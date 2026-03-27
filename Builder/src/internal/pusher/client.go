package pusher

import (
	"fmt"
	"net/http"
	"time"

	pusher "github.com/pusher/pusher-http-go/v5"
)

// Config holds Pusher configuration.
// Supports both Pusher cloud (via Cluster) and self-hosted Pusher-compatible
// servers like Laravel Reverb (via Host + Scheme).
type Config struct {
	AppID   string `json:"app_id"`
	Key     string `json:"key"`
	Secret  string `json:"secret"`
	Cluster string `json:"cluster,omitempty"`
	Host    string `json:"host,omitempty"`   // Custom host:port for Reverb (overrides Cluster)
	Scheme  string `json:"scheme,omitempty"` // "http" or "https" (default: "https")
}

// Validate checks if the configuration is valid
func (c *Config) Validate() error {
	if c.AppID == "" {
		return fmt.Errorf("pusher app_id is required")
	}
	if c.Key == "" {
		return fmt.Errorf("pusher key is required")
	}
	if c.Secret == "" {
		return fmt.Errorf("pusher secret is required")
	}
	if c.Cluster == "" && c.Host == "" {
		return fmt.Errorf("pusher cluster or host is required")
	}
	return nil
}

// Client interface for Pusher operations (allows mocking)
type Client interface {
	Trigger(channel string, eventName string, data interface{}) error
	ValidateCredentials() error
}

// PusherClient wraps the Pusher SDK client
type PusherClient struct {
	client *pusher.Client
	config *Config
}

// NewClient creates a new Pusher client.
// When Host is set, it connects to that host directly (for Reverb/self-hosted).
// When only Cluster is set, it connects to Pusher cloud.
func NewClient(cfg *Config) (*PusherClient, error) {
	if err := cfg.Validate(); err != nil {
		return nil, err
	}

	client := &pusher.Client{
		AppID:  cfg.AppID,
		Key:    cfg.Key,
		Secret: cfg.Secret,
		Secure: cfg.Scheme != "http",
		HTTPClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}

	// Host takes precedence over Cluster (for Reverb/self-hosted servers)
	if cfg.Host != "" {
		client.Host = cfg.Host
	} else {
		client.Cluster = cfg.Cluster
	}

	return &PusherClient{
		client: client,
		config: cfg,
	}, nil
}

// Trigger sends an event to a Pusher channel
func (p *PusherClient) Trigger(channel string, eventName string, data interface{}) error {
	return p.client.Trigger(channel, eventName, data)
}

// ValidateCredentials tests the Pusher credentials by triggering a test event.
// Uses Trigger instead of Channels because Reverb returns incompatible responses for Channels.
func (p *PusherClient) ValidateCredentials() error {
	err := p.client.Trigger("webby-validation-test", "test", map[string]bool{"ping": true})
	if err != nil {
		return fmt.Errorf("invalid pusher credentials: %w", err)
	}
	return nil
}
