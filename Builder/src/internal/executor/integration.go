package executor

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

// placeholderPatterns matches file names that are likely garbage/placeholder files
// created when AI gets confused and can't properly delete files
var placeholderPatterns = []*regexp.Regexp{
	regexp.MustCompile(`(?i)DELETED`),      // DELETED.txt, Deleted.tsx
	regexp.MustCompile(`(?i)Fixed\.tsx$`),  // HomeFixed.tsx, AboutFixed.tsx
	regexp.MustCompile(`(?i)New\.tsx$`),    // HomeNew.tsx, NewHome.tsx (but not just New.tsx)
	regexp.MustCompile(`(?i)Old\.tsx$`),    // HomeOld.tsx, OldHome.tsx
	regexp.MustCompile(`(?i)Copy\.tsx$`),   // HomeCopy.tsx
	regexp.MustCompile(`(?i)Backup\.tsx$`), // HomeBackup.tsx
	regexp.MustCompile(`(?i)\.bak$`),       // Home.tsx.bak
	regexp.MustCompile(`(?i)\.tmp$`),       // Home.tsx.tmp
	regexp.MustCompile(`(?i)~$`),           // Home.tsx~
}

// isPlaceholderFile returns true if the filename matches placeholder patterns
func isPlaceholderFile(path string) bool {
	for _, pattern := range placeholderPatterns {
		if pattern.MatchString(path) {
			return true
		}
	}
	return false
}

// isPlaceholderContent returns true if the file content indicates it's a placeholder
func isPlaceholderContent(content string) bool {
	// Very short files (less than 50 chars) are likely placeholders
	if len(strings.TrimSpace(content)) < 50 {
		return true
	}

	// Check for common placeholder markers
	lowerContent := strings.ToLower(content)
	placeholderMarkers := []string{
		"// deleted",
		"// removed",
		"// this file has been removed",
		"// this file has been deleted",
		"export default null",
		"export default undefined",
		"// placeholder",
	}
	for _, marker := range placeholderMarkers {
		if strings.Contains(lowerContent, marker) {
			return true
		}
	}

	return false
}

// IntegrationExecutor verifies component integration
type IntegrationExecutor struct {
	workspacePath string
}

// NewIntegrationExecutor creates a new integration executor
func NewIntegrationExecutor(workspacePath string) *IntegrationExecutor {
	return &IntegrationExecutor{workspacePath: workspacePath}
}

// IntegrationIssue represents a single integration problem
type IntegrationIssue struct {
	File    string `json:"file"`
	Issue   string `json:"issue"`
	Details string `json:"details"`
}

