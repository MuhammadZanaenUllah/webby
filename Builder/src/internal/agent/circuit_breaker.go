package agent

import (
	"strings"
	"sync"
)

// FailureAction indicates what action the circuit breaker recommends
type FailureAction int

const (
	// ActionContinue means continue normally
	ActionContinue FailureAction = iota
	// ActionInjectGuidance means inject recovery guidance into the conversation
	ActionInjectGuidance
	// ActionGracefulExit means stop the session gracefully
	ActionGracefulExit
)

// CircuitBreaker tracks tool failures and determines when to stop or recover
// Key improvements over simple consecutive failure counting:
// - Tracks global failures (not just per-tool)
// - Detects same-error loops (5 identical errors = exit)
// - Limits recovery attempts per tool (max 2 before giving up)
// - Does NOT reset counter after recovery (fixes infinite loop bug)
// - Tracks per-file failures for editFile (2 failures on same file = guidance)
type CircuitBreaker struct {
	mu sync.Mutex

	// Per-tool tracking
	toolFailures   map[string]int // Consecutive failures per tool
	toolRecoveries map[string]int // Recovery attempts per tool

	// Per-file tracking (for editFile)
	fileFailures map[string]int // Consecutive failures per "toolName:filePath"

	// Global tracking
	globalFailures       int    // Total failures across all tools
	lastGlobalError      string // For same-error detection
	consecutiveSameError int    // Count of identical errors

	// Limits
	maxToolFailures   int            // Failures before injecting guidance (default: 3)
	maxToolRecoveries int            // Max recovery attempts per tool (default: 2)
	maxGlobalFailures int            // Total failures before forced exit (default: 10)
	maxSameErrors     int            // Identical errors before exit (default: 5)
	toolFailureLimits map[string]int // Per-tool override for maxToolFailures
}

// NewCircuitBreaker creates a circuit breaker with default limits
func NewCircuitBreaker() *CircuitBreaker {
	return &CircuitBreaker{
		toolFailures:      make(map[string]int),
		toolRecoveries:    make(map[string]int),
		fileFailures:      make(map[string]int),
		maxToolFailures:   3,
		maxToolRecoveries: 2,
		maxGlobalFailures: 10,
		maxSameErrors:     5,
		toolFailureLimits: map[string]int{
			"verifyBuild":       5,
			"verifyIntegration": 4,
		},
	}
}

// NewCircuitBreakerForModel creates a circuit breaker with model-appropriate limits
func NewCircuitBreakerForModel(providerType, model string) *CircuitBreaker {
	cb := NewCircuitBreaker()
	tier := getModelTier(providerType, model)
	switch tier {
	case "standard":
		cb.maxGlobalFailures = 8
		cb.maxToolFailures = 2
		cb.maxToolRecoveries = 1
	default: // "advanced"
		cb.maxGlobalFailures = 10
		cb.maxToolFailures = 3
		cb.maxToolRecoveries = 2
	}
	return cb
}

// getModelTier classifies a model as "standard" or "advanced" based on provider and model name
func getModelTier(providerType, model string) string {
	switch providerType {
	case "zhipu", "deepseek":
		return "standard"
	}
	modelLower := strings.ToLower(model)
	// Use word-boundary check: "mini"/"nano" must be preceded by a delimiter (-, _, or start)
	// to avoid false positives like "gemini"
	for _, suffix := range []string{"mini", "nano"} {
		idx := strings.Index(modelLower, suffix)
		if idx > 0 && (modelLower[idx-1] == '-' || modelLower[idx-1] == '_') {
			return "standard"
		} else if idx == 0 {
			return "standard"
		}
	}
	return "advanced"
}

// getMaxFailures returns the per-tool failure limit, or the default maxToolFailures
func (cb *CircuitBreaker) getMaxFailures(toolName string) int {
	if limit, ok := cb.toolFailureLimits[toolName]; ok {
		return limit
	}
	return cb.maxToolFailures
}

