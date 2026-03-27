package pusher

import (
	"fmt"
	"sync"

	"webby-builder/internal/models"

	"github.com/sirupsen/logrus"
)

// PusherStreamer streams events directly to Pusher
// Handles: thinking, action, tool_result, message, complete, error
// Ignores: status (handled by webhook), tool_call (large payloads exceed 10KB limit)
type PusherStreamer struct {
	client    Client
	sessionID string
	channel   string
	closed    bool
	mu        sync.Mutex
	logger    *logrus.Logger
}

// NewPusherStreamer creates a new Pusher-based streamer.
// channelID is the ID used for the Pusher channel name (typically the workspace/project ID).
func NewPusherStreamer(client Client, channelID string) *PusherStreamer {
	return NewPusherStreamerWithLogger(client, channelID, nil)
}

// NewPusherStreamerWithLogger creates a new Pusher-based streamer with debug logging.
// channelID is the ID used for the Pusher channel name (typically the workspace/project ID).
func NewPusherStreamerWithLogger(client Client, channelID string, logger *logrus.Logger) *PusherStreamer {
	return &PusherStreamer{
		client:    client,
		sessionID: channelID,
		channel:   fmt.Sprintf("session.%s", channelID),
		logger:    logger,
	}
}

// maxPusherContentSize is the max size for string content in Pusher events.
// Pusher's payload limit is 10KB; we cap at 8KB to leave room for JSON overhead.
const maxPusherContentSize = 8000

// truncateForPusher truncates a string to fit within Pusher's payload limit.
func truncateForPusher(s string) string {
	if len(s) <= maxPusherContentSize {
		return s
	}
	return s[:maxPusherContentSize] + "\n\n[truncated]"
}

// send sends an event to Pusher
func (s *PusherStreamer) send(eventType string, data interface{}) {
	s.mu.Lock()
	if s.closed {
		s.mu.Unlock()
		return
	}
	s.mu.Unlock()

	// Debug log before sending
	if s.logger != nil {
		s.logger.WithFields(logrus.Fields{
			"channel":    s.channel,
			"event_type": eventType,
			"session_id": s.sessionID,
		}).Debug("Sending WebSocket event")
	}

	// Send to Pusher (fire and forget - don't block on errors).
	// Goroutine is bounded by the Pusher HTTP client's 10s timeout (see client.go).
	go func() {
		err := s.client.Trigger(s.channel, eventType, data)
		if err != nil && s.logger != nil {
			s.logger.WithFields(logrus.Fields{
				"channel":    s.channel,
				"event_type": eventType,
				"session_id": s.sessionID,
				"error":      err.Error(),
			}).Error("WebSocket event failed")
		}
	}()
}

// sendSync sends an event to Pusher synchronously, blocking until delivery.
// Used for critical terminal events (complete, error) that must not be lost.
func (s *PusherStreamer) sendSync(eventType string, data interface{}) {
	s.mu.Lock()
	if s.closed {
		s.mu.Unlock()
		return
	}
	s.mu.Unlock()

	if s.logger != nil {
		s.logger.WithFields(logrus.Fields{
			"channel":    s.channel,
			"event_type": eventType,
			"session_id": s.sessionID,
		}).Debug("Sending WebSocket event (sync)")
	}

	err := s.client.Trigger(s.channel, eventType, data)
	if err != nil && s.logger != nil {
		s.logger.WithFields(logrus.Fields{
			"channel":    s.channel,
			"event_type": eventType,
			"session_id": s.sessionID,
			"error":      err.Error(),
		}).Error("WebSocket event failed (sync)")
	}
}

// SendStatus sends a status event to Pusher for real-time UI updates
func (s *PusherStreamer) SendStatus(status, message string) {
	s.send(models.EventStatus, models.StatusData{
		Status:  status,
		Message: message,
	})
}

// SendThinking sends a thinking event to Pusher
func (s *PusherStreamer) SendThinking(content string, iteration int) {
	s.send(models.EventThinking, models.ThinkingData{
		Content:   content,
		Iteration: iteration,
	})
}

// SendToolCall is a no-op - tool_call payloads contain file contents that exceed
// Pusher's 10KB limit. The action event provides sufficient UI feedback.
func (s *PusherStreamer) SendToolCall(id, tool string, params map[string]interface{}) {
	// No-op: action event already provides UI feedback for tool calls
}

