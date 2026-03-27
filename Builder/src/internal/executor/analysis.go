package executor

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

// analyzeProject analyzes the existing project structure
func (e *FileExecutor) analyzeProject(ctx context.Context, args map[string]interface{}) (*ToolResult, error) {
	focus, _ := args["focus"].(string)
	if focus == "" {
		focus = "all"
	}

	var sb strings.Builder
	sb.WriteString("# Project Analysis\n\n")

	// Check if project exists
	if _, err := os.Stat(e.workspacePath); os.IsNotExist(err) {
		return &ToolResult{
			Success: true,
			Content: "Fresh project - no existing files to analyze.",
		}, nil
	}

	// Analyze based on focus
	if focus == "all" || focus == "pages" {
		sb.WriteString(e.analyzePages())
	}

	if focus == "all" || focus == "components" {
		sb.WriteString(e.analyzeComponents())
	}

	if focus == "all" || focus == "styling" {
		sb.WriteString(e.analyzeStyling())
	}

	return &ToolResult{
		Success: true,
		Content: sb.String(),
	}, nil
}

// analyzePages analyzes existing pages and their configurations
func (e *FileExecutor) analyzePages() string {
	var sb strings.Builder

	sb.WriteString("## Pages\n\n")

	// Try routes.tsx first, fall back to App.tsx
	routesPath := filepath.Join(e.workspacePath, "src/routes.tsx")
	appPath := filepath.Join(e.workspacePath, "src/App.tsx")

	var content string
	var sourceFile string

	if data, err := os.ReadFile(routesPath); err == nil {
		content = string(data)
		sourceFile = "routes.tsx"
	} else if data, err := os.ReadFile(appPath); err == nil {
		content = string(data)
		sourceFile = "App.tsx"
	} else {
		sb.WriteString("No routes configuration found.\n\n")
		return sb.String()
	}

	fmt.Fprintf(&sb, "Source: %s\n\n", sourceFile)

	// Find pages directory
	pagesDir := filepath.Join(e.workspacePath, "src/pages")
	pages, err := os.ReadDir(pagesDir)
	if err != nil {
		sb.WriteString("No src/pages/ directory found.\n\n")
		return sb.String()
	}

	// Filter out directories and hidden files
	var pageFiles []os.DirEntry
	for _, page := range pages {
		if !page.IsDir() && !strings.HasPrefix(page.Name(), ".") {
			pageFiles = append(pageFiles, page)
		}
	}

	if len(pageFiles) == 0 {
		sb.WriteString("No pages found in src/pages/\n\n")
		return sb.String()
	}

	fmt.Fprintf(&sb, "Found %d page(s):\n\n", len(pageFiles))

	for _, page := range pageFiles {
		name := strings.TrimSuffix(page.Name(), ".tsx")
		pagePath := filepath.Join(pagesDir, page.Name())

		// Read page content
		pageContent, err := os.ReadFile(pagePath)
		if err != nil {
			continue
		}

		fmt.Fprintf(&sb, "### %s\n", name)
		fmt.Fprintf(&sb, "File: src/pages/%s\n", page.Name())

		// Detect layout setting from routes.tsx content
		layout := "unknown"
		// Look for this page in routes with layout setting
		layoutPattern := regexp.MustCompile(fmt.Sprintf(`path:\s*['"][^'"]*%s[^'"]*['"],\s*[^}]*layout:\s*['"](\w+)['"]`, regexp.QuoteMeta(name)))
		if match := layoutPattern.FindStringSubmatch(content); len(match) > 1 {
			layout = match[1]
		} else {
			// Try simpler pattern - find layout for this page name
			routeRegex := regexp.MustCompile(fmt.Sprintf(`label:\s*['"]%s['"],\s*[^}]*layout:\s*['"](\w+)['"]`, regexp.QuoteMeta(name)))
			if match := routeRegex.FindStringSubmatch(content); len(match) > 1 {
				layout = match[1]
			} else {
				// Check if page has a route entry at all
				if strings.Contains(content, name) {
					// Has route but no explicit layout found
					layout = "default (assumed)"
				}
			}
		}
		fmt.Fprintf(&sb, "Layout: %s\n", layout)

		// Detect components used
		sb.WriteString("Components used: ")

		// shadcn/ui components
		uiImports := regexp.MustCompile(`from\s+['"]@/components/ui/(\w+)['"]`)
		matches := uiImports.FindAllStringSubmatch(string(pageContent), -1)
		if len(matches) > 0 {
			components := make(map[string]bool)
			for _, m := range matches {
				if len(m) > 1 {
					components[m[1]] = true
				}
			}
			var componentList []string
			for c := range components {
				componentList = append(componentList, c)
			}
			sb.WriteString(strings.Join(componentList, ", "))
		} else {
			sb.WriteString("none detected")
		}
		sb.WriteString("\n")

		// Check if uses Layout component directly
		if strings.Contains(string(pageContent), "import Layout") ||
			strings.Contains(string(pageContent), "from './Layout'") ||
			strings.Contains(string(pageContent), "from \"./Layout\"") {
			sb.WriteString("Uses Layout component directly: Yes\n")
		}

		// Check if uses Navigation component directly
		if strings.Contains(string(pageContent), "import Navigation") ||
			strings.Contains(string(pageContent), "from './Navigation'") ||
			strings.Contains(string(pageContent), "from \"./Navigation\"") {
			sb.WriteString("Uses Navigation component directly: Yes\n")
		}

		sb.WriteString("\n")
	}

	return sb.String()
}

