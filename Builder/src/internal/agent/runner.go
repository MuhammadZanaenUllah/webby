package agent

import (
	"context"
	"encoding/json"
	"fmt"
	"math/rand"
	"os"
	"path/filepath"
	"strings"
	"time"

	"webby-builder/internal/client"
	"webby-builder/internal/client/laravel"
	"webby-builder/internal/executor"
	"webby-builder/internal/logging"
	"webby-builder/internal/models"
	"webby-builder/internal/summarizer"

	"github.com/sirupsen/logrus"
)

// FactoryImport is a type alias to avoid import issues
type Factory = client.Factory

// Fun phrase pools for action messages
var createPhrases = []string{
	"Laying the bricks for",
	"Conjuring",
	"Cooking up",
	"Crafting",
	"Bringing to life",
	"Building",
	"Weaving",
	"Whipping up",
}

var editPhrases = []string{
	"Polishing",
	"Sprinkling magic on",
	"Fine-tuning",
	"Adding sparkle to",
	"Seasoning",
	"Touching up",
}

var readPhrases = []string{
	"Studying",
	"Checking the blueprints in",
	"Peeking at",
	"Consulting",
	"Scanning",
}

var explorePhrases = []string{
	"Surveying the land",
	"Getting the lay of the land",
	"Mapping things out",
	"Scouting the project",
}

// randomPhrase returns a random phrase from the given pool
func randomPhrase(phrases []string) string {
	return phrases[rand.Intn(len(phrases))]
}

// formatProjectCapabilities formats project capabilities as JSON for tool result
func formatProjectCapabilities(caps *models.ProjectCapabilities) string {
	var firebase, storage string

	if caps.Firebase != nil {
		firebase = fmt.Sprintf(`"firebase":{"enabled":%t,"collection_prefix":"%s"}`,
			caps.Firebase.Enabled, caps.Firebase.CollectionPrefix)
	} else {
		firebase = `"firebase":{"enabled":false,"collection_prefix":""}`
	}

	if caps.Storage != nil {
		storage = fmt.Sprintf(`"storage":{"enabled":%t,"max_file_size_mb":%d}`,
			caps.Storage.Enabled, caps.Storage.MaxFileSizeMB)
	} else {
		storage = `"storage":{"enabled":false,"max_file_size_mb":0}`
	}

	return fmt.Sprintf("{%s,%s}", firebase, storage)
}

// handleGetFirestoreCollections fetches Firestore collections from Laravel
func (r *Runner) handleGetFirestoreCollections(ctx context.Context, session *Session) string {
	// Check if Firebase is enabled via capabilities
	caps := session.GetProjectCapabilities()
	if caps == nil || caps.Firebase == nil || !caps.Firebase.Enabled {
		return `{"success":false,"error":"firebase_not_enabled","message":"Firebase is not enabled for this project.","collections":[]}`
	}

	// Get Laravel URL from session
	laravelURL := session.GetLaravelURL()
	if laravelURL == "" {
		return `{"success":false,"error":"configuration_error","message":"Laravel URL not configured.","collections":[]}`
	}

	// Get server key from executor
	serverKey := r.executor.GetServerKey()
	if serverKey == "" {
		return `{"success":false,"error":"configuration_error","message":"Server key not configured.","collections":[]}`
	}

	// Create client and fetch collections
	client := laravel.NewClient(laravelURL, serverKey)

	// Use workspace ID as project ID (they map 1:1)
	resp, err := client.GetFirestoreCollections(ctx, session.WorkspaceID)
	if err != nil {
		r.logger.WithFields(logrus.Fields{
			"session_id": session.ID,
			"project_id": session.WorkspaceID,
			"error":      err.Error(),
		}).Warn("Failed to fetch Firestore collections")

		return fmt.Sprintf(`{"success":false,"error":"api_error","message":"Failed to fetch collections: %s","collections":[]}`, err.Error())
	}

	// Return JSON response
	jsonBytes, err := json.Marshal(resp)
	if err != nil {
		return `{"success":false,"error":"encoding_error","message":"Failed to encode response","collections":[]}`
	}

	return string(jsonBytes)
}

// HistoryMsg represents a message in conversation history
type HistoryMsg struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// HistoryInput wraps history with metadata for the runner
type HistoryInput struct {
	Messages    []HistoryMsg
	IsCompacted bool // If true, skip summarization (history already compacted)
}

// Runner executes the agent loop
type Runner struct {
	executor        *executor.Executor
	aiConfig        models.ProviderConfig
	summarizer      *summarizer.Summarizer
	logger          *logrus.Logger
	providerFactory *Factory
}

// NewRunner creates a new runner with configuration
func NewRunner(workspacePath, templatePath string, agentCfg, summarizerCfg models.ProviderConfig, logger *logrus.Logger, toolConfig models.ToolExecutionConfig) *Runner {
	return &Runner{
		executor:        executor.NewExecutor(workspacePath, logger, toolConfig),
		aiConfig:        agentCfg,
		summarizer:      summarizer.NewSummarizerWithConfig(summarizerCfg),
		logger:          logger,
		providerFactory: client.NewFactory(logger, models.DefaultRetryConfig(), nil),
	}
}

// NewRunnerWithTemplate creates a new runner with template fetching support
func NewRunnerWithTemplate(workspacePath, templatePath string, agentCfg, summarizerCfg models.ProviderConfig, logger *logrus.Logger, serverKey, laravelURL string, toolConfig models.ToolExecutionConfig) *Runner {
	return &Runner{
		executor:        executor.NewExecutorWithTemplate(workspacePath, serverKey, laravelURL, logger, toolConfig),
		aiConfig:        agentCfg,
		summarizer:      summarizer.NewSummarizerWithConfig(summarizerCfg),
		logger:          logger,
		providerFactory: client.NewFactory(logger, models.DefaultRetryConfig(), nil),
	}
}

