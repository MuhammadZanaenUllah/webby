package executor

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"webby-builder/internal/models"

	"github.com/sirupsen/logrus"
)

// FileExecutor handles file operations
type FileExecutor struct {
	workspacePath string
	toolConfig    models.ToolExecutionConfig
	logger        *logrus.Logger
	workspaceID   string
}

// NewFileExecutor creates a new file executor
func NewFileExecutor(workspacePath string, toolConfig models.ToolExecutionConfig) *FileExecutor {
	// Extract workspace ID from path (last component)
	// Path format: storage/workspaces/{workspaceID}
	parts := strings.Split(filepath.Clean(workspacePath), string(filepath.Separator))
	workspaceID := parts[len(parts)-1]

	// Shorten workspace ID for logs (first 8 + ... + last 8)
	shortID := workspaceID
	if len(workspaceID) > 16 {
		shortID = workspaceID[:8] + "..." + workspaceID[len(workspaceID)-8:]
	}

	return &FileExecutor{
		workspacePath: workspacePath,
		toolConfig:    toolConfig,
		logger:        nil, // Will be set by SetLogger
		workspaceID:   shortID,
	}
}

// SetLogger sets the logger for the file executor
func (e *FileExecutor) SetLogger(logger *logrus.Logger) {
	e.logger = logger
}

// debug logs a debug message with workspace ID context
func (e *FileExecutor) debug(msg string, args ...interface{}) {
	if e.logger == nil {
		return
	}
	fields := logrus.Fields{"workspace_id": e.workspaceID}
	if len(args) > 0 {
		for i := 0; i < len(args)-1; i += 2 {
			if key, ok := args[i].(string); ok && i+1 < len(args) {
				fields[key] = args[i+1]
			}
		}
	}
	e.logger.WithFields(fields).Debug(msg)
}

// ensureWorkspaceReady ensures workspace directory exists
func (e *FileExecutor) ensureWorkspaceReady() error {
	return os.MkdirAll(e.workspacePath, 0755)
}

// CreateFile creates a new file with content
func (e *FileExecutor) CreateFile(ctx context.Context, args map[string]interface{}) (*ToolResult, error) {
	path, ok := args["path"].(string)
	if !ok {
		return nil, fmt.Errorf("path is required")
	}
	content, ok := args["content"].(string)
	if !ok {
		return nil, fmt.Errorf("content is required")
	}

	e.debug("CreateFile starting", "path", path, "content_size", len(content))

	// Validate path for writing (stricter than read)
	if err := e.validatePathForWrite(path); err != nil {
		return &ToolResult{
			Success: false,
			Content: fmt.Sprintf("Invalid path: %s", err.Error()),
		}, nil
	}

	// Initialize workspace from template on first file write
	e.debug("CreateFile ensuring workspace ready")
	if err := e.ensureWorkspaceReady(); err != nil {
		return nil, fmt.Errorf("failed to initialize workspace: %w", err)
	}

	fullPath := filepath.Join(e.workspacePath, path)
	e.debug("CreateFile full path", "full_path", fullPath)

	// Create parent directories
	e.debug("CreateFile creating parent directories")
	dir := filepath.Dir(fullPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create directory: %w", err)
	}

	// Write file
	e.debug("CreateFile writing file to disk")
	if err := os.WriteFile(fullPath, []byte(content), 0644); err != nil {
		return nil, fmt.Errorf("failed to write file: %w", err)
	}
	e.debug("CreateFile file written successfully")

	// Validate TypeScript/TSX files
	if strings.HasSuffix(path, ".tsx") || strings.HasSuffix(path, ".ts") {
		e.debug("CreateFile starting TypeScript validation")
		if err := e.validateTypeScript(ctx, fullPath); err != nil {
			e.debug("CreateFile TypeScript validation failed", "error", err.Error())
			// Return the error but keep the file (AI can fix it)
			return &ToolResult{
				Success: false,
				Content: fmt.Sprintf("File created but has errors: %s\n\nPlease fix these issues.", err.Error()),
			}, nil
		}
		e.debug("CreateFile TypeScript validation passed")
	}

	e.debug("CreateFile returning success")
	result := fmt.Sprintf("File created: %s (%d bytes)", path, len(content))

	// Check for missing imports (non-blocking warnings)
	if warnings := validateImports(fullPath, e.workspacePath); len(warnings) > 0 {
		result += "\n\n⚠️ Import warnings:\n" + strings.Join(warnings, "\n")
	}

	// Check for content quality issues (non-blocking warnings)
	if warnings := validateContentQuality(content, path); len(warnings) > 0 {
		result += "\n\n⚠️ Content warnings:\n" + strings.Join(warnings, "\n")
	}

	return &ToolResult{
		Success: true,
		Content: result,
	}, nil
}

