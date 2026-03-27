package client

import (
	"fmt"
	"time"

	"webby-builder/internal/client/anthropic"
	"webby-builder/internal/client/openai"
	"webby-builder/internal/models"

	"github.com/sirupsen/logrus"
)

// ProviderType defines the AI provider type
type ProviderType string

const (
	ProviderTypeOpenAI    ProviderType = "openai"
	ProviderTypeAnthropic ProviderType = "anthropic"
	ProviderTypeGrok      ProviderType = "grok"
	ProviderTypeDeepSeek  ProviderType = "deepseek"
	ProviderTypeZhipu     ProviderType = "zhipu"
)

// Factory creates AI providers based on type
type Factory struct {
	logger      *logrus.Logger
	retryConfig models.RetryConfig
	onRetry     models.RetryCallback
}

// NewFactory creates a new provider factory
func NewFactory(logger *logrus.Logger, retryConfig models.RetryConfig, onRetry models.RetryCallback) *Factory {
	return &Factory{
		logger:      logger,
		retryConfig: retryConfig,
		onRetry:     onRetry,
	}
}

// CreateProvider creates an AI provider based on the config type
func (f *Factory) CreateProvider(cfg models.ProviderConfig) (models.AIProvider, error) {
	providerType := ProviderType(cfg.ProviderType)

	switch providerType {
	case ProviderTypeOpenAI:
		return openai.NewClientWithRetry(cfg, f.logger, f.retryConfig, f.onRetry), nil
	case ProviderTypeAnthropic:
		// Convert models.RetryConfig to anthropic.RetryConfig
		anthropicRetryConfig := anthropic.RetryConfig{
			MaxRetries:    f.retryConfig.MaxRetries,
			InitialDelay:  f.retryConfig.InitialDelay,
			BackoffFactor: f.retryConfig.BackoffFactor,
			Jitter:        f.retryConfig.Jitter,
		}
		// Convert models.RetryCallback to anthropic.RetryCallback
		var anthropicOnRetry anthropic.RetryCallback
		if f.onRetry != nil {
			anthropicOnRetry = func(attempt, maxRetries int, delay time.Duration, reason string) {
				f.onRetry(attempt, maxRetries, delay, fmt.Errorf("retry: %s", reason))
			}
		}
		return anthropic.NewClientWithRetry(cfg, f.logger, anthropicRetryConfig, anthropicOnRetry), nil
	case ProviderTypeGrok:
		// Grok uses OpenAI-compatible API
		if cfg.BaseURL == "" {
			cfg.BaseURL = "https://api.x.ai/v1"
		}
		return openai.NewClientWithRetry(cfg, f.logger, f.retryConfig, f.onRetry), nil
	case ProviderTypeDeepSeek:
		// DeepSeek uses OpenAI-compatible API
		if cfg.BaseURL == "" {
			cfg.BaseURL = "https://api.deepseek.com"
		}
		return openai.NewClientWithRetry(cfg, f.logger, f.retryConfig, f.onRetry), nil
	case ProviderTypeZhipu:
		// ZhipuAI uses Anthropic-compatible API via z.ai proxy
		if cfg.BaseURL == "" {
			cfg.BaseURL = "https://api.z.ai/api/anthropic"
		}
		if cfg.Model == "" {
			cfg.Model = "glm-4.7"
		}
		anthropicRetryConfig := anthropic.RetryConfig{
			MaxRetries:    f.retryConfig.MaxRetries,
			InitialDelay:  f.retryConfig.InitialDelay,
			BackoffFactor: f.retryConfig.BackoffFactor,
			Jitter:        f.retryConfig.Jitter,
		}
		var anthropicOnRetry anthropic.RetryCallback
		if f.onRetry != nil {
			anthropicOnRetry = func(attempt, maxRetries int, delay time.Duration, reason string) {
				f.onRetry(attempt, maxRetries, delay, fmt.Errorf("retry: %s", reason))
			}
		}
		return anthropic.NewClientWithRetry(cfg, f.logger, anthropicRetryConfig, anthropicOnRetry), nil
	default:
		// Default to OpenAI for backwards compatibility
		return openai.NewClientWithRetry(cfg, f.logger, f.retryConfig, f.onRetry), nil
	}
}
