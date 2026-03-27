package executor

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// AEOExecutor generates Answer Engine Optimization assets
type AEOExecutor struct {
	workspacePath string
}

// NewAEOExecutor creates a new AEOExecutor
func NewAEOExecutor(workspacePath string) *AEOExecutor {
	return &AEOExecutor{workspacePath: workspacePath}
}

type pageInfo struct {
	Name string
	Path string
}

// GenerateAEO creates llms.txt, robots.txt, and injects JSON-LD into index.html.
// Reads memory.json for business context and scans src/pages/ for page list.
func (e *AEOExecutor) GenerateAEO(ctx context.Context, args map[string]interface{}) (*ToolResult, error) {
	memory, _ := ReadJSONFile(filepath.Join(e.workspacePath, "memory.json"))
	pages := e.scanPages()

	var generated []string

	// Generate llms.txt
	llmsTxt := e.buildLlmsTxt(memory, pages)
	publicDir := filepath.Join(e.workspacePath, "public")
	if err := os.MkdirAll(publicDir, 0755); err != nil {
		return &ToolResult{Success: false, Content: fmt.Sprintf("Failed to create public/ directory: %s", err.Error())}, nil
	}
	if err := os.WriteFile(filepath.Join(publicDir, "llms.txt"), []byte(llmsTxt), 0644); err != nil {
		return &ToolResult{Success: false, Content: fmt.Sprintf("Failed to write llms.txt: %s", err.Error())}, nil
	}
	generated = append(generated, "public/llms.txt")

	// Generate robots.txt
	robotsTxt := e.buildRobotsTxt()
	if err := os.WriteFile(filepath.Join(publicDir, "robots.txt"), []byte(robotsTxt), 0644); err != nil {
		return &ToolResult{Success: false, Content: fmt.Sprintf("Failed to write robots.txt: %s", err.Error())}, nil
	}
	generated = append(generated, "public/robots.txt")

	// Inject JSON-LD into index.html
	if err := e.injectJSONLD(memory); err != nil {
		return &ToolResult{
			Success: true,
			Content: fmt.Sprintf("Generated %s but failed to inject JSON-LD into index.html: %s", strings.Join(generated, ", "), err.Error()),
		}, nil
	}
	generated = append(generated, "index.html (JSON-LD injected)")

	return &ToolResult{
		Success: true,
		Content: fmt.Sprintf("AEO assets generated: %s. Your site is now optimized for AI search engines.", strings.Join(generated, ", ")),
	}, nil
}

func (e *AEOExecutor) scanPages() []pageInfo {
	var pages []pageInfo
	pagesDir := filepath.Join(e.workspacePath, "src", "pages")

	entries, err := os.ReadDir(pagesDir)
	if err != nil {
		return pages
	}

	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".tsx") {
			continue
		}
		name := strings.TrimSuffix(entry.Name(), ".tsx")
		path := "/" + strings.ToLower(name)
		if strings.EqualFold(name, "Home") || strings.EqualFold(name, "Index") {
			path = "/"
		}
		pages = append(pages, pageInfo{Name: name, Path: path})
	}
	return pages
}

func (e *AEOExecutor) buildLlmsTxt(memory map[string]interface{}, pages []pageInfo) string {
	var sb strings.Builder

	businessName := getNestedString(memory, "business", "name")
	if businessName == "" {
		businessName = "Website"
	}
	tagline := getNestedString(memory, "business", "tagline")
	description := getNestedString(memory, "business", "description")
	industry := getNestedString(memory, "business", "industry")

	fmt.Fprintf(&sb, "# %s\n", businessName)
	if tagline != "" {
		fmt.Fprintf(&sb, "> %s\n", tagline)
	}
	sb.WriteString("\n")

	// About section
	sb.WriteString("## About\n")
	if description != "" {
		sb.WriteString(description + "\n")
	} else if industry != "" {
		fmt.Fprintf(&sb, "%s is a %s business.\n", businessName, industry)
	} else {
		fmt.Fprintf(&sb, "%s website.\n", businessName)
	}
	sb.WriteString("\n")

	// Products/Services
	if products := getNestedMap(memory, "products"); len(products) > 0 {
		sb.WriteString("## Products & Services\n")
		for key, val := range products {
			if str, ok := val.(string); ok {
				fmt.Fprintf(&sb, "- %s: %s\n", capitalize(key), str)
			}
		}
		sb.WriteString("\n")
	}

	// Contact
	if contact := getNestedMap(memory, "contact"); len(contact) > 0 {
		sb.WriteString("## Contact\n")
		if email, ok := contact["email"].(string); ok {
			fmt.Fprintf(&sb, "- Email: %s\n", email)
		}
		if phone, ok := contact["phone"].(string); ok {
			fmt.Fprintf(&sb, "- Phone: %s\n", phone)
		}
		if social, ok := contact["social"].(map[string]interface{}); ok {
			for platform, handle := range social {
				if h, ok := handle.(string); ok {
					fmt.Fprintf(&sb, "- %s: %s\n", capitalize(platform), h)
				}
			}
		}
		sb.WriteString("\n")
	}

	// Pages
	if len(pages) > 0 {
		sb.WriteString("## Pages\n")
		for _, p := range pages {
			fmt.Fprintf(&sb, "- %s - %s page\n", p.Path, p.Name)
		}
		sb.WriteString("\n")
	}

	fmt.Fprintf(&sb, "---\nGenerated on %s\n", time.Now().Format("2006-01-02"))
	return sb.String()
}

