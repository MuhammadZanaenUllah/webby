package agent

import (
	"context"
	"sync"
	"time"

	"webby-builder/internal/models"
	"webby-builder/internal/webhook"

	"github.com/sirupsen/logrus"
)

// Session represents an agent session
type Session struct {
	ID           string
	WorkspaceID  string
	Status       models.SessionStatus
	Iterations   int
	TokensUsed   int
	Error        string
	FilesChanged bool

	// Build state tracking
	buildSucceeded *bool  // nil = not run, true = success, false = failed
	buildMessage   string // Build output/error summary

	// Granular token tracking
	PromptTokens     int
	CompletionTokens int
	ContextTokens    int // Estimated tokens in current context

	// Per-run token tracking (reset on each continuation)
	runTokensUsed       int
	runPromptTokens     int
	runCompletionTokens int

	config               *models.RequestConfig
	features             models.FeatureFlags
	streamer             webhook.Streamer
	cancel               context.CancelFunc
	workspacePath        string
	templateURL          string
	laravelURL           string
	selectedTemplate     string
	selectedTemplateName string
	webhookURL           string

	mu           sync.RWMutex
	createdAt    time.Time
	lastActivity time.Time

	// Workspace-specific logger (optional, for debug mode)
	logger     *logrus.Logger
	logCleanup func()

	// Credit enforcement
	remainingCredits   int  // User's credit balance at session start (0 = unlimited)
	creditWarningFired bool // Track if 80% warning was already sent

	// Circuit breaker for failure handling
	circuitBreaker *CircuitBreaker

	// Project capabilities (Firebase, storage, etc.)
	projectCapabilities *models.ProjectCapabilities

	// Theme preset (colors)
	themePreset *models.ThemePreset

	// Custom system prompts (admin-editable)
	customPrompts *models.CustomPrompts
}

// NewSession creates a new session with webhook notifier
func NewSession(id, workspaceID, workspacePath, webhookURL, serverKey string, cfg *models.RequestConfig) *Session {
	return &Session{
		ID:             id,
		WorkspaceID:    workspaceID,
		Status:         models.StatusPending,
		config:         cfg,
		features:       models.DefaultFeatureFlags(),
		streamer:       webhook.NewNotifier(webhookURL, serverKey, id),
		workspacePath:  workspacePath,
		webhookURL:     webhookURL,
		createdAt:      time.Now(),
		lastActivity:   time.Now(),
		circuitBreaker: NewCircuitBreaker(),
	}
}

// NewSessionWithStreamer creates a new session with a pre-built streamer
// Use this when you want to provide a custom streamer (e.g., HybridStreamer with Pusher)
func NewSessionWithStreamer(id, workspaceID, workspacePath, webhookURL string, cfg *models.RequestConfig, streamer webhook.Streamer) *Session {
	return &Session{
		ID:             id,
		WorkspaceID:    workspaceID,
		Status:         models.StatusPending,
		config:         cfg,
		features:       models.DefaultFeatureFlags(),
		streamer:       streamer,
		workspacePath:  workspacePath,
		webhookURL:     webhookURL,
		createdAt:      time.Now(),
		lastActivity:   time.Now(),
		circuitBreaker: NewCircuitBreaker(),
	}
}

// SetFeatures sets the feature flags for this session
func (s *Session) SetFeatures(features models.FeatureFlags) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.features = features
}

// GetFeatures returns the feature flags for this session
func (s *Session) GetFeatures() models.FeatureFlags {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.features
}

// SetCancel sets the cancel function for the session
func (s *Session) SetCancel(cancel context.CancelFunc) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.cancel = cancel
}

// Cancel cancels the session
func (s *Session) Cancel() {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.cancel != nil {
		s.cancel()
		s.Status = models.StatusCancelled
	}
}

// GetStreamer returns the webhook streamer
func (s *Session) GetStreamer() webhook.Streamer {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.streamer
}

// SetStatus sets the session status
func (s *Session) SetStatus(status models.SessionStatus) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.Status = status
	s.lastActivity = time.Now()
}

// GetStatus returns the current status
func (s *Session) GetStatus() models.SessionStatus {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.Status
}

// SetError sets an error message
func (s *Session) SetError(err string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.Error = err
	s.Status = models.StatusFailed
}

// IncrementIterations increments the iteration count
func (s *Session) IncrementIterations() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.Iterations++
	s.lastActivity = time.Now()
}

// AddTokens adds to the token count
func (s *Session) AddTokens(tokens int) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.TokensUsed += tokens
	s.runTokensUsed += tokens
}