// SendToolResult sends a tool_result event to Pusher
func (s *PusherStreamer) SendToolResult(id, tool string, success bool, output string, durationMs int64, iteration int) {
	s.send(models.EventToolResult, models.ToolResultData{
		ID:         id,
		Tool:       tool,
		Success:    success,
		Output:     output,
		DurationMs: durationMs,
		Iteration:  iteration,
	})
}

// SendAction sends a human-friendly action event to Pusher
func (s *PusherStreamer) SendAction(action, target, details, category string) {
	s.send(models.EventAction, models.ActionData{
		Action:   action,
		Target:   target,
		Details:  details,
		Category: category,
	})
}

// SendMessage sends a message event to Pusher
func (s *PusherStreamer) SendMessage(content string) {
	s.send(models.EventMessage, models.MessageData{
		Content: truncateForPusher(content),
	})
}

// SendError sends an error event to Pusher synchronously.
// Uses sendSync because error is a terminal event that must not be lost.
func (s *PusherStreamer) SendError(err string) {
	s.sendSync(models.EventError, models.ErrorData{
		Error: err,
	})
}

// SendComplete sends a complete event to Pusher synchronously.
// Uses sendSync because complete is a terminal event that must not be lost.
func (s *PusherStreamer) SendComplete(data models.CompleteData) {
	data.Message = truncateForPusher(data.Message)
	s.sendSync(models.EventComplete, data)
}

// SendIterationStart sends an iteration_start event to Pusher
func (s *PusherStreamer) SendIterationStart(iteration, maxIteration int) {
	s.send(models.EventIterationStart, models.IterationStartData{
		Iteration:    iteration,
		MaxIteration: maxIteration,
	})
}

// SendRetry sends a retry event to Pusher
func (s *PusherStreamer) SendRetry(attempt, maxRetries int, delayMs int64, reason string) {
	s.send(models.EventRetry, models.RetryData{
		Attempt:    attempt,
		MaxRetries: maxRetries,
		DelayMs:    delayMs,
		Reason:     reason,
	})
}

// SendTokenUsage sends a token_usage event to Pusher
func (s *PusherStreamer) SendTokenUsage(prompt, completion, total, context int) {
	s.send(models.EventTokenUsage, models.TokenUsageData{
		PromptTokens:     prompt,
		CompletionTokens: completion,
		TotalTokens:      total,
		ContextTokens:    context,
	})
}

// SendToolTimeout sends a tool_timeout event to Pusher
func (s *PusherStreamer) SendToolTimeout(tool string, timeoutSec int, attempt int) {
	s.send(models.EventToolTimeout, models.ToolTimeoutData{
		Tool:       tool,
		TimeoutSec: timeoutSec,
		Attempt:    attempt,
	})
}

// SendToolRetry sends a tool_retry event to Pusher
func (s *PusherStreamer) SendToolRetry(tool string, attempt, maxRetries int, delayMs int64, reason string) {
	s.send(models.EventToolRetry, models.ToolRetryData{
		Tool:       tool,
		Attempt:    attempt,
		MaxRetries: maxRetries,
		DelayMs:    delayMs,
		Reason:     reason,
	})
}

// SendPlan sends a plan event to Pusher
func (s *PusherStreamer) SendPlan(summary string, steps []models.PlanStep, dependencies, risks []string) {
	s.send(models.EventPlan, models.PlanData{
		Summary:      summary,
		Steps:        steps,
		Dependencies: dependencies,
		Risks:        risks,
	})
}

// SendCreditWarning sends a credit_warning event to Pusher
func (s *PusherStreamer) SendCreditWarning(data models.CreditEventData) {
	s.send(models.EventCreditWarning, data)
}

// SendCreditExceeded sends a credit_exceeded event to Pusher
func (s *PusherStreamer) SendCreditExceeded(data models.CreditEventData) {
	s.send(models.EventCreditExceeded, data)
}

// SendSummarizationComplete sends a summarization_complete event to Pusher
func (s *PusherStreamer) SendSummarizationComplete(data models.SummarizationEventData) {
	s.send(models.EventSummarizationComplete, data)
}

// Close closes the Pusher streamer
func (s *PusherStreamer) Close() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.closed = true
}
