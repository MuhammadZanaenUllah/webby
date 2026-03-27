package api

import (
	"time"

	"webby-builder/internal/logging"
	"webby-builder/internal/models"

	"github.com/sirupsen/logrus"
)

const (
	// CleanupInterval is how often the cleanup worker runs
	CleanupInterval = 5 * time.Minute

	// SessionTTL is how long to keep completed/failed/cancelled sessions before cleanup
	SessionTTL = 30 * time.Minute
)

// StartCleanupWorker starts a background goroutine that periodically cleans up stale sessions
func (s *Server) StartCleanupWorker() {
	go func() {
		ticker := time.NewTicker(CleanupInterval)
		defer ticker.Stop()

		for range ticker.C {
			s.cleanupStaleSessions()
		}
	}()

	logging.WithFields(logrus.Fields{
		"interval": CleanupInterval.String(),
		"ttl":      SessionTTL.String(),
	}).Info("Session cleanup worker started")
}

// cleanupStaleSessions removes sessions that are in a terminal state
// and have been inactive for longer than SessionTTL
func (s *Server) cleanupStaleSessions() {
	s.mu.Lock()
	defer s.mu.Unlock()

	now := time.Now()
	var removed int

	for sessionID, session := range s.sessions {
		// Only clean up sessions in terminal states
		status := session.GetStatus()
		if !isTerminalStatus(status) {
			continue
		}

		// Get session stats to check last activity
		stats := session.GetStats()
		lastActivity, ok := stats["last_activity"].(time.Time)
		if !ok {
			continue
		}

		// Remove if session has been inactive for longer than TTL
		if now.Sub(lastActivity) > SessionTTL {
			// Close the session's streamer to release resources
			session.Close()
			delete(s.sessions, sessionID)
			removed++
		}
	}

	if removed > 0 {
		logging.WithFields(logrus.Fields{
			"sessions_removed": removed,
		}).Info("Cleaned up stale sessions")
	}
}

// isTerminalStatus returns true if the status indicates the session is done
func isTerminalStatus(status models.SessionStatus) bool {
	switch status {
	case models.StatusCompleted, models.StatusFailed, models.StatusCancelled:
		return true
	default:
		return false
	}
}

// GetSessionCount returns the total number of sessions (for monitoring)
func (s *Server) GetSessionCount() int {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return len(s.sessions)
}
