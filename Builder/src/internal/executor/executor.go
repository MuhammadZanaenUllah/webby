package executor

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"sync"
	"time"

	"webby-builder/internal/models"
	"webby-builder/internal/registry"

	"github.com/sirupsen/logrus"
)

// ToolResult represents the result of executing a tool
type ToolResult struct {
	ToolCallID string `json:"tool_call_id"`
	Success    bool   `json:"success"`
	Content    string `json:"content"`
	DurationMs int64  `json:"duration_ms,omitempty"`
}

// Executor routes tool calls to appropriate handlers
type Executor struct {
	file          *FileExecutor
	build         *BuildExecutor
	integration   *IntegrationExecutor
	template      *TemplateExecutor
	designIntel   *DesignIntelligenceExecutor
	siteMemory    *SiteMemoryExecutor
	aeo           *AEOExecutor
	serverKey     string
	laravelURL    string
	fileChanges   bool
	fileChangesMu sync.Mutex   // Separate mutex for fileChanges to avoid deadlock
	mu            sync.RWMutex // Main mutex for batch execution coordination
	depsMu        sync.Mutex   // Guards depsInstalled flag
	depsInstalled bool         // Whether npm install has been run
	logger        *logrus.Logger
	toolConfig    models.ToolExecutionConfig
	themePreset   *models.ThemePreset
}

// NewExecutor creates a new executor with lazy workspace initialization
func NewExecutor(workspacePath string, logger *logrus.Logger, toolConfig models.ToolExecutionConfig) *Executor {
	defaultToolConfig := models.DefaultToolConfig()
	if toolConfig.Timeout == 0 {
		toolConfig = defaultToolConfig
	}
	fileExec := NewFileExecutor(workspacePath, toolConfig)
	fileExec.SetLogger(logger)
	return &Executor{
		file:        fileExec,
		build:       NewBuildExecutor(workspacePath, toolConfig),
		integration: NewIntegrationExecutor(workspacePath),
		designIntel: NewDesignIntelligenceExecutor(workspacePath),
		siteMemory:  NewSiteMemoryExecutor(workspacePath),
		aeo:         NewAEOExecutor(workspacePath),
		logger:      logger,
		template:    nil, // No template support
		toolConfig:  toolConfig,
	}
}

// NewExecutorWithTemplate creates a new executor with template fetching support
func NewExecutorWithTemplate(workspacePath, serverKey, laravelURL string, logger *logrus.Logger, toolConfig models.ToolExecutionConfig) *Executor {
	defaultToolConfig := models.DefaultToolConfig()
	if toolConfig.Timeout == 0 {
		toolConfig = defaultToolConfig
	}
	fileExec := NewFileExecutor(workspacePath, toolConfig)
	fileExec.SetLogger(logger)
	return &Executor{
		file:        fileExec,
		build:       NewBuildExecutor(workspacePath, toolConfig),
		integration: NewIntegrationExecutor(workspacePath),
		template:    NewTemplateExecutor(serverKey, laravelURL, logger, toolConfig),
		designIntel: NewDesignIntelligenceExecutor(workspacePath),
		siteMemory:  NewSiteMemoryExecutor(workspacePath),
		aeo:         NewAEOExecutor(workspacePath),
		serverKey:   serverKey,
		laravelURL:  laravelURL,
		logger:      logger,
		toolConfig:  toolConfig,
	}
}

// SetThemePreset stores the theme preset so it can be applied after useTemplate
func (e *Executor) SetThemePreset(preset *models.ThemePreset) {
	e.themePreset = preset
}

// HasFileChanges returns whether any files were created or edited
func (e *Executor) HasFileChanges() bool {
	e.fileChangesMu.Lock()
	defer e.fileChangesMu.Unlock()
	return e.fileChanges
}

// GetServerKey returns the server key for Laravel API calls
func (e *Executor) GetServerKey() string {
	return e.serverKey
}