// validateContentQuality checks for common content issues in created files
func validateContentQuality(content string, filePath string) []string {
	var warnings []string

	// 1. Suspiciously small TSX files (likely truncated or skeletal)
	if (strings.HasSuffix(filePath, ".tsx") || strings.HasSuffix(filePath, ".ts")) && len(content) < 100 {
		warnings = append(warnings, "File is very short (<100 chars). Verify it contains complete content.")
	}

	// 2. Missing default export in page/component files
	if strings.HasSuffix(filePath, ".tsx") && strings.Contains(filePath, "pages/") {
		if !strings.Contains(content, "export default") {
			warnings = append(warnings, "Page file missing 'export default'. This will cause a routing error.")
		}
	}

	// 3. Placeholder content detection
	placeholders := []string{"Lorem ipsum", "example.com", "555-", "john@example", "Jane Doe", "TODO:", "FIXME:"}
	for _, p := range placeholders {
		if strings.Contains(content, p) {
			warnings = append(warnings, fmt.Sprintf("Contains placeholder text '%s'. Replace with real content or remove.", p))
		}
	}

	return warnings
}

// validateTypeScript runs a lightweight syntax check (no import resolution)
func (e *FileExecutor) validateTypeScript(ctx context.Context, filePath string) error {
	e.debug("validateTypeScript starting", "file_path", filePath)

	// Check if node_modules exists, skip validation if not (will be caught by verifyBuild)
	nodeModulesPath := filepath.Join(e.workspacePath, "node_modules")
	e.debug("validateTypeScript checking for node_modules", "node_modules_path", nodeModulesPath)
	if _, err := os.Stat(nodeModulesPath); os.IsNotExist(err) {
		e.debug("validateTypeScript node_modules not found, skipping validation")
		return nil // Skip validation - verifyBuild will handle npm install
	}
	e.debug("validateTypeScript node_modules found, running esbuild validation")

	// Create timeout context (30 seconds max for validation) using parent context
	// This ensures the tool timeout (300s) propagates properly
	validateCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	// Use esbuild for fast SYNTAX-ONLY checking (no bundling/import resolution)
	// This avoids failing on imports that don't exist yet
	e.debug("validateTypeScript running esbuild command")
	// Compute path relative to workspace since cmd.Dir is set to workspacePath
	relPath, err := filepath.Rel(e.workspacePath, filePath)
	if err != nil {
		return fmt.Errorf("failed to compute relative path: %w", err)
	}
	cmd := exec.CommandContext(validateCtx, "npx", "esbuild", relPath, "--loader:.tsx=tsx", "--loader:.ts=ts", "--outfile=/dev/null")
	cmd.Dir = e.workspacePath

	output, err := cmd.CombinedOutput()
	if err != nil {
		e.debug("validateTypeScript esbuild command failed", "error", err.Error(), "output", string(output))
		// Check if timeout occurred
		if validateCtx.Err() == context.DeadlineExceeded {
			return fmt.Errorf("TypeScript validation timed out (30s)")
		}
		// Only report actual syntax errors (esbuild returns non-zero for any issue)
		outputStr := string(output)
		if strings.Contains(outputStr, "error:") || strings.Contains(outputStr, "ERROR") {
			return fmt.Errorf("%s", outputStr)
		}
		// If esbuild failed but there's no error message, it might be a non-syntax issue
		// (e.g., missing types), so we'll skip validation to avoid false positives
		e.debug("validateTypeScript esbuild failed with no syntax errors, skipping")
	}
	e.debug("validateTypeScript validation passed")
	return nil
}

