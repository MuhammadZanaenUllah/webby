package api

import (
	"archive/zip"
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"webby-builder/internal/agent"
	"webby-builder/internal/executor"
	"webby-builder/internal/logging"
	"webby-builder/internal/models"
	"webby-builder/internal/pkg/unzip"
	"webby-builder/internal/pusher"
	"webby-builder/internal/revision"
	"webby-builder/internal/webhook"

	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
)

// Server holds the server state
type Server struct {
	sessions         map[string]*agent.Session
	mu               sync.RWMutex
	revisionManagers map[string]*revision.Manager
	revisionMu       sync.RWMutex
	serverKey        string
	workspacePath    string
	router           *gin.Engine
	version          string
	logger           *logrus.Logger
	debug            bool
}

// NewServer creates a new server instance
func NewServer(cfg ServerConfig, logger *logrus.Logger) *Server {
	// Ensure workspace directory exists
	_ = os.MkdirAll(cfg.WorkspacePath, 0755)

	s := &Server{
		sessions:         make(map[string]*agent.Session),
		revisionManagers: make(map[string]*revision.Manager),
		serverKey:     cfg.ServerKey,
		workspacePath: cfg.WorkspacePath,
		version:       cfg.Version,
		logger:        logger,
		debug:         cfg.Debug,
	}

	s.router = s.SetupRouter()

	// Start background cleanup worker
	s.StartCleanupWorker()

	return s
}

// Run starts the server on the specified address
func (s *Server) RunAddr(addr string) error {
	return s.router.Run(addr)
}

// Run starts the server
func (s *Server) Run() error {
	return s.router.Run()
}

// getSession retrieves a session by ID
func (s *Server) getSession(sessionID string) (*agent.Session, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	session, ok := s.sessions[sessionID]
	return session, ok
}

// resolveWorkspaceFromRequest extracts a workspace or session ID from the request
// and resolves it to a workspace path on the filesystem.
func (s *Server) resolveWorkspaceFromRequest(c *gin.Context) (workspacePath string, workspaceID string, ok bool) {
	id := c.Param("session_id")
	if id == "" {
		id = c.Param("workspace_id")
	}
	if id == "" {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: "Missing workspace or session ID"})
		return "", "", false
	}
	path := filepath.Join(s.workspacePath, id)
	if _, err := os.Stat(path); os.IsNotExist(err) {
		c.JSON(http.StatusNotFound, models.ErrorResponse{Error: "Workspace not found"})
		return "", "", false
	}
	return path, id, true
}

// getActiveSessionCount returns the number of active sessions
func (s *Server) getActiveSessionCount() int {
	s.mu.RLock()
	defer s.mu.RUnlock()
	count := 0
	for _, session := range s.sessions {
		if session.IsActive() {
			count++
		}
	}
	return count
}

// Root endpoint - server info
func (s *Server) handleRoot(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"version":  s.version,
		"sessions": s.GetSessionCount(),
	})
}