// ResetFileChanges resets the file change tracking
func (e *Executor) ResetFileChanges() {
	e.fileChangesMu.Lock()
	defer e.fileChangesMu.Unlock()
	e.fileChanges = false
}

// ensureDependenciesInstalled runs npm install if package.json exists but node_modules doesn't.
// Uses sync.Mutex + bool flag instead of sync.Once because the first call may find no package.json
// (template not yet extracted), and subsequent calls after useTemplate must be able to retry.
func (e *Executor) ensureDependenciesInstalled(ctx context.Context) error {
	e.depsMu.Lock()
	defer e.depsMu.Unlock()

	if e.depsInstalled {
		return nil
	}

	workspacePath := e.file.workspacePath
	packageJsonPath := filepath.Join(workspacePath, "package.json")

	// If no package.json yet, return nil without setting flag (allow retry later)
	if _, err := os.Stat(packageJsonPath); os.IsNotExist(err) {
		return nil
	}

	// If node_modules already exists, mark as installed
	nodeModulesPath := filepath.Join(workspacePath, "node_modules")
	if _, err := os.Stat(nodeModulesPath); err == nil {
		e.depsInstalled = true
		return nil
	}

	// Run npm install
	installCmd := exec.CommandContext(ctx, "npm", "install", "--ignore-scripts")
	installCmd.Dir = workspacePath
	if output, err := installCmd.CombinedOutput(); err != nil {
		return fmt.Errorf("npm install failed: %s\n%s", err.Error(), string(output))
	}

	e.depsInstalled = true
	return nil
}

// Execute runs a tool by name with the given arguments, with timeout and retry logic
func (e *Executor) Execute(ctx context.Context, toolName string, args map[string]interface{}) (*ToolResult, error) {
	if e.logger != nil {
		e.logger.WithFields(logrus.Fields{
			"tool":    toolName,
			"timeout": e.toolConfig.Timeout,
		}).Debug("Execute: starting tool execution")
	}

	timeout := time.Duration(e.toolConfig.Timeout) * time.Second
	startTime := time.Now()

	for attempt := 0; attempt <= e.toolConfig.MaxRetries; attempt++ {
		if e.logger != nil {
			e.logger.WithFields(logrus.Fields{
				"tool":    toolName,
				"attempt": attempt + 1,
				"max":     e.toolConfig.MaxRetries + 1,
			}).Debug("Execute: attempt starting")
		}

		// Check if context is already cancelled
		select {
		case <-ctx.Done():
			if e.logger != nil {
				e.logger.WithFields(logrus.Fields{
					"tool": toolName,
				}).Debug("Execute: context cancelled before attempt")
			}
			return nil, ctx.Err()
		default:
		}

		// Create timeout context for each attempt
		toolCtx, cancel := context.WithTimeout(ctx, timeout)

		result, err := e.executeTool(toolCtx, toolName, args)
		cancel() // Always cancel to release resources

		if e.logger != nil {
			e.logger.WithFields(logrus.Fields{
				"tool":    toolName,
				"attempt": attempt + 1,
				"success": err == nil,
			}).Debug("Execute: attempt completed")
		}

		if err == nil {
			// Track file-modifying operations (only if successful)
			if result.Success && IsFileModifying(toolName) {
				e.fileChangesMu.Lock()
				e.fileChanges = true
				e.fileChangesMu.Unlock()
			}
			result.DurationMs = time.Since(startTime).Milliseconds()
			if e.logger != nil {
				e.logger.WithFields(logrus.Fields{
					"tool": toolName,
				}).Debug("Execute: returning success")
			}
			return result, nil
		}

		// Check if we should retry
		if attempt >= e.toolConfig.MaxRetries {
			return nil, err
		}

		// Classify error - only retry timeout/network errors
		category := models.ClassifyError(err)
		if category != models.ErrorCategoryRetryable {
			return nil, err
		}

		// Log retry
		delay := time.Duration(200*(attempt+1)) * time.Millisecond
		e.logger.WithFields(logrus.Fields{
			"tool":     toolName,
			"attempt":  attempt + 1,
			"max":      e.toolConfig.MaxRetries + 1,
			"delay_ms": delay.Milliseconds(),
			"error":    err.Error(),
		}).Debug("Tool execution failed, retrying")

		// Wait before retry
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-time.After(delay):
		}
	}

	return nil, fmt.Errorf("tool execution failed after %d attempts", e.toolConfig.MaxRetries+1)
}