// EditFile edits an existing file using search/replace with safety checks
func (e *FileExecutor) EditFile(ctx context.Context, args map[string]interface{}) (*ToolResult, error) {
	path, ok := args["path"].(string)
	if !ok {
		return nil, fmt.Errorf("path is required")
	}
	search, ok := args["search"].(string)
	if !ok {
		return nil, fmt.Errorf("search is required")
	}
	replace, ok := args["replace"].(string)
	if !ok {
		return nil, fmt.Errorf("replace is required")
	}
	replaceAll, _ := args["replaceAll"].(bool)

	// Validate path for writing (stricter than read)
	if err := e.validatePathForWrite(path); err != nil {
		return &ToolResult{
			Success: false,
			Content: fmt.Sprintf("Invalid path: %s", err.Error()),
		}, nil
	}

	// Initialize workspace from template on first file write
	if err := e.ensureWorkspaceReady(); err != nil {
		return nil, fmt.Errorf("failed to initialize workspace: %w", err)
	}

	fullPath := filepath.Join(e.workspacePath, path)

	// Read current content
	data, err := os.ReadFile(fullPath)
	if err != nil {
		if os.IsNotExist(err) {
			return &ToolResult{
				Success: false,
				Content: fmt.Sprintf("File not found: %s. Use createFile instead.", path),
			}, nil
		}
		return nil, fmt.Errorf("failed to read file: %w", err)
	}
	originalContent := string(data)

	// SAFETY CHECK 1: Exact match required
	if !strings.Contains(originalContent, search) {
		// Try to find similar matches for helpful error
		hint := findSimilarMatch(originalContent, search)
		hintMsg := ""
		if hint != "" {
			hintMsg = fmt.Sprintf("\n\nDid you mean:\n%s", truncateForHint(hint, 200))
		}
		return &ToolResult{
			Success: false,
			Content: fmt.Sprintf("Search string not found in %s. The content must match EXACTLY including whitespace.%s", path, hintMsg),
		}, nil
	}

	// SAFETY CHECK 2: Ambiguous matches
	count := strings.Count(originalContent, search)
	if count > 1 && !replaceAll {
		return &ToolResult{
			Success: false,
			Content: fmt.Sprintf("Found %d matches in %s. Either:\n1. Add more context to make search unique\n2. Set replaceAll=true to replace all occurrences", count, path),
		}, nil
	}

	// SAFETY CHECK 3: Validate size change isn't too drastic
	// Prevents accidental file truncation/corruption
	sizeDiff := len(replace) - len(search)
	originalSize := len(originalContent)
	if sizeDiff < 0 && originalSize > 100 && float64(-sizeDiff*count)/float64(originalSize) > 0.5 {
		return &ToolResult{
			Success: false,
			Content: "This edit would remove more than 50% of the file. Use createFile to replace the entire file instead.",
		}, nil
	}

	// Perform replacement
	var newContent string
	if replaceAll {
		newContent = strings.ReplaceAll(originalContent, search, replace)
	} else {
		newContent = strings.Replace(originalContent, search, replace, 1)
	}

	// SAFETY CHECK 4: Validate TypeScript/TSX syntax before saving
	if strings.HasSuffix(path, ".tsx") || strings.HasSuffix(path, ".ts") {
		// Create unique temp file to avoid race conditions
		ext := filepath.Ext(fullPath)
		baseName := strings.TrimSuffix(filepath.Base(fullPath), ext)

		tmpFile, err := os.CreateTemp(filepath.Dir(fullPath), baseName+".*.tmp"+ext)
		if err != nil {
			return nil, fmt.Errorf("failed to create temp file: %w", err)
		}
		tmpPath := tmpFile.Name()

		// Write content to temp file
		if _, err := tmpFile.WriteString(newContent); err != nil {
			_ = tmpFile.Close()
			_ = os.Remove(tmpPath)
			return nil, fmt.Errorf("failed to write temp file: %w", err)
		}
		_ = tmpFile.Close()
		defer func() { _ = os.Remove(tmpPath) }()

		if err := e.validateTypeScript(ctx, tmpPath); err != nil {
			return &ToolResult{
				Success: false,
				Content: fmt.Sprintf("Edit would introduce syntax errors:\n%s\n\nOriginal file unchanged.", err.Error()),
			}, nil
		}
	}

	// Write updated content
	if err := os.WriteFile(fullPath, []byte(newContent), 0644); err != nil {
		return nil, fmt.Errorf("failed to write file: %w", err)
	}

	result := fmt.Sprintf("File edited: %s (%d replacement(s))", path, count)

	// Check for missing imports (non-blocking warnings)
	if warnings := validateImports(fullPath, e.workspacePath); len(warnings) > 0 {
		result += "\n\n⚠️ Import warnings:\n" + strings.Join(warnings, "\n")
	}

	return &ToolResult{
		Success: true,
		Content: result,
	}, nil
}