// analyzeComponents analyzes custom components
func (e *FileExecutor) analyzeComponents() string {
	var sb strings.Builder

	sb.WriteString("## Custom Components\n\n")

	componentsDir := filepath.Join(e.workspacePath, "src/components")
	entries, err := os.ReadDir(componentsDir)
	if err != nil {
		sb.WriteString("No src/components/ directory found.\n\n")
		return sb.String()
	}

	// Check for Layout component
	layoutPath := filepath.Join(componentsDir, "Layout.tsx")
	if _, err := os.Stat(layoutPath); err == nil {
		sb.WriteString("• Layout component exists (wraps pages with Navigation + footer)\n")
	}

	// Check for Navigation component
	navPath := filepath.Join(componentsDir, "Navigation.tsx")
	if _, err := os.Stat(navPath); err == nil {
		sb.WriteString("• Navigation component exists (navigation bar)\n")
	}

	// List custom components (non-ui subdirectory)
	var customComponents []string
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		if strings.HasSuffix(entry.Name(), ".tsx") {
			name := strings.TrimSuffix(entry.Name(), ".tsx")
			if name != "Layout" && name != "Navigation" {
				customComponents = append(customComponents, name)
			}
		}
	}

	if len(customComponents) > 0 {
		sb.WriteString("\nCustom components:\n")
		for _, c := range customComponents {
			fmt.Fprintf(&sb, "• %s\n", c)
		}
	}

	// Count UI components
	uiDir := filepath.Join(componentsDir, "ui")
	if uiFiles, err := os.ReadDir(uiDir); err == nil {
		var uiComponents []string
		for _, f := range uiFiles {
			if !f.IsDir() && strings.HasSuffix(f.Name(), ".tsx") {
				name := strings.TrimSuffix(f.Name(), ".tsx")
				uiComponents = append(uiComponents, name)
			}
		}
		if len(uiComponents) > 0 {
			fmt.Fprintf(&sb, "\nshadcn/ui components available: %d\n", len(uiComponents))
			sb.WriteString("(Use listComponents to see all)\n")
		}
	}

	sb.WriteString("\n")
	return sb.String()
}

// analyzeStyling analyzes current styling approach
func (e *FileExecutor) analyzeStyling() string {
	var sb strings.Builder

	sb.WriteString("## Styling Analysis\n\n")

	// Check for global styles
	indexCss := filepath.Join(e.workspacePath, "src/index.css")
	if content, err := os.ReadFile(indexCss); err == nil {
		sb.WriteString("### Global Styles (src/index.css)\n")

		// Detect Tailwind version
		if strings.Contains(string(content), "@import") {
			sb.WriteString("Tailwind CSS v4 detected\n\n")
		} else if strings.Contains(string(content), "@tailwind") {
			sb.WriteString("Tailwind CSS v3 detected\n\n")
		}

		// Detect color scheme from Tailwind utility classes (not comments/variables)
		tailwindColorRe := regexp.MustCompile(`(?:bg|text|border|from|to|via)-(purple|pink|blue|green|red|orange|yellow|indigo|violet|teal|cyan|emerald|rose|amber)-\d+`)
		colorMatches := tailwindColorRe.FindAllStringSubmatch(string(content), -1)

		if len(colorMatches) > 0 {
			colorCounts := make(map[string]int)
			for _, match := range colorMatches {
				if len(match) > 1 {
					colorCounts[match[1]]++
				}
			}
			var dominantColor string
			maxCount := 0
			for color, count := range colorCounts {
				if count > maxCount {
					maxCount = count
					dominantColor = color
				}
			}
			capitalized := strings.ToUpper(dominantColor[:1]) + dominantColor[1:]
			fmt.Fprintf(&sb, "Current color scheme: %s tones detected (%d usages)\n",
				capitalized, maxCount)
		} else {
			sb.WriteString("Current color scheme: Neutral/default\n")
		}
	}

	// Analyze main page for styling patterns
	homePath := filepath.Join(e.workspacePath, "src/pages/Home.tsx")
	if content, err := os.ReadFile(homePath); err == nil {
		sb.WriteString("\n### Home Page Styling\n")

		// Detect gradient usage
		if strings.Contains(string(content), "bg-gradient") {
			sb.WriteString("Uses gradient backgrounds: Yes\n")

			// Extract gradient classes
			gradientPattern := regexp.MustCompile(`bg-gradient-[^"\s]+`)
			gradients := gradientPattern.FindAllString(string(content), -1)
			if len(gradients) > 0 {
				uniqueGradients := make(map[string]bool)
				for _, g := range gradients {
					uniqueGradients[g] = true
				}
				sb.WriteString("Gradients found:\n")
				for g := range uniqueGradients {
					fmt.Fprintf(&sb, "  • %s\n", g)
				}
			}
		} else {
			sb.WriteString("Uses gradient backgrounds: No\n")
		}

		// Detect background colors (sample)
		bgPattern := regexp.MustCompile(`bg-[\w-]+`)
		bgs := bgPattern.FindAllString(string(content), -1)
		if len(bgs) > 0 {
			sb.WriteString("\nBackground classes detected (sample):\n")
			counts := make(map[string]int)
			for _, bg := range bgs {
				counts[bg]++
			}
			// Show top 5
			count := 0
			for bg := range counts {
				if count >= 5 {
					break
				}
				fmt.Fprintf(&sb, "  • %s\n", bg)
				count++
			}
		}
	}

	sb.WriteString("\n")
	return sb.String()
}
