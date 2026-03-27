package executor

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// pendingEdit holds a validated edit ready to be written
type pendingEdit struct {
	filePath        string // relative path
	fullPath        string // absolute path
	originalContent []byte
	newContent      string
	replacements    int
}

// batchEditFiles applies the same edit to multiple files using two-phase write with rollback
func (e *FileExecutor) batchEditFiles(ctx context.Context, args map[string]interface{}) (*ToolResult, error) {
	pattern, _ := args["pattern"].(string)
	search, _ := args["search"].(string)
	replace, _ := args["replace"].(string)
	replaceAll, _ := args["replaceAll"].(bool)
	maxFiles := 10
	if max, ok := args["maxFiles"].(float64); ok {
		maxFiles = int(max)
	}

	// Expand glob pattern
	fullPattern := filepath.Join(e.workspacePath, pattern)
	matches, err := filepath.Glob(fullPattern)
	if err != nil {
		return &ToolResult{
			Success: false,
			Content: fmt.Sprintf("Invalid glob pattern: %s", err.Error()),
		}, nil
	}

	// Filter to only safe file types
	var validFiles []string
	searchableExtensions := map[string]bool{
		".tsx": true, ".ts": true, ".jsx": true, ".js": true,
		".css": true, ".scss": true, ".html": true,
	}

	for _, match := range matches {
		if info, err := os.Stat(match); err != nil || info.IsDir() {
			continue
		}
		ext := strings.ToLower(filepath.Ext(match))
		if searchableExtensions[ext] {
			relPath, _ := filepath.Rel(e.workspacePath, match)
			validFiles = append(validFiles, relPath)
		}
	}

	if len(validFiles) == 0 {
		return &ToolResult{
			Success: true,
			Content: fmt.Sprintf("No files found matching pattern: %s", pattern),
		}, nil
	}

	// Limit files
	if len(validFiles) > maxFiles {
		return &ToolResult{
			Success: false,
			Content: fmt.Sprintf("Too many files matched (%d). Set maxFiles parameter to a higher limit or be more specific with your pattern. Current limit: %d", len(validFiles), maxFiles),
		}, nil
	}

	// Phase 1: Validate all edits (write nothing to target files)
	var edits []pendingEdit
	var results []string
	var errors []string

	for _, filePath := range validFiles {
		// Validate path for writing (blocks protected files)
		if err := e.validatePathForWrite(filePath); err != nil {
			errors = append(errors, fmt.Sprintf("- %s: %s", filePath, err.Error()))
			continue
		}

		fullPath := filepath.Join(e.workspacePath, filePath)
		content, err := os.ReadFile(fullPath)
		if err != nil {
			errors = append(errors, fmt.Sprintf("- %s: %s", filePath, err.Error()))
			continue
		}

		originalContent := string(content)

		// Count replacements
		count := strings.Count(originalContent, search)
		if count == 0 {
			results = append(results, fmt.Sprintf("- %s: No matches found", filePath))
			continue
		}

		// Check for ambiguity if replaceAll is false and count > 1
		if !replaceAll && count > 1 {
			errors = append(errors, fmt.Sprintf("- %s: %d matches found (use replaceAll=true or be more specific)", filePath, count))
			continue
		}

		// Apply replacement
		var newContent string
		if replaceAll {
			newContent = strings.ReplaceAll(originalContent, search, replace)
		} else {
			newContent = strings.Replace(originalContent, search, replace, 1)
		}

		// Validate TypeScript/TSX syntax before committing
		if strings.HasSuffix(filePath, ".tsx") || strings.HasSuffix(filePath, ".ts") {
			dir := filepath.Dir(fullPath)
			base := filepath.Base(fullPath)
			ext := filepath.Ext(base)
			nameNoExt := strings.TrimSuffix(base, ext)

			tmpFile, tmpErr := os.CreateTemp(dir, nameNoExt+".batch_*.tmp"+ext)
			if tmpErr != nil {
				errors = append(errors, fmt.Sprintf("- %s: temp file error: %s", filePath, tmpErr.Error()))
				continue
			}
			tmpPath := tmpFile.Name()
			if _, writeErr := tmpFile.Write([]byte(newContent)); writeErr != nil {
				_ = tmpFile.Close()
				_ = os.Remove(tmpPath)
				errors = append(errors, fmt.Sprintf("- %s: temp file write error: %s", filePath, writeErr.Error()))
				continue
			}
			_ = tmpFile.Close()

			if valErr := e.validateTypeScript(ctx, tmpPath); valErr != nil {
				_ = os.Remove(tmpPath)
				errors = append(errors, fmt.Sprintf("- %s: syntax error after edit: %s", filePath, valErr.Error()))
				continue
			}
			_ = os.Remove(tmpPath)
		}

		edits = append(edits, pendingEdit{
			filePath:        filePath,
			fullPath:        fullPath,
			originalContent: content,
			newContent:      newContent,
			replacements:    count,
		})
	}

	// If validation phase already found errors, don't write anything
	if len(errors) > 0 {
		for _, edit := range edits {
			results = append(results, fmt.Sprintf("- %s: %d replacement(s) (not applied due to errors in other files)", edit.filePath, edit.replacements))
		}
		return e.formatBatchResult(results, errors, 0, len(validFiles)), nil
	}

	// Phase 2: Write all validated edits with rollback on failure
	var writtenEdits []pendingEdit
	writeErr := false

	for _, edit := range edits {
		if err := os.WriteFile(edit.fullPath, []byte(edit.newContent), 0644); err != nil {
			// Write failed — rollback all previously written files
			rollbackFailed := false
			for _, written := range writtenEdits {
				if rbErr := os.WriteFile(written.fullPath, written.originalContent, 0644); rbErr != nil {
					errors = append(errors, fmt.Sprintf("- %s: ROLLBACK FAILED: %s (original content may be lost)", written.filePath, rbErr.Error()))
					rollbackFailed = true
				}
			}
			if rollbackFailed {
				errors = append(errors, fmt.Sprintf("- %s: write failed: %s (rollback partially failed)", edit.filePath, err.Error()))
			} else {
				errors = append(errors, fmt.Sprintf("- %s: write failed: %s (all changes rolled back)", edit.filePath, err.Error()))
			}
			writeErr = true
			break
		}
		writtenEdits = append(writtenEdits, edit)
		results = append(results, fmt.Sprintf("- %s: %d replacement(s)", edit.filePath, edit.replacements))
	}

	successCount := len(writtenEdits)
	if writeErr {
		successCount = 0
	}

	return e.formatBatchResult(results, errors, successCount, len(validFiles)), nil
}

// formatBatchResult creates the formatted output for batch edit operations
func (e *FileExecutor) formatBatchResult(results, errors []string, successCount, totalFiles int) *ToolResult {
	var sb strings.Builder
	sb.WriteString("**Batch Edit Complete**\n\n")

	if len(results) > 0 {
		sb.WriteString("**Modified Files:**\n")
		for _, r := range results {
			sb.WriteString(r + "\n")
		}
	}

	if len(errors) > 0 {
		sb.WriteString("\n**Errors:**\n")
		for _, errMsg := range errors {
			sb.WriteString(errMsg + "\n")
		}
	}

	fmt.Fprintf(&sb, "\n**Summary:** %d/%d files modified successfully\n", successCount, totalFiles)

	return &ToolResult{
		Success: len(errors) == 0,
		Content: sb.String(),
	}
}