// findSimilarMatch tries to find a similar string for error hints
func findSimilarMatch(content, search string) string {
	// Try finding first line of search in content
	lines := strings.Split(search, "\n")
	if len(lines) > 0 {
		firstLine := strings.TrimSpace(lines[0])
		if len(firstLine) > 10 {
			if idx := strings.Index(content, firstLine); idx != -1 {
				// Return context around the match
				start := idx
				end := idx + len(search) + 50
				if end > len(content) {
					end = len(content)
				}
				return content[start:end]
			}
		}
	}
	return ""
}

// truncateForHint truncates a string for display in hints
func truncateForHint(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen] + "..."
}

// ReadFile reads file contents
func (e *FileExecutor) ReadFile(ctx context.Context, args map[string]interface{}) (*ToolResult, error) {
	path, ok := args["path"].(string)
	if !ok {
		return nil, fmt.Errorf("path is required")
	}

	// Validate path
	if err := e.validatePath(path); err != nil {
		return &ToolResult{
			Success: false,
			Content: fmt.Sprintf("Invalid path: %s", err.Error()),
		}, nil
	}

	fullPath := filepath.Join(e.workspacePath, path)

	data, err := os.ReadFile(fullPath)
	if err != nil {
		if os.IsNotExist(err) {
			return &ToolResult{
				Success: false,
				Content: fmt.Sprintf("File not found: %s", path),
			}, nil
		}
		return nil, fmt.Errorf("failed to read file: %w", err)
	}

	return &ToolResult{
		Success: true,
		Content: string(data),
	}, nil
}

// ListFiles lists directory contents
func (e *FileExecutor) ListFiles(ctx context.Context, args map[string]interface{}) (*ToolResult, error) {
	path, ok := args["path"].(string)
	if !ok {
		path = "."
	}
	recursive, _ := args["recursive"].(bool)

	// Validate path
	if err := e.validatePath(path); err != nil {
		return &ToolResult{
			Success: false,
			Content: fmt.Sprintf("Invalid path: %s", err.Error()),
		}, nil
	}

	fullPath := filepath.Join(e.workspacePath, path)

	var output strings.Builder

	if recursive {
		err := filepath.Walk(fullPath, func(p string, info os.FileInfo, err error) error {
			if err != nil {
				return err
			}
			// Skip hidden files and node_modules
			if strings.HasPrefix(info.Name(), ".") || info.Name() == "node_modules" {
				if info.IsDir() {
					return filepath.SkipDir
				}
				return nil
			}
			relPath, relErr := filepath.Rel(e.workspacePath, p)
			if relErr != nil {
				return nil
			}
			if info.IsDir() {
				output.WriteString(relPath + "/\n")
			} else {
				output.WriteString(relPath + "\n")
			}
			return nil
		})
		if err != nil {
			return nil, fmt.Errorf("failed to list files: %w", err)
		}
	} else {
		entries, err := os.ReadDir(fullPath)
		if err != nil {
			if os.IsNotExist(err) {
				return &ToolResult{
					Success: false,
					Content: fmt.Sprintf("Directory not found: %s", path),
				}, nil
			}
			return nil, fmt.Errorf("failed to read directory: %w", err)
		}
		for _, entry := range entries {
			// Skip hidden files and node_modules
			if strings.HasPrefix(entry.Name(), ".") || entry.Name() == "node_modules" {
				continue
			}
			if entry.IsDir() {
				output.WriteString(entry.Name() + "/\n")
			} else {
				output.WriteString(entry.Name() + "\n")
			}
		}
	}

	result := output.String()
	if result == "" {
		result = "(empty directory)"
	}

	return &ToolResult{
		Success: true,
		Content: result,
	}, nil
}