// loadTemplatePrompts reads template.json from workspace and extracts prompt sections
func (r *Runner) loadTemplatePrompts(workspacePath string) *models.TemplatePrompts {
	templatePath := filepath.Join(workspacePath, "template.json")

	data, err := os.ReadFile(templatePath)
	if err != nil {
		r.logger.WithFields(logrus.Fields{
			"path": templatePath,
		}).Debug("No template.json found, using default prompts")
		return nil
	}

	var metadata models.TemplateMetadata
	if err := json.Unmarshal(data, &metadata); err != nil {
		r.logger.WithFields(logrus.Fields{
			"path":  templatePath,
			"error": err.Error(),
		}).Warn("Failed to parse template.json for prompts")
		return nil
	}

	if metadata.Prompts != nil {
		r.logger.WithFields(logrus.Fields{
			"prompt_count": len(metadata.Prompts.Prompts),
		}).Debug("Loaded template prompts")
	}

	return metadata.Prompts
}

// loadTemplateMetadata reads template.json from workspace and returns the full metadata.
// Returns nil if template.json doesn't exist or is invalid (graceful fallback).
func (r *Runner) loadTemplateMetadata(workspacePath string) *models.TemplateMetadata {
	templatePath := filepath.Join(workspacePath, "template.json")

	data, err := os.ReadFile(templatePath)
	if err != nil {
		return nil
	}

	var metadata models.TemplateMetadata
	if err := json.Unmarshal(data, &metadata); err != nil {
		r.logger.WithFields(logrus.Fields{
			"path":  templatePath,
			"error": err.Error(),
		}).Warn("Failed to parse template.json for metadata")
		return nil
	}

	r.logger.WithFields(logrus.Fields{
		"template_name": metadata.Name,
		"pages":         len(metadata.AvailablePages),
	}).Debug("Loaded template metadata")

	return &metadata
}

// getToolRecoveryGuidance returns specific recovery steps for a failed tool
func getToolRecoveryGuidance(toolName string) string {
	switch toolName {
	case "editFile":
		return `RECOVERY STEPS:
1. Use readFile to see the CURRENT file content (it may have changed since you last read it)
2. Copy the EXACT text you want to replace, including all whitespace and newlines
3. If the text doesn't exist anymore, use searchFiles to find where it moved
4. For changes affecting >20 lines, consider using createFile instead
5. If this file has failed multiple edits, use createFile to rewrite it completely`
	case "createFile":
		return `RECOVERY STEPS:
1. Read the error message - look for the specific line/column with the syntax issue
2. Check for: missing closing brackets }, unclosed JSX tags </>, unmatched quotes
3. Verify all imports reference files that actually exist
4. Ensure there's exactly ONE default export
5. Use diffPreview first to see what would change`
	case "verifyBuild":
		return `RECOVERY STEPS:
1. Read the SPECIFIC file and line mentioned in the error using readFile
2. Common issues: missing imports, typos in component names, unclosed tags
3. Fix ONE error at a time, then rerun verifyBuild
4. Don't guess - always read the problematic code first before attempting a fix`
	case "verifyIntegration":
		return `RECOVERY STEPS:
1. Read src/routes.tsx to see current imports and routes
2. Ensure the page file exists in src/pages/
3. Check that the import path matches the actual file name (case-sensitive)
4. Verify the route entry has all required fields: path, label, element, showInNav, layout`
	default:
		return "Try a different approach, or use readFile to understand the current state before retrying."
	}
}

