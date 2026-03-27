package webhook

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"

	"webby-builder/internal/models"
)

// WebhookPayload is the JSON payload sent to webhooks
type WebhookPayload struct {
	SessionID string      `json:"session_id"`
	EventID   string      `json:"event_id"` // Unique per event for idempotency
	EventType string      `json:"event_type"`
	Data      interface{} `json:"data"`
	Timestamp time.Time   `json:"timestamp"`
}

// Streamer interface defines methods for streaming events via Pusher and webhooks
type Streamer interface {
	SendStatus(status, message string)
	SendThinking(content string, iteration int)
	SendToolCall(id, tool string, params map[string]interface{})
	SendToolResult(id, tool string, success bool, output string, durationMs int64, iteration int)
	SendAction(action, target, details, category string)
	SendMessage(content string)
	SendError(err string)
	SendComplete(data models.CompleteData)
	SendPlan(summary string, steps []models.PlanStep, dependencies, risks []string)

	// Granular progress events
	SendIterationStart(iteration, maxIteration int)
	SendRetry(attempt, maxRetries int, delayMs int64, reason string)
	SendTokenUsage(prompt, completion, total, context int)
	SendToolTimeout(tool string, timeoutSec int, attempt int)
	SendToolRetry(tool string, attempt, maxRetries int, delayMs int64, reason string)

	// Credit enforcement events
	SendCreditWarning(data models.CreditEventData)
	SendCreditExceeded(data models.CreditEventData)

	// Summarization events
	SendSummarizationComplete(data models.SummarizationEventData)

	Close()
}

// Notifier sends events to a webhook URL
type Notifier struct {
	webhookURL string
	serverKey  string
	sessionID  string
	maxRetries int
	retryDelay time.Duration
	client     *http.Client
	ctx        context.Context
	cancel     context.CancelFunc
	wg         sync.WaitGroup
	closed     bool
	mu         sync.Mutex
	eventQueue chan WebhookPayload
}

// NewNotifier creates a new webhook notifier with default settings
func NewNotifier(webhookURL, serverKey, sessionID string) *Notifier {
	return NewNotifierWithRetry(webhookURL, serverKey, sessionID, 3, 100*time.Millisecond)
}

// NewNotifierWithRetry creates a notifier with custom retry settings
func NewNotifierWithRetry(webhookURL, serverKey, sessionID string, maxRetries int, retryDelay time.Duration) *Notifier {
	ctx, cancel := context.WithCancel(context.Background())
	return newNotifier(ctx, cancel, webhookURL, serverKey, sessionID, maxRetries, retryDelay)
}

// NewNotifierWithContext creates a notifier with a parent context
func NewNotifierWithContext(ctx context.Context, webhookURL, serverKey, sessionID string) *Notifier {
	childCtx, cancel := context.WithCancel(ctx)
	return newNotifier(childCtx, cancel, webhookURL, serverKey, sessionID, 3, 100*time.Millisecond)
}

func newNotifier(ctx context.Context, cancel context.CancelFunc, webhookURL, serverKey, sessionID string, maxRetries int, retryDelay time.Duration) *Notifier {
	n := &Notifier{
		webhookURL: webhookURL,
		serverKey:  serverKey,
		sessionID:  sessionID,
		maxRetries: maxRetries,
		retryDelay: retryDelay,
		client: &http.Client{
			Timeout: 10 * time.Second,
		},
		ctx:        ctx,
		cancel:     cancel,
		eventQueue: make(chan WebhookPayload, 100),
	}

	// Start background worker
	n.wg.Add(1)
	go n.worker()

	return n
}

// worker processes events from the queue
func (n *Notifier) worker() {
	defer n.wg.Done()

	for {
		select {
		case payload, ok := <-n.eventQueue:
			if !ok {
				// Channel closed, drain any remaining events that were queued
				// before we noticed the closure
				return
			}
			// Check if context is cancelled before sending
			select {
			case <-n.ctx.Done():
				return
			default:
				n.sendWithRetry(payload)
			}
		case <-n.ctx.Done():
			// Context cancelled, drain remaining events quickly
			for {
				select {
				case _, ok := <-n.eventQueue:
					if !ok {
						return
					}
					// Skip sending, just drain
				default:
					return
				}
			}
		}
	}
}