// executeTool executes a single tool without retry logic
func (e *Executor) executeTool(ctx context.Context, toolName string, args map[string]interface{}) (*ToolResult, error) {
	// Ensure dependencies are installed before file writes (enables TypeScript validation)
	if toolName == "createFile" || toolName == "editFile" {
		if err := e.ensureDependenciesInstalled(ctx); err != nil {
			if e.logger != nil {
				e.logger.WithField("error", err.Error()).Warn("ensureDependenciesInstalled failed (non-blocking)")
			}
		}
	}

	switch toolName {
	case "createFile":
		return e.file.CreateFile(ctx, args)
	case "editFile":
		return e.file.EditFile(ctx, args)
	case "readFile":
		return e.file.ReadFile(ctx, args)
	case "listFiles":
		return e.file.ListFiles(ctx, args)
	case "searchFiles":
		return e.file.SearchFiles(ctx, args)
	case "deleteFile":
		return e.file.DeleteFile(ctx, args)
	case "listComponents":
		return e.listComponents(ctx)
	case "getComponentUsage":
		return e.getComponentUsage(ctx, args)
	case "listIcons":
		return e.listIcons(ctx, args)
	case "getIconUsage":
		return e.getIconUsage(ctx, args)
	case "analyzeProject":
		return e.analyzeProject(ctx, args)
	case "diffPreview":
		return e.file.diffPreview(ctx, args)
	case "batchEditFiles":
		return e.file.batchEditFiles(ctx, args)
	case "checkExistingComponents":
		return e.file.checkExistingComponents(ctx, args)
	case "getFileInfo":
		return e.file.getFileInfo(ctx, args)
	case "createPlan":
		return e.createPlan(ctx, args)
	case "verifyBuild":
		return e.build.VerifyBuild(ctx, args)
	case "verifyIntegration":
		return e.integration.VerifyIntegration(ctx, args)
	case "fetchTemplates":
		if e.template == nil {
			return &ToolResult{Success: false, Content: "Error: template support not configured"}, nil
		}
		return e.template.FetchTemplates(ctx)
	case "getTemplateInfo":
		if e.template == nil {
			return &ToolResult{Success: false, Content: "Error: template support not configured"}, nil
		}
		templateID, _ := args["template"].(string)
		return e.template.GetTemplateInfo(ctx, templateID)
	case "writeDesignIntelligence":
		return e.designIntel.WriteDesignIntelligence(ctx, args)
	case "readDesignIntelligence":
		return e.designIntel.ReadDesignIntelligence(ctx, args)
	case "updateSiteMemory":
		return e.siteMemory.UpdateSiteMemory(ctx, args)
	case "readSiteMemory":
		return e.siteMemory.ReadSiteMemory(ctx, args)
	case "generateAEO":
		return e.aeo.GenerateAEO(ctx, args)
	case "listImages":
		return e.listImages(ctx, args)
	case "getImageUsage":
		return e.getImageUsage(ctx, args)
	case "useTemplate":
		if e.template == nil {
			return nil, fmt.Errorf("template support not configured")
		}
		templateID, _ := args["template"].(string)
		err := e.template.UseTemplate(ctx, e.file.workspacePath, templateID)
		if err == nil {
			// Template extracted — install dependencies so TypeScript validation works on first file write
			if depsErr := e.ensureDependenciesInstalled(ctx); depsErr != nil && e.logger != nil {
				e.logger.WithField("error", depsErr.Error()).Warn("ensureDependenciesInstalled after useTemplate failed (non-blocking)")
			}
			// Apply theme preset to newly extracted template CSS
			if e.themePreset != nil && e.themePreset.Light != nil && e.themePreset.Dark != nil {
				cssPath := filepath.Join(e.file.workspacePath, "src", "index.css")
				if content, readErr := os.ReadFile(cssPath); readErr == nil {
					newContent := applyThemeToCSSContent(string(content), e.themePreset.Light, e.themePreset.Dark)
					if writeErr := os.WriteFile(cssPath, []byte(newContent), 0644); writeErr != nil && e.logger != nil {
						e.logger.WithField("error", writeErr.Error()).Warn("Failed to apply theme preset to CSS")
					}
				}
			}
			return &ToolResult{Success: true, Content: fmt.Sprintf("Template '%s' applied successfully", templateID)}, nil
		}
		return nil, err
	default:
		return nil, fmt.Errorf("unknown tool: %s", toolName)
	}
}