func (e *AEOExecutor) buildRobotsTxt() string {
	var sb strings.Builder

	sb.WriteString("# Robots.txt - AI-Ready Website\n\n")
	sb.WriteString("User-agent: *\n")
	sb.WriteString("Allow: /\n")
	sb.WriteString("Disallow: /api/\n\n")

	sb.WriteString("# AI Search Engines - Explicitly Allowed\n")
	sb.WriteString("User-agent: ClaudeBot\nAllow: /\n\n")
	sb.WriteString("User-agent: GPTBot\nAllow: /\n\n")
	sb.WriteString("User-agent: Google-Extended\nAllow: /\n\n")
	sb.WriteString("User-agent: PerplexityBot\nAllow: /\n\n")
	sb.WriteString("User-agent: Amazonbot\nAllow: /\n\n")

	sb.WriteString("# AI Discovery\n")
	sb.WriteString("Llms-Txt: /llms.txt\n")

	return sb.String()
}

func (e *AEOExecutor) injectJSONLD(memory map[string]interface{}) error {
	indexPath := filepath.Join(e.workspacePath, "index.html")
	content, err := os.ReadFile(indexPath)
	if err != nil {
		return fmt.Errorf("cannot read index.html: %w", err)
	}

	html := string(content)

	// Remove ALL existing JSON-LD blocks to prevent duplicates
	for {
		existingStart := strings.Index(html, `<script type="application/ld+json">`)
		if existingStart == -1 {
			break
		}
		existingEnd := strings.Index(html[existingStart:], `</script>`)
		if existingEnd == -1 {
			break
		}
		html = html[:existingStart] + html[existingStart+existingEnd+len(`</script>`):]
	}

	jsonLD := e.buildJSONLD(memory)
	// Use an encoder that doesn't escape HTML entities (& < >) for readability
	var buf strings.Builder
	enc := json.NewEncoder(&buf)
	enc.SetEscapeHTML(false)
	enc.SetIndent("    ", "  ")
	if err := enc.Encode(jsonLD); err != nil {
		return fmt.Errorf("cannot marshal JSON-LD: %w", err)
	}
	jsonLDBytes := strings.TrimSpace(buf.String())

	scriptTag := fmt.Sprintf("    <script type=\"application/ld+json\">\n    %s\n    </script>\n", jsonLDBytes)

	// Inject before </head>
	headClose := strings.Index(html, "</head>")
	if headClose == -1 {
		return fmt.Errorf("</head> tag not found in index.html")
	}

	html = html[:headClose] + scriptTag + html[headClose:]

	return os.WriteFile(indexPath, []byte(html), 0644)
}

func (e *AEOExecutor) buildJSONLD(memory map[string]interface{}) map[string]interface{} {
	businessName := getNestedString(memory, "business", "name")
	if businessName == "" {
		businessName = "Website"
	}

	ld := map[string]interface{}{
		"@context": "https://schema.org",
		"@type":    "WebSite",
		"name":     businessName,
	}

	if desc := getNestedString(memory, "business", "description"); desc != "" {
		ld["description"] = desc
	}
	if industry := getNestedString(memory, "business", "industry"); industry != "" {
		ld["@type"] = "Organization"
		ld["description"] = industry
		if desc := getNestedString(memory, "business", "description"); desc != "" {
			ld["description"] = desc
		}
	}

	if contact := getNestedMap(memory, "contact"); len(contact) > 0 {
		if email, ok := contact["email"].(string); ok {
			ld["email"] = email
		}
		if phone, ok := contact["phone"].(string); ok {
			ld["telephone"] = phone
		}
	}

	return ld
}

// Helper functions for accessing nested JSON maps

func getNestedString(data map[string]interface{}, keys ...string) string {
	current := data
	for i, key := range keys {
		val, ok := current[key]
		if !ok {
			return ""
		}
		if i == len(keys)-1 {
			if str, ok := val.(string); ok {
				return str
			}
			return ""
		}
		if next, ok := val.(map[string]interface{}); ok {
			current = next
		} else {
			return ""
		}
	}
	return ""
}

func getNestedMap(data map[string]interface{}, key string) map[string]interface{} {
	if val, ok := data[key]; ok {
		if m, ok := val.(map[string]interface{}); ok {
			return m
		}
	}
	return nil
}

func capitalize(s string) string {
	if s == "" {
		return s
	}
	return strings.ToUpper(s[:1]) + s[1:]
}