// POST /api/run - Start a new agent session
func (s *Server) handleRun(c *gin.Context) {
	var req models.RunRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: err.Error()})
		return
	}

	// Validate config
	if err := req.Config.Validate(); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: err.Error()})
		return
	}

	// Use workspace ID as session ID (no separate UUID)
	sessionID := req.WorkspaceID

	// Create workspace path for this session
	workspacePath := filepath.Join(s.workspacePath, req.WorkspaceID)
	_ = os.MkdirAll(workspacePath, 0755)

	// Check if session already exists for this workspace
	// Hold lock through entire check-and-modify operation to prevent race conditions
	s.mu.Lock()
	existingSession, exists := s.sessions[sessionID]

	var session *agent.Session
	var reused bool

	if exists {
		status := existingSession.GetStatus()
		// Active sessions: pending or running - reject
		if status == models.StatusPending || status == models.StatusRunning {
			s.mu.Unlock()
			s.logger.WithFields(logrus.Fields{
				"session_id":      sessionID,
				"workspace_id":    req.WorkspaceID,
				"existing_status": status,
			}).Warn("Rejecting new session - workspace already has active session")

			c.JSON(http.StatusConflict, gin.H{
				"error":         "A session is already active for this workspace",
				"session_id":    sessionID,
				"status":        string(status),
				"can_reconnect": true,
			})
			return
		}
		// Terminal sessions: completed, failed, or cancelled - reuse the session
		s.logger.WithFields(logrus.Fields{
			"session_id":      sessionID,
			"workspace_id":    req.WorkspaceID,
			"existing_status": status,
		}).Info("Reusing existing terminal session")

		session = s.reuseSession(existingSession, req)
		reused = true
	}
	s.mu.Unlock()

	// Create appropriate streamer based on Pusher config
	if !reused {
		if req.Pusher != nil {
			// Validate and create Pusher client
			pusherConfig := &pusher.Config{
				AppID:   req.Pusher.AppID,
				Key:     req.Pusher.Key,
				Secret:  req.Pusher.Secret,
				Cluster: req.Pusher.Cluster,
				Host:    req.Pusher.Host,
				Scheme:  req.Pusher.Scheme,
			}

			pusherClient, err := pusher.NewClient(pusherConfig)
			if err != nil {
				c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: "Invalid Pusher config: " + err.Error()})
				return
			}

			// Validate credentials (fail fast)
			if err := pusherClient.ValidateCredentials(); err != nil {
				c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: "Pusher validation failed: " + err.Error()})
				return
			}

			// Create webhook notifier for critical events (status, complete, error)
			webhookNotifier := webhook.NewNotifier(req.WebhookURL, s.serverKey, sessionID)

			// Create hybrid streamer with logger for debug logging
			// Use WorkspaceID (project ID) as channel ID so frontend can subscribe before the build starts
			hybridStreamer := pusher.NewHybridStreamerWithLogger(pusherClient, webhookNotifier, req.WorkspaceID, s.logger)

			// Create session with hybrid streamer
			session = agent.NewSessionWithStreamer(sessionID, req.WorkspaceID, workspacePath, req.WebhookURL, &req.Config, hybridStreamer)
		} else {
			// Create session with webhook-only notifier
			session = agent.NewSession(sessionID, req.WorkspaceID, workspacePath, req.WebhookURL, s.serverKey, &req.Config)
		}

		// Set template URL if provided
		if req.Template != nil {
			session.SetTemplateURL(req.Template.URL)
		}

		// Set Laravel URL for template fetching
		session.SetLaravelURL(req.LaravelURL)
		if req.LaravelURL != "" {
			s.logger.WithField("laravel_url", req.LaravelURL).Debug("Laravel URL set from request")
		}

		// Set selected template ID and name if provided
		if req.Template != nil && req.Template.TemplateID != "" {
			session.SetSelectedTemplate(req.Template.TemplateID, req.Template.TemplateName)
		}

		// Set custom system prompts if provided (admin-editable)
		if req.CustomPrompts != nil {
			session.SetCustomPrompts(req.CustomPrompts)
		}

		// Set feature flags if provided, otherwise use defaults
		if req.Features != nil {
			session.SetFeatures(*req.Features)
		}

		// Set project capabilities if provided
		if req.ProjectCapabilities != nil {
			session.SetProjectCapabilities(*req.ProjectCapabilities)
			s.logger.WithFields(logrus.Fields{
				"session_id":       session.ID,
				"firebase_enabled": req.ProjectCapabilities.Firebase != nil && req.ProjectCapabilities.Firebase.Enabled,
				"storage_enabled":  req.ProjectCapabilities.Storage != nil && req.ProjectCapabilities.Storage.Enabled,
			}).Debug("Project capabilities set from request")
		} else {
			s.logger.WithFields(logrus.Fields{
				"session_id": session.ID,
			}).Debug("No project capabilities in request")
		}

		// Set theme preset if provided
		if req.ThemePreset != nil {
			session.SetThemePreset(*req.ThemePreset)
			s.logger.WithField("theme_preset", req.ThemePreset.ID).Debug("Theme preset set from request")
		}

		// Create workspace-specific logger if debug mode
		if s.debug {
			wsLogger, cleanup := logging.NewWorkspaceLogger(req.WorkspaceID, true)
			session.SetLogger(wsLogger, cleanup)
		}
	}

	// Create cancellable context FIRST (before session is accessible to other goroutines)
	ctx, cancel := context.WithCancel(context.Background())
	session.SetCancel(cancel)

	// THEN store session (now fully initialized with cancel function)
	s.mu.Lock()
	s.sessions[sessionID] = session
	s.mu.Unlock()

	// Start agent in background
	go s.runAgent(ctx, session, req.Goal, req.History, req.IsCompacted, req.MaxIterations)

	// Log session creation
	logMsg := "Agent session created"
	if reused {
		logMsg = "Agent session reused"
	}
	s.logger.WithFields(logrus.Fields{
		"session_id":   sessionID,
		"workspace_id": req.WorkspaceID,
		"reused":       reused,
	}).Info(logMsg)

	response := gin.H{"session_id": sessionID}
	if reused {
		response["reused"] = true
	}
	c.JSON(http.StatusOK, response)
}

