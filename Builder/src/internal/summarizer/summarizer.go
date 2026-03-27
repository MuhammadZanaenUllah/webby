package summarizer

import (
	"context"
	"fmt"
	"strings"
	"time"

	"webby-builder/internal/models"

	openai "github.com/sashabaranov/go-openai"
)

// Turn represents a single turn in the conversation
type Turn struct {
	Role    string
	Content string
}

// ConversationState contains the processed conversation
type ConversationState struct {
	Summary      string
	RecentTurns  []Turn
	FilesCreated []string
	FilesEdited  []string
	// Token usage from summarization API call (0 if no API call made)
	PromptTokens     int
	CompletionTokens int
	TotalTokens      int
}

// Summarizer handles conversation compression
type Summarizer struct {
	client              *openai.Client
	model               string
	maxTokens           int // Token threshold for triggering summarization
	keepRecent          int // Number of recent turns to keep in full
	maxCompletionTokens int // Max tokens for summary output (configurable)
}

// NewSummarizer creates a new summarizer (backward compatible)
func NewSummarizer(apiKey string) *Summarizer {
	return NewSummarizerWithConfig(models.ProviderConfig{
		APIKey: apiKey,
		Model:  "gpt-4o-mini",
	})
}

// NewSummarizerWithConfig creates a summarizer with full configuration
func NewSummarizerWithConfig(cfg models.ProviderConfig) *Summarizer {
	var client *openai.Client

	if cfg.BaseURL != "" {
		openaiConfig := openai.DefaultConfig(cfg.APIKey)
		openaiConfig.BaseURL = cfg.BaseURL
		client = openai.NewClientWithConfig(openaiConfig)
	} else {
		client = openai.NewClient(cfg.APIKey)
	}

	model := cfg.Model
	if model == "" {
		model = "gpt-4o-mini"
	}

	// Use configurable max tokens for summary output, default to 500
	maxCompletionTokens := cfg.MaxTokens
	if maxCompletionTokens == 0 {
		maxCompletionTokens = 500
	}

	return &Summarizer{
		client:              client,
		model:               model,
		maxTokens:           8000, // Trigger at 8000 estimated tokens
		keepRecent:          6,    // Keep last 6 turns in full
		maxCompletionTokens: maxCompletionTokens,
	}
}

// IsContextOverflowError checks if an error is a context window overflow error
// from the LLM API. Used to trigger retry with fewer turns.
func IsContextOverflowError(err error) bool {
	if err == nil {
		return false
	}
	errStr := strings.ToLower(err.Error())
	return strings.Contains(errStr, "context length") ||
		strings.Contains(errStr, "maximum context") ||
		strings.Contains(errStr, "token limit") ||
		strings.Contains(errStr, "too long")
}

// Process analyzes conversation and returns compressed state if needed
func (s *Summarizer) Process(ctx context.Context, turns []Turn) (*ConversationState, error) {
	tokens := s.estimateTokens(turns)

	// If under threshold, return all turns as-is
	if tokens < s.maxTokens || len(turns) <= s.keepRecent {
		return &ConversationState{
			RecentTurns: turns,
		}, nil
	}

	// Split: old turns to summarize, recent to keep
	splitPoint := len(turns) - s.keepRecent
	oldTurns := turns[:splitPoint]
	recentTurns := turns[splitPoint:]

	// Guard against nil client (can happen if API key is missing)
	if s.client == nil {
		return &ConversationState{
			RecentTurns: recentTurns,
		}, nil
	}

	// Generate summary with retry on context overflow
	maxRetries := 3
	for attempt := 0; attempt <= maxRetries; attempt++ {
		if len(oldTurns) == 0 {
			break
		}

		result, err := s.generateSummary(ctx, oldTurns)
		if err == nil {
			return &ConversationState{
				Summary:          result.Content,
				RecentTurns:      recentTurns,
				PromptTokens:     result.PromptTokens,
				CompletionTokens: result.CompletionTokens,
				TotalTokens:      result.TotalTokens,
			}, nil
		}

		// If not a context overflow error or last attempt, stop retrying
		if !IsContextOverflowError(err) || attempt == maxRetries {
			break
		}

		// Trim oldest 33% and retry
		trimCount := len(oldTurns) / 3
		if trimCount < 1 {
			trimCount = 1
		}
		oldTurns = oldTurns[trimCount:]
	}

	// Fallback: keep just recent turns
	return &ConversationState{
		RecentTurns: recentTurns,
	}, nil
}

// estimateTokens roughly estimates token count
// Uses word-based heuristic: ~1.3 tokens per word (more accurate than char-based)
func (s *Summarizer) estimateTokens(turns []Turn) int {
	total := 0
	for _, t := range turns {
		total += EstimateTokens(t.Content)
	}
	return total
}

