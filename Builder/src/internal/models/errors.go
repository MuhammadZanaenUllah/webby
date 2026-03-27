package models

import (
	"context"
	"errors"
	"net"
	"strings"
)

// ErrorCategory represents the category of an error for retry decisions
type ErrorCategory int

const (
	// ErrorCategoryRetryable indicates the error is transient and can be retried
	ErrorCategoryRetryable ErrorCategory = iota
	// ErrorCategoryFatal indicates the error is permanent and should not be retried
	ErrorCategoryFatal
	// ErrorCategoryCancelled indicates the operation was cancelled
	ErrorCategoryCancelled
)

// String returns a string representation of the error category
func (c ErrorCategory) String() string {
	switch c {
	case ErrorCategoryRetryable:
		return "retryable"
	case ErrorCategoryFatal:
		return "fatal"
	case ErrorCategoryCancelled:
		return "cancelled"
	default:
		return "unknown"
	}
}

// ClassifyError categorizes an error for retry decisions
// Retryable: 429 (rate limit), 500-504 (server errors), timeouts, connection errors
// Fatal: 401, 403, 400, context length exceeded
// Cancelled: user-initiated context.Canceled (but not timeout errors)
func ClassifyError(err error) ErrorCategory {
	if err == nil {
		return ErrorCategoryFatal
	}

	errStr := strings.ToLower(err.Error())

	// Check for timeout errors FIRST (before context cancellation check)
	// Tool timeouts should be retryable
	if strings.Contains(errStr, "timeout") ||
		strings.Contains(errStr, "timed out") {
		return ErrorCategoryRetryable
	}

	// Check for context cancellation (but not timeout - handled above)
	if errors.Is(err, context.Canceled) {
		return ErrorCategoryCancelled
	}
	if errors.Is(err, context.DeadlineExceeded) {
		return ErrorCategoryCancelled
	}

	// Check for rate limiting (429)
	if strings.Contains(errStr, "429") ||
		strings.Contains(errStr, "rate limit") ||
		strings.Contains(errStr, "too many requests") {
		return ErrorCategoryRetryable
	}

	// Check for server errors (500-504)
	if strings.Contains(errStr, "500") ||
		strings.Contains(errStr, "501") ||
		strings.Contains(errStr, "502") ||
		strings.Contains(errStr, "503") ||
		strings.Contains(errStr, "504") ||
		strings.Contains(errStr, "internal server error") ||
		strings.Contains(errStr, "bad gateway") ||
		strings.Contains(errStr, "service unavailable") ||
		strings.Contains(errStr, "gateway timeout") {
		return ErrorCategoryRetryable
	}

	// Check for connection/network errors
	var netErr net.Error
	if errors.As(err, &netErr) {
		if netErr.Timeout() {
			return ErrorCategoryRetryable
		}
		// Other network errors are typically retryable
		return ErrorCategoryRetryable
	}

	// Check for connection errors by string matching (excluding "timeout" - handled above)
	if strings.Contains(errStr, "connection reset") ||
		strings.Contains(errStr, "connection refused") ||
		strings.Contains(errStr, "eof") ||
		strings.Contains(errStr, "broken pipe") {
		return ErrorCategoryRetryable
	}

	// Check for fatal errors
	// 401 Unauthorized
	if strings.Contains(errStr, "401") ||
		strings.Contains(errStr, "unauthorized") {
		return ErrorCategoryFatal
	}

	// 403 Forbidden
	if strings.Contains(errStr, "403") ||
		strings.Contains(errStr, "forbidden") {
		return ErrorCategoryFatal
	}

	// 400 Bad Request
	if strings.Contains(errStr, "400") ||
		strings.Contains(errStr, "bad request") {
		return ErrorCategoryFatal
	}

	// Context length exceeded
	if strings.Contains(errStr, "context length") ||
		strings.Contains(errStr, "maximum context") ||
		strings.Contains(errStr, "token limit") ||
		strings.Contains(errStr, "too long") {
		return ErrorCategoryFatal
	}

	// Invalid API key
	if strings.Contains(errStr, "invalid api key") ||
		strings.Contains(errStr, "invalid_api_key") {
		return ErrorCategoryFatal
	}

	// Model not found
	if strings.Contains(errStr, "model not found") ||
		strings.Contains(errStr, "does not exist") {
		return ErrorCategoryFatal
	}

	// Default: treat unknown errors as fatal to avoid infinite retries
	return ErrorCategoryFatal
}

// IsRetryable returns true if the error can be retried
func IsRetryable(err error) bool {
	return ClassifyError(err) == ErrorCategoryRetryable
}

// IsFatal returns true if the error is permanent
func IsFatal(err error) bool {
	return ClassifyError(err) == ErrorCategoryFatal
}

// IsCancelled returns true if the operation was cancelled
func IsCancelled(err error) bool {
	return ClassifyError(err) == ErrorCategoryCancelled
}