// listComponents returns all available shadcn/ui components
func (e *Executor) listComponents(ctx context.Context) (*ToolResult, error) {
	result := registry.GetAllComponents()
	return &ToolResult{
		Success: true,
		Content: result,
	}, nil
}

// getComponentUsage returns detailed usage info for a component
func (e *Executor) getComponentUsage(ctx context.Context, args map[string]interface{}) (*ToolResult, error) {
	componentName, ok := args["component"].(string)
	if !ok || componentName == "" {
		return &ToolResult{
			Success: false,
			Content: "Error: component name is required",
		}, nil
	}

	result := registry.GetComponentUsage(componentName)
	return &ToolResult{
		Success: true,
		Content: result,
	}, nil
}

// listIcons lists available Lucide React icons by category or search
func (e *Executor) listIcons(ctx context.Context, args map[string]interface{}) (*ToolResult, error) {
	category, _ := args["category"].(string)
	search, _ := args["search"].(string)

	var result string
	if search != "" {
		result = registry.SearchIcons(search)
	} else if category != "" {
		result = registry.GetIconsByCategory(category)
	} else {
		result = registry.GetAllIconCategories()
	}

	return &ToolResult{
		Success: true,
		Content: result,
	}, nil
}

// getIconUsage returns detailed usage info for a Lucide React icon
func (e *Executor) getIconUsage(ctx context.Context, args map[string]interface{}) (*ToolResult, error) {
	iconName, ok := args["icon"].(string)
	if !ok || iconName == "" {
		return &ToolResult{
			Success: false,
			Content: "Error: icon name is required",
		}, nil
	}

	result := registry.GetIconUsage(iconName)
	return &ToolResult{
		Success: true,
		Content: result,
	}, nil
}

// GetWorkspacePath returns the workspace path
func (e *Executor) GetWorkspacePath() string {
	return e.file.workspacePath
}

// analyzeProject analyzes the existing project structure
func (e *Executor) analyzeProject(ctx context.Context, args map[string]interface{}) (*ToolResult, error) {
	return e.file.analyzeProject(ctx, args)
}