// VerifyIntegration checks if files are properly integrated in App.tsx or routes.tsx
func (e *IntegrationExecutor) VerifyIntegration(ctx context.Context, args map[string]interface{}) (*ToolResult, error) {
	filesArg, ok := args["files"]
	if !ok {
		return &ToolResult{
			Success: false,
			Content: "No files provided to verify",
		}, nil
	}

	// Handle both []interface{} and []string
	var files []string
	switch v := filesArg.(type) {
	case []interface{}:
		for _, f := range v {
			if s, ok := f.(string); ok {
				files = append(files, s)
			}
		}
	case []string:
		files = v
	default:
		return &ToolResult{
			Success: false,
			Content: "Invalid files parameter type",
		}, nil
	}

	if len(files) == 0 {
		return &ToolResult{
			Success: false,
			Content: "No files provided to verify",
		}, nil
	}

	// Load template.json for routing context (graceful fallback if missing)
	tmplConfig := loadTemplateRouteConfig(e.workspacePath)

	// Determine routes file path from template.json or use default
	routesFilePath := "src/routes.tsx"
	if tmplConfig != nil && tmplConfig.RoutesFile != "" {
		routesFilePath = tmplConfig.RoutesFile
	}

	// Try to read routes file first (preferred), then App.tsx
	var mainContent string
	var mainFile string

	routesPath := filepath.Join(e.workspacePath, routesFilePath)
	if content, err := os.ReadFile(routesPath); err == nil {
		mainContent = string(content)
		mainFile = filepath.Base(routesFilePath)
	} else {
		// Fall back to App.tsx
		appPath := filepath.Join(e.workspacePath, "src/App.tsx")
		content, err := os.ReadFile(appPath)
		if err != nil {
			return &ToolResult{
				Success: false,
				Content: fmt.Sprintf("Cannot read App.tsx or %s: %s", routesFilePath, err.Error()),
			}, nil
		}
		mainContent = string(content)
		mainFile = "App.tsx"
	}

	var issues []IntegrationIssue
	var skippedPlaceholders []string

	for _, filePath := range files {
		// Only check page files
		if !strings.Contains(filePath, "src/pages/") {
			continue
		}

		// Skip placeholder files by name pattern
		if isPlaceholderFile(filePath) {
			skippedPlaceholders = append(skippedPlaceholders, filePath)
			continue
		}

		// Check if file exists
		fullPath := filepath.Join(e.workspacePath, filePath)
		if _, err := os.Stat(fullPath); os.IsNotExist(err) {
			issues = append(issues, IntegrationIssue{
				File:    filePath,
				Issue:   "file_not_found",
				Details: "File does not exist",
			})
			continue
		}

		// Check if file content indicates it's a placeholder
		content, err := os.ReadFile(fullPath)
		if err == nil && isPlaceholderContent(string(content)) {
			skippedPlaceholders = append(skippedPlaceholders, filePath)
			continue
		}

		// Extract component name from file path
		componentName := extractComponentName(filePath)
		if componentName == "" {
			continue
		}

		// Check if imported
		// Match patterns like: import Home from './pages/Home'
		// or: import { Home } from './pages/Home'
		importPattern := regexp.MustCompile(fmt.Sprintf(`import\s+(?:%s|\{[^}]*%s[^}]*\})\s+from\s+['"]\.?/?(?:\.\.\/)*(?:src\/)?pages\/%s['"]`, componentName, componentName, componentName))
		if !importPattern.MatchString(mainContent) {
			// Also check for simpler import patterns
			simpleImport := regexp.MustCompile(fmt.Sprintf(`import\s+%s\s+from`, componentName))
			if !simpleImport.MatchString(mainContent) {
				issues = append(issues, IntegrationIssue{
					File:    filePath,
					Issue:   "unimported",
					Details: fmt.Sprintf("Component '%s' is not imported in %s. Add: import %s from './pages/%s'", componentName, mainFile, componentName, componentName),
				})
				continue
			}
		}

		// Check if used/rendered (in JSX or routes array)
		// Matches: <Home />, <Home/>, <Home>, element: <Home, Component: Home, component={Home}, lazy imports
		usagePatterns := []string{
			fmt.Sprintf(`<%s\s*/?>`, componentName),            // <Home /> or <Home/> or <Home>
			fmt.Sprintf(`<%s\s+[^>]*>`, componentName),         // <Home prop="value">
			fmt.Sprintf(`element:\s*<%s`, componentName),       // element: <Home
			fmt.Sprintf(`[Cc]omponent:\s*%s\b`, componentName), // Component: Home or component: Home
			fmt.Sprintf(`component=\{%s\}`, componentName),     // component={Home}
			fmt.Sprintf(`lazy\([^)]*%s`, componentName),        // lazy(() => import('./pages/Home'))
			fmt.Sprintf(`['"]/%s['"]`, strings.ToLower(componentName)), // path: '/home' in RouteConfig
			fmt.Sprintf(`(?i)label:\s*['"][^'"]*%s[^'"]*['"]`, componentName), // label: 'Home' or 'home' in RouteConfig
		}

		used := false
		for _, pattern := range usagePatterns {
			if regexp.MustCompile(pattern).MatchString(mainContent) {
				used = true
				break
			}
		}

		if !used {
			issues = append(issues, IntegrationIssue{
				File:    filePath,
				Issue:   "unused",
				Details: fmt.Sprintf("Component '%s' is imported but not rendered. Add it to the routes array or JSX.", componentName),
			})
		}
	}

	// Check layout component usage in page files
	templatePath := filepath.Join(e.workspacePath, "template.json")
	if tmplData, err := os.ReadFile(templatePath); err == nil {
		var tmpl struct {
			CustomComponents []struct {
				Name string `json:"name"`
			} `json:"custom_components"`
		}
		if jsonErr := json.Unmarshal(tmplData, &tmpl); jsonErr == nil {
			var layoutName string
			for _, comp := range tmpl.CustomComponents {
				if strings.Contains(strings.ToLower(comp.Name), "layout") {
					layoutName = comp.Name
					break
				}
			}
			if layoutName != "" {
				// Check if Layout is applied centrally in App.tsx.
				// Templates wrap routes like: <Layout>{route.element}</Layout>
				// When detected, pages don't need to import Layout themselves.
				// Detection: if App.tsx has both <Layout and </Layout>, it wraps children centrally.
				centralContent := mainContent
				appTsxPath := filepath.Join(e.workspacePath, "src/App.tsx")
				if appData, readErr := os.ReadFile(appTsxPath); readErr == nil {
					centralContent = string(appData)
				}
				hasCentralLayout := strings.Contains(centralContent, "<"+layoutName) &&
					strings.Contains(centralContent, "</"+layoutName+">")

				if !hasCentralLayout {
					// No centralized layout — check individual pages for Layout import
					// Find pages with layout: 'bare' in routes file -- they intentionally skip Layout
					// Handles both single-line and multi-line route objects by matching
					// element and layout: 'bare' within the same route object ({ ... })
					bareLayoutPages := make(map[string]bool)
					// element before layout
					barePattern := regexp.MustCompile(`(?s)\{[^}]*?element:\s*<(\w+)[^}]*?layout:\s*['"]bare['"][^}]*?\}`)
					// layout before element
					barePatternReverse := regexp.MustCompile(`(?s)\{[^}]*?layout:\s*['"]bare['"][^}]*?element:\s*<(\w+)[^}]*?\}`)
					for _, m := range barePattern.FindAllStringSubmatch(mainContent, -1) {
						bareLayoutPages[m[1]] = true
					}
					for _, m := range barePatternReverse.FindAllStringSubmatch(mainContent, -1) {
						bareLayoutPages[m[1]] = true
					}

					for _, filePath := range files {
						if isPlaceholderFile(filePath) {
							continue
						}
						if !strings.Contains(filePath, "src/pages/") {
							continue
						}

						// Skip pages with layout: 'bare' -- they intentionally don't use Layout
						componentName := extractComponentName(filePath)
						if bareLayoutPages[componentName] {
							continue
						}

						fullPath := filepath.Join(e.workspacePath, filePath)
						pageContent, err := os.ReadFile(fullPath)
						if err != nil {
							continue
						}
						pageStr := string(pageContent)
						layoutImportPattern := regexp.MustCompile(fmt.Sprintf(`import\s+.*%s`, layoutName))
						if !layoutImportPattern.MatchString(pageStr) {
							issues = append(issues, IntegrationIssue{
								File:    filePath,
								Issue:   "missing_layout",
								Details: fmt.Sprintf("Page does not import the '%s' component. All pages should use the shared layout for consistent navigation.", layoutName),
							})
						}
					}
				}
			}
		}
	}

	// Format output
	var sb strings.Builder

	// Report skipped placeholder files first
	if len(skippedPlaceholders) > 0 {
		sb.WriteString("PLACEHOLDER FILES DETECTED (skipped verification):\n")
		for _, file := range skippedPlaceholders {
			fmt.Fprintf(&sb, "  - %s\n", file)
		}
		sb.WriteString("\nThese files appear to be placeholders or garbage files. Use the deleteFile tool to remove them.\n\n")
	}

	if len(issues) == 0 {
		if len(skippedPlaceholders) > 0 {
			// Has placeholders but no real issues - still success but recommend cleanup
			return &ToolResult{
				Success: true,
				Content: sb.String() + "All valid pages are properly integrated. Consider deleting the placeholder files above.",
			}, nil
		}
		return &ToolResult{
			Success: true,
			Content: "All pages are properly integrated! Every file is imported and rendered.",
		}, nil
	}

	// Format issues for AI
	sb.WriteString("INTEGRATION ISSUES FOUND:\n\n")
	for _, issue := range issues {
		fmt.Fprintf(&sb, "- %s [%s]\n  %s\n\n", issue.File, issue.Issue, issue.Details)
	}
	sb.WriteString("Fix these issues before telling the user they can access these pages.")

	return &ToolResult{
		Success: false,
		Content: sb.String(),
	}, nil
}

