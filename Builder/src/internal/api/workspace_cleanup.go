package api

import (
	"net/http"
	"os"
	"path/filepath"

	"webby-builder/internal/models"

	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
)

// handleListWorkspaces returns all workspace IDs on disk.
// GET /api/workspaces
func (s *Server) handleListWorkspaces(c *gin.Context) {
	entries, err := os.ReadDir(s.workspacePath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: "Failed to read workspace directory: " + err.Error(),
		})
		return
	}

	workspaceIDs := []string{}
	for _, entry := range entries {
		if entry.IsDir() {
			workspaceIDs = append(workspaceIDs, entry.Name())
		}
	}

	c.JSON(http.StatusOK, models.ListWorkspacesResponse{
		WorkspaceIDs: workspaceIDs,
		Count:        len(workspaceIDs),
	})
}

// handleCleanupWorkspaces bulk deletes workspaces by ID.
// POST /api/cleanup-workspaces
func (s *Server) handleCleanupWorkspaces(c *gin.Context) {
	var req models.CleanupWorkspacesRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: err.Error()})
		return
	}

	if len(req.WorkspaceIDs) == 0 {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: "workspace_ids cannot be empty"})
		return
	}

	response := models.CleanupWorkspacesResponse{
		Results: make([]models.CleanupWorkspaceResult, 0, len(req.WorkspaceIDs)),
	}

	for _, workspaceID := range req.WorkspaceIDs {
		result := s.cleanupSingleWorkspace(workspaceID)
		response.Results = append(response.Results, result)

		switch result.Status {
		case "deleted":
			response.Deleted++
		case "not_found":
			response.NotFound++
		case "skipped":
			response.Skipped++
		case "failed":
			response.Failed++
		}
	}

	s.logger.WithFields(logrus.Fields{
		"requested": len(req.WorkspaceIDs),
		"deleted":   response.Deleted,
		"not_found": response.NotFound,
		"skipped":   response.Skipped,
		"failed":    response.Failed,
	}).Info("Workspace cleanup completed")

	c.JSON(http.StatusOK, response)
}

// cleanupSingleWorkspace handles deletion of a single workspace.
func (s *Server) cleanupSingleWorkspace(workspaceID string) models.CleanupWorkspaceResult {
	if s.hasActiveSessionForWorkspace(workspaceID) {
		return models.CleanupWorkspaceResult{
			WorkspaceID: workspaceID,
			Status:      "skipped",
			Reason:      "active session exists",
		}
	}

	workspacePath := filepath.Join(s.workspacePath, workspaceID)

	if _, err := os.Stat(workspacePath); os.IsNotExist(err) {
		s.deleteLogFile(workspaceID)
		return models.CleanupWorkspaceResult{
			WorkspaceID: workspaceID,
			Status:      "not_found",
		}
	}

	if err := os.RemoveAll(workspacePath); err != nil {
		return models.CleanupWorkspaceResult{
			WorkspaceID: workspaceID,
			Status:      "failed",
			Reason:      err.Error(),
		}
	}

	s.deleteLogFile(workspaceID)

	return models.CleanupWorkspaceResult{
		WorkspaceID: workspaceID,
		Status:      "deleted",
	}
}

// hasActiveSessionForWorkspace checks if any session for the given workspace is active.
func (s *Server) hasActiveSessionForWorkspace(workspaceID string) bool {
	s.mu.RLock()
	defer s.mu.RUnlock()

	for _, session := range s.sessions {
		if session.WorkspaceID == workspaceID && session.IsActive() {
			return true
		}
	}
	return false
}

// deleteLogFile removes the log file for a workspace.
func (s *Server) deleteLogFile(workspaceID string) {
	logPath := filepath.Join("./storage/logs", workspaceID+".log")
	_ = os.Remove(logPath)
}
