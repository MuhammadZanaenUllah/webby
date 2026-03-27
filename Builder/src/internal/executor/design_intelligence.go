package executor

import (
	"context"
	"encoding/json"
	"fmt"
	"path/filepath"
)

// DesignIntelligenceExecutor handles persisting and reading design decisions
type DesignIntelligenceExecutor struct {
	workspacePath string
}

// NewDesignIntelligenceExecutor creates a new DesignIntelligenceExecutor
func NewDesignIntelligenceExecutor(workspacePath string) *DesignIntelligenceExecutor {
	return &DesignIntelligenceExecutor{workspacePath: workspacePath}
}

func (e *DesignIntelligenceExecutor) filePath() string {
	return filepath.Join(e.workspacePath, "design-intelligence.json")
}

// WriteDesignIntelligence deep-merges new data into design-intelligence.json.
// Args: { "data": { ... } }
func (e *DesignIntelligenceExecutor) WriteDesignIntelligence(ctx context.Context, args map[string]interface{}) (*ToolResult, error) {
	dataRaw, ok := args["data"]
	if !ok {
		return &ToolResult{
			Success: false,
			Content: "Error: 'data' parameter is required. Provide a JSON object with design decisions.",
		}, nil
	}

	newData, ok := dataRaw.(map[string]interface{})
	if !ok {
		return &ToolResult{
			Success: false,
			Content: "Error: 'data' must be a JSON object.",
		}, nil
	}

	existing, err := ReadJSONFile(e.filePath())
	if err != nil {
		return &ToolResult{
			Success: false,
			Content: fmt.Sprintf("Error reading existing design intelligence: %s", err.Error()),
		}, nil
	}

	merged := DeepMergeJSON(existing, newData)

	if err := WriteJSONFileAtomic(e.filePath(), merged); err != nil {
		return &ToolResult{
			Success: false,
			Content: fmt.Sprintf("Error writing design intelligence: %s", err.Error()),
		}, nil
	}

	keys := make([]string, 0, len(newData))
	for k := range newData {
		keys = append(keys, k)
	}

	return &ToolResult{
		Success: true,
		Content: fmt.Sprintf("Design intelligence updated. Merged keys: %v. Total keys in file: %d.", keys, len(merged)),
	}, nil
}

// ReadDesignIntelligence reads and returns design-intelligence.json contents.
func (e *DesignIntelligenceExecutor) ReadDesignIntelligence(ctx context.Context, args map[string]interface{}) (*ToolResult, error) {
	data, err := ReadJSONFile(e.filePath())
	if err != nil {
		return &ToolResult{
			Success: false,
			Content: fmt.Sprintf("Error reading design intelligence: %s", err.Error()),
		}, nil
	}

	if len(data) == 0 {
		return &ToolResult{
			Success: true,
			Content: "No design intelligence found. This is a new project with no recorded design decisions.",
		}, nil
	}

	content, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		return &ToolResult{
			Success: false,
			Content: fmt.Sprintf("Error formatting design intelligence: %s", err.Error()),
		}, nil
	}

	return &ToolResult{
		Success: true,
		Content: string(content),
	}, nil
}
