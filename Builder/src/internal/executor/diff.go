package executor

import (
	"context"
	"fmt"
	"math"
	"strings"

	"github.com/sergi/go-diff/diffmatchpatch"
)

// diffPreview generates a diff preview between old and new content
func (e *FileExecutor) diffPreview(ctx context.Context, args map[string]interface{}) (*ToolResult, error) {
	path, _ := args["path"].(string)
	oldContent, _ := args["oldContent"].(string)
	newContent, _ := args["newContent"].(string)

	// Validate path for reading (no write validation needed)
	if err := e.validatePath(path); err != nil {
		return &ToolResult{
			Success: false,
			Content: fmt.Sprintf("Invalid path: %s", err.Error()),
		}, nil
	}

	// Calculate change statistics
	oldLines := strings.Split(oldContent, "\n")
	newLines := strings.Split(newContent, "\n")
	oldSize := len(oldContent)
	newSize := len(newContent)

	var sb strings.Builder

	// Calculate change percentage
	changePercent := 0.0
	if oldSize > 0 {
		changePercent = math.Abs(float64(newSize-oldSize)) / float64(oldSize) * 100
	}

	// Warning for large changes
	if changePercent > 50.0 {
		fmt.Fprintf(&sb, "⚠️  WARNING: This will change %.1f%% of the file!\n\n", changePercent)
		sb.WriteString("Consider using editFile for targeted changes instead.\n\n")
	} else if changePercent > 20.0 {
		fmt.Fprintf(&sb, "ℹ️  This will change %.1f%% of the file.\n\n", changePercent)
	}

	// Generate line-by-line diff using diffmatchpatch
	dmp := diffmatchpatch.New()
	diffs := dmp.DiffMain(oldContent, newContent, false)

	sb.WriteString("**Diff Preview**\n\n")
	for _, diff := range diffs {
		text := diff.Text
		// Split multi-line diffs for better readability
		lines := strings.Split(text, "\n")
		for i, line := range lines {
			// Skip empty last line from split
			if i == len(lines)-1 && line == "" {
				continue
			}
			trimmed := strings.TrimRight(line, " \t")
			switch diff.Type {
			case diffmatchpatch.DiffInsert:
				fmt.Fprintf(&sb, "+ %s\n", trimmed)
			case diffmatchpatch.DiffDelete:
				fmt.Fprintf(&sb, "- %s\n", trimmed)
			default:
				fmt.Fprintf(&sb, " %s\n", trimmed)
			}
		}
	}

	// Summary statistics
	sb.WriteString("\n**Summary**\n")
	fmt.Fprintf(&sb, "- Original: %d lines, %d bytes\n", len(oldLines), oldSize)
	fmt.Fprintf(&sb, "- New: %d lines, %d bytes\n", len(newLines), newSize)
	fmt.Fprintf(&sb, "- Change: %+.1f%%\n", changePercent)

	if changePercent > 50.0 {
		sb.WriteString("\n**RECOMMENDATION**: Use editFile for smaller, targeted changes.")
	}

	return &ToolResult{
		Success: true,
		Content: sb.String(),
	}, nil
}