// SearchResult represents a single search match
type SearchResult struct {
	File    string
	Line    int
	Content string
}

// SearchFiles searches file contents using regex patterns
func (e *FileExecutor) SearchFiles(ctx context.Context, args map[string]interface{}) (*ToolResult, error) {
	pattern, ok := args["pattern"].(string)
	if !ok || pattern == "" {
		return &ToolResult{
			Success: false,
			Content: "Error: pattern is required",
		}, nil
	}

	// Compile the regex
	re, err := regexp.Compile(pattern)
	if err != nil {
		return &ToolResult{
			Success: false,
			Content: fmt.Sprintf("Invalid regex pattern: %s", err.Error()),
		}, nil
	}

	// Get optional path parameter
	searchPath := "."
	if p, ok := args["path"].(string); ok && p != "" {
		searchPath = p
	}

	// Validate path
	if err := e.validatePath(searchPath); err != nil {
		return &ToolResult{
			Success: false,
			Content: fmt.Sprintf("Invalid path: %s", err.Error()),
		}, nil
	}

	// Get maxResults with default
	maxResults := 20
	if max, ok := args["maxResults"].(float64); ok {
		maxResults = int(max)
		if maxResults < 1 {
			maxResults = 1
		} else if maxResults > 50 {
			maxResults = 50
		}
	}

	fullPath := filepath.Join(e.workspacePath, searchPath)

	// Collect search results
	var results []SearchResult
	totalMatches := 0
	truncated := false

	err = filepath.Walk(fullPath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil // Skip files with errors
		}

		// Skip directories, hidden files, and non-searchable locations
		if info.IsDir() {
			name := info.Name()
			if strings.HasPrefix(name, ".") || name == "node_modules" || name == "dist" {
				return filepath.SkipDir
			}
			return nil
		}

		// Skip hidden files and non-searchable file types
		if strings.HasPrefix(info.Name(), ".") || !isSearchableFile(info.Name()) {
			return nil
		}

		// Check context cancellation
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		// Read and search the file
		file, err := os.Open(path)
		if err != nil {
			return nil // Skip files we can't open
		}
		defer func() { _ = file.Close() }()

		relPath, relErr := filepath.Rel(e.workspacePath, path)
		if relErr != nil {
			return nil
		}

		scanner := bufio.NewScanner(file)
		lineNum := 0
		for scanner.Scan() {
			lineNum++
			line := scanner.Text()

			if re.MatchString(line) {
				totalMatches++
				if len(results) < maxResults {
					results = append(results, SearchResult{
						File:    relPath,
						Line:    lineNum,
						Content: truncateLine(line, 200),
					})
				} else {
					truncated = true
				}
			}
		}

		return nil
	})

	if err != nil && !errors.Is(err, context.Canceled) && !errors.Is(err, context.DeadlineExceeded) {
		return nil, fmt.Errorf("search error: %w", err)
	}

	// Format output
	output := formatSearchResults(pattern, results, totalMatches, truncated)

	return &ToolResult{
		Success: true,
		Content: output,
	}, nil
}

// deleteProtectedFiles lists files that cannot be deleted
var deleteProtectedFiles = map[string]bool{
	"src/routes.tsx":     true,
	"src/main.tsx":       true,
	"src/index.tsx":      true,
	"package.json":       true,
	"tsconfig.json":      true,
	"vite.config.ts":     true,
	"vite.config.js":     true,
	"tailwind.config.js": true,
	"tailwind.config.ts": true,
	"postcss.config.js":  true,
	"index.html":         true,
	"template.json":      true,
}