// Run executes the agent loop for a session
func (r *Runner) Run(ctx context.Context, session *Session, goal string, historyInput HistoryInput, maxIterations int) error {
	// Create cancellable context
	ctx, cancel := context.WithCancel(ctx)
	session.SetCancel(cancel)
	session.SetStatus(models.StatusRunning)

	streamer := session.GetStreamer()
	features := session.GetFeatures()

	// Pass theme preset to executor for application after useTemplate
	if preset := session.GetThemePreset(); preset != nil {
		r.executor.SetThemePreset(preset)
	}

	// Initialize credit enforcement from config
	if r.aiConfig.RemainingBuildCredits > 0 {
		session.SetRemainingCredits(r.aiConfig.RemainingBuildCredits)
		r.logger.WithFields(logrus.Fields{
			"session_id":        session.ID,
			"remaining_credits": r.aiConfig.RemainingBuildCredits,
		}).Info("Credit enforcement enabled")
	}

	// Log session start with visual separator
	logging.LogSessionStart(r.logger, session.ID, session.WorkspaceID, goal, maxIterations)

	defer func() {
		if session.GetStatus() == models.StatusRunning {
			session.SetStatus(models.StatusCompleted)
		}
		streamer.Close()
	}()

	// Create AI provider with retry config based on feature flags
	var provider models.AIProvider
	if features.RetryLLM {
		// Create retry callback to send events
		retryCallback := func(attempt, maxRetries int, delay time.Duration, err error) {
			reason := err.Error()
			if features.GranularEvents {
				streamer.SendRetry(attempt, maxRetries, delay.Milliseconds(), reason)
			}
			r.logger.WithFields(logrus.Fields{
				"session_id":  session.ID,
				"attempt":     attempt,
				"max_retries": maxRetries,
				"delay_ms":    delay.Milliseconds(),
				"reason":      reason,
			}).Debug("LLM retry")
		}
		// Create factory with retry callback
		retryFactory := client.NewFactory(r.logger, models.DefaultRetryConfig(), retryCallback)
		var err error
		provider, err = retryFactory.CreateProvider(r.aiConfig)
		if err != nil {
			return fmt.Errorf("failed to create AI provider: %w", err)
		}
	} else {
		var err error
		provider, err = r.providerFactory.CreateProvider(r.aiConfig)
		if err != nil {
			return fmt.Errorf("failed to create AI provider: %w", err)
		}
	}

	// Load template prompts and metadata from workspace (only if a template is already present)
	// When no template is pre-selected, the AI will call useTemplate during the agent loop,
	// so template.json won't exist yet — skip the unnecessary file read.
	var templatePrompts *models.TemplatePrompts
	var templateMetadata *models.TemplateMetadata
	if session.GetSelectedTemplate() != "" {
		templatePrompts = r.loadTemplatePrompts(r.executor.GetWorkspacePath())
		templateMetadata = r.loadTemplateMetadata(r.executor.GetWorkspacePath())
	}

	// Calculate token budget for the system prompt (reserve ~60% for history + response)
	tokenBudget := 0
	if r.aiConfig.ContextWindow > 0 {
		tokenBudget = int(float64(r.aiConfig.ContextWindow) * 0.4)
	}

	// Build system prompt with template injections
	promptCfg := PromptConfig{
		ProjectName:      "Project",
		WorkspacePath:    r.executor.GetWorkspacePath(),
		TemplatePrompts:  templatePrompts,
		TemplateMetadata: templateMetadata,
		Capabilities:     session.GetProjectCapabilities(),
		ThemePreset:      session.GetThemePreset(),
		Compact:          getModelTier(r.aiConfig.ProviderType, r.aiConfig.Model) == "standard",
		TokenBudget:      tokenBudget,
	}
	if customPrompts := session.GetCustomPrompts(); customPrompts != nil {
		promptCfg.CustomPrompt = customPrompts.SystemPrompt
		promptCfg.CustomCompactPrompt = customPrompts.CompactPrompt
	}
	systemPrompt, err := BuildSystemPrompt(promptCfg)
	if err != nil {
		session.SetError(err.Error())
		session.SetStatus(models.StatusFailed)
		return fmt.Errorf("building system prompt: %w", err)
	}

	// Initialize conversation with system prompt
	messages := []models.Message{
		{Role: "system", Content: systemPrompt},
	}

	// Process history
	history := historyInput.Messages
	if len(history) > 0 {
		if historyInput.IsCompacted {
			// Already compacted by Laravel - use directly without summarization
			r.logger.WithFields(logrus.Fields{
				"session_id":     session.ID,
				"history_length": len(history),
			}).Debug("Using pre-compacted history, skipping summarization")

			for _, h := range history {
				messages = append(messages, models.Message{
					Role:    h.Role,
					Content: h.Content,
				})
			}
		} else {
			// Not compacted - run through summarizer
			turns := make([]summarizer.Turn, len(history))
			for i, h := range history {
				turns[i] = summarizer.Turn{Role: h.Role, Content: h.Content}
			}

			// Send status BEFORE summarization to show animation during API call
			if len(turns) > r.summarizer.GetKeepRecent() {
				streamer.SendStatus("compacting", "Summarizing conversation history...")
			}

			// Process with summarization if needed
			state, err := r.summarizer.Process(ctx, turns)
			if err == nil {
				// Track summarization tokens for credit depletion
				if state.TotalTokens > 0 {
					session.UpdateTokens(state.PromptTokens, state.CompletionTokens, state.TotalTokens)
					r.logger.WithFields(logrus.Fields{
						"session_id":            session.ID,
						"summarizer_prompt":     state.PromptTokens,
						"summarizer_completion": state.CompletionTokens,
						"summarizer_total":      state.TotalTokens,
					}).Debug("Added summarization tokens to session")
				}

				// Build compacted history to send back to Laravel
				var compactedHistory []models.HistoryMessage

				// Add summary if generated
				if state.Summary != "" {
					// Add summary as assistant message for Laravel storage
					compactedHistory = append(compactedHistory, models.HistoryMessage{
						Role:    "assistant",
						Content: "[Previous conversation summary]\n" + state.Summary,
					})

					messages = append(messages, models.Message{
						Role:    "system",
						Content: "CONVERSATION HISTORY:\n" + state.Summary,
					})
				}

				// Add recent turns in full
				for _, t := range state.RecentTurns {
					compactedHistory = append(compactedHistory, models.HistoryMessage{
						Role:    t.Role,
						Content: t.Content,
					})
					messages = append(messages, models.Message{
						Role:    t.Role,
						Content: t.Content,
					})
				}

				// Send summarization complete event with compacted history
				if state.Summary != "" {
					oldTokens := summarizer.EstimateTokens(state.Summary)
					for _, t := range turns {
						oldTokens += summarizer.EstimateTokens(t.Content)
					}
					// Estimate new tokens: summary + recent turns
					newTokens := summarizer.EstimateTokens(state.Summary)
					for _, t := range state.RecentTurns {
						newTokens += summarizer.EstimateTokens(t.Content)
					}
					turnsCompacted := len(turns) - len(state.RecentTurns)
					reductionPct := float64(0)
					if oldTokens > 0 {
						reductionPct = float64(oldTokens-newTokens) / float64(oldTokens) * 100
					}
					streamer.SendSummarizationComplete(models.SummarizationEventData{
						OldTokens:        oldTokens,
						NewTokens:        newTokens,
						ReductionPercent: reductionPct,
						TurnsCompacted:   turnsCompacted,
						TurnsKept:        len(state.RecentTurns),
						Message:          fmt.Sprintf("Compressed %d turns into summary, keeping %d recent turns", turnsCompacted, len(state.RecentTurns)),
						CompactedHistory: compactedHistory,
					})
				}
			} else {
				// Log summarizer failure for debugging
				r.logger.WithFields(logrus.Fields{
					"session_id": session.ID,
					"error":      err.Error(),
					"turns":      len(turns),
				}).Warn("Summarizer failed, using truncated history fallback")

				// Fallback: just use last 20 messages
				historyLimit := 20
				startIdx := 0
				if len(history) > historyLimit {
					startIdx = len(history) - historyLimit
				}
				for _, h := range history[startIdx:] {
					messages = append(messages, models.Message{
						Role:    h.Role,
						Content: h.Content,
					})
				}
			}
		}
	}

	// Inject persistent context (survives conversation compaction)
	if memContent := loadSiteMemory(r.executor.GetWorkspacePath()); memContent != "" {
		messages = append(messages, models.Message{
			Role:    "system",
			Content: "[SITE MEMORY — business context from previous sessions]\n" + memContent,
		})
	}
	if diContent := loadDesignIntelligence(r.executor.GetWorkspacePath()); diContent != "" {
		messages = append(messages, models.Message{
			Role:    "system",
			Content: "[DESIGN INTELLIGENCE — design decisions from previous sessions]\n" + diContent,
		})
	}

	// Add current user message
	messages = append(messages, models.Message{
		Role:    "user",
		Content: goal,
	})

	tools := GetTools()

	// Send initial status
	streamer.SendStatus("running", "Let's build something awesome...")

	// Track last non-empty AI content for final message
	var lastAIContent string

	// Integration verification: track fix attempts and repeated errors to avoid infinite loop
	integrationFixAttempts := 0
	const maxIntegrationFixes = 2
	var lastIntegrationError string
	integrationFinalNotified := false // Flag to track if we've sent final notification about unresolved issues

	// Empty response nudge: when AI returns no content and no tool calls, nudge once for a final summary
	emptyResponseNudged := false

	// Set model-appropriate circuit breaker thresholds
	session.SetCircuitBreakerForModel(r.aiConfig.ProviderType, r.aiConfig.Model)
	circuitBreaker := session.GetCircuitBreaker()

	// Main agent loop - use local counter to allow continuation after reaching max_iterations
	// session.Iterations tracks cumulative count for billing/stats, but shouldn't block new runs
	iterationsRun := 0
	for iterationsRun < maxIterations {
		select {
		case <-ctx.Done():
			session.SetStatus(models.StatusCancelled)
			streamer.SendStatus("cancelled", "Agent cancelled")
			return ctx.Err()
		default:
		}

		iterationsRun++      // Track iterations for this run
		session.Iterations++ // Track cumulative iterations for billing

		// Send iteration_start event if granular events enabled
		if features.GranularEvents {
			streamer.SendIterationStart(iterationsRun, maxIterations)
		}

		// Log before AI call
		r.logger.WithFields(logrus.Fields{
			"session_id": session.ID,
			"iteration":  iterationsRun,
			"model":      r.aiConfig.Model,
			"messages":   len(messages),
		}).Debug("Calling AI provider")

		// Send thinking event at start to begin frontend timer
		streamer.SendThinking("", iterationsRun)

		// Call AI
		response, err := provider.Chat(ctx, messages, tools)
		if err != nil {
			// Check if this is a user-initiated cancellation (works for all providers)
			// errors.Is() traverses wrapped errors, so "openai error: context canceled" is detected
			if models.IsCancelled(err) {
				session.SetStatus(models.StatusCancelled)
				streamer.SendStatus("cancelled", "Build stopped")
				r.logger.WithFields(logrus.Fields{
					"session_id": session.ID,
					"iteration":  iterationsRun,
				}).Info("Session cancelled by user")
				return ctx.Err()
			}

			// Real error - handle as before
			session.SetStatus(models.StatusFailed)
			session.Error = err.Error()
			streamer.SendStatus("failed", "AI provider error: "+err.Error())
			streamer.SendError(err.Error())
			r.logger.WithFields(logrus.Fields{
				"session_id": session.ID,
				"iteration":  iterationsRun,
				"error":      err.Error(),
			}).Error("AI provider error")
			return fmt.Errorf("AI error: %w", err)
		}

		session.UpdateTokens(response.PromptTokens, response.CompletionTokens, response.TokensUsed)

		// Send token_usage event if granular events enabled
		if features.GranularEvents {
			prompt, completion, total, context := session.GetTokenStats()
			streamer.SendTokenUsage(prompt, completion, total, context)
		}

		// Credit enforcement checks
		if session.ShouldWarnCredits() {
			percentUsed, _ := session.CheckCredits()
			_, _, runTotal := session.GetRunTokenStats()
			creditData := models.CreditEventData{
				UsedTokens:       runTotal, // Per-run tokens
				RemainingCredits: session.GetRemainingCredits() - runTotal,
				PercentUsed:      percentUsed,
				Message:          "You have used 80% of your build credits for this session. The session will complete the current task and then stop.",
			}
			streamer.SendCreditWarning(creditData)
			r.logger.WithFields(logrus.Fields{
				"session_id":        session.ID,
				"percent_used":      percentUsed,
				"run_tokens_used":   runTotal,
				"total_tokens_used": session.TokensUsed,
			}).Warn("Credit warning threshold reached")
		}

		// Check if credits exceeded - graceful exit
		percentUsed, exceeded := session.CheckCredits()
		if exceeded {
			_, _, runTotal := session.GetRunTokenStats()
			creditData := models.CreditEventData{
				UsedTokens:       runTotal, // Per-run tokens
				RemainingCredits: 0,
				PercentUsed:      percentUsed,
				Message:          "Build credit limit reached. Session is stopping gracefully.",
			}
			streamer.SendCreditExceeded(creditData)
			streamer.SendStatus("credit_limit", "Build credit limit reached")
			r.logger.WithFields(logrus.Fields{
				"session_id":        session.ID,
				"run_tokens_used":   runTotal,
				"total_tokens_used": session.TokensUsed,
				"limit":             session.GetRemainingCredits(),
			}).Warn("Credit limit exceeded, stopping session")

			// Send completion with credit exceeded message
			hasChanges := r.executor.HasFileChanges() || session.GetFilesChanged()
			session.SetFilesChanged(hasChanges)
			session.SetStatus(models.StatusCompleted)
			completeData := models.CompleteData{
				Iterations:       iterationsRun,
				TokensUsed:       session.TokensUsed,
				FilesChanged:     hasChanges,
				Message:          "Build credit limit reached. Please upgrade your plan or wait for credits to reset.",
				BuildStatus:      session.GetBuildStatus(),
				BuildMessage:     session.GetBuildMessage(),
				BuildRequired:    session.IsBuildRequired(),
				PromptTokens:     session.PromptTokens,
				CompletionTokens: session.CompletionTokens,
				Model:            r.aiConfig.Model,
			}
			streamer.SendComplete(completeData)
			return nil
		}

		// Log AI response
		r.logger.WithFields(logrus.Fields{
			"session_id":  session.ID,
			"iteration":   iterationsRun,
			"tokens":      response.TokensUsed,
			"tool_calls":  len(response.ToolCalls),
			"stop_reason": response.StopReason,
		}).Debug("Received AI response")

		// Stream thinking/content and track last response
		if response.Content != "" {
			// Send thinking event
			streamer.SendThinking(response.Content, iterationsRun)
			lastAIContent = response.Content // Track for final message

			// Send substantial AI content as message event for real-time display
			if len(response.Content) > 100 {
				streamer.SendMessage(response.Content)
			}

			// Log AI content (truncated)
			r.logger.WithFields(logrus.Fields{
				"session_id": session.ID,
				"content":    logging.TruncateForLog(response.Content, 500),
			}).Debug("AI response content")
		}

		// Check if done (no tool calls)
		if len(response.ToolCalls) == 0 {
			// If AI returned an empty response (no content, no tool calls), nudge it once
			// to provide a final summary. This happens when AI templates already satisfy the
			// goal and the AI has nothing to change but also doesn't send a closing message.
			if response.Content == "" && !emptyResponseNudged {
				emptyResponseNudged = true
				r.logger.WithFields(logrus.Fields{
					"session_id": session.ID,
					"iteration":  iterationsRun,
				}).Debug("AI returned empty response, nudging for final summary")

				messages = append(messages, models.Message{
					Role:    "user",
					Content: "Please provide a brief summary of what has been set up and what the user can do next. Describe the key features and pages included in the project.",
				})
				continue
			}

			// Before completing, scan src/pages/ for unregistered pages
			// Skip if we've already sent final notification about unresolved issues
			if !integrationFinalNotified && integrationFixAttempts < maxIntegrationFixes {
				pageFiles := scanPageFiles(r.executor.GetWorkspacePath())
				if len(pageFiles) > 0 {
					streamer.SendStatus("verifying", "Checking page integration...")

					filesArg := make([]interface{}, len(pageFiles))
					for i, p := range pageFiles {
						filesArg[i] = p
					}

					verifyResult, err := r.executor.Execute(ctx, "verifyIntegration", map[string]interface{}{
						"files": filesArg,
					})
					if err == nil && !verifyResult.Success {
						// Check if this is the same error as last time (avoid infinite loop on same issue)
						currentError := verifyResult.Content
						if currentError == lastIntegrationError {
							r.logger.WithFields(logrus.Fields{
								"session_id": session.ID,
							}).Warn("Same integration error twice in a row, giving up on auto-fix")

							// Notify AI about unresolved issues before completing
							finalMsg := fmt.Sprintf(
								"⚠️ INTEGRATION ISSUES REMAIN (same error repeated):\n\n%s\n\nPlease inform the user about these unresolved integration issues in your final response.",
								currentError,
							)
							messages = append(messages, models.Message{
								Role:    "system",
								Content: finalMsg,
							})
							integrationFinalNotified = true
							continue // Let AI respond about the issues
						}
						lastIntegrationError = currentError

						integrationFixAttempts++
						if integrationFixAttempts >= maxIntegrationFixes {
							r.logger.WithFields(logrus.Fields{
								"session_id": session.ID,
								"attempt":    integrationFixAttempts,
							}).Warn("Max integration fix attempts reached")

							// Notify AI about unresolved issues before completing
							finalMsg := fmt.Sprintf(
								"⚠️ INTEGRATION ISSUES REMAIN after %d fix attempts:\n\n%s\n\nPlease inform the user about these unresolved integration issues in your final response.",
								integrationFixAttempts, verifyResult.Content,
							)
							messages = append(messages, models.Message{
								Role:    "system",
								Content: finalMsg,
							})
							integrationFinalNotified = true
							continue // Let AI respond about the issues
						}

						r.logger.WithFields(logrus.Fields{
							"session_id": session.ID,
							"attempt":    integrationFixAttempts,
						}).Info("Integration issues found, re-entering loop to fix")

						fixPrompt := fmt.Sprintf(
							"⚠️ INTEGRATION ISSUES DETECTED:\n\n%s\n\nYou MUST fix these integration issues before completing the task. Edit src/routes.tsx to import and register all pages. Do NOT tell the user the task is complete until all pages are routed.",
							verifyResult.Content,
						)
						messages = append(messages, models.Message{
							Role:    "user",
							Content: fixPrompt,
						})

						streamer.SendMessage("I found some integration issues. Let me fix those...")
						streamer.SendStatus("fixing", "Fixing integration issues...")
						continue
					}
				}
			}

			// No integration issues (or max fix attempts reached), we're done
			streamer.SendStatus("completing", "Almost there...")
			break
		}

		// Build batch of tool call requests and stream events
		batchRequests := make([]executor.ToolCallRequest, 0, len(response.ToolCalls))

		// Pre-computed results for session-level tools (not handled by executor)
		sessionToolResults := make(map[string]executor.ToolResult)

		for _, toolCall := range response.ToolCalls {
			// Handle getProjectCapabilities specially (needs session access)
			if toolCall.Name == "getProjectCapabilities" {
				caps := session.GetProjectCapabilities()
				var content string
				if caps == nil {
					content = `{"firebase":{"enabled":false,"collection_prefix":""},"storage":{"enabled":false,"max_file_size_mb":0},"message":"No project capabilities configured."}`
				} else {
					content = formatProjectCapabilities(caps)
				}

				// Log session-level tool execution
				r.logger.WithFields(logrus.Fields{
					"session_id":  session.ID,
					"tool":        toolCall.Name,
					"caps_is_nil": caps == nil,
					"content":     content,
				}).Debug("Session-level tool: getProjectCapabilities")

				sessionToolResults[toolCall.ID] = executor.ToolResult{
					ToolCallID: toolCall.ID,
					Success:    true,
					Content:    content,
				}
				// Still stream the tool call event
				streamer.SendToolCall(toolCall.ID, toolCall.Name, toolCall.Arguments)
				action, target, category := getActionDescription(toolCall.Name, toolCall.Arguments)
				streamer.SendAction(action, target, "", category)
				// Stream the result immediately
				streamer.SendToolResult(toolCall.ID, toolCall.Name, true, content, 0, iterationsRun)
				continue
			}

			// Handle getFirestoreCollections specially (needs session + Laravel API)
			if toolCall.Name == "getFirestoreCollections" {
				content := r.handleGetFirestoreCollections(ctx, session)

				r.logger.WithFields(logrus.Fields{
					"session_id": session.ID,
					"tool":       toolCall.Name,
				}).Debug("Session-level tool: getFirestoreCollections")

				sessionToolResults[toolCall.ID] = executor.ToolResult{
					ToolCallID: toolCall.ID,
					Success:    true,
					Content:    content,
				}
				streamer.SendToolCall(toolCall.ID, toolCall.Name, toolCall.Arguments)
				action, target, category := getActionDescription(toolCall.Name, toolCall.Arguments)
				streamer.SendAction(action, target, "", category)
				streamer.SendToolResult(toolCall.ID, toolCall.Name, true, content, 0, iterationsRun)
				continue
			}

			// Stream tool call event
			streamer.SendToolCall(toolCall.ID, toolCall.Name, toolCall.Arguments)

			// Special handling for createPlan - send structured plan event
			if toolCall.Name == "createPlan" {
				summary, _ := toolCall.Arguments["summary"].(string)
				stepsArray, _ := toolCall.Arguments["steps"].([]interface{})

				var steps []models.PlanStep
				for _, stepInterface := range stepsArray {
					if step, ok := stepInterface.(map[string]interface{}); ok {
						steps = append(steps, models.PlanStep{
							File:        step["file"].(string),
							Action:      step["action"].(string),
							Description: step["description"].(string),
						})
					}
				}

				var deps, risks []string
				if depsRaw, ok := toolCall.Arguments["dependencies"].([]interface{}); ok {
					for _, dep := range depsRaw {
						if s, ok := dep.(string); ok {
							deps = append(deps, s)
						}
					}
				}
				if risksRaw, ok := toolCall.Arguments["risks"].([]interface{}); ok {
					for _, risk := range risksRaw {
						if r, ok := risk.(string); ok {
							risks = append(risks, r)
						}
					}
				}

				streamer.SendPlan(summary, steps, deps, risks)
			}

			// Send human-friendly action event
			action, target, category := getActionDescription(toolCall.Name, toolCall.Arguments)
			streamer.SendAction(action, target, "", category)

			// Log tool arguments
			r.logger.WithFields(logrus.Fields{
				"session_id": session.ID,
				"tool":       toolCall.Name,
				"args":       logging.FormatArgsForLog(toolCall.Arguments, 200),
			}).Debug("Tool arguments")

			// Add to batch
			batchRequests = append(batchRequests, executor.ToolCallRequest{
				ID:        toolCall.ID,
				Name:      toolCall.Name,
				Arguments: toolCall.Arguments,
			})
		}

		// Log batch execution start
		readOnlyCount := 0
		writeCount := 0
		for _, req := range batchRequests {
			if executor.IsReadOnly(req.Name) {
				readOnlyCount++
			} else {
				writeCount++
			}
		}
		r.logger.WithFields(logrus.Fields{
			"session_id":      session.ID,
			"total_tools":     len(batchRequests),
			"read_only_tools": readOnlyCount,
			"write_tools":     writeCount,
			"parallel":        features.ParallelTools,
		}).Debug("Executing tool batch")

		// Execute tools (batch/parallel or sequential based on feature flag)
		var toolResults []executor.ToolResult
		if features.ParallelTools {
			// Parallel execution for read-only tools, sequential for write tools
			toolResults = r.executor.ExecuteBatch(ctx, batchRequests)
		} else {
			// Sequential execution for all tools
			toolResults = make([]executor.ToolResult, len(batchRequests))
			for i, req := range batchRequests {
				result, err := r.executor.Execute(ctx, req.Name, req.Arguments)
				if err != nil {
					toolResults[i] = executor.ToolResult{
						ToolCallID: req.ID,
						Success:    false,
						Content:    fmt.Sprintf("Error: %s", err.Error()),
					}
				} else {
					result.ToolCallID = req.ID
					toolResults[i] = *result
				}
			}
		}

		// Stream results in original order
		for i, result := range toolResults {
			toolName := response.ToolCalls[i].Name

			// Log tool result
			r.logger.WithFields(logrus.Fields{
				"session_id": session.ID,
				"tool":       toolName,
				"success":    result.Success,
			}).Debug("Tool completed")

			// Stream tool result
			streamer.SendToolResult(
				result.ToolCallID,
				toolName,
				result.Success,
				truncateOutput(result.Content, 1500),
				result.DurationMs,
				iterationsRun,
			)

			// Track build results from verifyBuild calls
			if toolName == "verifyBuild" {
				success := result.Success
				var message string
				if !success {
					message = result.Content
				} else {
					message = "Build succeeded"
				}
				session.SetBuildResult(success, message)
			}
		}

		// Circuit breaker: detect repeated failures and prevent infinite loops
		var shouldExit bool
		for i, result := range toolResults {
			toolName := response.ToolCalls[i].Name
			filePath, _ := response.ToolCalls[i].Arguments["path"].(string)
			if !result.Success {
				action := circuitBreaker.RecordFileFailure(toolName, filePath, result.Content)
				switch action {
				case ActionGracefulExit:
					// Too many failures - stop the session gracefully
					r.logger.WithFields(logrus.Fields{
						"session_id": session.ID,
						"tool":       toolName,
						"stats":      circuitBreaker.GetStats(),
					}).Warn("Circuit breaker: forcing graceful exit")
					shouldExit = true

				case ActionInjectGuidance:
					// Inject recovery guidance
					circuitMsg := fmt.Sprintf(
						"⚠️ SYSTEM: %s has failed repeatedly.\n\n%s",
						toolName, getToolRecoveryGuidance(toolName),
					)
					messages = append(messages, models.Message{
						Role:    "system",
						Content: circuitMsg,
					})
					r.logger.WithFields(logrus.Fields{
						"session_id": session.ID,
						"tool":       toolName,
						"stats":      circuitBreaker.GetStats(),
					}).Warn("Circuit breaker: injected recovery guidance")
				}
			} else {
				circuitBreaker.RecordFileSuccess(toolName, filePath)
			}
		}

		// Handle graceful exit due to circuit breaker
		if shouldExit {
			hasChanges := r.executor.HasFileChanges() || session.GetFilesChanged()
			session.SetFilesChanged(hasChanges)
			session.SetStatus(models.StatusCompleted)
			streamer.SendStatus("circuit_breaker", "Too many failures detected, stopping gracefully")
			streamer.SendMessage("I encountered repeated errors and couldn't complete the task. Please try again with a simpler request or review the changes made so far.")

			completeData := models.CompleteData{
				Iterations:       iterationsRun,
				TokensUsed:       session.TokensUsed,
				FilesChanged:     hasChanges,
				Message:          "Session stopped due to repeated errors. Some changes may have been made - please review.",
				BuildStatus:      session.GetBuildStatus(),
				BuildMessage:     session.GetBuildMessage(),
				BuildRequired:    session.IsBuildRequired(),
				PromptTokens:     session.PromptTokens,
				CompletionTokens: session.CompletionTokens,
				Model:            r.aiConfig.Model,
			}
			streamer.SendComplete(completeData)
			return nil
		}

		// Add assistant message with tool calls
		messages = append(messages, models.Message{
			Role:      "assistant",
			Content:   response.Content,
			ToolCalls: response.ToolCalls,
		})

		// Add tool results as separate messages (truncated to save context window)

		// First add session-level tool results (e.g., getProjectCapabilities)
		for toolCallID, result := range sessionToolResults {
			messages = append(messages, models.Message{
				Role:       "tool",
				Content:    result.Content,
				ToolCallID: toolCallID,
			})
		}

		// Then add executor tool results
		for i, result := range toolResults {
			toolName := batchRequests[i].Name
			maxLen := maxResultForTool(toolName)
			content := result.Content
			if len(content) > maxLen {
				half := maxLen / 2
				content = content[:half] +
					fmt.Sprintf("\n\n... (%d chars truncated) ...\n\n", len(result.Content)-maxLen) +
					content[len(content)-half+50:]
			}
			messages = append(messages, models.Message{
				Role:       "tool",
				Content:    content,
				ToolCallID: result.ToolCallID,
			})
		}

		// Auto-compaction: check if context is getting too large (if enabled)
		contextTokens := summarizer.EstimateConversationTokens(messages)
		session.SetContextTokens(contextTokens)

		if features.AutoCompaction {
			contextWindow := r.aiConfig.ContextWindow
			if contextWindow == 0 {
				contextWindow = 128000 // Default
			}
			threshold := r.aiConfig.CompactionThreshold
			if threshold == 0 {
				threshold = 0.7 // Default: 70%
			}

			thresholdTokens := int(float64(contextWindow) * threshold)
			if contextTokens > thresholdTokens {
				r.logger.WithFields(logrus.Fields{
					"session_id":     session.ID,
					"context_tokens": contextTokens,
					"threshold":      thresholdTokens,
				}).Debug("Context threshold reached, triggering compaction")

				streamer.SendStatus("compacting", "Compressing history...")

				// Convert messages to turns for summarization
				turns := make([]summarizer.Turn, 0, len(messages))
				for _, msg := range messages {
					if msg.Role == "system" {
						continue // Skip system messages
					}
					turns = append(turns, summarizer.Turn{
						Role:    msg.Role,
						Content: msg.Content,
					})
				}

				// Process with summarization
				state, err := r.summarizer.Process(ctx, turns)
				if err == nil && state.Summary != "" {
					// Track auto-compaction tokens for credit depletion
					if state.TotalTokens > 0 {
						session.UpdateTokens(state.PromptTokens, state.CompletionTokens, state.TotalTokens)
						r.logger.WithFields(logrus.Fields{
							"session_id":            session.ID,
							"summarizer_prompt":     state.PromptTokens,
							"summarizer_completion": state.CompletionTokens,
							"summarizer_total":      state.TotalTokens,
						}).Debug("Added auto-compaction tokens to session")
					}

					// Build compacted history for Laravel
					var compactedHistory []models.HistoryMessage
					compactedHistory = append(compactedHistory, models.HistoryMessage{
						Role:    "assistant",
						Content: "[Previous conversation summary]\n" + state.Summary,
					})

					// Rebuild messages with summary
					// Re-load template prompts in case the AI selected a template during the run
					compactTemplatePrompts := r.loadTemplatePrompts(r.executor.GetWorkspacePath())
					compactCfg := PromptConfig{
						ProjectName:     "Project",
						WorkspacePath:   r.executor.GetWorkspacePath(),
						TemplatePrompts: compactTemplatePrompts,
						Capabilities:    session.GetProjectCapabilities(),
						ThemePreset:     session.GetThemePreset(),
					}
					if cp := session.GetCustomPrompts(); cp != nil {
						compactCfg.CustomPrompt = cp.SystemPrompt
						compactCfg.CustomCompactPrompt = cp.CompactPrompt
					}
					systemPrompt, promptErr := BuildSystemPrompt(compactCfg)
					if promptErr != nil {
						r.logger.WithField("error", promptErr.Error()).Warn("Failed to build compact prompt during compaction, using current prompt")
						break
					}
					newMessages := []models.Message{
						{Role: "system", Content: systemPrompt},
						{Role: "system", Content: "CONVERSATION HISTORY:\n" + state.Summary},
					}

					// Add recent turns back
					for _, t := range state.RecentTurns {
						compactedHistory = append(compactedHistory, models.HistoryMessage{
							Role:    t.Role,
							Content: t.Content,
						})
						newMessages = append(newMessages, models.Message{
							Role:    t.Role,
							Content: t.Content,
						})
					}

					messages = newMessages
					newContextTokens := summarizer.EstimateConversationTokens(messages)
					session.SetContextTokens(newContextTokens)

					r.logger.WithFields(logrus.Fields{
						"session_id":    session.ID,
						"old_tokens":    contextTokens,
						"new_tokens":    newContextTokens,
						"reduction_pct": fmt.Sprintf("%.1f%%", float64(contextTokens-newContextTokens)/float64(contextTokens)*100),
					}).Debug("Context compacted")

					// Send summarization complete event with compacted history
					turnsCompacted := len(turns) - len(state.RecentTurns)
					reductionPct := float64(0)
					if contextTokens > 0 {
						reductionPct = float64(contextTokens-newContextTokens) / float64(contextTokens) * 100
					}
					streamer.SendSummarizationComplete(models.SummarizationEventData{
						OldTokens:        contextTokens,
						NewTokens:        newContextTokens,
						ReductionPercent: reductionPct,
						TurnsCompacted:   turnsCompacted,
						TurnsKept:        len(state.RecentTurns),
						Message:          fmt.Sprintf("Auto-compaction: reduced context from %d to %d tokens (%.1f%% reduction)", contextTokens, newContextTokens, reductionPct),
						CompactedHistory: compactedHistory,
					})
				} else {
					// Mid-turn compaction failed
					errMsg := "empty summary returned"
					if err != nil {
						errMsg = err.Error()
					}
					r.logger.WithFields(logrus.Fields{
						"session_id":     session.ID,
						"error":          errMsg,
						"context_tokens": contextTokens,
						"turns":          len(turns),
					}).Warn("Mid-turn compaction failed, truncating to recent messages")

					// Fallback: preserve all system messages + last N non-system messages
					if len(messages) > 20 {
						var systemMsgs []models.Message
						var otherMsgs []models.Message
						for _, msg := range messages {
							if msg.Role == "system" {
								systemMsgs = append(systemMsgs, msg)
							} else {
								otherMsgs = append(otherMsgs, msg)
							}
						}
						keepCount := 20 - len(systemMsgs)
						if keepCount < 4 {
							keepCount = 4
						}
						if len(otherMsgs) > keepCount {
							otherMsgs = otherMsgs[len(otherMsgs)-keepCount:]
						}
						messages = append(systemMsgs, otherMsgs...)
					}
					newContextTokens := summarizer.EstimateConversationTokens(messages)
					session.SetContextTokens(newContextTokens)
					streamer.SendStatus("compaction_warning",
						fmt.Sprintf("Context compaction failed (%s), using truncated history", errMsg))
				}
			}
		}
	}

	// Send the AI's final response as a message
	if lastAIContent == "" {
		// Context-aware fallback: distinguish between agent modifications and template-only projects
		if r.executor.HasFileChanges() {
			lastAIContent = "Done! I've made the changes to your website."
		} else {
			lastAIContent = "Your website is ready! You can preview it now."
		}
		streamer.SendMessage(lastAIContent)
	} else if len(lastAIContent) <= 100 {
		// Only send short messages here (long ones already sent in loop)
		streamer.SendMessage(lastAIContent)
	}
	// Long messages (>100 chars) were already sent via SendMessage in the loop

	// Brief delay to ensure async message event is dispatched before sync complete
	time.Sleep(100 * time.Millisecond)

	// Sync file changes to session so IsBuildRequired() reads the correct value
	// OR with session flag to preserve pre-agent changes (e.g. template initialization)
	hasChanges := r.executor.HasFileChanges() || session.GetFilesChanged()
	session.SetFilesChanged(hasChanges)

	// Send completion (synchronous - blocks until Pusher confirms delivery)
	streamer.SendComplete(models.CompleteData{
		Iterations:       session.Iterations,
		TokensUsed:       session.TokensUsed,
		FilesChanged:     hasChanges,
		Message:          lastAIContent,
		BuildStatus:      session.GetBuildStatus(),
		BuildMessage:     session.GetBuildMessage(),
		BuildRequired:    session.IsBuildRequired(),
		PromptTokens:     session.PromptTokens,
		CompletionTokens: session.CompletionTokens,
		Model:            r.aiConfig.Model,
	})

	// Log session complete with visual separator
	status := string(session.GetStatus())
	logging.LogSessionEnd(r.logger, session.ID, session.Iterations, session.TokensUsed, r.executor.HasFileChanges(), status)

	return nil
}