// templateRouteInfo holds routing config extracted from template.json
type templateRouteInfo struct {
	RoutesFile     string
	AvailablePages []string
}

// loadTemplateRouteConfig reads template.json and extracts routing configuration.
// Returns nil if template.json doesn't exist (graceful fallback).
func loadTemplateRouteConfig(workspacePath string) *templateRouteInfo {
	templatePath := filepath.Join(workspacePath, "template.json")
	data, err := os.ReadFile(templatePath)
	if err != nil {
		return nil
	}

	var tmpl struct {
		FileStructure struct {
			RoutesFile string `json:"routes_file"`
		} `json:"file_structure"`
		AvailablePages []struct {
			Name string `json:"name"`
		} `json:"available_pages"`
	}
	if err := json.Unmarshal(data, &tmpl); err != nil {
		return nil
	}

	info := &templateRouteInfo{
		RoutesFile: tmpl.FileStructure.RoutesFile,
	}
	for _, p := range tmpl.AvailablePages {
		info.AvailablePages = append(info.AvailablePages, p.Name)
	}
	return info
}

// extractComponentName gets the component name from a file path
// e.g., "src/pages/About.tsx" -> "About"
func extractComponentName(filePath string) string {
	base := filepath.Base(filePath)
	ext := filepath.Ext(base)
	return strings.TrimSuffix(base, ext)
}
