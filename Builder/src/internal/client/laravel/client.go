package laravel

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"webby-builder/internal/models"
)

// Client for Laravel template API
type Client struct {
	baseURL    string
	serverKey  string
	httpClient *http.Client
}

// setHeaders sets common headers on outgoing requests
func (c *Client) setHeaders(req *http.Request) {
	req.Header.Set("X-Server-Key", c.serverKey)
	req.Header.Set("User-Agent", models.HTTPUserAgent)
}

// NewClient creates a new Laravel API client
func NewClient(baseURL, serverKey string) *Client {
	return NewClientWithTimeout(baseURL, serverKey, 30*time.Second)
}

// NewClientWithTimeout creates a new Laravel API client with custom timeout
func NewClientWithTimeout(baseURL, serverKey string, timeout time.Duration) *Client {
	return &Client{
		baseURL:   baseURL,
		serverKey: serverKey,
		httpClient: &http.Client{
			Timeout: timeout,
		},
	}
}

// FetchTemplates lists all available templates
func (c *Client) FetchTemplates() (*models.TemplateListResponse, error) {
	url := fmt.Sprintf("%s/api/templates", c.baseURL)
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	c.setHeaders(req)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("API returned status %d", resp.StatusCode)
	}

	var result models.TemplateListResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}
	return &result, nil
}

// GetTemplateMetadata gets detailed template info
func (c *Client) GetTemplateMetadata(id string) (*models.TemplateMetadata, error) {
	url := fmt.Sprintf("%s/api/templates/%s", c.baseURL, id)
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	c.setHeaders(req)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("API returned status %d", resp.StatusCode)
	}

	var result models.TemplateMetadata
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}
	return &result, nil
}

// DownloadTemplate downloads template zip
func (c *Client) DownloadTemplate(id string) (io.ReadCloser, error) {
	url := fmt.Sprintf("%s/api/templates/%s/download", c.baseURL, id)
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	c.setHeaders(req)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		_ = resp.Body.Close()
		return nil, fmt.Errorf("API returned status %d", resp.StatusCode)
	}

	return resp.Body, nil
}

// DownloadContext downloads template zip with context support
func (c *Client) DownloadContext(ctx context.Context, id string) (io.ReadCloser, error) {
	url := fmt.Sprintf("%s/api/templates/%s/download", c.baseURL, id)
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	c.setHeaders(req)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		_ = resp.Body.Close()
		return nil, fmt.Errorf("API returned status %d", resp.StatusCode)
	}

	return resp.Body, nil
}

// GetFirestoreCollections fetches Firestore collections metadata for a project
func (c *Client) GetFirestoreCollections(ctx context.Context, projectID string) (*models.FirestoreCollectionsResponse, error) {
	url := fmt.Sprintf("%s/api/builder/projects/%s/firestore/collections", c.baseURL, projectID)

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	c.setHeaders(req)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("API returned status %d: %s", resp.StatusCode, string(body))
	}

	var result models.FirestoreCollectionsResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &result, nil
}
