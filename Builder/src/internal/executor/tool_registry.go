package executor

// Tool metadata for parallel execution decisions
// Read-only tools can be executed in parallel safely
// Write tools must be executed sequentially to prevent race conditions

// readOnlyTools maps tool names to their read-only status
// Read-only tools: safe to run in parallel (no file system mutations)
// Write tools: must run sequentially (create/edit files)
// Note: verifyBuild is excluded from read-only as it runs npm which can mutate node_modules
var readOnlyTools = map[string]bool{
	"readFile":                true,
	"listFiles":               true,
	"searchFiles":             true,
	"listComponents":          true,
	"getComponentUsage":       true,
	"listIcons":               true,
	"getIconUsage":            true,
	"analyzeProject":          true,
	"verifyIntegration":       true,
	"fetchTemplates":          true,
	"getTemplateInfo":         true,
	"diffPreview":             true, // NEW
	"checkExistingComponents": true, // NEW
	"getFileInfo":             true, // NEW
	"createPlan":              true, // NEW - plan creation is read-only
	"getProjectCapabilities":  true, // Session-level tool (no file system access)
	"getFirestoreCollections": true, // Session-level tool (API call, no file system access)
	"readDesignIntelligence":  true, // Reads design-intelligence.json (no mutations)
	"readSiteMemory":          true, // Reads memory.json (no mutations)
	"listImages":              true, // Searches stock image registry (no file system)
	"getImageUsage":           true, // Returns image usage info (no file system)
	// Write tools (must be sequential):
	// - createFile
	// - editFile
	// - deleteFile
	// - verifyBuild (runs npm commands that can mutate state)
	// - useTemplate (downloads and extracts files)
	// - batchEditFiles
	// - writeDesignIntelligence (writes design-intelligence.json)
	// - updateSiteMemory (writes memory.json)
}

// IsReadOnly returns true if the tool is safe to run in parallel
func IsReadOnly(toolName string) bool {
	return readOnlyTools[toolName]
}

// IsWriteTool returns true if the tool is a direct file write operation (create/edit/delete).
// Used only in tests. For file change tracking (build triggers), use IsFileModifying instead.
func IsWriteTool(toolName string) bool {
	return toolName == "createFile" || toolName == "editFile" || toolName == "deleteFile"
}

// IsFileModifying returns true if the tool creates, edits, deletes, or extracts files.
// Used by Execute() to track whether a build should be triggered after session completion.
func IsFileModifying(toolName string) bool {
	switch toolName {
	case "createFile", "editFile", "batchEditFiles", "deleteFile", "useTemplate",
		"writeDesignIntelligence", "updateSiteMemory", "generateAEO":
		return true
	default:
		return false
	}
}

// ToolCallRequest represents a request to execute a tool
type ToolCallRequest struct {
	ID        string                 `json:"id"`
	Name      string                 `json:"name"`
	Arguments map[string]interface{} `json:"arguments"`
}

// BatchResult contains the results of a batch execution
type BatchResult struct {
	Results []ToolResult
}

// GetAllTools returns a list of all known tool names
func GetAllTools() []string {
	return []string{
		"createFile",
		"editFile",
		"readFile",
		"listFiles",
		"searchFiles",
		"listComponents",
		"getComponentUsage",
		"listIcons",
		"getIconUsage",
		"analyzeProject",
		"verifyBuild",
		"verifyIntegration",
		"fetchTemplates",
		"getTemplateInfo",
		"useTemplate",
		"diffPreview",
		"batchEditFiles",
		"checkExistingComponents",
		"getFileInfo",
		"createPlan",
		"deleteFile",
		"getProjectCapabilities",
		"getFirestoreCollections",
		"writeDesignIntelligence",
		"readDesignIntelligence",
		"updateSiteMemory",
		"readSiteMemory",
		"generateAEO",
		"listImages",
		"getImageUsage",
	}
}

// GetReadOnlyTools returns a list of read-only tool names
func GetReadOnlyTools() []string {
	var tools []string
	for name, isReadOnly := range readOnlyTools {
		if isReadOnly {
			tools = append(tools, name)
		}
	}
	return tools
}