// reuseSession reconfigures an existing terminal session for a new run
func (s *Server) reuseSession(session *agent.Session, req models.RunRequest) *agent.Session {
	// Reset session state for continuation
	session.ResetForContinuation()

	// Update config (AI provider settings, model, etc.)
	session.SetConfig(&req.Config)

	// Set template URL if provided
	if req.Template != nil {
		session.SetTemplateURL(req.Template.URL)
		if req.Template.TemplateID != "" {
			session.SetSelectedTemplate(req.Template.TemplateID, req.Template.TemplateName)
		}
	}

	// Set Laravel URL
	session.SetLaravelURL(req.LaravelURL)

	// Set feature flags
	if req.Features != nil {
		session.SetFeatures(*req.Features)
	}

	// Set project capabilities
	if req.ProjectCapabilities != nil {
		session.SetProjectCapabilities(*req.ProjectCapabilities)
		s.logger.WithFields(logrus.Fields{
			"session_id":       session.ID,
			"firebase_enabled": req.ProjectCapabilities.Firebase != nil && req.ProjectCapabilities.Firebase.Enabled,
			"storage_enabled":  req.ProjectCapabilities.Storage != nil && req.ProjectCapabilities.Storage.Enabled,
		}).Debug("Project capabilities set from request (reuse)")
	} else {
		s.logger.WithFields(logrus.Fields{
			"session_id": session.ID,
		}).Debug("No project capabilities in request (reuse)")
	}

	// Set theme preset if provided
	if req.ThemePreset != nil {
		session.SetThemePreset(*req.ThemePreset)
		s.logger.WithField("theme_preset", req.ThemePreset.ID).Debug("Theme preset set from request (reuse)")
	}

	// Set custom prompts (or clear stale ones)
	if req.CustomPrompts != nil {
		session.SetCustomPrompts(req.CustomPrompts)
	} else {
		session.SetCustomPrompts(nil)
	}

	// Reinitialize streamer
	var newStreamer webhook.Streamer
	if req.Pusher != nil {
		pusherConfig := &pusher.Config{
			AppID:   req.Pusher.AppID,
			Key:     req.Pusher.Key,
			Secret:  req.Pusher.Secret,
			Cluster: req.Pusher.Cluster,
			Host:    req.Pusher.Host,
			Scheme:  req.Pusher.Scheme,
		}
		webhookNotifier := webhook.NewNotifier(req.WebhookURL, s.serverKey, session.ID)
		pusherClient, err := pusher.NewClient(pusherConfig)
		if err != nil {
			s.logger.Warnf("Failed to reinitialize Pusher client for session %s: %v, falling back to webhook-only", session.ID, err)
			newStreamer = webhookNotifier
		} else {
			newStreamer = pusher.NewHybridStreamerWithLogger(pusherClient, webhookNotifier, session.WorkspaceID, s.logger)
		}
	} else {
		newStreamer = webhook.NewNotifier(req.WebhookURL, s.serverKey, session.ID)
	}
	session.ReinitializeStreamer(newStreamer)

	return session
}

// POST /api/stop/:session_id - Stop a running session
func (s *Server) handleStop(c *gin.Context) {
	sessionID := c.Param("session_id")

	session, ok := s.getSession(sessionID)
	if !ok {
		c.JSON(http.StatusNotFound, models.ErrorResponse{Error: "Session not found"})
		return
	}

	session.Cancel()

	s.logger.WithFields(logrus.Fields{
		"session_id": sessionID,
	}).Info("Stopping session")

	c.JSON(http.StatusOK, gin.H{"cancelled": true})
}

// GET /api/status/:session_id - Get session status
func (s *Server) handleStatus(c *gin.Context) {
	sessionID := c.Param("session_id")

	session, ok := s.getSession(sessionID)
	if !ok {
		c.JSON(http.StatusNotFound, models.ErrorResponse{Error: "Session not found"})
		return
	}

	// Return 404 for terminal sessions so Laravel knows the build is done
	status := session.GetStatus()
	if isTerminalStatus(status) {
		c.JSON(http.StatusNotFound, models.ErrorResponse{Error: "Session ended"})
		return
	}

	c.JSON(http.StatusOK, models.StatusResponse{
		SessionID:      sessionID,
		Status:         string(status),
		Iterations:     session.Iterations,
		TokensUsed:     session.TokensUsed,
		ActiveSessions: s.getActiveSessionCount(),
		Error:          session.Error,
	})
}

// GET /api/files/:session_id or /api/files-workspace/:workspace_id - List workspace files
func (s *Server) handleListFiles(c *gin.Context) {
	workspacePath, _, ok := s.resolveWorkspaceFromRequest(c)
	if !ok {
		return
	}

	files := s.listFilesInPath(workspacePath)
	c.JSON(http.StatusOK, models.FileListResponse{Files: files})
}

// listFilesInPath returns a list of files in the given workspace path
func (s *Server) listFilesInPath(workspacePath string) []models.FileInfo {
	var files []models.FileInfo

	_ = filepath.Walk(workspacePath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil
		}

		relPath, _ := filepath.Rel(workspacePath, path)
		if relPath == "." {
			return nil
		}

		// Skip hidden files, common excludes, and internal metadata
		if strings.HasPrefix(info.Name(), ".") ||
			info.Name() == "node_modules" ||
			info.Name() == "dist" ||
			info.Name() == "template.json" {
			if info.IsDir() {
				return filepath.SkipDir
			}
			return nil
		}

		files = append(files, models.FileInfo{
			Path:    relPath,
			Name:    info.Name(),
			Size:    info.Size(),
			IsDir:   info.IsDir(),
			ModTime: info.ModTime().Format(time.RFC3339),
		})

		return nil
	})

	return files
}

// GET /api/file/:session_id or /api/file-workspace/:workspace_id - Get file content
func (s *Server) handleGetFile(c *gin.Context) {
	filePath := c.Query("path")

	if filePath == "" {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: "path query parameter is required"})
		return
	}

	workspacePath, _, ok := s.resolveWorkspaceFromRequest(c)
	if !ok {
		return
	}

	s.serveFileContent(c, workspacePath, filePath)
}