// scanPageFiles returns relative paths of all .tsx page files in src/pages/.
// Excludes NotFound.tsx since it doesn't need routing.
func scanPageFiles(workspacePath string) []string {
	pagesDir := filepath.Join(workspacePath, "src", "pages")
	entries, err := os.ReadDir(pagesDir)
	if err != nil {
		return nil
	}

	var pages []string
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		name := entry.Name()
		if strings.HasSuffix(name, ".tsx") && name != "NotFound.tsx" {
			pages = append(pages, "src/pages/"+name)
		}
	}
	return pages
}

// maxResultForTool returns the per-tool context window truncation limit.
// Build tools need more context (error messages at end of long output).
// Read/analysis tools benefit from larger results. Other tools use a default.
func maxResultForTool(toolName string) int {
	switch toolName {
	case "verifyBuild":
		return 12000
	case "readFile", "analyzeProject", "searchFiles":
		return 8000
	default:
		return 6000
	}
}

func truncateOutput(s string, maxLen int) string {
	// Strip HTML tags first to prevent HTML in logs/streamed output
	s = logging.StripHTMLTags(s)

	if len(s) <= maxLen {
		return s
	}
	// For longer outputs, show beginning + end (errors usually at end)
	if maxLen > 500 {
		headLen := 200
		tailLen := maxLen - headLen - 50
		return s[:headLen] + "\n\n...(truncated)...\n\n" + s[len(s)-tailLen:]
	}
	return s[:maxLen] + "..."
}

