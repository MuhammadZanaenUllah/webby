package pusher

import (
	"webby-builder/internal/models"
	"webby-builder/internal/webhook"

	"github.com/sirupsen/logrus"
)

// HybridStreamer combines Pusher for low-latency real-time events
// with Webhook for critical state updates (status, complete, error)
type HybridStreamer struct {
	pusher  *PusherStreamer
	webhook webhook.Streamer
}

// NewHybridStreamer creates a streamer that routes events appropriately:
// - Real-time events (thinking, action, tool_result, message) -> Pusher
// - Critical events (status, complete, error) -> Webhook (for DB updates)
// - tool_call is a no-op (large payloads exceed Pusher's 10KB limit)
// channelID is used for the Pusher channel name (typically the workspace/project ID).
func NewHybridStreamer(pusherClient Client, webhookStreamer webhook.Streamer, channelID string) *HybridStreamer {
	return NewHybridStreamerWithLogger(pusherClient, webhookStreamer, channelID, nil)
}

// NewHybridStreamerWithLogger creates a hybrid streamer with debug logging.
// channelID is used for the Pusher channel name (typically the workspace/project ID).
func NewHybridStreamerWithLogger(pusherClient Client, webhookStreamer webhook.Streamer, channelID string, logger *logrus.Logger) *HybridStreamer {
	return &HybridStreamer{
		pusher:  NewPusherStreamerWithLogger(pusherClient, channelID, logger),
		webhook: webhookStreamer,
	}
}

// SendStatus sends to BOTH Pusher (real-time UI) and webhook (for DB updates)
func (h *HybridStreamer) SendStatus(status, message string) {
	h.pusher.SendStatus(status, message)
	h.webhook.SendStatus(status, message)
}

// SendThinking sends to both Pusher (real-time) and webhook (persistence)
func (h *HybridStreamer) SendThinking(content string, iteration int) {
	h.pusher.SendThinking(content, iteration)
	h.webhook.SendThinking(content, iteration)
}

// SendToolCall is a no-op - tool_call events contain large payloads (file contents)
// that exceed Pusher's 10KB limit. The action event provides sufficient UI feedback.
func (h *HybridStreamer) SendToolCall(id, tool string, params map[string]interface{}) {
	// No-op: action event already provides UI feedback for tool calls
}

// SendToolResult sends to Pusher for low-latency streaming
func (h *HybridStreamer) SendToolResult(id, tool string, success bool, output string, durationMs int64, iteration int) {
	h.pusher.SendToolResult(id, tool, success, output, durationMs, iteration)
}

// SendAction sends to BOTH Pusher (real-time) AND webhook (for persistence)
func (h *HybridStreamer) SendAction(action, target, details, category string) {
	h.pusher.SendAction(action, target, details, category)
	h.webhook.SendAction(action, target, details, category)
}

// SendMessage sends to BOTH Pusher (real-time) AND webhook (for persistence)
func (h *HybridStreamer) SendMessage(content string) {
	h.pusher.SendMessage(content)
	h.webhook.SendMessage(content)
}

// SendError sends to both Pusher (for real-time UI) and webhook (for DB updates)
func (h *HybridStreamer) SendError(err string) {
	h.pusher.SendError(err)
	h.webhook.SendError(err)
}

// SendComplete sends to both Pusher (for real-time UI) and webhook (for DB updates)
func (h *HybridStreamer) SendComplete(data models.CompleteData) {
	h.pusher.SendComplete(data)
	h.webhook.SendComplete(data)
}

// SendIterationStart sends to Pusher for low-latency streaming
func (h *HybridStreamer) SendIterationStart(iteration, maxIteration int) {
	h.pusher.SendIterationStart(iteration, maxIteration)
}

// SendRetry sends to Pusher for low-latency streaming
func (h *HybridStreamer) SendRetry(attempt, maxRetries int, delayMs int64, reason string) {
	h.pusher.SendRetry(attempt, maxRetries, delayMs, reason)
}

// SendTokenUsage sends to Pusher for low-latency streaming
func (h *HybridStreamer) SendTokenUsage(prompt, completion, total, context int) {
	h.pusher.SendTokenUsage(prompt, completion, total, context)
}

// SendToolTimeout sends to Pusher for low-latency streaming
func (h *HybridStreamer) SendToolTimeout(tool string, timeoutSec int, attempt int) {
	h.pusher.SendToolTimeout(tool, timeoutSec, attempt)
}

// SendToolRetry sends to Pusher for low-latency streaming
func (h *HybridStreamer) SendToolRetry(tool string, attempt, maxRetries int, delayMs int64, reason string) {
	h.pusher.SendToolRetry(tool, attempt, maxRetries, delayMs, reason)
}

// SendPlan sends to BOTH Pusher (real-time) AND webhook (for persistence)
func (h *HybridStreamer) SendPlan(summary string, steps []models.PlanStep, dependencies, risks []string) {
	h.pusher.SendPlan(summary, steps, dependencies, risks)
	h.webhook.SendPlan(summary, steps, dependencies, risks)
}

// SendCreditWarning sends to BOTH Pusher and webhook
func (h *HybridStreamer) SendCreditWarning(data models.CreditEventData) {
	h.pusher.SendCreditWarning(data)
	h.webhook.SendCreditWarning(data)
}

// SendCreditExceeded sends to BOTH Pusher and webhook
func (h *HybridStreamer) SendCreditExceeded(data models.CreditEventData) {
	h.pusher.SendCreditExceeded(data)
	h.webhook.SendCreditExceeded(data)
}

// SendSummarizationComplete sends to BOTH Pusher and webhook
func (h *HybridStreamer) SendSummarizationComplete(data models.SummarizationEventData) {
	h.pusher.SendSummarizationComplete(data)
	h.webhook.SendSummarizationComplete(data)
}

// Close closes both streamers
func (h *HybridStreamer) Close() {
	h.pusher.Close()
	h.webhook.Close()
}