// EstimateTokens estimates token count for a string using word-based heuristic
// Average is ~1.3 tokens per word for English text with code
func EstimateTokens(text string) int {
	if len(text) == 0 {
		return 0
	}
	// Count words by splitting on whitespace
	words := 0
	inWord := false
	for _, r := range text {
		if r == ' ' || r == '\t' || r == '\n' || r == '\r' {
			if inWord {
				words++
				inWord = false
			}
		} else {
			inWord = true
		}
	}
	if inWord {
		words++
	}

	// ~1.3 tokens per word, minimum 1 token per word
	tokens := int(float64(words) * 1.3)
	if tokens < words {
		tokens = words
	}
	return tokens
}

// EstimateMessagesTokens estimates total tokens for a slice of messages
func EstimateMessagesTokens(messages []struct{ Role, Content string }) int {
	total := 0
	for _, m := range messages {
		// Add role overhead (~4 tokens per message for role and formatting)
		total += 4
		total += EstimateTokens(m.Content)
	}
	return total
}

// EstimateConversationTokens estimates total tokens for models.Message slice
func EstimateConversationTokens(messages []models.Message) int {
	total := 0
	for _, m := range messages {
		// Add role overhead (~4 tokens per message for role and formatting)
		total += 4
		total += EstimateTokens(m.Content)
		// Add overhead for tool calls (each tool call is ~20 tokens for metadata + content)
		total += len(m.ToolCalls) * 20
	}
	return total
}

// summaryResult holds the result of a summary generation including token usage
type summaryResult struct {
	Content          string
	PromptTokens     int
	CompletionTokens int
	TotalTokens      int
}

// generateSummary creates a concise summary of older conversation turns
func (s *Summarizer) generateSummary(ctx context.Context, turns []Turn) (*summaryResult, error) {
	// Add explicit timeout for summarization (30 seconds max)
	summarizeCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	// Build conversation text
	var conversation strings.Builder
	for _, t := range turns {
		content := t.Content
		// Truncate very long messages
		if len(content) > 1000 {
			content = content[:1000] + "..."
		}
		fmt.Fprintf(&conversation, "%s: %s\n\n", t.Role, content)
	}

	prompt := fmt.Sprintf(`Compress this website builder conversation (max 300 words):

%s

Format your response EXACTLY as:
GOAL: [what user wanted in one sentence]
FILES: [comma-separated file paths that were created/edited]
DESIGN: [key visual decisions - colors, layout, features]
STATUS: [completed/in-progress/blocked]
NOTES: [any issues or pending items]

Be concise. Preserve all file names and specific design choices.`, conversation.String())

	resp, err := s.client.CreateChatCompletion(summarizeCtx, openai.ChatCompletionRequest{
		Model:               s.model,
		MaxCompletionTokens: s.maxCompletionTokens, // Use configurable value
		Messages: []openai.ChatCompletionMessage{
			{
				Role:    "system",
				Content: "You compress website builder conversations into structured summaries. Preserve all file paths and design specifics. Use the exact format requested.",
			},
			{
				Role:    "user",
				Content: prompt,
			},
		},
	})

	if err != nil {
		if summarizeCtx.Err() == context.DeadlineExceeded {
			return nil, fmt.Errorf("summarization timed out after 30s")
		}
		return nil, fmt.Errorf("summarization error: %w", err)
	}

	if len(resp.Choices) == 0 {
		return nil, fmt.Errorf("no summary response")
	}

	// Capture token usage from response (was previously discarded)
	return &summaryResult{
		Content:          resp.Choices[0].Message.Content,
		PromptTokens:     resp.Usage.PromptTokens,
		CompletionTokens: resp.Usage.CompletionTokens,
		TotalTokens:      resp.Usage.TotalTokens,
	}, nil
}

// ShouldSummarize checks if conversation needs summarization
func (s *Summarizer) ShouldSummarize(turns []Turn) bool {
	return s.estimateTokens(turns) >= s.maxTokens && len(turns) > s.keepRecent
}

// GetKeepRecent returns the number of recent turns to keep in full
func (s *Summarizer) GetKeepRecent() int {
	return s.keepRecent
}

// BuildMessages creates the message array with summary included
func BuildMessagesWithSummary(systemPrompt string, state *ConversationState) []struct{ Role, Content string } {
	messages := []struct{ Role, Content string }{
		{Role: "system", Content: systemPrompt},
	}

	// Add summary if exists
	if state.Summary != "" {
		messages = append(messages, struct{ Role, Content string }{
			Role:    "system",
			Content: "CONVERSATION HISTORY:\n" + state.Summary,
		})
	}

	// Add recent turns
	for _, turn := range state.RecentTurns {
		messages = append(messages, struct{ Role, Content string }{
			Role:    turn.Role,
			Content: turn.Content,
		})
	}

	return messages
}