// ExecuteBatch executes multiple tool calls with parallel execution for read-only tools
// and sequential execution for write tools to prevent race conditions.
// Results are returned in the original order of the requests.
func (e *Executor) ExecuteBatch(ctx context.Context, requests []ToolCallRequest) []ToolResult {
	if e.logger != nil {
		e.logger.WithFields(logrus.Fields{
			"total_requests": len(requests),
		}).Debug("ExecuteBatch: starting")
	}

	if len(requests) == 0 {
		if e.logger != nil {
			e.logger.Debug("ExecuteBatch: no requests, returning nil")
		}
		return nil
	}

	// Single request: just execute it directly
	if len(requests) == 1 {
		result, err := e.Execute(ctx, requests[0].Name, requests[0].Arguments)
		if err != nil {
			return []ToolResult{{
				ToolCallID: requests[0].ID,
				Success:    false,
				Content:    fmt.Sprintf("Error: %s", err.Error()),
			}}
		}
		result.ToolCallID = requests[0].ID
		return []ToolResult{*result}
	}

	// Separate requests into read-only (parallelizable) and write (sequential)
	type indexedRequest struct {
		index int
		req   ToolCallRequest
	}

	var readOnlyReqs []indexedRequest
	var writeReqs []indexedRequest

	for i, req := range requests {
		if IsReadOnly(req.Name) {
			readOnlyReqs = append(readOnlyReqs, indexedRequest{index: i, req: req})
		} else {
			writeReqs = append(writeReqs, indexedRequest{index: i, req: req})
		}
	}

	// Results array to maintain original order
	results := make([]ToolResult, len(requests))

	// Execute read-only tools in parallel
	if len(readOnlyReqs) > 0 {
		var wg sync.WaitGroup
		var resultsMu sync.Mutex

		// Use RLock for read-only operations
		e.mu.RLock()
		for _, ir := range readOnlyReqs {
			wg.Add(1)
			go func(ir indexedRequest) {
				defer wg.Done()
				roStart := time.Now()

				result, err := e.executeReadOnly(ctx, ir.req.Name, ir.req.Arguments)
				if err != nil {
					result = &ToolResult{
						ToolCallID: ir.req.ID,
						Success:    false,
						Content:    fmt.Sprintf("Error: %s", err.Error()),
						DurationMs: time.Since(roStart).Milliseconds(),
					}
				} else {
					result.ToolCallID = ir.req.ID
					result.DurationMs = time.Since(roStart).Milliseconds()
				}

				resultsMu.Lock()
				results[ir.index] = *result
				resultsMu.Unlock()
			}(ir)
		}
		wg.Wait()
		e.mu.RUnlock()
	}

	// Execute write tools sequentially with exclusive lock
	if e.logger != nil {
		e.logger.WithFields(logrus.Fields{
			"write_tools_count": len(writeReqs),
		}).Debug("ExecuteBatch: starting write tools execution")
	}

	// Detect duplicate file paths among write tools
	duplicateFiles := detectDuplicateFilePaths(requests)
	executedPaths := make(map[string]bool)

	for i, ir := range writeReqs {
		if e.logger != nil {
			e.logger.WithFields(logrus.Fields{
				"tool":     ir.req.Name,
				"index":    i,
				"of_total": len(writeReqs),
			}).Debug("ExecuteBatch: acquiring lock for write tool")
		}

		// Check if context is cancelled before locking
		select {
		case <-ctx.Done():
			if e.logger != nil {
				e.logger.WithFields(logrus.Fields{
					"tool": ir.req.Name,
				}).Debug("ExecuteBatch: context cancelled before lock")
			}
			return nil
		default:
		}

		// Check for duplicate file paths - skip second+ edits to same file
		if path, ok := ir.req.Arguments["path"].(string); ok && path != "" {
			if _, isDupe := duplicateFiles[path]; isDupe {
				if executedPaths[path] {
					results[ir.index] = ToolResult{
						ToolCallID: ir.req.ID,
						Success:    false,
						Content:    "WARNING: Another edit to this file was already executed in this batch. The file content has changed. Use batchEditFiles for multiple changes to the same file, or make edits in separate tool calls.",
					}
					continue
				}
				executedPaths[path] = true
			}
		}

		// Use exclusive lock for write operations
		e.mu.Lock()
		if e.logger != nil {
			e.logger.WithFields(logrus.Fields{
				"tool":  ir.req.Name,
				"index": i,
			}).Debug("ExecuteBatch: lock acquired, calling Execute")
		}

		result, err := e.Execute(ctx, ir.req.Name, ir.req.Arguments)

		if e.logger != nil {
			e.logger.WithFields(logrus.Fields{
				"tool":  ir.req.Name,
				"index": i,
			}).Debug("ExecuteBatch: Execute returned, releasing lock")
		}
		e.mu.Unlock()

		if err != nil {
			results[ir.index] = ToolResult{
				ToolCallID: ir.req.ID,
				Success:    false,
				Content:    fmt.Sprintf("Error: %s", err.Error()),
			}
		} else {
			result.ToolCallID = ir.req.ID
			results[ir.index] = *result
		}
	}

	if e.logger != nil {
		e.logger.WithFields(logrus.Fields{
			"total_results": len(results),
		}).Debug("ExecuteBatch: completed, returning results")
	}
	return results
}

