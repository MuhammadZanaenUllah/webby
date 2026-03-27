package openai

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"webby-builder/internal/models"

	openai "github.com/sashabaranov/go-openai"
	"github.com/sirupsen/logrus"
)

// Client implements AIProvider using OpenAI or compatible APIs
type Client struct {
	client      *openai.Client
	model       string
	maxTokens   int
	logger      *logrus.Logger
	retryConfig models.RetryConfig
	onRetry     models.RetryCallback
}

// Ensure Client implements AIProvider
var _ models.AIProvider = (*Client)(nil)

// NewClient creates a new OpenAI client (backward compatible)
func NewClient(apiKey string, model string, maxTokens int) *Client {
	return NewClientWithConfig(models.ProviderConfig{
		APIKey:    apiKey,
		Model:     model,
		MaxTokens: maxTokens,
	}, nil)
}

// NewClientWithConfig creates a client with full configuration
func NewClientWithConfig(cfg models.ProviderConfig, logger *logrus.Logger) *Client {
	return NewClientWithRetry(cfg, logger, models.DefaultRetryConfig(), nil)
}

// NewClientWithRetry creates a client with custom retry configuration
func NewClientWithRetry(cfg models.ProviderConfig, logger *logrus.Logger, retryConfig models.RetryConfig, onRetry models.RetryCallback) *Client {
	var oaiClient *openai.Client

	if cfg.BaseURL != "" {
		// Custom base URL (for compatible APIs)
		openaiConfig := openai.DefaultConfig(cfg.APIKey)
		openaiConfig.BaseURL = cfg.BaseURL
		oaiClient = openai.NewClientWithConfig(openaiConfig)
	} else {
		// Standard OpenAI
		oaiClient = openai.NewClient(cfg.APIKey)
	}

	model := cfg.Model
	if model == "" {
		model = "gpt-4o"
	}

	maxTokens := cfg.MaxTokens
	if maxTokens == 0 {
		maxTokens = 16384
	}

	return &Client{
		client:      oaiClient,
		model:       model,
		maxTokens:   maxTokens,
		logger:      logger,
		retryConfig: retryConfig,
		onRetry:     onRetry,
	}
}

// SetRetryCallback sets the callback for retry events
func (c *Client) SetRetryCallback(callback models.RetryCallback) {
	c.onRetry = callback
}

// convertMessage converts our Message to OpenAI format
func (c *Client) convertMessage(msg models.Message) openai.ChatCompletionMessage {
	m := openai.ChatCompletionMessage{
		Role:    msg.Role,
		Content: msg.Content,
	}

	if msg.ToolCallID != "" {
		m.ToolCallID = msg.ToolCallID
	}
	if len(msg.ToolCalls) > 0 {
		m.ToolCalls = ConvertToolCallsToOpenAI(msg.ToolCalls)
	}
	return m
}

// Chat sends messages and returns response with potential tool calls
func (c *Client) Chat(ctx context.Context, messages []models.Message, tools []models.ToolDefinition) (*models.Response, error) {
	// Convert messages to OpenAI format
	openaiMessages := make([]openai.ChatCompletionMessage, 0, len(messages))
	for _, msg := range messages {
		openaiMessages = append(openaiMessages, c.convertMessage(msg))
	}

	// Convert tools to OpenAI format
	openaiTools := make([]openai.Tool, len(tools))
	for i, tool := range tools {
		openaiTools[i] = openai.Tool{
			Type: openai.ToolTypeFunction,
			Function: &openai.FunctionDefinition{
				Name:        tool.Name,
				Description: tool.Description,
				Parameters:  tool.Parameters,
			},
		}
	}

	req := openai.ChatCompletionRequest{
		Model:               c.model,
		MaxCompletionTokens: c.maxTokens,
		Messages:            openaiMessages,
		Tools:               openaiTools,
	}

	// Log before request
	if c.logger != nil {
		c.logger.WithFields(logrus.Fields{
			"model":      c.model,
			"messages":   len(messages),
			"max_tokens": c.maxTokens,
		}).Debug("Sending chat request")
	}

	startTime := time.Now()

	// Create retry callback that wraps our callback
	var retryCallback models.RetryCallback
	if c.onRetry != nil {
		retryCallback = c.onRetry
	}

	// Execute with retry logic
	resp, err := models.RetryWithCallback(ctx, c.retryConfig, func() (openai.ChatCompletionResponse, error) {
		return c.client.CreateChatCompletion(ctx, req)
	}, retryCallback, c.logger)

	duration := time.Since(startTime)

	if err != nil {
		if c.logger != nil {
			c.logger.WithFields(logrus.Fields{
				"model":    c.model,
				"duration": fmt.Sprintf("%.2fs", duration.Seconds()),
				"error":    err.Error(),
			}).Debug("AI request failed")
		}
		return nil, fmt.Errorf("openai error: %w", err)
	}

	if len(resp.Choices) == 0 {
		return nil, fmt.Errorf("no response from OpenAI")
	}

	// Log after response
	if c.logger != nil {
		c.logger.WithFields(logrus.Fields{
			"model":         c.model,
			"duration":      fmt.Sprintf("%.2fs", duration.Seconds()),
			"prompt_tokens": resp.Usage.PromptTokens,
			"comp_tokens":   resp.Usage.CompletionTokens,
			"total_tokens":  resp.Usage.TotalTokens,
		}).Debug("AI response received")
	}

	choice := resp.Choices[0]
	result := &models.Response{
		Content:          choice.Message.Content,
		StopReason:       string(choice.FinishReason),
		TokensUsed:       resp.Usage.TotalTokens,
		PromptTokens:     resp.Usage.PromptTokens,
		CompletionTokens: resp.Usage.CompletionTokens,
	}

	// Parse tool calls
	for _, tc := range choice.Message.ToolCalls {
		args := make(map[string]interface{})
		if err := json.Unmarshal([]byte(tc.Function.Arguments), &args); err != nil {
			return nil, fmt.Errorf("failed to parse tool arguments: %w", err)
		}
		result.ToolCalls = append(result.ToolCalls, models.ToolCall{
			ID:        tc.ID,
			Name:      tc.Function.Name,
			Arguments: args,
		})
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

// ConvertToolCallsToOpenAI converts our ToolCall to openai.ToolCall
func ConvertToolCallsToOpenAI(calls []models.ToolCall) []openai.ToolCall {
	result := make([]openai.ToolCall, len(calls))
	for i, tc := range calls {
		args, _ := json.Marshal(tc.Arguments)
		result[i] = openai.ToolCall{
			ID:   tc.ID,
			Type: openai.ToolTypeFunction,
			Function: openai.FunctionCall{
				Name:      tc.Name,
				Arguments: string(args),
			},
		}
	}
	return result
}