// validateAndResolvePath validates a relative path and resolves it to an absolute path
// within the workspace. Returns an error if the path would escape the workspace.
func (s *Server) validateAndResolvePath(workspacePath, relativePath string) (string, error) {
	// Reject obviously bad patterns first
	if strings.Contains(relativePath, "..") || strings.HasPrefix(relativePath, "/") {
		return "", fmt.Errorf("invalid path")
	}

	// Delegate to shared utility (follows symlinks to prevent escape)
	return executor.ResolveAndValidatePath(workspacePath, relativePath)
}

// serveFileContent reads and returns file content from a workspace
func (s *Server) serveFileContent(c *gin.Context, workspacePath, filePath string) {
	// Validate and resolve path (prevent traversal)
	fullPath, err := s.validateAndResolvePath(workspacePath, filePath)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: "Invalid path"})
		return
	}

	content, err := os.ReadFile(fullPath)
	if err != nil {
		c.JSON(http.StatusNotFound, models.ErrorResponse{Error: "File not found"})
		return
	}

	info, err := os.Stat(fullPath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: "Failed to stat file"})
		return
	}

	c.JSON(http.StatusOK, models.FileResponse{
		Path:    filePath,
		Content: string(content),
		Size:    info.Size(),
	})
}

// validatePathForAPIWrite checks if a file path is allowed for writes via the code editor API.
// Blocks protected config files and npm config files that could enable script injection.
func (s *Server) validatePathForAPIWrite(path string) error {
	cleaned := filepath.Clean(path)

	// Block protected config files (same as AI agent)
	if executor.IsProtectedFile(cleaned) {
		return fmt.Errorf("cannot modify %s: this is a protected system file", path)
	}

	// Block npm/yarn config files that could enable script injection
	base := filepath.Base(cleaned)
	npmConfigFiles := []string{".npmrc", ".yarnrc", ".yarnrc.yml"}
	for _, f := range npmConfigFiles {
		if base == f {
			return fmt.Errorf("cannot modify %s: npm/yarn config files are not allowed", path)
		}
	}

	return nil
}

// PUT /api/file/:session_id or /api/file-workspace/:workspace_id - Update file content
func (s *Server) handleUpdateFile(c *gin.Context) {
	var req models.FileUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: err.Error()})
		return
	}

	workspacePath, _, ok := s.resolveWorkspaceFromRequest(c)
	if !ok {
		return
	}

	// Validate and resolve path (prevent traversal)
	fullPath, err := s.validateAndResolvePath(workspacePath, req.Path)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: "Invalid path"})
		return
	}

	// Block writes to protected files
	if err := s.validatePathForAPIWrite(req.Path); err != nil {
		c.JSON(http.StatusForbidden, models.ErrorResponse{Error: err.Error()})
		return
	}

	// Ensure directory exists
	_ = os.MkdirAll(filepath.Dir(fullPath), 0755)

	if err := os.WriteFile(fullPath, []byte(req.Content), 0644); err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

// PUT /api/theme-workspace/:workspace_id - Apply theme preset to workspace CSS
func (s *Server) handleApplyTheme(c *gin.Context) {
	workspaceID := c.Param("workspace_id")

	var req models.ApplyThemeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: err.Error()})
		return
	}

	workspacePath := filepath.Join(s.workspacePath, workspaceID)
	if _, err := os.Stat(workspacePath); os.IsNotExist(err) {
		c.JSON(http.StatusNotFound, models.ErrorResponse{Error: "Workspace not found"})
		return
	}

	cssPath := filepath.Join(workspacePath, "src", "index.css")
	if _, err := os.Stat(cssPath); os.IsNotExist(err) {
		c.JSON(http.StatusNotFound, models.ErrorResponse{Error: "index.css not found"})
		return
	}

	// Read current CSS
	content, err := os.ReadFile(cssPath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: "failed to read CSS"})
		return
	}

	// Apply theme by replacing :root and .dark blocks
	newContent := applyThemeToCSS(string(content), req.Light, req.Dark)

	// Write back
	if err := os.WriteFile(cssPath, []byte(newContent), 0644); err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: "failed to write CSS"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

// applyThemeToCSS replaces CSS variables in :root and .dark blocks
func applyThemeToCSS(css string, light, dark map[string]string) string {
	// Generate new :root block content
	lightBlock := generateCSSBlock(light)
	// Generate new .dark block content
	darkBlock := generateCSSBlock(dark)

	// Replace :root { ... } block
	rootPattern := regexp.MustCompile(`(:root\s*\{)([^}]*?)(\})`)
	css = rootPattern.ReplaceAllString(css, "${1}\n"+lightBlock+"${3}")

	// Replace .dark { ... } block
	darkPattern := regexp.MustCompile(`(\.dark\s*\{)([^}]*?)(\})`)
	css = darkPattern.ReplaceAllString(css, "${1}\n"+darkBlock+"${3}")

	return css
}

// generateCSSBlock creates CSS variable declarations from a map
func generateCSSBlock(vars map[string]string) string {
	var lines []string
	for name, value := range vars {
		lines = append(lines, fmt.Sprintf("  --%s: %s;", name, value))
	}
	// Sort for consistent output
	sort.Strings(lines)
	return strings.Join(lines, "\n") + "\n"
}

