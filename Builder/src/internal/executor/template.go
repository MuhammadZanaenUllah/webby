package executor

import (
	"archive/zip"
	"context"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"time"

	"webby-builder/internal/client/laravel"
	"webby-builder/internal/models"

	"github.com/sirupsen/logrus"
)

// TemplateExecutor handles template operations
type TemplateExecutor struct {
	serverKey  string
	laravelURL string
	logger     *logrus.Logger
	toolConfig models.ToolExecutionConfig
}

// NewTemplateExecutor creates a new template executor
func NewTemplateExecutor(serverKey, laravelURL string, logger *logrus.Logger, toolConfig models.ToolExecutionConfig) *TemplateExecutor {
	return &TemplateExecutor{
		serverKey:  serverKey,
		laravelURL: laravelURL,
		logger:     logger,
		toolConfig: toolConfig,
	}
}

// FetchTemplates calls Laravel API to list templates
func (e *TemplateExecutor) FetchTemplates(ctx context.Context) (*ToolResult, error) {
	client := laravel.NewClient(e.laravelURL, e.serverKey)
	resp, err := client.FetchTemplates()
	if err != nil {
		return &ToolResult{
			Success: false,
			Content: fmt.Sprintf("Failed to fetch templates from Laravel API: %s", err),
		}, nil
	}

	// Format response for AI
	return e.formatTemplateList(resp), nil
}

// GetTemplateInfo gets detailed template metadata
func (e *TemplateExecutor) GetTemplateInfo(ctx context.Context, templateID string) (*ToolResult, error) {
	client := laravel.NewClient(e.laravelURL, e.serverKey)
	metadata, err := client.GetTemplateMetadata(templateID)
	if err != nil {
		return &ToolResult{
			Success: false,
			Content: fmt.Sprintf("Failed to get template info: %s", err),
		}, nil
	}

	return &ToolResult{
		Success: true,
		Content: e.formatMetadata(metadata),
	}, nil
}

// UseTemplate downloads and extracts template to workspace (lazy initialization)
func (e *TemplateExecutor) UseTemplate(ctx context.Context, workspacePath, templateID string) error {
	// Use configurable timeout with 300s minimum for template downloads
	timeout := time.Duration(e.toolConfig.Timeout) * time.Second
	if timeout < 300*time.Second {
		timeout = 300 * time.Second // Minimum 5 minutes for template downloads
	}

	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	client := laravel.NewClientWithTimeout(e.laravelURL, e.serverKey, timeout)
	body, err := client.DownloadTemplate(templateID)
	if err != nil {
		return fmt.Errorf("failed to download template: %w", err)
	}
	defer func() { _ = body.Close() }()

	// Check context cancellation before proceeding
	select {
	case <-ctx.Done():
		return ctx.Err()
	default:
	}

	// Create temp file for zip
	tmpFile := filepath.Join(os.TempDir(), fmt.Sprintf("template-%s.zip", templateID))
	tmpZip, err := os.Create(tmpFile)
	if err != nil {
		return fmt.Errorf("failed to create temp file: %w", err)
	}
	defer func() { _ = os.Remove(tmpFile) }() // Always clean up temp file on all code paths

	// Copy download to temp file (limit to 100MB to prevent disk exhaustion)
	const maxTemplateSize = 100 * 1024 * 1024
	written, err := io.Copy(tmpZip, io.LimitReader(body, maxTemplateSize+1))
	if err != nil {
		_ = tmpZip.Close()
		return fmt.Errorf("failed to save template: %w", err)
	}
	if written > maxTemplateSize {
		_ = tmpZip.Close()
		return fmt.Errorf("template too large (exceeds 100MB limit)")
	}

	// Close file before extraction (required by zip.OpenReader)
	_ = tmpZip.Close()

	// Extract to workspace
	if err := e.extractZip(tmpFile, workspacePath); err != nil {
		return fmt.Errorf("failed to extract template: %w", err)
	}

	e.logger.WithFields(logrus.Fields{
		"template": templateID,
		"path":     workspacePath,
	}).Info("Template downloaded and extracted")

	return nil
}

// formatTemplateList formats template list for AI consumption
func (e *TemplateExecutor) formatTemplateList(resp *models.TemplateListResponse) *ToolResult {
	var sb strings.Builder
	sb.WriteString("Available Templates:\n\n")
	for _, t := range resp.Templates {
		fmt.Fprintf(&sb, "- %s: %s", t.ID, t.Name)
		if t.Category != "" {
			fmt.Fprintf(&sb, " [%s]", t.Category)
		}
		sb.WriteString("\n")
		fmt.Fprintf(&sb, "  Description: %s\n\n", t.Description)
	}
	sb.WriteString("Use getTemplateInfo to get detailed metadata about a specific template before using it.")

	return &ToolResult{
		Success: true,
		Content: sb.String(),
	}
}

