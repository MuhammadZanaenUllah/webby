package logging

import (
	"fmt"
	"sort"
	"strings"

	"github.com/sirupsen/logrus"
)

const (
	// Session separator constants
	sessionSeparatorWidth = 80
	sessionSeparatorChar  = "─"
)

// StripHTMLTags removes HTML tags from a string (exported for use by other packages)
func StripHTMLTags(s string) string {
	var result strings.Builder
	inTag := false
	for _, r := range s {
		switch r {
		case '<':
			inTag = true
		case '>':
			inTag = false
		default:
			if !inTag {
				result.WriteRune(r)
			}
		}
	}
	return result.String()
}

// TruncateForLog truncates long strings for logging and strips HTML tags
func TruncateForLog(s string, maxLen int) string {
	// Strip HTML tags first
	s = StripHTMLTags(s)
	// Then truncate
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen] + "..."
}

// FormatArgsForLog formats tool arguments, truncating long values
// Returns something like: path=src/app/page.tsx, content=[2450 chars]
func FormatArgsForLog(args map[string]interface{}, maxValueLen int) string {
	if len(args) == 0 {
		return "{}"
	}

	// Get sorted keys for consistent output
	keys := make([]string, 0, len(args))
	for k := range args {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	var parts []string
	for _, key := range keys {
		value := args[key]
		formattedValue := formatArgValue(value, maxValueLen)
		parts = append(parts, fmt.Sprintf("%s=%s", key, formattedValue))
	}

	return strings.Join(parts, ", ")
}

// formatArgValue formats a single argument value, truncating if needed
func formatArgValue(value interface{}, maxLen int) string {
	switch v := value.(type) {
	case string:
		if len(v) > maxLen {
			return fmt.Sprintf("[%d chars]", len(v))
		}
		// Escape newlines for single-line display
		escaped := strings.ReplaceAll(v, "\n", "\\n")
		if len(escaped) > maxLen {
			return escaped[:maxLen] + "..."
		}
		return escaped
	case bool:
		return fmt.Sprintf("%t", v)
	case float64:
		// Check if it's a whole number
		if v == float64(int64(v)) {
			return fmt.Sprintf("%d", int64(v))
		}
		return fmt.Sprintf("%.2f", v)
	case int, int64, int32:
		return fmt.Sprintf("%d", v)
	case []interface{}:
		if len(v) == 0 {
			return "[]"
		}
		return fmt.Sprintf("[%d items]", len(v))
	case map[string]interface{}:
		return fmt.Sprintf("{%d keys}", len(v))
	case nil:
		return "null"
	default:
		str := fmt.Sprintf("%v", v)
		if len(str) > maxLen {
			return str[:maxLen] + "..."
		}
		return str
	}
}

// LogSessionStart logs a visual separator and session start information
func LogSessionStart(logger *logrus.Logger, sessionID, workspaceID, goal string, maxIterations int) {
	if logger == nil {
		return
	}

	separator := strings.Repeat(sessionSeparatorChar, sessionSeparatorWidth)

	// Print separator line
	logger.Info(separator)
	logger.WithFields(logrus.Fields{
		"session_id":     sessionID,
		"workspace_id":   workspaceID,
		"max_iterations": maxIterations,
		"goal":           TruncateForLog(goal, 100),
	}).Info("SESSION START")
	logger.Info(separator)
}

// LogSessionEnd logs a visual separator and session completion information
func LogSessionEnd(logger *logrus.Logger, sessionID string, iterations, tokens int, filesChanged bool, status string) {
	if logger == nil {
		return
	}

	separator := strings.Repeat(sessionSeparatorChar, sessionSeparatorWidth)

	logger.Info(separator)
	logger.WithFields(logrus.Fields{
		"session_id":    sessionID,
		"iterations":    iterations,
		"tokens":        tokens,
		"files_changed": filesChanged,
		"status":        status,
	}).Info("SESSION END")
	logger.Info(separator)
}

// LogSessionError logs a session error with visual separation
func LogSessionError(logger *logrus.Logger, sessionID string, err error, context string) {
	if logger == nil {
		return
	}

	errMsg := ""
	if err != nil {
		errMsg = err.Error()
	}

	logger.WithFields(logrus.Fields{
		"session_id": sessionID,
		"error":      errMsg,
		"context":    context,
	}).Error("Session error")
}

// LogIterationStart logs the start of an agent iteration
func LogIterationStart(logger *logrus.Logger, sessionID string, iteration int) {
	if logger == nil {
		return
	}

	logger.WithFields(logrus.Fields{
		"session_id": sessionID,
		"iteration":  iteration,
	}).Debug("─── Iteration start ───")
}

// LogToolExecution logs tool execution with consistent formatting
func LogToolExecution(logger *logrus.Logger, sessionID, toolName string, args map[string]interface{}, isReadOnly bool) {
	if logger == nil {
		return
	}

	toolType := "write"
	if isReadOnly {
		toolType = "read"
	}

	logger.WithFields(logrus.Fields{
		"session_id": sessionID,
		"tool":       toolName,
		"type":       toolType,
		"args":       FormatArgsForLog(args, 150),
	}).Debug("Executing tool")
}

// LogToolResult logs tool execution result with consistent formatting
func LogToolResult(logger *logrus.Logger, sessionID, toolName string, success bool, duration string) {
	if logger == nil {
		return
	}

	logger.WithFields(logrus.Fields{
		"session_id": sessionID,
		"tool":       toolName,
		"success":    success,
		"duration":   duration,
	}).Debug("Tool completed")
}