// sendWithRetry sends a payload with retry logic
func (n *Notifier) sendWithRetry(payload WebhookPayload) {
	for attempt := 0; attempt < n.maxRetries; attempt++ {
		select {
		case <-n.ctx.Done():
			return
		default:
		}

		if n.send(payload) {
			return
		}

		// Wait before retry (except on last attempt)
		if attempt < n.maxRetries-1 {
			select {
			case <-n.ctx.Done():
				return
			case <-time.After(n.retryDelay * time.Duration(attempt+1)):
			}
		}
	}
}

// send sends a single webhook payload
func (n *Notifier) send(payload WebhookPayload) bool {
	body, err := json.Marshal(payload)
	if err != nil {
		return false
	}

	req, err := http.NewRequestWithContext(n.ctx, "POST", n.webhookURL, bytes.NewReader(body))
	if err != nil {
		return false
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Server-Key", n.serverKey)
	req.Header.Set("X-Webhook-ID", payload.EventID)
	req.Header.Set("User-Agent", models.HTTPUserAgent)

	resp, err := n.client.Do(req)
	if err != nil {
		return false
	}
	defer func() { _ = resp.Body.Close() }()

	return resp.StatusCode >= 200 && resp.StatusCode < 300
}

// SendDirectly sends a webhook event synchronously, bypassing the async queue.
// Used for terminal events (complete, error) that must reach the server promptly
// and should not be blocked by slow or failing events ahead in the queue.
func (n *Notifier) SendDirectly(eventType string, data interface{}) bool {
	n.mu.Lock()
	if n.closed {
		n.mu.Unlock()
		return false
	}
	n.mu.Unlock()

	timestamp := time.Now().UTC()
	h := sha256.New()
	_, _ = fmt.Fprintf(h, "%s:%s:%d", n.sessionID, eventType, timestamp.UnixNano())
	eventID := hex.EncodeToString(h.Sum(nil))[:32]

	payload := WebhookPayload{
		SessionID: n.sessionID,
		EventID:   eventID,
		EventType: eventType,
		Data:      data,
		Timestamp: timestamp,
	}

	for attempt := 0; attempt < n.maxRetries; attempt++ {
		select {
		case <-n.ctx.Done():
			return false
		default:
		}

		if n.send(payload) {
			return true
		}

		if attempt < n.maxRetries-1 {
			select {
			case <-n.ctx.Done():
				return false
			case <-time.After(n.retryDelay * time.Duration(attempt+1)):
			}
		}
	}
	return false
}

// queueEvent adds an event to the send queue
func (n *Notifier) queueEvent(eventType string, data interface{}) {
	n.mu.Lock()
	if n.closed {
		n.mu.Unlock()
		return
	}
	n.mu.Unlock()

	// Generate unique event ID using SHA256 hash of session + event type + timestamp
	// This ensures uniqueness while being deterministic for debugging
	timestamp := time.Now().UTC()
	h := sha256.New()
	_, _ = fmt.Fprintf(h, "%s:%s:%d", n.sessionID, eventType, timestamp.UnixNano())
	eventID := hex.EncodeToString(h.Sum(nil))[:32] // Use first 32 chars (128 bits)

	payload := WebhookPayload{
		SessionID: n.sessionID,
		EventID:   eventID,
		EventType: eventType,
		Data:      data,
		Timestamp: timestamp,
	}

	select {
	case n.eventQueue <- payload:
	default:
		// Queue full, log warning and drop event
		log.Printf("[WARN] Webhook event queue full for session %s, dropping event type=%s event_id=%s",
			n.sessionID, eventType, eventID)
	}
}

// SendStatus sends a status event
func (n *Notifier) SendStatus(status, message string) {
	n.queueEvent(models.EventStatus, models.StatusData{
		Status:  status,
		Message: message,
	})
}

// SendThinking sends a thinking event
func (n *Notifier) SendThinking(content string, iteration int) {
	n.queueEvent(models.EventThinking, models.ThinkingData{
		Content:   content,
		Iteration: iteration,
	})
}

// SendToolCall sends a tool_call event
func (n *Notifier) SendToolCall(id, tool string, params map[string]interface{}) {
	n.queueEvent(models.EventToolCall, models.ToolCallData{
		ID:     id,
		Tool:   tool,
		Params: params,
	})
}

// SendToolResult sends a tool_result event
func (n *Notifier) SendToolResult(id, tool string, success bool, output string, durationMs int64, iteration int) {
	n.queueEvent(models.EventToolResult, models.ToolResultData{
		ID:         id,
		Tool:       tool,
		Success:    success,
		Output:     output,
		DurationMs: durationMs,
		Iteration:  iteration,
	})
}

// SendAction sends a human-friendly action event
func (n *Notifier) SendAction(action, target, details, category string) {
	n.queueEvent(models.EventAction, models.ActionData{
		Action:   action,
		Target:   target,
		Details:  details,
		Category: category,
	})
}

// SendMessage sends a message event
func (n *Notifier) SendMessage(content string) {
	n.queueEvent(models.EventMessage, models.MessageData{
		Content: content,
	})
}

// SendError sends an error event synchronously (bypasses queue).
// Terminal events are sent directly to ensure prompt delivery.
func (n *Notifier) SendError(err string) {
	n.SendDirectly(models.EventError, models.ErrorData{
		Error: err,
	})
}

// SendComplete sends a complete event synchronously (bypasses queue).
// Terminal events are sent directly to ensure prompt delivery.
func (n *Notifier) SendComplete(data models.CompleteData) {
	n.SendDirectly(models.EventComplete, data)
}

// SendIterationStart sends an iteration_start event
func (n *Notifier) SendIterationStart(iteration, maxIteration int) {
	n.queueEvent(models.EventIterationStart, models.IterationStartData{
		Iteration:    iteration,
		MaxIteration: maxIteration,
	})
}

// SendRetry sends a retry event
func (n *Notifier) SendRetry(attempt, maxRetries int, delayMs int64, reason string) {
	n.queueEvent(models.EventRetry, models.RetryData{
		Attempt:    attempt,
		MaxRetries: maxRetries,
		DelayMs:    delayMs,
		Reason:     reason,
	})
}

// SendTokenUsage sends a token_usage event
func (n *Notifier) SendTokenUsage(prompt, completion, total, context int) {
	n.queueEvent(models.EventTokenUsage, models.TokenUsageData{
		PromptTokens:     prompt,
		CompletionTokens: completion,
		TotalTokens:      total,
		ContextTokens:    context,
	})
}

// SendToolTimeout sends a tool_timeout event
func (n *Notifier) SendToolTimeout(tool string, timeoutSec int, attempt int) {
	n.queueEvent(models.EventToolTimeout, models.ToolTimeoutData{
		Tool:       tool,
		TimeoutSec: timeoutSec,
		Attempt:    attempt,
	})
}

// SendToolRetry sends a tool_retry event
func (n *Notifier) SendToolRetry(tool string, attempt, maxRetries int, delayMs int64, reason string) {
	n.queueEvent(models.EventToolRetry, models.ToolRetryData{
		Tool:       tool,
		Attempt:    attempt,
		MaxRetries: maxRetries,
		DelayMs:    delayMs,
		Reason:     reason,
	})
}

// SendPlan sends a plan event
func (n *Notifier) SendPlan(summary string, steps []models.PlanStep, dependencies, risks []string) {
	n.queueEvent(models.EventPlan, models.PlanData{
		Summary:      summary,
		Steps:        steps,
		Dependencies: dependencies,
		Risks:        risks,
	})
}

// SendCreditWarning sends a credit_warning event
func (n *Notifier) SendCreditWarning(data models.CreditEventData) {
	n.queueEvent(models.EventCreditWarning, data)
}

// SendCreditExceeded sends a credit_exceeded event
func (n *Notifier) SendCreditExceeded(data models.CreditEventData) {
	n.queueEvent(models.EventCreditExceeded, data)
}

// SendSummarizationComplete sends a summarization_complete event
func (n *Notifier) SendSummarizationComplete(data models.SummarizationEventData) {
	n.queueEvent(models.EventSummarizationComplete, data)
}

// Close stops the notifier and waits for pending events to drain
func (n *Notifier) Close() {
	n.mu.Lock()
	if n.closed {
		n.mu.Unlock()
		return
	}
	n.closed = true
	n.mu.Unlock()

	// Close the queue so worker knows no more events are coming
	close(n.eventQueue)
	// Wait for worker to drain remaining queued events
	n.wg.Wait()
	// Then cancel context (cleanup)
	n.cancel()
}