// formatMetadata formats template metadata for AI consumption
func (e *TemplateExecutor) formatMetadata(metadata *models.TemplateMetadata) string {
	var sb strings.Builder

	fmt.Fprintf(&sb, "Template: %s\n\n", metadata.Name)
	fmt.Fprintf(&sb, "%s\n\n", metadata.Description)

	sb.WriteString("Categories: ")
	sb.WriteString(strings.Join(metadata.Categories, ", "))
	sb.WriteString("\n\n")

	sb.WriteString("File Structure:\n")
	fmt.Fprintf(&sb, "  Pages: %s\n", metadata.FileStructure.PagesDir)
	fmt.Fprintf(&sb, "  Components: %s\n", metadata.FileStructure.ComponentsDir)
	fmt.Fprintf(&sb, "  Routes: %s\n\n", metadata.FileStructure.RoutesFile)

	if len(metadata.AvailablePages) > 0 {
		sb.WriteString("Available Pages:\n")
		for _, p := range metadata.AvailablePages {
			fmt.Fprintf(&sb, "  - %s (%s): %s\n", p.Name, p.Path, p.Description)
		}
		sb.WriteString("\n")
	}

	if len(metadata.CustomComponents) > 0 {
		sb.WriteString("Custom Components:\n")
		for _, c := range metadata.CustomComponents {
			fmt.Fprintf(&sb, "  - %s (%s): %s\n", c.Name, c.Path, c.Description)
		}
		sb.WriteString("\n")
	}

	if len(metadata.ShadcnComponents) > 0 {
		sb.WriteString("Shadcn Components: ")
		sb.WriteString(strings.Join(metadata.ShadcnComponents, ", "))
		sb.WriteString("\n\n")
	}

	sb.WriteString("Styling:\n")
	fmt.Fprintf(&sb, "  Framework: %s\n", metadata.Styling.Framework)
	fmt.Fprintf(&sb, "  Primary Color: %s\n", metadata.Styling.PrimaryColor)
	fmt.Fprintf(&sb, "  Icon Set: %s\n\n", metadata.Styling.IconSet)

	fmt.Fprintf(&sb, "Routing: %s\n\n", metadata.RoutingPattern)

	if len(metadata.Dependencies) > 0 {
		sb.WriteString("Dependencies:\n")
		for _, d := range metadata.Dependencies {
			fmt.Fprintf(&sb, "  - %s@%s\n", d.Name, d.Version)
		}
		sb.WriteString("\n")
	}

	if len(metadata.UsageExamples) > 0 {
		sb.WriteString("Usage Examples:\n")
		for key, value := range metadata.UsageExamples {
			fmt.Fprintf(&sb, "  %s: %s\n", key, value)
		}
	}

	return sb.String()
}

// extractZip extracts a zip file to a destination directory
func (e *TemplateExecutor) extractZip(zipPath, destDir string) error {
	r, err := zip.OpenReader(zipPath)
	if err != nil {
		return err
	}
	defer func() { _ = r.Close() }()

	// Create destination directory if it doesn't exist
	if err := os.MkdirAll(destDir, 0755); err != nil {
		return err
	}

	// Extract files
	for _, f := range r.File {
		// Skip node_modules and dist - they should be generated fresh
		if containsPathSegment(f.Name, "node_modules") || containsPathSegment(f.Name, "dist") || filepath.Base(f.Name) == "package-lock.json" {
			continue
		}

		// Build destination path
		destPath := filepath.Join(destDir, f.Name)

		// Zip slip protection: ensure extracted path stays within destDir
		if !strings.HasPrefix(filepath.Clean(destPath), filepath.Clean(destDir)+string(os.PathSeparator)) {
			return fmt.Errorf("invalid file path in template (zip slip detected): %s", f.Name)
		}

		// Create directory
		if f.FileInfo().IsDir() {
			if err := os.MkdirAll(destPath, f.Mode()); err != nil {
				return err
			}
			continue
		}

		// Extract file
		rc, err := f.Open()
		if err != nil {
			return err
		}

		// Create parent directory
		if err := os.MkdirAll(filepath.Dir(destPath), 0755); err != nil {
			_ = rc.Close()
			return err
		}

		outFile, err := os.OpenFile(destPath, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, f.Mode())
		if err != nil {
			_ = rc.Close()
			return err
		}

		_, err = io.Copy(outFile, rc)
		_ = rc.Close()
		_ = outFile.Close()

		if err != nil {
			return err
		}
	}

	return nil
}

// containsPathSegment checks if a filepath contains a segment as a complete
// directory name, not as a substring of another name.
// e.g., containsPathSegment("src/dist/file.js", "dist") = true
//
//	containsPathSegment("src/dist_button/file.js", "dist") = false
func containsPathSegment(path, segment string) bool {
	parts := strings.Split(filepath.ToSlash(path), "/")
	for _, part := range parts {
		if part == segment {
			return true
		}
	}
	return false
}
