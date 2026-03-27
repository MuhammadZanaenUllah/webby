package agent

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"webby-builder/internal/models"
)

// PromptsDir is the directory containing prompt template files.
// Relative to the working directory by default. Tests may override this.
var PromptsDir = "prompts"

// PromptConfig holds configuration for building the system prompt
type PromptConfig struct {
	ProjectName         string
	WorkspacePath       string
	TemplatePrompts     *models.TemplatePrompts
	TemplateMetadata    *models.TemplateMetadata
	Capabilities        *models.ProjectCapabilities
	ThemePreset         *models.ThemePreset
	Compact             bool   // When true, generates a shorter prompt for standard-tier models
	TokenBudget         int    // Max tokens for prompt (0 = no budget, include everything)
	CustomPrompt        string // Admin-editable full prompt (empty = use hardcoded)
	CustomCompactPrompt string // Admin-editable compact prompt (empty = use hardcoded)
}

// promptSection represents a prioritized section of the system prompt
type promptSection struct {
	Priority int    // 0 = always include, 1 = high, 2 = medium, 3 = low (drop first)
	Label    string // For logging which sections were dropped
	Content  string
}

// estimateTokens gives a rough token count (word-based heuristic ~1.3 tokens/word)
func estimateTokens(text string) int {
	words := len(strings.Fields(text))
	return int(float64(words) * 1.3)
}

// assemblePrioritized builds the prompt from sections, respecting the token budget.
// If budget is 0, all sections are included. Otherwise, sections are added by priority
// until the budget is reached. P0 sections are always included.
func assemblePrioritized(sections []promptSection, budget int) string {
	if budget <= 0 {
		// No budget — include everything in order
		var sb strings.Builder
		for _, s := range sections {
			sb.WriteString(s.Content)
		}
		return sb.String()
	}

	var sb strings.Builder
	used := 0

	// Always include P0
	for _, s := range sections {
		if s.Priority == 0 {
			sb.WriteString(s.Content)
			used += estimateTokens(s.Content)
		}
	}

	// Add higher priority sections first
	for priority := 1; priority <= 3; priority++ {
		for _, s := range sections {
			if s.Priority != priority {
				continue
			}
			cost := estimateTokens(s.Content)
			if used+cost <= budget {
				sb.WriteString(s.Content)
				used += cost
			}
		}
	}

	return sb.String()
}

// validSections defines allowed injection points in order
var validSections = []string{
	"after_role",
	"after_mandatory_steps",
	"after_patterns",
	"after_dynamic_features",
	"before_response_format",
	"footer",
}

// injectTemplatePrompts injects template prompts for a specific section
func injectTemplatePrompts(sb *strings.Builder, prompts *models.TemplatePrompts, caps *models.ProjectCapabilities, section string) {
	if prompts == nil || len(prompts.Prompts) == 0 {
		return
	}

	filtered := filterAndSortPrompts(prompts.Prompts, section, caps)
	for _, p := range filtered {
		fmt.Fprintf(sb, "\n## %s\n\n%s\n", p.Title, p.Content)
	}
}

// filterAndSortPrompts returns prompts matching section and conditions, sorted by priority
func filterAndSortPrompts(prompts []models.TemplatePrompt, section string, caps *models.ProjectCapabilities) []models.TemplatePrompt {
	var result []models.TemplatePrompt
	for _, p := range prompts {
		if p.Section == section && evaluateConditions(p.Conditions, caps) {
			result = append(result, p)
		}
	}
	sort.Slice(result, func(i, j int) bool {
		return result[i].Priority < result[j].Priority
	})
	return result
}

// evaluateConditions checks if all prompt conditions are met (AND logic)
func evaluateConditions(cond *models.PromptConditions, caps *models.ProjectCapabilities) bool {
	if cond == nil {
		return true // No conditions = always include
	}

	if cond.FirebaseEnabled != nil {
		enabled := caps != nil && caps.Firebase != nil && caps.Firebase.Enabled
		if *cond.FirebaseEnabled != enabled {
			return false
		}
	}

	if cond.StorageEnabled != nil {
		enabled := caps != nil && caps.Storage != nil && caps.Storage.Enabled
		if *cond.StorageEnabled != enabled {
			return false
		}
	}

	return true
}

