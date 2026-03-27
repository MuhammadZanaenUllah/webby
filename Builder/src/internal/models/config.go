package models

// HTTPUserAgent is the User-Agent header sent on all outgoing HTTP requests.
const HTTPUserAgent = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36"

// ProviderConfig holds configuration for an AI provider
type ProviderConfig struct {
	APIKey          string `json:"api_key"`
	BaseURL         string `json:"base_url"`
	Model           string `json:"model"`
	MaxTokens       int    `json:"max_tokens"`
	ReasoningEffort string `json:"reasoning_effort,omitempty"`
	ProviderType    string `json:"provider_type,omitempty"` // "openai", "anthropic", "grok", or "deepseek"

	// Token-aware context management
	ContextWindow       int     `json:"context_window,omitempty"`       // Model's context window (default: 128000)
	CompactionThreshold float64 `json:"compaction_threshold,omitempty"` // Trigger compaction at this % of context (default: 0.7)
	KeepRecentTurns     int     `json:"keep_recent_turns,omitempty"`    // Number of recent turns to keep (default: 6)

	// Anthropic prompt caching
	EnablePromptCaching bool `json:"enable_prompt_caching,omitempty"`

	// Credit enforcement - passed from Laravel
	// 0 = unlimited (user has own API key or unlimited plan)
	RemainingBuildCredits int `json:"remaining_build_credits,omitempty"`
}

// RequestConfig holds all AI configuration passed per-request from Laravel
type RequestConfig struct {
	Agent       ProviderConfig      `json:"agent"`
	Summarizer  ProviderConfig      `json:"summarizer"`
	Suggestions ProviderConfig      `json:"suggestions"`
	Tools       ToolExecutionConfig `json:"tools"` // Tool timeout and retry configuration
}

// Validate checks that required fields are present and sets defaults
func (c *RequestConfig) Validate() error {
	// Apply provider-specific model defaults
	if c.Agent.Model == "" {
		switch c.Agent.ProviderType {
		case "anthropic":
			c.Agent.Model = "claude-sonnet-4-5"
		case "zhipu":
			c.Agent.Model = "glm-4.7"
		case "deepseek":
			c.Agent.Model = "deepseek-chat"
		case "grok":
			c.Agent.Model = "grok-4-1-fast-non-reasoning"
		default:
			c.Agent.Model = "gpt-5-nano"
		}
	}
	if c.Agent.MaxTokens == 0 {
		c.Agent.MaxTokens = 16384
	}
	if c.Agent.ReasoningEffort == "" {
		c.Agent.ReasoningEffort = "medium"
	}
	// Token-aware context defaults (provider-specific)
	if c.Agent.ContextWindow == 0 {
		switch c.Agent.ProviderType {
		case "anthropic":
			c.Agent.ContextWindow = 200000
		case "deepseek":
			c.Agent.ContextWindow = 64000
		case "grok":
			c.Agent.ContextWindow = 131072
		default:
			c.Agent.ContextWindow = 128000
		}
	}
	if c.Agent.CompactionThreshold == 0 {
		c.Agent.CompactionThreshold = 0.7
	}
	if c.Agent.KeepRecentTurns == 0 {
		c.Agent.KeepRecentTurns = 6
	}

	// Summarizer falls back to agent config
	if c.Summarizer.APIKey == "" {
		c.Summarizer.APIKey = c.Agent.APIKey
	}
	if c.Summarizer.BaseURL == "" {
		c.Summarizer.BaseURL = c.Agent.BaseURL
	}
	if c.Summarizer.Model == "" {
		c.Summarizer.Model = c.Agent.Model // Use same model as agent for consistency
	}
	if c.Summarizer.MaxTokens == 0 {
		c.Summarizer.MaxTokens = 1500 // Default max tokens for summary output
	}

	// Suggestions falls back to agent config
	if c.Suggestions.APIKey == "" {
		c.Suggestions.APIKey = c.Agent.APIKey
	}
	if c.Suggestions.BaseURL == "" {
		c.Suggestions.BaseURL = c.Agent.BaseURL
	}
	if c.Suggestions.Model == "" {
		c.Suggestions.Model = c.Agent.Model // Use same model as agent for consistency
	}

	// Apply defaults for tool execution
	if c.Tools.Timeout == 0 {
		c.Tools.Timeout = 300 // 5 minutes default
	}
	if c.Tools.MaxRetries == 0 {
		c.Tools.MaxRetries = 2 // 2 retry attempts default
	}

	return nil
}

// TemplateConfig holds template download configuration
type TemplateConfig struct {
	URL          string `json:"url"`
	Checksum     string `json:"checksum,omitempty"`
	TemplateID   string `json:"template_id,omitempty"`   // Pre-select template from Laravel
	TemplateName string `json:"template_name,omitempty"` // Human-readable template name for logging
}

// ToolExecutionConfig holds timeout and retry settings for tool execution
type ToolExecutionConfig struct {
	// Timeout is the maximum time to wait for any single tool to complete (default: 300s)
	Timeout int `json:"timeout"`
	// MaxRetries is the maximum number of retry attempts for transient failures (default: 2)
	MaxRetries int `json:"max_retries"`
}

// DefaultToolConfig returns the default tool execution configuration
func DefaultToolConfig() ToolExecutionConfig {
	return ToolExecutionConfig{
		Timeout:    300, // 5 minutes
		MaxRetries: 2,   // 2 retry attempts
	}
}
