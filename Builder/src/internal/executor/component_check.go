package executor

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

// checkExistingComponents checks if components already exist
func (e *FileExecutor) checkExistingComponents(ctx context.Context, args map[string]interface{}) (*ToolResult, error) {
	componentNamesArg, _ := args["componentNames"].([]interface{})

	var targetComponents map[string]bool
	if len(componentNamesArg) > 0 {
		targetComponents = make(map[string]bool)
		for _, name := range componentNamesArg {
			if nameStr, ok := name.(string); ok && nameStr != "" {
				targetComponents[nameStr] = true
			}
		}
	}

	// Check src/components directory
	componentsDir := filepath.Join(e.workspacePath, "src/components")
	entries, err := os.ReadDir(componentsDir)
	if err != nil {
		return &ToolResult{
			Success: true,
			Content: "No src/components/ directory found.",
		}, nil
	}

	var sb strings.Builder

	// Collect all existing components
	type ComponentInfo struct {
		Name     string
		Path     string
		Size     int64
		Modified string
	}

	var existingComponents []ComponentInfo
	var matchedComponents []ComponentInfo

	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}

		if !strings.HasSuffix(entry.Name(), ".tsx") && !strings.HasSuffix(entry.Name(), ".ts") {
			continue
		}

		name := strings.TrimSuffix(entry.Name(), ".tsx")
		if name == "Layout" || name == "Navigation" || name == "ui" {
			continue // Skip known system components
		}

		fullPath := filepath.Join(componentsDir, entry.Name())
		info, _ := os.Stat(fullPath)

		compInfo := ComponentInfo{
			Name:     name,
			Path:     filepath.Join("src/components", entry.Name()),
			Size:     info.Size(),
			Modified: info.ModTime().Format("2006-01-02 15:04"),
		}

		existingComponents = append(existingComponents, compInfo)

		if targetComponents != nil && targetComponents[name] {
			matchedComponents = append(matchedComponents, compInfo)
		}
	}

	// Report results
	if targetComponents != nil && len(matchedComponents) > 0 {
		sb.WriteString("**Requested Components Already Exist:**\n\n")
		for _, comp := range matchedComponents {
			fmt.Fprintf(&sb, "✅ %s\n", comp.Name)
			fmt.Fprintf(&sb, "   Path: %s\n", comp.Path)
			fmt.Fprintf(&sb, "   Size: %d bytes\n", comp.Size)
			fmt.Fprintf(&sb, "   Modified: %s\n\n", comp.Modified)
		}
	}

	// Check for requested components that don't exist
	var notFound []string
	for name := range targetComponents {
		found := false
		for _, comp := range existingComponents {
			if strings.EqualFold(comp.Name, name) {
				found = true
				break
			}
		}
		if !found {
			notFound = append(notFound, name)
		}
	}

	if len(notFound) > 0 {
		fmt.Fprintf(&sb, "\n**Not Found:** %s\n", strings.Join(notFound, ", "))
	}

	// If no specific components requested, show all existing
	if targetComponents == nil && len(existingComponents) > 0 {
		sb.WriteString("**All Existing Custom Components:**\n\n")
		sort.Slice(existingComponents, func(i, j int) bool {
			return existingComponents[i].Name < existingComponents[j].Name
		})
		for _, comp := range existingComponents {
			fmt.Fprintf(&sb, "• %s (%s)\n", comp.Name, comp.Path)
		}
		fmt.Fprintf(&sb, "\nTotal: %d custom component(s)", len(existingComponents))
	}

	if targetComponents == nil && len(existingComponents) == 0 {
		sb.WriteString("No custom components found in src/components/\n")
		sb.WriteString("\nTip: Use listComponents to see available shadcn/ui components.")
	}

	return &ToolResult{
		Success: true,
		Content: sb.String(),
	}, nil
}
