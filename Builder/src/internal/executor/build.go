package executor

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"webby-builder/internal/models"
)

// BuildExecutor handles build verification
type BuildExecutor struct {
	workspacePath string
	toolConfig    models.ToolExecutionConfig
}

// NewBuildExecutor creates a new build executor
func NewBuildExecutor(workspacePath string, toolConfig models.ToolExecutionConfig) *BuildExecutor {
	return &BuildExecutor{
		workspacePath: workspacePath,
		toolConfig:    toolConfig,
	}
}

// VerifyBuild runs npm run build and returns the result
func (e *BuildExecutor) VerifyBuild(ctx context.Context, args map[string]interface{}) (*ToolResult, error) {
	// Use configurable timeout with 120s minimum
	timeout := time.Duration(e.toolConfig.Timeout) * time.Second
	if timeout < 120*time.Second {
		timeout = 120 * time.Second // Minimum 2 minutes for builds
	}

	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	// Check if node_modules exists, if not run npm install first
	nodeModulesPath := filepath.Join(e.workspacePath, "node_modules")
	if _, err := os.Stat(nodeModulesPath); os.IsNotExist(err) {
		installCmd := exec.CommandContext(ctx, "npm", "install", "--ignore-scripts")
		installCmd.Dir = e.workspacePath
		if output, err := installCmd.CombinedOutput(); err != nil {
			return &ToolResult{
				Success: false,
				Content: fmt.Sprintf("Failed to install dependencies:\n%s", string(output)),
			}, nil
		}
	}

	// Run npm run build
	cmd := exec.CommandContext(ctx, "npm", "run", "build")
	cmd.Dir = e.workspacePath

	output, err := cmd.CombinedOutput()
	outputStr := string(output)

	if err != nil {
		// Extract the most relevant error info
		errorSummary := extractBuildErrors(outputStr)
		return &ToolResult{
			Success: false,
			Content: fmt.Sprintf("Build failed:\n%s", errorSummary),
		}, nil
	}

	return &ToolResult{
		Success: true,
		Content: "Build successful! The project compiles without errors.",
	}, nil
}

// extractBuildErrors extracts relevant error messages from build output
func extractBuildErrors(output string) string {
	lines := strings.Split(output, "\n")
	var errors []string

	for _, line := range lines {
		lineLower := strings.ToLower(line)
		// Look for TypeScript/Vite error patterns
		if strings.Contains(lineLower, "error") ||
			strings.Contains(line, "TS") ||
			strings.Contains(line, "Cannot find") ||
			strings.Contains(line, "is not defined") ||
			strings.Contains(line, "has no exported member") {
			trimmed := strings.TrimSpace(line)
			if trimmed != "" {
				errors = append(errors, trimmed)
			}
		}
	}

	if len(errors) == 0 {
		// Return last 30 lines if no specific errors found
		start := len(lines) - 30
		if start < 0 {
			start = 0
		}
		return strings.Join(lines[start:], "\n")
	}

	// Limit to first 15 errors to avoid overwhelming
	if len(errors) > 15 {
		errors = errors[:15]
		errors = append(errors, "... (more errors omitted)")
	}

	return strings.Join(errors, "\n")
}