// POST /api/build/:session_id or /api/build-workspace/:workspace_id - Trigger a build
func (s *Server) handleBuild(c *gin.Context) {
	workspacePath, _, ok := s.resolveWorkspaceFromRequest(c)
	if !ok {
		return
	}

	s.runBuildInWorkspace(c, workspacePath)
}

// runBuildInWorkspace runs npm install and npm run build in the given workspace
func (s *Server) runBuildInWorkspace(c *gin.Context, workspacePath string) {
	// Check if package.json exists
	packageJSON := filepath.Join(workspacePath, "package.json")
	if _, err := os.Stat(packageJSON); os.IsNotExist(err) {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: "No package.json found in workspace"})
		return
	}

	// Run npm install first
	installCmd := exec.Command("npm", "install", "--ignore-scripts")
	installCmd.Dir = workspacePath
	if output, err := installCmd.CombinedOutput(); err != nil {
		s.logger.WithField("output", string(output)).WithError(err).Error("npm install failed")
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: "npm install failed",
		})
		return
	}

	// Run npm run build
	buildCmd := exec.Command("npm", "run", "build")
	buildCmd.Dir = workspacePath
	if output, err := buildCmd.CombinedOutput(); err != nil {
		s.logger.WithField("output", string(output)).WithError(err).Error("npm run build failed")
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: "Build failed",
		})
		return
	}

	// Check if dist folder exists
	distPath := filepath.Join(workspacePath, "dist")
	if _, err := os.Stat(distPath); os.IsNotExist(err) {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: "Build completed but dist folder not found"})
		return
	}

	c.JSON(http.StatusOK, models.BuildResponse{
		Success: true,
		Message: "Build completed successfully",
	})
}

// GET /api/build-output/:session_id or /api/build-output-workspace/:workspace_id - Download built files as zip
func (s *Server) handleBuildOutput(c *gin.Context) {
	workspacePath, workspaceID, ok := s.resolveWorkspaceFromRequest(c)
	if !ok {
		return
	}

	s.serveBuildOutput(c, workspacePath, workspaceID)
}

// serveBuildOutput creates and serves a zip of the dist folder
func (s *Server) serveBuildOutput(c *gin.Context, workspacePath, workspaceID string) {
	distPath := filepath.Join(workspacePath, "dist")
	if _, err := os.Stat(distPath); os.IsNotExist(err) {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: "Build output not found"})
		return
	}

	// Extract project ID from workspace ID for base tag injection
	projectID := extractProjectID(workspaceID)

	// Create zip in memory
	buf := new(bytes.Buffer)
	zipWriter := zip.NewWriter(buf)
	fileCount := 0

	err := filepath.Walk(distPath, func(path string, info os.FileInfo, err error) error {
		if err != nil || info.IsDir() {
			return err
		}

		relPath, _ := filepath.Rel(distPath, path)

		// Read file content
		data, err := os.ReadFile(path)
		if err != nil {
			return err
		}

		// Inject base tag into index.html to fix relative asset paths
		// This ensures ./assets/* resolves to /preview/{id}/assets/* instead of /preview/assets/*
		if relPath == "index.html" {
			data = injectBaseTag(data, projectID)
		}

		w, err := zipWriter.Create(relPath)
		if err != nil {
			return err
		}

		if _, wErr := w.Write(data); wErr != nil {
			return wErr
		}
		fileCount++
		return nil
	})

	if closeErr := zipWriter.Close(); closeErr != nil && err == nil {
		err = closeErr
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: err.Error()})
		return
	}

	c.Header("X-Build-Status", "success")
	c.Header("X-Files-Count", strconv.Itoa(fileCount))
	c.Header("Content-Disposition", "attachment; filename=dist.zip")
	c.Data(http.StatusOK, "application/zip", buf.Bytes())
}

// POST /api/reset/:session_id - Reset workspace
func (s *Server) handleReset(c *gin.Context) {
	sessionID := c.Param("session_id")

	session, ok := s.getSession(sessionID)
	if !ok {
		c.JSON(http.StatusNotFound, models.ErrorResponse{Error: "Session not found"})
		return
	}

	// Remove workspace contents (but not the directory itself)
	workspacePath := session.GetWorkspacePath()
	entries, _ := os.ReadDir(workspacePath)
	for _, entry := range entries {
		_ = os.RemoveAll(filepath.Join(workspacePath, entry.Name()))
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

// GET /api/suggestions/:session_id - Get AI suggestions
func (s *Server) handleSuggestions(c *gin.Context) {
	sessionID := c.Param("session_id")

	_, ok := s.getSession(sessionID)
	if !ok {
		c.JSON(http.StatusNotFound, models.ErrorResponse{Error: "Session not found"})
		return
	}

	// TODO: Implement actual suggestions
	c.JSON(http.StatusOK, models.SuggestionsResponse{
		Suggestions: []string{
			"Add a responsive navigation menu",
			"Implement dark mode toggle",
			"Add form validation",
		},
	})
}

// POST /api/chat/:session_id - Continue conversation
func (s *Server) handleChat(c *gin.Context) {
	sessionID := c.Param("session_id")

	var req models.ChatRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: err.Error()})
		return
	}

	session, ok := s.getSession(sessionID)
	if !ok {
		c.JSON(http.StatusNotFound, models.ErrorResponse{Error: "Session not found"})
		return
	}

	// Check if session can accept new messages
	if !session.CanContinue() {
		status := session.GetStatus()
		if status == models.StatusRunning || status == models.StatusPending {
			c.JSON(http.StatusConflict, models.ErrorResponse{Error: "Session is still running"})
			return
		}
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: "Session cannot continue (status: " + string(status) + ")"})
		return
	}

	// Reinitialize streamer for the new conversation turn using stored server key
	webhookNotifier := webhook.NewNotifier(
		session.GetWebhookURL(),
		s.serverKey,
		sessionID,
	)

	// Note: If the original request had Pusher config, chat continuation uses webhook-only
	// This is simpler and ensures critical events (status, complete, error) still work
	session.ReinitializeStreamer(webhookNotifier)

	// Reset session for continuation
	session.ResetForContinuation()

	// Create cancellable context
	ctx, cancel := context.WithCancel(context.Background())
	session.SetCancel(cancel)

	// Use history from request (Laravel sends full conversation history)
	history := req.History
	if history == nil {
		history = []models.HistoryMessage{}
	}

	// Start agent in background with the new message
	go s.runAgent(ctx, session, req.Message, history, req.IsCompacted, 20)

	c.JSON(http.StatusOK, gin.H{
		"session_id": sessionID,
		"status":     "running",
	})
}

