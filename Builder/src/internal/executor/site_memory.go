package executor

import (
	"context"
	"encoding/json"
	"fmt"
	"path/filepath"
)

// SiteMemoryExecutor handles persisting and reading business facts
type SiteMemoryExecutor struct {
	workspacePath string
}

// NewSiteMemoryExecutor creates a new SiteMemoryExecutor
func NewSiteMemoryExecutor(workspacePath string) *SiteMemoryExecutor {
	return &SiteMemoryExecutor{workspacePath: workspacePath}
}

func (e *SiteMemoryExecutor) filePath() string {
	return filepath.Join(e.workspacePath, "memory.json")
}

// UpdateSiteMemory deep-merges new data into memory.json.
// Args: { "data": { ... } }
func (e *SiteMemoryExecutor) UpdateSiteMemory(ctx context.Context, args map[string]interface{}) (*ToolResult, error) {
	dataRaw, ok := args["data"]
	if !ok {
		return &ToolResult{
			Success: false,
			Content: "Error: 'data' parameter is required. Provide a JSON object with business facts.",
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
			Content: fmt.Sprintf("Error reading existing site memory: %s", err.Error()),
		}, nil
	}

	merged := DeepMergeJSON(existing, newData)

	if err := WriteJSONFileAtomic(e.filePath(), merged); err != nil {
		return &ToolResult{
			Success: false,
			Content: fmt.Sprintf("Error writing site memory: %s", err.Error()),
		}, nil
	}

	keys := make([]string, 0, len(newData))
	for k := range newData {
		keys = append(keys, k)
	}

	return &ToolResult{
		Success: true,
		Content: fmt.Sprintf("Site memory updated. Merged keys: %v. Total keys in file: %d.", keys, len(merged)),
	}, nil
}

// ReadSiteMemory reads and returns memory.json contents.
func (e *SiteMemoryExecutor) ReadSiteMemory(ctx context.Context, args map[string]interface{}) (*ToolResult, error) {
	data, err := ReadJSONFile(e.filePath())
	if err != nil {
		return &ToolResult{
			Success: false,
			Content: fmt.Sprintf("Error reading site memory: %s", err.Error()),
		}, nil
	}

	if len(data) == 0 {
		return &ToolResult{
			Success: true,
			Content: "No site memory found. No business facts have been recorded yet.",
		}, nil
	}

	content, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		return &ToolResult{
			Success: false,
			Content: fmt.Sprintf("Error formatting site memory: %s", err.Error()),
		}, nil
	}

	return &ToolResult{
		Success: true,
		Content: string(content),
	}, nil
}