// BuildSystemPrompt creates the system prompt for the AI
func BuildSystemPrompt(cfg PromptConfig) (string, error) {
	// Check for admin-editable custom prompts first
	if cfg.Compact && cfg.CustomCompactPrompt != "" {
		return buildFromCustomPrompt(cfg, cfg.CustomCompactPrompt), nil
	}
	if !cfg.Compact && cfg.CustomPrompt != "" {
		return buildFromCustomPrompt(cfg, cfg.CustomPrompt), nil
	}

	// Load template from disk
	templateFile := filepath.Join(PromptsDir, "system.md")
	if cfg.Compact {
		templateFile = filepath.Join(PromptsDir, "compact.md")
	}
	template, err := os.ReadFile(templateFile)
	if err != nil {
		return "", fmt.Errorf("loading prompt template %s: %w", templateFile, err)
	}

	result := processTemplate(string(template), cfg)

	// Apply token budget if set — trim from the end if over budget
	// This preserves the most critical sections (role, mandatory steps) at the top
	if cfg.TokenBudget > 0 {
		tokens := estimateTokens(result)
		if tokens > cfg.TokenBudget {
			// Trim to approximately fit the budget
			// Use word-based trimming to avoid cutting mid-word
			words := strings.Fields(result)
			targetWords := int(float64(cfg.TokenBudget) / 1.3)
			if targetWords < len(words) {
				result = strings.Join(words[:targetWords], " ") + "\n\n[Prompt truncated to fit context window]"
			}
		}
	}

	return result, nil
}

// processTemplate replaces all markers in a template string with dynamic content.
func processTemplate(template string, cfg PromptConfig) string {
	result := strings.ReplaceAll(template, "{{PROJECT_NAME}}", cfg.ProjectName)

	// Process INJECT markers (template prompt injection points)
	for _, section := range validSections {
		marker := "{{INJECT:" + section + "}}"
		if strings.Contains(result, marker) {
			var sb strings.Builder
			injectTemplatePrompts(&sb, cfg.TemplatePrompts, cfg.Capabilities, section)
			result = replaceMarker(result, marker, sb.String())
		}
	}

	// Process DYNAMIC markers (conditional sections)
	result = replaceMarker(result, "{{DYNAMIC:TEMPLATE_METADATA}}", buildTemplateMetadataSection(cfg.TemplateMetadata))
	result = replaceMarker(result, "{{DYNAMIC:THEME_PRESET}}", buildThemePresetSection(cfg.ThemePreset))
	result = replaceMarker(result, "{{DYNAMIC:THEME_PRESET_COMPACT}}", buildThemePresetCompactSection(cfg.ThemePreset))
	result = replaceMarker(result, "{{DYNAMIC:FILE_TREE}}", buildFileTreeSection(cfg.WorkspacePath))
	result = replaceMarker(result, "{{DYNAMIC:CAPABILITIES}}", buildCapabilitiesSection(cfg.Capabilities))

	return result
}

// replaceMarker replaces a marker in the template. It replaces the marker AND
// its trailing newline (the full marker line) so that empty replacements don't
// leave extra blank lines, and non-empty replacements integrate cleanly.
func replaceMarker(template, marker, replacement string) string {
	markerLine := marker + "\n"
	if strings.Contains(template, markerLine) {
		return strings.ReplaceAll(template, markerLine, replacement)
	}
	// Fallback: marker at end of file without trailing newline
	return strings.ReplaceAll(template, marker, replacement)
}

func buildThemePresetSection(preset *models.ThemePreset) string {
	if preset == nil {
		return ""
	}
	themeLine := fmt.Sprintf("The user has selected the \"%s\" theme.", preset.Name)
	if preset.Description != "" {
		themeLine = fmt.Sprintf("The user has selected the \"%s\" theme (%s).", preset.Name, preset.Description)
	}

	return fmt.Sprintf(`
## THEME PRESET - USER'S COLOR PREFERENCE

%s This theme is ALREADY applied to the workspace CSS.

**CRITICAL: Do NOT modify index.css — it is a protected system file.**
If the user explicitly asks to adjust colors, add CSS variable overrides in src/custom.css (imported after index.css, so overrides take effect).

When creating UI elements:
- Use semantic color classes: bg-primary, text-foreground, bg-card, bg-muted, bg-accent
- Do NOT hardcode colors like "blue-500" or "gray-900"
- The theme has both light and dark mode support built-in

The user chose this theme for a specific color feel. Do NOT suggest changing colors unless explicitly asked.
`, themeLine)
}

func buildThemePresetCompactSection(preset *models.ThemePreset) string {
	if preset == nil {
		return ""
	}
	return fmt.Sprintf("\n## THEME: %s — Use specified colors and fonts.\n", preset.Name)
}