// getActionDescription returns a fun, human-friendly action description and category for icon
// loadSiteMemory reads memory.json from workspace root if it exists.
// Returns the formatted content or empty string if not present.
func loadSiteMemory(workspacePath string) string {
	data, err := executor.ReadJSONFile(filepath.Join(workspacePath, "memory.json"))
	if err != nil || len(data) == 0 {
		return ""
	}
	content, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		return ""
	}
	return string(content)
}

// loadDesignIntelligence reads design-intelligence.json from workspace root if it exists.
// Returns the formatted content or empty string if not present.
func loadDesignIntelligence(workspacePath string) string {
	data, err := executor.ReadJSONFile(filepath.Join(workspacePath, "design-intelligence.json"))
	if err != nil || len(data) == 0 {
		return ""
	}
	content, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		return ""
	}
	return string(content)
}

func getActionDescription(toolName string, args map[string]interface{}) (action, target, category string) {
	path, _ := args["path"].(string)

	switch toolName {
	case "createFile":
		return randomPhrase(createPhrases), path, "creating"
	case "editFile":
		return randomPhrase(editPhrases), path, "editing"
	case "readFile":
		return randomPhrase(readPhrases), path, "reading"
	case "listFiles":
		return randomPhrase(explorePhrases), "project structure", "exploring"
	case "listComponents":
		return "Browsing", "available components", "exploring"
	case "getComponentUsage":
		component, _ := args["component"].(string)
		if component != "" {
			return "Learning about", component + " component", "reading"
		}
		return "Learning about", "component usage", "reading"
	case "verifyBuild":
		return "Verifying", "build", "reading"
	case "verifyIntegration":
		return "Checking", "page integration", "reading"
	case "createPlan":
		return "Planning", "your project", "planning"
	case "getProjectCapabilities":
		return "Checking", "available features", "reading"
	case "getFirestoreCollections":
		return "Checking", "existing data collections", "reading"
	case "writeDesignIntelligence":
		return "Saving", "design decisions", "creating"
	case "readDesignIntelligence":
		return "Recalling", "design decisions", "reading"
	case "updateSiteMemory":
		return "Saving", "business context", "creating"
	case "readSiteMemory":
		return "Recalling", "business context", "reading"
	case "generateAEO":
		return "Generating", "AI discovery files", "creating"
	case "listImages":
		return "Browsing", "stock images", "exploring"
	case "getImageUsage":
		return "Selecting", "stock image", "reading"
	default:
		if path != "" {
			return "Working on", path, ""
		}
		return "Working on", "your website", ""
	}
}