// recordFailureLocked is the core failure recording logic (must be called with mutex held)
func (cb *CircuitBreaker) recordFailureLocked(toolName, errorMsg string) FailureAction {
	// Increment counters
	cb.toolFailures[toolName]++
	cb.globalFailures++

	// Check for same-error loop
	normalizedError := normalizeError(errorMsg)
	if normalizedError == cb.lastGlobalError {
		cb.consecutiveSameError++
	} else {
		cb.consecutiveSameError = 1
		cb.lastGlobalError = normalizedError
	}

	// Check exit conditions first
	if cb.consecutiveSameError >= cb.maxSameErrors {
		return ActionGracefulExit
	}
	if cb.globalFailures >= cb.maxGlobalFailures {
		return ActionGracefulExit
	}

	// Check if this tool has exhausted recovery attempts
	maxFailures := cb.getMaxFailures(toolName)
	if cb.toolRecoveries[toolName] >= cb.maxToolRecoveries {
		// This tool has already had max recovery attempts
		// If it fails again, it's time to give up
		if cb.toolFailures[toolName] >= maxFailures {
			return ActionGracefulExit
		}
	}

	// Check if we should inject guidance
	if cb.toolFailures[toolName] >= maxFailures {
		cb.toolRecoveries[toolName]++
		// Reset consecutive failures for this tool only (not global)
		// This allows one more "round" of attempts after guidance
		cb.toolFailures[toolName] = 0
		return ActionInjectGuidance
	}

	return ActionContinue
}

// recordSuccessLocked is the core success recording logic (must be called with mutex held)
func (cb *CircuitBreaker) recordSuccessLocked(toolName string) {
	// Reset consecutive failures for this tool
	cb.toolFailures[toolName] = 0

	// Reset same-error tracking (success breaks the loop)
	cb.consecutiveSameError = 0
	cb.lastGlobalError = ""

	// NOTE: We do NOT reset toolRecoveries or globalFailures
	// This prevents infinite loops where success->fail->guidance->success->fail...
}

// RecordFailure records a tool failure and returns the recommended action
func (cb *CircuitBreaker) RecordFailure(toolName, errorMsg string) FailureAction {
	cb.mu.Lock()
	defer cb.mu.Unlock()
	return cb.recordFailureLocked(toolName, errorMsg)
}

// RecordSuccess records a successful tool execution
// Resets consecutive failures for that tool but NOT recovery count
func (cb *CircuitBreaker) RecordSuccess(toolName string) {
	cb.mu.Lock()
	defer cb.mu.Unlock()
	cb.recordSuccessLocked(toolName)
}

// RecordFileFailure records a tool failure with per-file tracking for editFile
// If editFile fails on the same file 2+ times, upgrades to ActionInjectGuidance
func (cb *CircuitBreaker) RecordFileFailure(toolName, filePath, errorMsg string) FailureAction {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	action := cb.recordFailureLocked(toolName, errorMsg)

	// Per-file tracking only applies to editFile
	if toolName == "editFile" && filePath != "" {
		key := "editFile:" + filePath
		cb.fileFailures[key]++
		// Upgrade ActionContinue to ActionInjectGuidance after 2 failures on same file
		// Never downgrade ActionGracefulExit
		if cb.fileFailures[key] >= 2 && action == ActionContinue {
			return ActionInjectGuidance
		}
	}

	return action
}

// RecordFileSuccess records a successful tool execution with per-file tracking
func (cb *CircuitBreaker) RecordFileSuccess(toolName, filePath string) {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	// Reset per-file tracking
	if toolName == "editFile" && filePath != "" {
		delete(cb.fileFailures, "editFile:"+filePath)
	}

	cb.recordSuccessLocked(toolName)
}

// GetStats returns current circuit breaker statistics
func (cb *CircuitBreaker) GetStats() map[string]interface{} {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	return map[string]interface{}{
		"global_failures":        cb.globalFailures,
		"consecutive_same_error": cb.consecutiveSameError,
		"tool_failures":          copyMap(cb.toolFailures),
		"tool_recoveries":        copyMap(cb.toolRecoveries),
	}
}

// normalizeError extracts the key part of an error message for comparison
// This helps detect loops where the same underlying error keeps occurring
func normalizeError(err string) string {
	// Truncate to first 200 chars and lowercase
	if len(err) > 200 {
		err = err[:200]
	}
	return strings.ToLower(strings.TrimSpace(err))
}

// copyMap creates a shallow copy of a map
func copyMap(m map[string]int) map[string]int {
	cp := make(map[string]int, len(m))
	for k, v := range m {
		cp[k] = v
	}
	return cp
}