// extractProjectID returns the workspace ID directly (now a UUID)
// Previously stripped "project-" prefix, now workspace IDs are UUIDs directly
func extractProjectID(workspaceID string) string {
	return workspaceID
}

// injectBaseTag injects a <base> tag into HTML content to fix relative asset paths
// This ensures that relative paths like "./assets/index.js" resolve correctly
// when the preview is served at /preview/{id}/ instead of /preview/{id}
func injectBaseTag(htmlContent []byte, projectID string) []byte {
	baseTag := fmt.Sprintf(`<base href="/preview/%s/">`, projectID)

	content := strings.Replace(string(htmlContent), "<head>", "<head>\n    "+baseTag, 1)
	return []byte(content)
}

// workspaceHasFiles checks if the workspace already contains source files
// (indicating it was previously initialized and shouldn't be overwritten)
func workspaceHasFiles(workspacePath string) bool {
	srcDir := filepath.Join(workspacePath, "src")
	if info, err := os.Stat(srcDir); err == nil && info.IsDir() {
		entries, err := os.ReadDir(srcDir)
		if err == nil && len(entries) > 0 {
			return true
		}
	}
	return false
}

// initializeWorkspaceFromTemplate fetches template ZIP from Laravel API and extracts it to workspace
func (s *Server) initializeWorkspaceFromTemplate(workspacePath, templateID, laravelURL string) error {
	// Build download URL
	downloadURL := fmt.Sprintf("%s/api/templates/%s/download", laravelURL, templateID)
	s.logger.WithField("download_url", downloadURL).Debug("Fetching template from Laravel")

	// Create HTTP request with server key authentication
	req, err := http.NewRequest("GET", downloadURL, nil)
	if err != nil {
		return fmt.Errorf("creating download request: %w", err)
	}
	req.Header.Set("X-Server-Key", s.serverKey)
	req.Header.Set("User-Agent", models.HTTPUserAgent)

	// Fetch template ZIP
	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("fetching template: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	// Handle API errors
	if resp.StatusCode != http.StatusOK {
		body, readErr := io.ReadAll(resp.Body)
		if readErr != nil {
			return fmt.Errorf("template API returned status %d (failed to read response body: %s)", resp.StatusCode, readErr.Error())
		}
		return fmt.Errorf("template API returned status %d: %s", resp.StatusCode, string(body))
	}

	// Create temporary file for ZIP
	tmpFile, err := os.CreateTemp("", "template-*.zip")
	if err != nil {
		return fmt.Errorf("creating temp file: %w", err)
	}
	tmpPath := tmpFile.Name()
	defer func() { _ = os.Remove(tmpPath) }()

	// Download ZIP to temp file
	if _, err := io.Copy(tmpFile, resp.Body); err != nil {
		_ = tmpFile.Close()
		return fmt.Errorf("downloading template: %w", err)
	}
	_ = tmpFile.Close()

	// Extract ZIP to workspace
	if err := unzip.Extract(tmpPath, workspacePath); err != nil {
		return fmt.Errorf("extracting template: %w", err)
	}

	s.logger.WithFields(logrus.Fields{
		"template_id":    templateID,
		"workspace_path": workspacePath,
		"source":         laravelURL,
	}).Info("Workspace initialized from template")

	return nil
}

// runAgent runs the agent loop
func (s *Server) runAgent(ctx context.Context, session *agent.Session, goal string, history []models.HistoryMessage, isCompacted bool, maxIterations int) {
	// Get Laravel URL for template fetching
	laravelURL := session.GetLaravelURL()
	selectedTemplate := session.GetSelectedTemplate()

	// Log template selection for this session
	if selectedTemplate != "" {
		s.logger.WithFields(logrus.Fields{
			"session_id":   session.ID,
			"workspace_id": session.WorkspaceID,
			"template_id":  selectedTemplate,
		}).Info("Template selected for session")
	}

	// Initialize workspace from template BEFORE starting agent
	// Only initialize if workspace is empty (skip for chat continuations)
	// Only pre-initialize when user explicitly selected a template;
	// when "Automatic" (no template), the AI agent will select via fetchTemplates + useTemplate
	workspacePath := session.GetWorkspacePath()
	if !workspaceHasFiles(workspacePath) && selectedTemplate != "" {
		if err := s.initializeWorkspaceFromTemplate(workspacePath, selectedTemplate, laravelURL); err != nil {
			// Notify user about template fetch failure
			s.notifyError(session.ID, fmt.Sprintf("Failed to initialize workspace from template '%s': %v", selectedTemplate, err))
			session.SetError(err.Error())
			session.SetStatus(models.StatusFailed)
			return
		}

		// Template was extracted — mark session so auto-build triggers
		// even if the agent doesn't modify any files during its session
		session.SetFilesChanged(true)

		// Apply theme preset to workspace CSS if provided
		if themePreset := session.GetThemePreset(); themePreset != nil && themePreset.Light != nil && themePreset.Dark != nil {
			cssPath := filepath.Join(workspacePath, "src", "index.css")
			if content, err := os.ReadFile(cssPath); err == nil {
				newContent := applyThemeToCSS(string(content), themePreset.Light, themePreset.Dark)
				if err := os.WriteFile(cssPath, []byte(newContent), 0644); err == nil {
					s.logger.WithFields(logrus.Fields{
						"session_id":   session.ID,
						"theme_preset": themePreset.ID,
					}).Debug("Applied theme preset to workspace CSS")
				}
			}
		}
	}

	// Convert history to runner format with compaction metadata
	runnerHistory := agent.HistoryInput{
		Messages:    make([]agent.HistoryMsg, len(history)),
		IsCompacted: isCompacted,
	}
	for i, h := range history {
		runnerHistory.Messages[i] = agent.HistoryMsg{
			Role:    h.Role,
			Content: h.Content,
		}
	}

	// Update goal to inform AI about template selection state
	initialGoal := goal
	if selectedTemplate != "" {
		templateName := session.GetSelectedTemplateName()
		if templateName == "" {
			templateName = selectedTemplate // Fall back to ID if name not provided
		}
		initialGoal = fmt.Sprintf("%s\n\n(Note: The '%s' template has been pre-selected and initialized for this project. Read template.json and proceed.)", goal, templateName)
	} else if !workspaceHasFiles(workspacePath) {
		initialGoal = fmt.Sprintf("%s\n\n(Note: No template was pre-selected. You MUST call fetchTemplates first to see available templates, then select the most appropriate one using useTemplate before doing any other work.)", goal)
	}

	// Use workspace logger if available, otherwise fall back to server logger
	logger := session.GetLogger()
	if logger == nil {
		logger = s.logger
	}

	// Create runner with config from session (templatePath is no longer needed)
	cfg := session.GetConfig()
	runner := agent.NewRunnerWithTemplate(
		session.GetWorkspacePath(),
		"", // templatePath - no longer needed, templates fetched from API
		cfg.Agent,
		cfg.Summarizer,
		logger,
		s.serverKey, // serverKey for Laravel API auth
		laravelURL,  // Laravel API URL for template fetching
		cfg.Tools,   // tool config for timeout and retry
	)

	// Create revision snapshot before running the agent
	revMgr := s.getOrCreateRevisionManager(session.WorkspaceID)
	if err := revMgr.CreateSnapshot(fmt.Sprintf("Before: %s", truncateLabel(goal, 60))); err != nil {
		s.logger.WithField("error", err.Error()).Warn("Failed to create revision snapshot (non-blocking)")
	}

	// Run the agent
	if err := runner.Run(ctx, session, initialGoal, runnerHistory, maxIterations); err != nil {
		// Error handling is done inside Run
		return
	}
}

// notifyError sends an error notification via session streamer
func (s *Server) notifyError(sessionID, message string) {
	// Strip HTML tags from error message to prevent HTML in logs
	cleanMessage := logging.StripHTMLTags(message)
	s.logger.WithFields(logrus.Fields{
		"session_id": sessionID,
	}).Error(cleanMessage)
	// The streamer will send the error to the client
}

// getOrCreateRevisionManager returns or creates a revision manager for the given workspace
func (s *Server) getOrCreateRevisionManager(workspaceID string) *revision.Manager {
	s.revisionMu.RLock()
	mgr, exists := s.revisionManagers[workspaceID]
	s.revisionMu.RUnlock()

	if exists {
		return mgr
	}

	s.revisionMu.Lock()
	defer s.revisionMu.Unlock()

	// Double-check after acquiring write lock
	if mgr, exists = s.revisionManagers[workspaceID]; exists {
		return mgr
	}

	workspacePath := filepath.Join(s.workspacePath, workspaceID)
	mgr = revision.NewManager(workspacePath)
	s.revisionManagers[workspaceID] = mgr
	return mgr
}

// handleUndo reverts workspace to the previous revision
func (s *Server) handleUndo(c *gin.Context) {
	_, workspaceID, ok := s.resolveWorkspaceFromRequest(c)
	if !ok {
		return
	}

	mgr := s.getOrCreateRevisionManager(workspaceID)
	info, err := mgr.Undo()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success":  true,
		"revision": info,
	})
}