// DeleteFile deletes a file from the workspace
func (e *FileExecutor) DeleteFile(ctx context.Context, args map[string]interface{}) (*ToolResult, error) {
	path, ok := args["path"].(string)
	if !ok || path == "" {
		return &ToolResult{Success: false, Content: "path is required"}, nil
	}
	reason, _ := args["reason"].(string)

	// Normalize path
	path = filepath.Clean(path)
	path = strings.TrimPrefix(path, "/")
	path = strings.TrimPrefix(path, string(filepath.Separator))

	e.debug("deleteFile", "path", path, "reason", reason)

	// Check protected files by exact path
	if deleteProtectedFiles[path] {
		return &ToolResult{
			Success: false,
			Content: fmt.Sprintf("Cannot delete protected file: %s. This file is required for the project to function.", path),
		}, nil
	}

	// Also block config files by pattern
	if strings.HasSuffix(path, ".config.js") ||
		strings.HasSuffix(path, ".config.ts") ||
		strings.HasSuffix(path, ".config.json") ||
		strings.HasSuffix(path, ".config.mjs") ||
		strings.HasSuffix(path, ".config.cjs") {
		return &ToolResult{
			Success: false,
			Content: fmt.Sprintf("Cannot delete config file: %s. Config files are protected.", path),
		}, nil
	}

	// Validate path is within workspace (prevent path traversal, follows symlinks)
	fullPath, err := ResolveAndValidatePath(e.workspacePath, path)
	if err != nil {
		return &ToolResult{
			Success: false,
			Content: "Path traversal not allowed. File must be within the project workspace.",
		}, nil
	}

	// Check if file exists
	if _, err := os.Stat(fullPath); os.IsNotExist(err) {
		return &ToolResult{
			Success: true,
			Content: fmt.Sprintf("File does not exist: %s (nothing to delete)", path),
		}, nil
	}

	// Check if it's a directory (don't delete directories)
	info, err := os.Stat(fullPath)
	if err != nil {
		return &ToolResult{
			Success: false,
			Content: fmt.Sprintf("Failed to check file: %s", err.Error()),
		}, nil
	}
	if info.IsDir() {
		return &ToolResult{
			Success: false,
			Content: fmt.Sprintf("Cannot delete directory: %s. Use deleteFile only for files.", path),
		}, nil
	}

	// Delete the file
	if err := os.Remove(fullPath); err != nil {
		return &ToolResult{
			Success: false,
			Content: fmt.Sprintf("Failed to delete file: %s", err.Error()),
		}, nil
	}

	msg := fmt.Sprintf("Successfully deleted: %s", path)
	if reason != "" {
		msg += fmt.Sprintf(" (reason: %s)", reason)
	}

	e.debug("deleteFile completed", "path", path)

	return &ToolResult{Success: true, Content: msg}, nil
}

// isSearchableFile returns true if the file extension is searchable
func isSearchableFile(name string) bool {
	searchableExtensions := map[string]bool{
		".ts":   true,
		".tsx":  true,
		".js":   true,
		".jsx":  true,
		".json": true,
		".css":  true,
		".scss": true,
		".html": true,
		".md":   true,
		".txt":  true,
		".yaml": true,
		".yml":  true,
	}

	ext := strings.ToLower(filepath.Ext(name))
	return searchableExtensions[ext]
}

// truncateLine truncates a line to maxLen characters
func truncateLine(line string, maxLen int) string {
	line = strings.TrimSpace(line)
	if len(line) <= maxLen {
		return line
	}
	return line[:maxLen] + "..."
}

// formatSearchResults formats search results into a readable string
func formatSearchResults(pattern string, results []SearchResult, totalMatches int, truncated bool) string {
	if len(results) == 0 {
		return fmt.Sprintf("No matches found for pattern %q", pattern)
	}

	var sb strings.Builder

	if truncated {
		fmt.Fprintf(&sb, "Found %d match(es) for pattern %q (showing first %d):\n\n", totalMatches, pattern, len(results))
	} else {
		fmt.Fprintf(&sb, "Found %d match(es) for pattern %q:\n\n", len(results), pattern)
	}

	for _, r := range results {
		fmt.Fprintf(&sb, "%s:%d: %s\n", r.File, r.Line, r.Content)
	}

	return sb.String()
}

// validatePath checks for path traversal attacks
func (e *FileExecutor) validatePath(path string) error {
	// Normalize path
	cleaned := filepath.Clean(path)

	// Check for path traversal patterns in input
	if strings.HasPrefix(cleaned, "..") || strings.HasPrefix(cleaned, "/") {
		return fmt.Errorf("path traversal not allowed: %s", path)
	}

	// Block certain paths
	blocked := []string{"node_modules", ".git", ".env"}
	for _, b := range blocked {
		if strings.HasPrefix(cleaned, b) {
			return fmt.Errorf("access denied: %s", path)
		}
	}

	// Verify resolved path stays within workspace (follows symlinks)
	if _, err := ResolveAndValidatePath(e.workspacePath, path); err != nil {
		return fmt.Errorf("path traversal not allowed: %s", path)
	}

	return nil
}