// detectDuplicateFilePaths finds write tools that target the same file path in a batch.
// Returns a map of path → list of indices for paths that appear more than once.
func detectDuplicateFilePaths(requests []ToolCallRequest) map[string][]int {
	pathIndices := make(map[string][]int)
	for i, req := range requests {
		if IsReadOnly(req.Name) {
			continue
		}
		path, ok := req.Arguments["path"].(string)
		if !ok || path == "" {
			continue
		}
		pathIndices[path] = append(pathIndices[path], i)
	}
	// Only return paths with duplicates
	dupes := make(map[string][]int)
	for path, indices := range pathIndices {
		if len(indices) > 1 {
			dupes[path] = indices
		}
	}
	return dupes
}

// executeReadOnly executes a read-only tool without locking
// This should only be called while holding at least a read lock
func (e *Executor) executeReadOnly(ctx context.Context, toolName string, args map[string]interface{}) (*ToolResult, error) {
	switch toolName {
	case "readFile":
		return e.file.ReadFile(ctx, args)
	case "listFiles":
		return e.file.ListFiles(ctx, args)
	case "searchFiles":
		return e.file.SearchFiles(ctx, args)
	case "listComponents":
		return e.listComponents(ctx)
	case "getComponentUsage":
		return e.getComponentUsage(ctx, args)
	case "listIcons":
		return e.listIcons(ctx, args)
	case "getIconUsage":
		return e.getIconUsage(ctx, args)
	case "analyzeProject":
		return e.analyzeProject(ctx, args)
	case "diffPreview":
		return e.file.diffPreview(ctx, args)
	case "checkExistingComponents":
		return e.file.checkExistingComponents(ctx, args)
	case "getFileInfo":
		return e.file.getFileInfo(ctx, args)
	case "createPlan":
		return e.createPlan(ctx, args)
	case "verifyIntegration":
		return e.integration.VerifyIntegration(ctx, args)
	case "fetchTemplates":
		if e.template == nil {
			return &ToolResult{Success: false, Content: "Error: template support not configured"}, nil
		}
		return e.template.FetchTemplates(ctx)
	case "getTemplateInfo":
		if e.template == nil {
			return &ToolResult{Success: false, Content: "Error: template support not configured"}, nil
		}
		templateID, _ := args["template"].(string)
		return e.template.GetTemplateInfo(ctx, templateID)
	case "readDesignIntelligence":
		return e.designIntel.ReadDesignIntelligence(ctx, args)
	case "readSiteMemory":
		return e.siteMemory.ReadSiteMemory(ctx, args)
	case "listImages":
		return e.listImages(ctx, args)
	case "getImageUsage":
		return e.getImageUsage(ctx, args)
	default:
		return nil, fmt.Errorf("unknown read-only tool: %s", toolName)
	}
}

