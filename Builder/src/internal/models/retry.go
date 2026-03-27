package models

import (
	"context"
	"math/rand"
	"time"

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

// DefaultRetryConfig returns the default retry configuration
// Delays: 200ms -> 400ms -> 800ms (±10% jitter)
func DefaultRetryConfig() RetryConfig {
	return RetryConfig{
		MaxRetries:    3,
		InitialDelay:  200 * time.Millisecond,
		BackoffFactor: 2.0,
		Jitter:        0.1,
	}
}

// NoRetryConfig returns a config that disables retries
func NoRetryConfig() RetryConfig {
	return RetryConfig{
		MaxRetries: 0,
	}
}

// RetryResult contains the result of a retry operation
type RetryResult[T any] struct {
	// Value is the successful result
	Value T
	// Attempts is the number of attempts made (1 = success on first try)
	Attempts int
	// LastError is the last error encountered (nil if successful)
	LastError error
}

// RetryCallback is called after each retry attempt (optional)
type RetryCallback func(attempt int, maxRetries int, delay time.Duration, err error)

// Retry executes a function with exponential backoff retry logic
// The function is retried only for retryable errors (rate limits, server errors, timeouts)
// Fatal errors (auth, bad request, context length) are returned immediately
func Retry[T any](ctx context.Context, cfg RetryConfig, fn func() (T, error)) (T, error) {
	return RetryWithCallback(ctx, cfg, fn, nil, nil)
}

// RetryWithCallback executes a function with retry logic and callbacks
// onRetry is called before each retry attempt
// logger is used for debug logging (can be nil)
func RetryWithCallback[T any](
	ctx context.Context,
	cfg RetryConfig,
	fn func() (T, error),
	onRetry RetryCallback,
	logger *logrus.Logger,
) (T, error) {
	var zero T
	var lastErr error

	for attempt := 0; attempt <= cfg.MaxRetries; attempt++ {
		// Check context before each attempt
		select {
		case <-ctx.Done():
			return zero, ctx.Err()
		default:
		}

		// Execute the function
		result, err := fn()
		if err == nil {
			return result, nil
		}

		lastErr = err

		// Classify the error
		category := ClassifyError(err)

		// Log the error
		if logger != nil {
			logger.WithFields(logrus.Fields{
				"attempt":  attempt + 1,
				"max":      cfg.MaxRetries + 1,
				"category": category.String(),
				"error":    err.Error(),
			}).Debug("Retry: attempt failed")
		}

		// Don't retry fatal or cancelled errors
		if category != ErrorCategoryRetryable {
			return zero, err
		}

		// Don't retry if we've exhausted all attempts
		if attempt >= cfg.MaxRetries {
			break
		}

		// Calculate delay with exponential backoff and jitter
		delay := calculateDelay(cfg, attempt)

		// Call retry callback if provided
		if onRetry != nil {
			onRetry(attempt+1, cfg.MaxRetries, delay, err)
		}

		// Log retry attempt
		if logger != nil {
			logger.WithFields(logrus.Fields{
				"attempt":  attempt + 1,
				"delay_ms": delay.Milliseconds(),
				"reason":   err.Error(),
			}).Debug("Retry: waiting before next attempt")
		}

		// Wait before retry
		select {
		case <-ctx.Done():
			return zero, ctx.Err()
		case <-time.After(delay):
		}
	}

	return zero, lastErr
}

// calculateDelay calculates the delay for a given attempt with jitter
func calculateDelay(cfg RetryConfig, attempt int) time.Duration {
	// Calculate base delay with exponential backoff
	delay := float64(cfg.InitialDelay)
	for i := 0; i < attempt; i++ {
		delay *= cfg.BackoffFactor
	}

	// Apply jitter (±jitter%)
	if cfg.Jitter > 0 {
		jitterRange := delay * cfg.Jitter
		jitter := (rand.Float64() * 2 * jitterRange) - jitterRange
		delay += jitter
	}

	// Ensure delay is at least 1ms
	if delay < float64(time.Millisecond) {
		delay = float64(time.Millisecond)
	}

	return time.Duration(delay)
}

// CalculateExpectedDelays returns the expected delays for debugging
func CalculateExpectedDelays(cfg RetryConfig) []time.Duration {
	delays := make([]time.Duration, cfg.MaxRetries)
	for i := 0; i < cfg.MaxRetries; i++ {
		baseDelay := float64(cfg.InitialDelay)
		for j := 0; j < i; j++ {
			baseDelay *= cfg.BackoffFactor
		}
		delays[i] = time.Duration(baseDelay)
	}
	return delays
}
