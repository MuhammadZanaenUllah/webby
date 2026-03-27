package models

import (
	"context"
)

// AIProvider defines the interface for AI backends
type AIProvider interface {
	// Chat sends messages and returns response with potential tool calls
	Chat(ctx context.Context, messages []Message, tools []ToolDefinition) (*Response, error)
}
