package models

// Event types
const (
	EventStatus     = "status"
	EventThinking   = "thinking"
	EventToolCall   = "tool_call"
	EventToolResult = "tool_result"
	EventAction     = "action"
	EventMessage    = "message"
	EventError      = "error"
	EventComplete   = "complete"
	EventPlan       = "plan" // Structured plan for complex tasks

	// Granular progress events
	EventIterationStart = "iteration_start" // Start of a new iteration
	EventRetry          = "retry"           // LLM retry attempt
	EventTokenUsage     = "token_usage"     // Token usage update
	EventToolTimeout    = "tool_timeout"    // Tool execution timed out
	EventToolRetry      = "tool_retry"      // Tool execution retry attempt

	// Credit enforcement events
	EventCreditWarning  = "credit_warning"  // Warning at 80% usage
	EventCreditExceeded = "credit_exceeded" // Session stopped due to credit limit

	// Summarization events
	EventSummarizationComplete = "summarization_complete" // Context was compacted
)

// Event represents a streaming event
type Event struct {
	Type string      `json:"type"`
	Data interface{} `json:"data"`
}

// StatusData for status events
type StatusData struct {
	Status  string `json:"status"`
	Message string `json:"message,omitempty"`
}

// ThinkingData for thinking events
type ThinkingData struct {
	Content   string `json:"content"`
	Iteration int    `json:"iteration"`
}

// ToolCallData for tool_call events
type ToolCallData struct {
	ID     string                 `json:"id"`
	Tool   string                 `json:"tool"`
	Params map[string]interface{} `json:"params"`
}

// ToolResultData for tool_result events
type ToolResultData struct {
	ID         string `json:"id"`
	Tool       string `json:"tool"`
	Success    bool   `json:"success"`
	Output     string `json:"output"`
	DurationMs int64  `json:"duration_ms,omitempty"`
	Iteration  int    `json:"iteration,omitempty"`
}

// ActionData for action events (human-friendly)
type ActionData struct {
	Action   string `json:"action"`
	Target   string `json:"target"`
	Details  string `json:"details,omitempty"`
	Category string `json:"category"`
}

// MessageData for message events
type MessageData struct {
	Content string `json:"content"`
}

// ErrorData for error events
type ErrorData struct {
	Error string `json:"error"`
}

// CompleteData for complete events
type CompleteData struct {
	Iterations       int    `json:"iterations"`
	TokensUsed       int    `json:"tokens_used"`
	FilesChanged     bool   `json:"files_changed"`
	Message          string `json:"message,omitempty"`
	BuildStatus      string `json:"build_status,omitempty"`   // "not_run", "success", "failed"
	BuildMessage     string `json:"build_message,omitempty"`  // Error summary or success msg
	BuildRequired    bool   `json:"build_required,omitempty"` // Hint for Laravel
	PromptTokens     int    `json:"prompt_tokens,omitempty"`
	CompletionTokens int    `json:"completion_tokens,omitempty"`
	Model            string `json:"model,omitempty"`
}

// IterationStartData for iteration_start events
type IterationStartData struct {
	Iteration    int `json:"iteration"`
	MaxIteration int `json:"max_iteration"`
}

// RetryData for retry events
type RetryData struct {
	Attempt    int    `json:"attempt"`
	MaxRetries int    `json:"max_retries"`
	DelayMs    int64  `json:"delay_ms"`
	Reason     string `json:"reason"`
}

// TokenUsageData for token_usage events
type TokenUsageData struct {
	PromptTokens     int `json:"prompt"`
	CompletionTokens int `json:"completion"`
	TotalTokens      int `json:"total"`
	ContextTokens    int `json:"context"`
}

// ToolTimeoutData for tool_timeout events
type ToolTimeoutData struct {
	Tool       string `json:"tool"`
	TimeoutSec int    `json:"timeout_sec"`
	Attempt    int    `json:"attempt"`
}

// ToolRetryData for tool_retry events
type ToolRetryData struct {
	Tool       string `json:"tool"`
	Attempt    int    `json:"attempt"`
	MaxRetries int    `json:"max_retries"`
	DelayMs    int64  `json:"delay_ms"`
	Reason     string `json:"reason"`
}

// PlanStep represents a single step in a plan
type PlanStep struct {
	File        string `json:"file"`
	Action      string `json:"action"` // "create", "modify", "delete"
	Description string `json:"description"`
}

// PlanData for plan events
type PlanData struct {
	Summary      string     `json:"summary"`
	Steps        []PlanStep `json:"steps"`
	Dependencies []string   `json:"dependencies,omitempty"`
	Risks        []string   `json:"risks,omitempty"`
}

// CreditEventData for credit_warning and credit_exceeded events
type CreditEventData struct {
	UsedTokens       int     `json:"used_tokens"`
	RemainingCredits int     `json:"remaining_credits"`
	PercentUsed      float64 `json:"percent_used"`
	Message          string  `json:"message"`
}

// SummarizationEventData for summarization_complete events
type SummarizationEventData struct {
	OldTokens        int              `json:"old_tokens"`
	NewTokens        int              `json:"new_tokens"`
	ReductionPercent float64          `json:"reduction_percent"`
	TurnsCompacted   int              `json:"turns_compacted"`
	TurnsKept        int              `json:"turns_kept"`
	Message          string           `json:"message"`
	CompactedHistory []HistoryMessage `json:"compacted_history,omitempty"`
}