// createPlan generates a structured plan for complex tasks
func (e *Executor) createPlan(ctx context.Context, args map[string]interface{}) (*ToolResult, error) {
	summary, _ := args["summary"].(string)
	stepsArray, _ := args["steps"].([]interface{})

	if len(stepsArray) == 0 {
		return &ToolResult{
			Success: false,
			Content: "Error: plan must have at least one step",
		}, nil
	}

	var sb strings.Builder
	sb.WriteString("## Plan: " + summary + "\n\n")
	sb.WriteString("### Steps (" + fmt.Sprintf("%d", len(stepsArray)) + " files)\n\n")

	for i, stepInterface := range stepsArray {
		step, ok := stepInterface.(map[string]interface{})
		if !ok {
			continue
		}
		file, _ := step["file"].(string)
		action, _ := step["action"].(string)
		description, _ := step["description"].(string)
		fmt.Fprintf(&sb, "%d. **%s** `%s`\n", i+1, action, file)
		sb.WriteString("   - " + description + "\n\n")
	}

	if deps, ok := args["dependencies"].([]interface{}); ok && len(deps) > 0 {
		sb.WriteString("### Dependencies\n\n")
		for _, depInterface := range deps {
			if dep, ok := depInterface.(string); ok {
				sb.WriteString("- " + dep + "\n")
			}
		}
		sb.WriteString("\n")
	}

	if risks, ok := args["risks"].([]interface{}); ok && len(risks) > 0 {
		sb.WriteString("### Risks to Monitor\n\n")
		for _, riskInterface := range risks {
			if risk, ok := riskInterface.(string); ok {
				sb.WriteString("- " + risk + "\n")
			}
		}
	}

	return &ToolResult{Success: true, Content: sb.String()}, nil
}

// listImages searches the stock image library
func (e *Executor) listImages(ctx context.Context, args map[string]interface{}) (*ToolResult, error) {
	imageType, _ := args["type"].(string)
	category, _ := args["category"].(string)
	mood, _ := args["mood"].(string)
	tone, _ := args["tone"].(string)
	limit := 10
	if l, ok := args["limit"].(float64); ok && l > 0 {
		limit = int(l)
		if limit > 30 {
			limit = 30
		}
	}

	results := registry.SearchImages(imageType, category, mood, tone, limit)
	return &ToolResult{
		Success: true,
		Content: registry.FormatImageList(results, e.laravelURL),
	}, nil
}

// getImageUsage returns usage info for a specific stock image
func (e *Executor) getImageUsage(ctx context.Context, args map[string]interface{}) (*ToolResult, error) {
	filename, ok := args["filename"].(string)
	if !ok || filename == "" {
		return &ToolResult{Success: false, Content: "Error: 'filename' parameter is required."}, nil
	}

	img := registry.FindImageByFilename(filename)
	if img == nil {
		return &ToolResult{Success: false, Content: fmt.Sprintf("Image not found: %s. Use listImages to see available images.", filename)}, nil
	}

	return &ToolResult{
		Success: true,
		Content: registry.FormatImageUsage(*img, e.laravelURL),
	}, nil
}

// applyThemeToCSSContent replaces :root and .dark CSS variable blocks with theme preset values
func applyThemeToCSSContent(css string, light, dark map[string]string) string {
	lightBlock := generateThemeCSSBlock(light)
	darkBlock := generateThemeCSSBlock(dark)

	rootPattern := regexp.MustCompile(`(:root\s*\{)([^}]*?)(\})`)
	css = rootPattern.ReplaceAllString(css, "${1}\n"+lightBlock+"${3}")

	darkPattern := regexp.MustCompile(`(\.dark\s*\{)([^}]*?)(\})`)
	css = darkPattern.ReplaceAllString(css, "${1}\n"+darkBlock+"${3}")

	return css
}

// generateThemeCSSBlock creates CSS variable declarations from a map
func generateThemeCSSBlock(vars map[string]string) string {
	var lines []string
	for name, value := range vars {
		lines = append(lines, fmt.Sprintf("  --%s: %s;", name, value))
	}
	sort.Strings(lines)
	return strings.Join(lines, "\n") + "\n"
}