func buildFileTreeSection(workspacePath string) string {
	fileTree := getFileTree(workspacePath)
	if fileTree != "" {
		return "\n```\n" + fileTree + "```\n"
	}
	return "\nNo files yet - this is a fresh project.\n"
}

func buildCapabilitiesSection(caps *models.ProjectCapabilities) string {
	if caps == nil {
		return ""
	}
	var sb strings.Builder
	if caps.Firebase != nil && caps.Firebase.Enabled {
		sb.WriteString("## FIREBASE: Enabled. Use getFirestoreCollections to discover collections.\n\n")
	}
	if caps.Storage != nil && caps.Storage.Enabled {
		fmt.Fprintf(&sb, "## STORAGE: Enabled. Max %dMB.\n\n", caps.Storage.MaxFileSizeMB)
	}
	return sb.String()
}

// buildTemplateMetadataSection renders pre-loaded template metadata so the AI
// can skip the initial readFile("template.json") call, saving one iteration.
func buildTemplateMetadataSection(meta *models.TemplateMetadata) string {
	if meta == nil {
		return ""
	}

	var sb strings.Builder
	sb.WriteString("\n## Template Metadata (Pre-loaded — skip readFile(\"template.json\"))\n\n")

	// Pages
	if len(meta.AvailablePages) > 0 {
		sb.WriteString("**Pages:** ")
		names := make([]string, 0, len(meta.AvailablePages))
		for _, p := range meta.AvailablePages {
			names = append(names, p.Name)
		}
		sb.WriteString(strings.Join(names, ", "))
		sb.WriteString("\n")
	}

	// File structure
	fs := meta.FileStructure
	if fs.PagesDir != "" || fs.ComponentsDir != "" || fs.RoutesFile != "" {
		sb.WriteString("**File structure:** ")
		parts := []string{}
		if fs.PagesDir != "" {
			parts = append(parts, "pages="+fs.PagesDir)
		}
		if fs.ComponentsDir != "" {
			parts = append(parts, "components="+fs.ComponentsDir)
		}
		if fs.RoutesFile != "" {
			parts = append(parts, "routes="+fs.RoutesFile)
		}
		sb.WriteString(strings.Join(parts, ", "))
		sb.WriteString("\n")
	}

	// Shadcn components
	if len(meta.ShadcnComponents) > 0 {
		sb.WriteString("**shadcn/ui:** ")
		sb.WriteString(strings.Join(meta.ShadcnComponents, ", "))
		sb.WriteString("\n")
	}

	// Styling
	if meta.Styling.IconSet != "" || meta.Styling.Framework != "" {
		sb.WriteString("**Styling:** ")
		parts := []string{}
		if meta.Styling.IconSet != "" {
			parts = append(parts, "icons="+meta.Styling.IconSet)
		}
		if meta.Styling.Framework != "" {
			parts = append(parts, "framework="+meta.Styling.Framework)
		}
		sb.WriteString(strings.Join(parts, ", "))
		sb.WriteString("\n")
	}

	sb.WriteString("\n")
	return sb.String()
}

// getFileTree returns a string representation of the file tree
func getFileTree(workspacePath string) string {
	var sb strings.Builder

	err := filepath.Walk(workspacePath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil
		}

		// Skip hidden files, node_modules, and dist
		name := info.Name()
		if strings.HasPrefix(name, ".") || name == "node_modules" || name == "dist" {
			if info.IsDir() {
				return filepath.SkipDir
			}
			return nil
		}

		relPath, _ := filepath.Rel(workspacePath, path)
		if relPath == "." {
			return nil
		}

		// Calculate indentation based on depth
		depth := strings.Count(relPath, string(os.PathSeparator))
		indent := strings.Repeat("  ", depth)

		if info.IsDir() {
			fmt.Fprintf(&sb, "%s%s/\n", indent, name)
		} else {
			fmt.Fprintf(&sb, "%s%s\n", indent, name)
		}

		return nil
	})

	if err != nil {
		return ""
	}

	return sb.String()
}

// buildFromCustomPrompt uses an admin-editable prompt as the base,
// processing all markers ({{PROJECT_NAME}}, {{INJECT:*}}, {{DYNAMIC:*}}).
func buildFromCustomPrompt(cfg PromptConfig, customPrompt string) string {
	return processTemplate(customPrompt, cfg)
}