// handleRedo moves workspace forward to the next revision
func (s *Server) handleRedo(c *gin.Context) {
	_, workspaceID, ok := s.resolveWorkspaceFromRequest(c)
	if !ok {
		return
	}

	mgr := s.getOrCreateRevisionManager(workspaceID)
	info, err := mgr.Redo()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success":  true,
		"revision": info,
	})
}

// handleListRevisions returns all revisions with current pointer position
func (s *Server) handleListRevisions(c *gin.Context) {
	_, workspaceID, ok := s.resolveWorkspaceFromRequest(c)
	if !ok {
		return
	}

	mgr := s.getOrCreateRevisionManager(workspaceID)
	revisions, pointer := mgr.List()

	c.JSON(http.StatusOK, gin.H{
		"revisions": revisions,
		"current":   pointer,
	})
}

// handleRecover attempts to recover a workspace from a crashed/failed state
func (s *Server) handleRecover(c *gin.Context) {
	workspacePath, _, ok := s.resolveWorkspaceFromRequest(c)
	if !ok {
		return
	}

	// Check package.json exists
	packageJSON := filepath.Join(workspacePath, "package.json")
	if _, err := os.Stat(packageJSON); os.IsNotExist(err) {
		c.JSON(http.StatusOK, gin.H{"success": false, "build_status": "no_package_json", "error": "No package.json found in workspace"})
		return
	}

	// Run npm install
	installCtx, installCancel := context.WithTimeout(c.Request.Context(), 60*time.Second)
	defer installCancel()

	installCmd := exec.CommandContext(installCtx, "npm", "install", "--ignore-scripts")
	installCmd.Dir = workspacePath
	if output, err := installCmd.CombinedOutput(); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success":      false,
			"build_status": "failed",
			"error":        fmt.Sprintf("npm install failed: %s", err.Error()),
			"build_output": string(output),
		})
		return
	}

	// Run npm run build
	buildCtx, buildCancel := context.WithTimeout(c.Request.Context(), 120*time.Second)
	defer buildCancel()

	buildCmd := exec.CommandContext(buildCtx, "npm", "run", "build")
	buildCmd.Dir = workspacePath
	buildOutput, buildErr := buildCmd.CombinedOutput()

	if buildErr != nil {
		c.JSON(http.StatusOK, gin.H{
			"success":      false,
			"build_status": "failed",
			"error":        fmt.Sprintf("npm run build failed: %s", buildErr.Error()),
			"build_output": string(buildOutput),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success":      true,
		"build_status": "success",
		"build_output": string(buildOutput),
	})
}

