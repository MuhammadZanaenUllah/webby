package models

// TemplateInfo represents basic template info from list endpoint
type TemplateInfo struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Category    string `json:"category"`
}

// TemplateListResponse from Laravel /api/templates
type TemplateListResponse struct {
	Templates []TemplateInfo `json:"templates"`
}

// TemplateMetadata from Laravel /api/templates/{id}
type TemplateMetadata struct {
	ID               string            `json:"id"`
	Name             string            `json:"name"`
	Description      string            `json:"description"`
	Categories       []string          `json:"categories"`
	FileStructure    FileStructure     `json:"file_structure"`
	AvailablePages   []PageInfo        `json:"available_pages"`
	CustomComponents []ComponentInfo   `json:"custom_components"`
	ShadcnComponents []string          `json:"shadcn_components"`
	Styling          StylingInfo       `json:"styling"`
	RoutingPattern   string            `json:"routing_pattern"`
	Dependencies     []Dependency      `json:"dependencies"`
	UsageExamples    map[string]string `json:"usage_examples"`
	Prompts          *TemplatePrompts  `json:"prompts,omitempty"`
}

// FileStructure describes the template's file organization
type FileStructure struct {
	PagesDir      string `json:"pages_dir"`
	ComponentsDir string `json:"components_dir"`
	RoutesFile    string `json:"routes_file"`
}

// PageInfo describes a page in the template
type PageInfo struct {
	Path        string `json:"path"`
	Name        string `json:"name"`
	Description string `json:"description"`
}

// ComponentInfo describes a custom component in the template
type ComponentInfo struct {
	Name        string `json:"name"`
	Path        string `json:"path"`
	Description string `json:"description"`
}

// StylingInfo describes the template's styling configuration
type StylingInfo struct {
	PrimaryColor string `json:"primary_color"`
	Framework    string `json:"framework"`
	IconSet      string `json:"icon_set"`
}

// Dependency describes a dependency required by the template
type Dependency struct {
	Name    string `json:"name"`
	Version string `json:"version"`
}

// TemplatePrompt defines a customizable prompt section from a template
type TemplatePrompt struct {
	Priority   int               `json:"priority"` // 1-100, lower = earlier in prompt
	Section    string            `json:"section"`  // after_role, after_mandatory_steps, etc.
	Title      string            `json:"title"`    // Section header (e.g., "FIREBASE ENABLED")
	Content    string            `json:"content"`  // Actual prompt text
	Conditions *PromptConditions `json:"conditions,omitempty"`
}

// PromptConditions defines when a prompt section should be included (AND logic)
type PromptConditions struct {
	FirebaseEnabled *bool `json:"firebase_enabled,omitempty"`
	StorageEnabled  *bool `json:"storage_enabled,omitempty"`
}

// TemplatePrompts is the collection of prompt sections from template.json
type TemplatePrompts struct {
	Prompts []TemplatePrompt `json:"prompts"`
}