// UpdateTokens updates all token tracking fields
func (s *Session) UpdateTokens(prompt, completion, total int) {
	s.mu.Lock()
	defer s.mu.Unlock()
	// Cumulative totals (for billing/stats sent to Laravel)
	s.PromptTokens += prompt
	s.CompletionTokens += completion
	s.TokensUsed += total
	// Per-run totals (for credit enforcement)
	s.runPromptTokens += prompt
	s.runCompletionTokens += completion
	s.runTokensUsed += total
}

// SetContextTokens sets the estimated context tokens
func (s *Session) SetContextTokens(tokens int) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.ContextTokens = tokens
}

// GetContextTokens returns the current context token estimate
func (s *Session) GetContextTokens() int {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.ContextTokens
}

// GetTokenStats returns all token statistics
func (s *Session) GetTokenStats() (prompt, completion, total, context int) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.PromptTokens, s.CompletionTokens, s.TokensUsed, s.ContextTokens
}

// GetRunTokenStats returns token statistics for the current run only
func (s *Session) GetRunTokenStats() (prompt, completion, total int) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.runPromptTokens, s.runCompletionTokens, s.runTokensUsed
}

// SetFilesChanged marks that files have been changed
func (s *Session) SetFilesChanged(changed bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.FilesChanged = changed
}

// GetFilesChanged returns whether files have been changed
func (s *Session) GetFilesChanged() bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.FilesChanged
}

// SetBuildResult records the result of a verifyBuild call
func (s *Session) SetBuildResult(success bool, message string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.buildSucceeded = &success
	s.buildMessage = message
}

// GetBuildStatus returns the build status: "not_run", "success", or "failed"
func (s *Session) GetBuildStatus() string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if s.buildSucceeded == nil {
		return "not_run"
	}
	if *s.buildSucceeded {
		return "success"
	}
	return "failed"
}

// GetBuildMessage returns the build message
func (s *Session) GetBuildMessage() string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.buildMessage
}

// IsBuildRequired returns true if build should be run (files changed but no successful build)
func (s *Session) IsBuildRequired() bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.FilesChanged && (s.buildSucceeded == nil || !*s.buildSucceeded)
}

// GetConfig returns the session configuration
func (s *Session) GetConfig() *models.RequestConfig {
	return s.config
}

// SetConfig updates the session configuration
func (s *Session) SetConfig(cfg *models.RequestConfig) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.config = cfg
}

// GetWorkspacePath returns the workspace path
func (s *Session) GetWorkspacePath() string {
	return s.workspacePath
}

// SetTemplateURL sets the template URL
func (s *Session) SetTemplateURL(url string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.templateURL = url
}

// GetTemplateURL returns the template URL
func (s *Session) GetTemplateURL() string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.templateURL
}

// SetLaravelURL sets the Laravel API URL
func (s *Session) SetLaravelURL(url string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.laravelURL = url
}

// GetLaravelURL returns the Laravel API URL
func (s *Session) GetLaravelURL() string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.laravelURL
}

// SetSelectedTemplate sets the selected template ID and optional name
func (s *Session) SetSelectedTemplate(templateID, templateName string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.selectedTemplate = templateID
	s.selectedTemplateName = templateName
}

// GetSelectedTemplate returns the selected template ID
func (s *Session) GetSelectedTemplate() string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.selectedTemplate
}

// GetSelectedTemplateName returns the selected template name (human-readable)
func (s *Session) GetSelectedTemplateName() string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.selectedTemplateName
}

// GetWebhookURL returns the webhook URL
func (s *Session) GetWebhookURL() string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.webhookURL
}

// SetLogger sets the workspace-specific logger
func (s *Session) SetLogger(logger *logrus.Logger, cleanup func()) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.logger = logger
	s.logCleanup = cleanup
}

// GetLogger returns the workspace logger (or nil if not set)
func (s *Session) GetLogger() *logrus.Logger {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.logger
}

// Close closes the session and its streamer. Safe to call multiple times.
func (s *Session) Close() {
	s.mu.Lock()
	if s.streamer != nil {
		s.streamer.Close()
		s.streamer = nil // Prevent double-close
	}
	cleanup := s.logCleanup
	s.logCleanup = nil // Prevent double-cleanup
	s.mu.Unlock()

	// Call cleanup outside lock with recover protection
	if cleanup != nil {
		func() {
			defer func() {
				_ = recover() // Silently recover - cleanup failure shouldn't crash
			}()
			cleanup()
		}()
	}
}

// IsActive returns true if the session is still active
func (s *Session) IsActive() bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.Status == models.StatusPending || s.Status == models.StatusRunning
}

