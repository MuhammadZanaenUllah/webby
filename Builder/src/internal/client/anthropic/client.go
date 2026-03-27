package anthropic

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	anthropic "github.com/anthropics/anthropic-sdk-go"
	"github.com/anthropics/anthropic-sdk-go/option"
	"github.com/anthropics/anthropic-sdk-go/shared/constant"

	"webby-builder/internal/models"

	"github.com/sirupsen/logrus"
)

// RetryConfig configures retry behavior with exponential backoff
type RetryConfig struct {
	// MaxRetries is the maximum number of retry attempts (0 = no retries)
	MaxRetries int
	// InitialDelay is the delay before the first retry
	InitialDelay time.Duration
	// BackoffFactor is the multiplier for each subsequent retry delay
	BackoffFactor float64
	// Jitter is the random variance factor (0.1 = ±10%)
	Jitter float64
}

// RetryCallback is called when a retry is about to happen
type RetryCallback func(attempt, maxRetries int, delay time.Duration, reason string)

// Model constants for Anthropic API (matching SDK v1.19.0+)
const (
	ModelClaudeOpus45   = "claude-opus-4-5-20251101"
	ModelClaudeSonnet45 = "claude-sonnet-4-5"
	ModelClaudeHaiku45  = "claude-haiku-4-5"
)

// Model mappings from Laravel names to SDK model names
var modelMappings = map[string]string{
	"claude-opus-4-5":   ModelClaudeOpus45,
	"claude-sonnet-4-5": ModelClaudeSonnet45,
	"claude-haiku-4-5":  ModelClaudeHaiku45,
}

// Client implements AIProvider using Anthropic API
type Client struct {
	client        *anthropic.Client
	model         string
	maxTokens     int
	logger        *logrus.Logger
	retryConfig   RetryConfig
	onRetry       RetryCallback
	enableCaching bool
	providerName  string
}

// Ensure Client implements AIProvider
var _ models.AIProvider = (*Client)(nil)

// NewClientWithRetry creates a client with custom retry configuration
func NewClientWithRetry(cfg models.ProviderConfig, logger *logrus.Logger, retryConfig RetryConfig, onRetry RetryCallback) *Client {
	// Build request options from config (like OpenAI client does)
	opts := []option.RequestOption{}

	if cfg.APIKey != "" {
		opts = append(opts, option.WithAPIKey(cfg.APIKey))
	}
	if cfg.BaseURL != "" {
		opts = append(opts, option.WithBaseURL(cfg.BaseURL))
	}

	// Create client with options
	anthropicClient := anthropic.NewClient(opts...)

	// Resolve model name from Laravel format to SDK format
	model := cfg.Model
	if model == "" {
		model = ModelClaudeSonnet45 // Default to sonnet 4.5
	}
	// Apply model mapping if needed
	if mappedModel, ok := modelMappings[model]; ok {
		model = mappedModel
	}

	maxTokens := cfg.MaxTokens
	if maxTokens == 0 {
		maxTokens = 16384
	}

	// Determine provider name for logging
	providerName := cfg.ProviderType
	if providerName == "" {
		providerName = "anthropic"
	}

	return &Client{
		client:        &anthropicClient,
		model:         model,
		maxTokens:     maxTokens,
		logger:        logger,
		retryConfig:   retryConfig,
		onRetry:       onRetry,
		enableCaching: cfg.EnablePromptCaching,
		providerName:  providerName,
	}
}

// convertMessages converts our Message format to Anthropic format
func (c *Client) convertMessages(messages []models.Message) []anthropic.MessageParam {
	var contentMsgs []anthropic.MessageParam

	for _, msg := range messages {
		switch msg.Role {
		case "system":
			// System messages are extracted separately
			continue
		case "user":
			contentMsgs = append(contentMsgs, anthropic.NewUserMessage(anthropic.NewTextBlock(msg.Content)))
		case "assistant":
			// Check if there are tool calls
			if len(msg.ToolCalls) > 0 {
				blocks := []anthropic.ContentBlockParamUnion{}
				if msg.Content != "" {
					blocks = append(blocks, anthropic.ContentBlockParamUnion{
						OfText: &anthropic.TextBlockParam{Text: msg.Content},
					})
				}
				for _, tc := range msg.ToolCalls {
					blocks = append(blocks, anthropic.ContentBlockParamUnion{
						OfToolUse: &anthropic.ToolUseBlockParam{
							ID:    tc.ID,
							Name:  tc.Name,
							Input: tc.Arguments,
						},
					})
				}
				contentMsgs = append(contentMsgs, anthropic.MessageParam{
					Role:    anthropic.MessageParamRoleAssistant,
					Content: blocks,
				})
			} else if msg.Content != "" {
				contentMsgs = append(contentMsgs, anthropic.NewAssistantMessage(anthropic.NewTextBlock(msg.Content)))
			}
		case "tool":
			// Tool result message
			contentMsgs = append(contentMsgs, anthropic.MessageParam{
				Role: anthropic.MessageParamRoleUser,
				Content: []anthropic.ContentBlockParamUnion{
					anthropic.ContentBlockParamUnion{
						OfToolResult: &anthropic.ToolResultBlockParam{
							ToolUseID: msg.ToolCallID,
							Content: []anthropic.ToolResultBlockParamContentUnion{
								anthropic.ToolResultBlockParamContentUnion{
									OfText: &anthropic.TextBlockParam{Text: msg.Content},
								},
							},
						},
					},
				},
			})
		}
	}

	return contentMsgs
}

