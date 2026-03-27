package client

import (
	"context"

	"webby-builder/internal/models"
)

// AIProvider defines the interface for AI backends
type AIProvider interface {
	// Chat sends messages and returns response with potential tool calls
	Chat(ctx context.Context, messages []models.Message, tools []models.ToolDefinition) (*models.Response, error)
}
