package executor

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
)

// getFileInfo gets metadata and structure information about a file
func (e *FileExecutor) getFileInfo(ctx context.Context, args map[string]interface{}) (*ToolResult, error) {
	path, _ := args["path"].(string)

	// Validate path
	if err := e.validatePath(path); err != nil {
		return &ToolResult{
			Success: false,
			Content: fmt.Sprintf("Invalid path: %s", err.Error()),
		}, nil
	}

	fullPath := filepath.Join(e.workspacePath, path)

	info, err := os.Stat(fullPath)
	if err != nil {
		if os.IsNotExist(err) {
			return &ToolResult{
				Success: false,
				Content: fmt.Sprintf("File not found: %s", path),
			}, nil
		}
		return nil, fmt.Errorf("failed to stat file: %w", err)
	}

	content, err := os.ReadFile(fullPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read file: %w", err)
	}

	contentStr := string(content)

	var sb strings.Builder
	fmt.Fprintf(&sb, "**File Information: %s**\n\n", path)

	// Basic metadata
	lines := strings.Split(contentStr, "\n")
	sb.WriteString("**Metadata:**\n")
	fmt.Fprintf(&sb, "- Size: %d bytes\n", info.Size())
	fmt.Fprintf(&sb, "- Lines: %d\n", len(lines))
	fmt.Fprintf(&sb, "- Modified: %s\n", info.ModTime().Format("2006-01-02 15:04:05"))

	// Determine file type
	var fileType string
	ext := strings.ToLower(filepath.Ext(path))
	switch {
	case ext == ".tsx" || ext == ".jsx":
		if strings.Contains(path, "src/pages/") {
			fileType = "Page"
		} else if strings.Contains(path, "src/components/") {
			fileType = "Component"
		} else {
			fileType = "React/TSX file"
		}
	case ext == ".ts":
		fileType = "TypeScript file"
	case ext == ".css" || ext == ".scss":
		fileType = "Stylesheet"
	case ext == ".html":
		fileType = "HTML file"
	case path == "package.json":
		fileType = "Package config (read-only)"
	case path == "tsconfig.json":
		fileType = "TypeScript config (read-only)"
	default:
		fileType = fmt.Sprintf("%s file", ext)
	}

	fmt.Fprintf(&sb, "- Type: %s\n", fileType)

	// For TSX files, get additional info
	if ext == ".tsx" {
		// Get imports
		importPattern := regexp.MustCompile(`^import\s+.*from\s+['"]([^'"]+)['"]`)
		imports := []string{}
		for _, line := range lines {
			if importPattern.MatchString(line) {
				matches := importPattern.FindStringSubmatch(line)
				if len(matches) > 1 {
					imports = append(imports, matches[1])
				}
			}
		}

		if len(imports) > 0 {
			sb.WriteString("\n**Imports:**\n")
			for _, imp := range imports {
				fmt.Fprintf(&sb, "- %s\n", imp)
			}
		}

		// Get components used
		uiImports := regexp.MustCompile(`from\s+['"]@/components/ui/(\w+)['"]`)
		uiMatches := uiImports.FindAllStringSubmatch(contentStr, -1)
		if len(uiMatches) > 0 {
			components := make(map[string]bool)
			for _, m := range uiMatches {
				if len(m) > 1 {
					components[m[1]] = true
				}
			}
			if len(components) > 0 {
				sb.WriteString("\n**UI Components Used:**\n")
				for _, comp := range sortedKeys(components) {
					fmt.Fprintf(&sb, "- %s\n", comp)
				}
			}
		}

		// Check for Layout/Navigation usage
		usesLayout := strings.Contains(contentStr, "import Layout") ||
			strings.Contains(contentStr, "from './Layout'") ||
			strings.Contains(contentStr, `from "./Layout"`)
		usesNav := strings.Contains(contentStr, "import Navigation") ||
			strings.Contains(contentStr, "from './Navigation'") ||
			strings.Contains(contentStr, `from "./Navigation"`)

		if usesLayout || usesNav {
			sb.WriteString("\n**Layout Components:**\n")
			if usesLayout {
				sb.WriteString("- Uses Layout component\n")
			}
			if usesNav {
				sb.WriteString("- Uses Navigation component\n")
			}
		}
	}

	// Check if file is in routes.tsx
	routesPath := filepath.Join(e.workspacePath, "src/routes.tsx")
	if routesContent, err := os.ReadFile(routesPath); err == nil {
		fileName := strings.TrimSuffix(filepath.Base(path), ".tsx")
		// Check for layout setting
		layoutPattern := regexp.MustCompile(fmt.Sprintf(`label:\s*['"]%s['"],\s*[^}]*layout:\s*['"](\w+)['"]`, regexp.QuoteMeta(fileName)))
		if match := layoutPattern.FindStringSubmatch(string(routesContent)); len(match) > 1 {
			fmt.Fprintf(&sb, "\n**Layout in routes.tsx:** %s\n", match[1])
		}
	}

	return &ToolResult{
		Success: true,
		Content: sb.String(),
	}, nil
}

func sortedKeys(m map[string]bool) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	return keys
}
