package api

import (
	"github.com/gin-gonic/gin"
)

// ServerConfig holds server configuration
type ServerConfig struct {
	Host          string
	Port          string
	ServerKey     string
	WorkspacePath string
	Version       string
	Debug         bool
}

// SetupRouter configures the Gin router
func (s *Server) SetupRouter() *gin.Engine {
	gin.SetMode(gin.ReleaseMode)
	r := gin.New()

	// Global middleware
	r.Use(gin.Recovery())
	r.Use(LoggerMiddleware())

	// Root endpoint (no auth required)
	r.GET("/", s.handleRoot)

	// API routes (auth required)
	api := r.Group("/api")
	api.Use(ServerKeyAuth(s.serverKey))
	api.Use(RequestSizeLimit(5 * 1024 * 1024)) // 5MB request body limit
	{
		// Session management
		api.POST("/run", s.handleRun)
		api.POST("/stop/:session_id", s.handleStop)
		api.GET("/status/:session_id", s.handleStatus)

		// File operations (both patterns resolve workspace from filesystem)
		api.GET("/files/:session_id", s.handleListFiles)
		api.GET("/files-workspace/:workspace_id", s.handleListFiles)
		api.GET("/file/:session_id", s.handleGetFile)
		api.GET("/file-workspace/:workspace_id", s.handleGetFile)
		api.PUT("/file/:session_id", s.handleUpdateFile)
		api.PUT("/file-workspace/:workspace_id", s.handleUpdateFile)

		// Theme operations
		api.PUT("/theme-workspace/:workspace_id", s.handleApplyTheme)

		// Build operations (both patterns resolve workspace from filesystem)
		api.POST("/build/:session_id", s.handleBuild)
		api.POST("/build-workspace/:workspace_id", s.handleBuild)
		api.GET("/build-output/:session_id", s.handleBuildOutput)
		api.GET("/build-output-workspace/:workspace_id", s.handleBuildOutput)

		// Other
		api.POST("/reset/:session_id", s.handleReset)
		api.GET("/suggestions/:session_id", s.handleSuggestions)
		api.POST("/chat/:session_id", s.handleChat)

		// Class editing (visual style editor)
		api.PATCH("/class-edit-workspace/:workspace_id", s.handleClassEdit)

		// Revision management (undo/redo)
		api.POST("/undo-workspace/:workspace_id", s.handleUndo)
		api.POST("/redo-workspace/:workspace_id", s.handleRedo)
		api.GET("/revisions-workspace/:workspace_id", s.handleListRevisions)

		// Recovery
		api.POST("/recover-workspace/:workspace_id", s.handleRecover)

		// Workspace management
		api.GET("/workspaces", s.handleListWorkspaces)
		api.POST("/cleanup-workspaces", s.handleCleanupWorkspaces)

		// Prompt management
		api.GET("/default-prompts", s.handleGetDefaultPrompts)
	}

	return r
}