// GetStats returns session statistics
func (s *Session) GetStats() map[string]interface{} {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return map[string]interface{}{
		"session_id":    s.ID,
		"workspace_id":  s.WorkspaceID,
		"status":        s.Status,
		"iterations":    s.Iterations,
		"tokens_used":   s.TokensUsed,
		"files_changed": s.FilesChanged,
		"error":         s.Error,
		"created_at":    s.createdAt,
		"last_activity": s.lastActivity,
	}
}

// CanContinue returns true if the session can accept new messages
func (s *Session) CanContinue() bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	// Can continue if session is completed (not running, pending, failed, or cancelled)
	return s.Status == models.StatusCompleted
}

// ResetForContinuation resets the session state for a new run continuation
func (s *Session) ResetForContinuation() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.Status = models.StatusPending
	s.Error = ""
	s.lastActivity = time.Now()
	// Reset circuit breaker for new conversation turn
	s.circuitBreaker = NewCircuitBreaker()
	// Reset per-run token tracking for credit enforcement
	s.runTokensUsed = 0
	s.runPromptTokens = 0
	s.runCompletionTokens = 0
	// Allow warning to fire again for this new run
	s.creditWarningFired = false
	// Reset file change and build state so continuation runs start clean
	s.FilesChanged = false
	s.buildSucceeded = nil
	s.buildMessage = ""
	// Note: We keep TokensUsed, PromptTokens, CompletionTokens for cumulative billing
}

// ReinitializeStreamer creates a new streamer for the session
// This is needed when continuing a conversation to reset webhook state
func (s *Session) ReinitializeStreamer(streamer webhook.Streamer) {
	s.mu.Lock()
	defer s.mu.Unlock()
	// Close old streamer
	if s.streamer != nil {
		s.streamer.Close()
	}
	s.streamer = streamer
}

// SetRemainingCredits sets the user's credit balance for this session
// 0 = unlimited (user has own API key or unlimited plan)
func (s *Session) SetRemainingCredits(credits int) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.remainingCredits = credits
}

// GetRemainingCredits returns the credit limit for this session
func (s *Session) GetRemainingCredits() int {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.remainingCredits
}

// CheckCredits checks if the session has exceeded its credit limit
// Returns the percent used and whether credits are exceeded
// If remainingCredits is 0, this always returns (0, false) - unlimited
func (s *Session) CheckCredits() (percentUsed float64, exceeded bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if s.remainingCredits == 0 {
		return 0, false // Unlimited credits
	}

	// Use per-run tokens for credit enforcement (not cumulative)
	percentUsed = float64(s.runTokensUsed) / float64(s.remainingCredits) * 100
	exceeded = s.runTokensUsed >= s.remainingCredits
	return percentUsed, exceeded
}

// ShouldWarnCredits returns true once when usage reaches 80%
// Subsequent calls return false (warning already fired)
func (s *Session) ShouldWarnCredits() bool {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.remainingCredits == 0 {
		return false // Unlimited credits, no warning needed
	}

	if s.creditWarningFired {
		return false // Already warned
	}

	// Use per-run tokens for credit enforcement
	percentUsed := float64(s.runTokensUsed) / float64(s.remainingCredits) * 100
	if percentUsed >= 80 {
		s.creditWarningFired = true
		return true
	}

	return false
}

// GetCircuitBreaker returns the session's circuit breaker
func (s *Session) GetCircuitBreaker() *CircuitBreaker {
	return s.circuitBreaker
}

// SetCircuitBreakerForModel replaces the circuit breaker with model-appropriate thresholds
func (s *Session) SetCircuitBreakerForModel(providerType, model string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.circuitBreaker = NewCircuitBreakerForModel(providerType, model)
}

// SetProjectCapabilities sets the project capabilities for this session
func (s *Session) SetProjectCapabilities(caps models.ProjectCapabilities) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.projectCapabilities = &caps
}

// GetProjectCapabilities returns the project capabilities
func (s *Session) GetProjectCapabilities() *models.ProjectCapabilities {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.projectCapabilities
}

// SetThemePreset sets the theme preset for this session
func (s *Session) SetThemePreset(preset models.ThemePreset) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.themePreset = &preset
}

// GetThemePreset returns the theme preset
func (s *Session) GetThemePreset() *models.ThemePreset {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.themePreset
}

// SetCustomPrompts stores admin-editable system prompts on the session
func (s *Session) SetCustomPrompts(p *models.CustomPrompts) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.customPrompts = p
}

// GetCustomPrompts returns the admin-editable system prompts
func (s *Session) GetCustomPrompts() *models.CustomPrompts {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.customPrompts
}