// extractSystemMessages extracts system messages from the message list
func (c *Client) extractSystemMessages(messages []models.Message) []anthropic.TextBlockParam {
	var systemContents []anthropic.TextBlockParam
	for _, msg := range messages {
		if msg.Role == "system" {
			systemContents = append(systemContents, anthropic.TextBlockParam{Text: msg.Content})
		}
	}
	return systemContents
}

// convertTools converts our ToolDefinition to Anthropic format
func (c *Client) convertTools(tools []models.ToolDefinition) []anthropic.ToolUnionParam {
	anthropicTools := make([]anthropic.ToolUnionParam, len(tools))
	for i, tool := range tools {
		// Extract properties and required from tool.Parameters
		properties, _ := tool.Parameters["properties"].(map[string]interface{})
		required, _ := tool.Parameters["required"].([]string)
		typeVal, _ := tool.Parameters["type"].(string)

		anthropicTools[i] = anthropic.ToolUnionParam{
			OfTool: &anthropic.ToolParam{
				Name:        tool.Name,
				Description: anthropic.String(tool.Description),
				InputSchema: anthropic.ToolInputSchemaParam{
					Properties: properties,
					Required:   required,
					Type:       constant.Object(typeVal),
				},
			},
		}
	}
	return anthropicTools
}

// Chat sends messages and returns response with potential tool calls
func (c *Client) Chat(ctx context.Context, messages []models.Message, tools []models.ToolDefinition) (*models.Response, error) {
	// Extract system messages
	systemBlocks := c.extractSystemMessages(messages)

	// Convert messages to Anthropic format
	anthropicMessages := c.convertMessages(messages)

	// Convert tools to Anthropic format
	var anthropicTools []anthropic.ToolUnionParam
	if len(tools) > 0 {
		anthropicTools = c.convertTools(tools)
	}

	// Build request params
	params := anthropic.MessageNewParams{
		Model:     anthropic.Model(c.model),
		MaxTokens: int64(c.maxTokens),
		Messages:  anthropicMessages,
	}

	if len(systemBlocks) > 0 {
		params.System = systemBlocks
	}

	if len(anthropicTools) > 0 {
		params.Tools = anthropicTools
	}

	// Log before request
	if c.logger != nil {
		c.logger.WithFields(logrus.Fields{
			"model":      c.model,
			"messages":   len(messages),
			"max_tokens": c.maxTokens,
			"tools":      len(tools),
		}).Debug("Sending " + c.providerName + " chat request")
	}

	startTime := time.Now()

	// Convert anthropic.RetryConfig to models.RetryConfig for retry logic
	modelsRetryConfig := models.RetryConfig{
		MaxRetries:    c.retryConfig.MaxRetries,
		InitialDelay:  c.retryConfig.InitialDelay,
		BackoffFactor: c.retryConfig.BackoffFactor,
		Jitter:        c.retryConfig.Jitter,
	}

	// Convert anthropic.RetryCallback to models.RetryCallback
	var modelsRetryCallback models.RetryCallback
	if c.onRetry != nil {
		modelsRetryCallback = func(attempt, maxRetries int, delay time.Duration, err error) {
			c.onRetry(attempt, maxRetries, delay, err.Error())
		}
	}

	// Execute with retry logic
	resp, err := models.RetryWithCallback(ctx, modelsRetryConfig, func() (*anthropic.Message, error) {
		return c.client.Messages.New(ctx, params)
	}, modelsRetryCallback, c.logger)

	duration := time.Since(startTime)

	if err != nil {
		if c.logger != nil {
			c.logger.WithFields(logrus.Fields{
				"model":    c.model,
				"duration": fmt.Sprintf("%.2fs", duration.Seconds()),
				"error":    err.Error(),
			}).Debug(c.providerName + " request failed")
		}
		return nil, fmt.Errorf("%s error: %w", c.providerName, err)
	}

	// Log after response
	if c.logger != nil {
		c.logger.WithFields(logrus.Fields{
			"model":         c.model,
			"duration":      fmt.Sprintf("%.2fs", duration.Seconds()),
			"prompt_tokens": resp.Usage.InputTokens,
			"comp_tokens":   resp.Usage.OutputTokens,
			"total_tokens":  resp.Usage.InputTokens + resp.Usage.OutputTokens,
		}).Debug(c.providerName + " response received")
	}

	// Build response
	result := &models.Response{
		StopReason:       string(resp.StopReason),
		TokensUsed:       int(resp.Usage.InputTokens + resp.Usage.OutputTokens),
		PromptTokens:     int(resp.Usage.InputTokens),
		CompletionTokens: int(resp.Usage.OutputTokens),
	}

	// Parse content blocks
	for _, blockUnion := range resp.Content {
		switch block := blockUnion.AsAny().(type) {
		case anthropic.TextBlock:
			if result.Content == "" {
				result.Content = block.Text
			} else {
				result.Content += "\n\n" + block.Text
			}
		case anthropic.ToolUseBlock:
			args := make(map[string]interface{})
			if err := json.Unmarshal(block.Input, &args); err != nil {
				return nil, fmt.Errorf("failed to parse tool arguments: %w", err)
			}
			result.ToolCalls = append(result.ToolCalls, models.ToolCall{
				ID:        string(block.ID),
				Name:      block.Name,
				Arguments: args,
			})
		}
	}

	return result, nil
}

// BuildToolResultMessage creates a message for tool result
func BuildToolResultMessage(toolCallID, content string) models.Message {
	return models.Message{
		Role:       "tool",
		Content:    content,
		ToolCallID: toolCallID,
	}
}

// BuildAssistantMessageWithToolCalls creates assistant message with tool calls
func BuildAssistantMessageWithToolCalls(content string, toolCalls []models.ToolCall) models.Message {
	return models.Message{
		Role:      "assistant",
		Content:   content,
		ToolCalls: toolCalls,
	}
}