// handleClassEdit performs className-aware search/replace in TSX files
func (s *Server) handleClassEdit(c *gin.Context) {
	workspacePath, _, ok := s.resolveWorkspaceFromRequest(c)
	if !ok {
		return
	}

	var req struct {
		Path         string `json:"path" binding:"required"`
		OldClassName string `json:"old_class_name" binding:"required"`
		NewClassName string `json:"new_class_name" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Validate path using shared security utilities
	fullPath, err := s.validateAndResolvePath(workspacePath, req.Path)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid path"})
		return
	}
	if writeErr := s.validatePathForAPIWrite(req.Path); writeErr != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": writeErr.Error()})
		return
	}

	content, err := os.ReadFile(fullPath)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "File not found"})
		return
	}

	fileStr := string(content)
	oldPattern := fmt.Sprintf(`className="%s"`, req.OldClassName)
	newPattern := fmt.Sprintf(`className="%s"`, req.NewClassName)

	if !strings.Contains(fileStr, oldPattern) {
		c.JSON(http.StatusOK, gin.H{"success": false, "error": "className pattern not found", "replacements": 0})
		return
	}

	newContent := strings.Replace(fileStr, oldPattern, newPattern, 1)
	if err := os.WriteFile(fullPath, []byte(newContent), 0644); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to write file"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "replacements": 1})
}

// truncateLabel shortens a label to maxLen characters
func truncateLabel(label string, maxLen int) string {
	if len(label) <= maxLen {
		return label
	}
	return label[:maxLen-3] + "..."
}

// handleGetDefaultPrompts returns the hardcoded default system prompts
// so admin can load and edit them from the Laravel settings UI.
func (s *Server) handleGetDefaultPrompts(c *gin.Context) {
	fullPrompt, err := agent.BuildSystemPrompt(agent.PromptConfig{
		ProjectName:   "{{PROJECT_NAME}}",
		WorkspacePath: "/nonexistent",
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: "Failed to load system prompt: " + err.Error()})
		return
	}
	compactPrompt, err := agent.BuildSystemPrompt(agent.PromptConfig{
		ProjectName:   "{{PROJECT_NAME}}",
		WorkspacePath: "/nonexistent",
		Compact:       true,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: "Failed to load compact prompt: " + err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"system_prompt":  fullPrompt,
		"compact_prompt": compactPrompt,
	})
}
