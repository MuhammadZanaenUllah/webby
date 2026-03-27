package models

// ToolResult represents the result of a tool execution
type ToolResult struct {
	Success bool   `json:"success"`
	Output  string `json:"output"`
}

// ToolDefinition represents a tool/function definition (provider-agnostic)
type ToolDefinition struct {
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	Parameters  map[string]interface{} `json:"parameters"`
}