// ProtectedWriteFiles lists files that cannot be written to via AI agent or code editor.
// These are system config files managed by the template/build system.
var ProtectedWriteFiles = []string{
	"vite.config.ts",
	"tsconfig.json",
	"package.json",
	"package-lock.json",
	"components.json",
	"tailwind.config.ts",
	"tailwind.config.js",
	"postcss.config.js",
	"postcss.config.cjs",
	"index.html",
	"src/main.tsx",  // React entry point
	"src/index.css", // Tailwind theme config
	"template.json", // Internal project metadata
}

// IsProtectedFile checks if a path is a protected file that cannot be written to.
func IsProtectedFile(path string) bool {
	cleaned := filepath.Clean(path)
	for _, f := range ProtectedWriteFiles {
		if cleaned == f {
			return true
		}
	}
	return false
}

// validatePathForWrite checks if a path can be written to (stricter than read)
func (e *FileExecutor) validatePathForWrite(path string) error {
	// First run standard validation
	if err := e.validatePath(path); err != nil {
		return err
	}

	// Block config files - these are managed by the system, not the AI
	if IsProtectedFile(path) {
		return fmt.Errorf("cannot modify %s: this is a system config file", path)
	}

	return nil
}

// importPattern matches ES module import statements including "import type" syntax
var importPattern = regexp.MustCompile(`import\s+(?:type\s+)?(?:.*?\s+from\s+)?['"]([^'"]+)['"]`)

// validateImports checks if imported packages exist in package.json
// Returns warning strings for missing packages (non-blocking)
func validateImports(filePath, workspacePath string) []string {
	// Only check .ts/.tsx/.js/.jsx files
	ext := strings.ToLower(filepath.Ext(filePath))
	if ext != ".ts" && ext != ".tsx" && ext != ".js" && ext != ".jsx" {
		return nil
	}

	content, err := os.ReadFile(filePath)
	if err != nil {
		return nil
	}

	// Find all import specifiers
	matches := importPattern.FindAllSubmatch(content, -1)
	if len(matches) == 0 {
		return nil
	}

	// Extract unique package names (skip relative and alias imports)
	packages := make(map[string]bool)
	for _, match := range matches {
		specifier := string(match[1])
		// Skip relative imports
		if strings.HasPrefix(specifier, "./") || strings.HasPrefix(specifier, "../") {
			continue
		}
		// Skip alias imports
		if strings.HasPrefix(specifier, "@/") {
			continue
		}
		// Extract package name: first segment, or @scope/name for scoped
		pkgName := specifier
		if strings.HasPrefix(specifier, "@") {
			parts := strings.SplitN(specifier, "/", 3)
			if len(parts) >= 2 {
				pkgName = parts[0] + "/" + parts[1]
			}
		} else {
			parts := strings.SplitN(specifier, "/", 2)
			pkgName = parts[0]
		}
		packages[pkgName] = true
	}

	if len(packages) == 0 {
		return nil
	}

	// Read package.json
	pkgPath := filepath.Join(workspacePath, "package.json")
	pkgData, err := os.ReadFile(pkgPath)
	if err != nil {
		return nil // No package.json, skip validation
	}

	var pkgJSON struct {
		Dependencies    map[string]string `json:"dependencies"`
		DevDependencies map[string]string `json:"devDependencies"`
	}
	if err := json.Unmarshal(pkgData, &pkgJSON); err != nil {
		return nil
	}

	// Check each package against dependencies
	var warnings []string
	for pkg := range packages {
		_, inDeps := pkgJSON.Dependencies[pkg]
		_, inDevDeps := pkgJSON.DevDependencies[pkg]
		if !inDeps && !inDevDeps {
			warnings = append(warnings, fmt.Sprintf("Package '%s' is not in package.json", pkg))
		}
	}

	return warnings
}
