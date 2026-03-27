package logging

import (
	"fmt"
	"strings"
	"time"

	"github.com/sirupsen/logrus"
)

const (
	// Colors
	Reset  = "\033[0m"
	Red    = "\033[31m"
	Green  = "\033[32m"
	Yellow = "\033[33m"
	Blue   = "\033[34m"
	Purple = "\033[35m"
	Cyan   = "\033[36m"
	Gray   = "\033[37m"
	Bold   = "\033[1m"

	// Background colors
	BgRed    = "\033[41m"
	BgGreen  = "\033[42m"
	BgYellow = "\033[43m"
	BgBlue   = "\033[44m"
)

// PrettyFormatter implements a beautiful formatter for logrus
type PrettyFormatter struct {
	// TimestampFormat to use for display when a full timestamp is printed
	TimestampFormat string

	// The fields are sorted by default for a consistent output. For applications
	// that log extremely frequently and don't use the JSON formatter this may not
	// be desired.
	DisableSorting bool

	// DisableColors allows users to disable colors when outputting to a TTY
	DisableColors bool
}

// Format implements logrus.Formatter interface
func (f *PrettyFormatter) Format(entry *logrus.Entry) ([]byte, error) {
	var b strings.Builder

	timestampFormat := f.TimestampFormat
	if timestampFormat == "" {
		timestampFormat = "15:04:05.000"
	}

	// Timestamp
	timeStr := entry.Time.Format(timestampFormat)
	if f.DisableColors {
		b.WriteString(timeStr)
	} else {
		fmt.Fprintf(&b, "%s%s%s", Gray, timeStr, Reset)
	}

	// Level with color
	level := strings.ToUpper(entry.Level.String())
	if !f.DisableColors {
		levelColor := f.getLevelColor(entry.Level)
		fmt.Fprintf(&b, " [%s%-5s%s]", levelColor, level, Reset)
	} else {
		fmt.Fprintf(&b, " [%-5s]", level)
	}

	// Session ID (truncated if present)
	if sessionID, ok := entry.Data["session_id"]; ok {
		sessionStr := f.truncateSessionID(fmt.Sprintf("%v", sessionID))
		if !f.DisableColors {
			fmt.Fprintf(&b, " %s[%s]%s", Purple, sessionStr, Reset)
		} else {
			fmt.Fprintf(&b, " [%s]", sessionStr)
		}
	}

	// Main message
	if !f.DisableColors {
		fmt.Fprintf(&b, " %s%s%s", Bold, entry.Message, Reset)
	} else {
		fmt.Fprintf(&b, " %s", entry.Message)
	}

	// Additional context from fields
	details := f.formatFields(entry.Data)
	if len(details) > 0 {
		if !f.DisableColors {
			fmt.Fprintf(&b, " %s(%s)%s", Gray, strings.Join(details, ", "), Reset)
		} else {
			fmt.Fprintf(&b, " (%s)", strings.Join(details, ", "))
		}
	}

	// URL on new line if present
	if url, ok := entry.Data["url"]; ok {
		if !f.DisableColors {
			fmt.Fprintf(&b, "\n    %s→%s %v", Gray, Reset, url)
		} else {
			fmt.Fprintf(&b, "\n    → %v", url)
		}
	}

	b.WriteString("\n")
	return []byte(b.String()), nil
}

func (f *PrettyFormatter) getLevelColor(level logrus.Level) string {
	if f.DisableColors {
		return ""
	}

	switch level {
	case logrus.FatalLevel, logrus.PanicLevel:
		return Red + Bold
	case logrus.ErrorLevel:
		return Red
	case logrus.WarnLevel:
		return Yellow
	case logrus.InfoLevel:
		return Green
	case logrus.DebugLevel:
		return Cyan
	default:
		return Reset
	}
}

func (f *PrettyFormatter) truncateSessionID(sessionID string) string {
	if len(sessionID) > 20 {
		return sessionID[:8] + "..." + sessionID[len(sessionID)-8:]
	}
	return sessionID
}

func (f *PrettyFormatter) formatFields(fields logrus.Fields) []string {
	var details []string

	// Skip common fields that are handled separately
	skipFields := map[string]bool{
		"session_id": true,
		"time":       true,
		"level":      true,
		"msg":        true,
		"url":        true,
	}

	// Priority fields to show first (webby-builder specific)
	priorityFields := []string{
		"error", "status", "iteration", "tool", "model", "tokens",
		"workspace_id", "duration", "messages", "tool_calls", "stop_reason",
		"success", "prompt_tokens", "comp_tokens", "total_tokens", "files_changed",
		"max_iterations", "port", "method", "path", "client", "endpoint",
		"sessions_removed", "interval", "ttl", "remaining_credits", "content",
	}

	// Add priority fields first
	for _, field := range priorityFields {
		if value, ok := fields[field]; ok {
			detail := f.formatField(field, value)
			if detail != "" {
				details = append(details, detail)
			}
		}
	}

	// Add remaining fields
	for key, value := range fields {
		if !skipFields[key] && !f.contains(priorityFields, key) {
			detail := f.formatField(key, value)
			if detail != "" {
				details = append(details, detail)
			}
		}
	}

	return details
}

func (f *PrettyFormatter) formatField(key string, value interface{}) string {
	if f.DisableColors {
		return f.formatFieldNoColor(key, value)
	}

	switch key {
	case "error":
		return fmt.Sprintf("%serror%s=%s%v%s", Red, Reset, Red, value, Reset)
	case "status":
		status := fmt.Sprintf("%v", value)
		color := Green
		if strings.Contains(status, "fail") || strings.Contains(status, "error") {
			color = Red
		} else if strings.Contains(status, "pending") || strings.Contains(status, "running") {
			color = Yellow
		}
		return fmt.Sprintf("%s%s%s=%s%v%s", color, key, Reset, color, value, Reset)
	case "duration":
		duration := f.formatDuration(value)
		if duration != "" {
			return fmt.Sprintf("%sduration%s=%s", Cyan, Reset, duration)
		}
	case "iteration", "iterations":
		return fmt.Sprintf("%siteration%s=%s%v%s", Yellow, Reset, Yellow, value, Reset)
	case "tool":
		return fmt.Sprintf("%stool%s=%s%v%s", Blue, Reset, Blue, value, Reset)
	case "model":
		return fmt.Sprintf("%smodel%s=%v", Cyan, Reset, value)
	case "tokens", "total_tokens":
		return fmt.Sprintf("%stokens%s=%v", Green, Reset, value)
	case "prompt_tokens":
		return fmt.Sprintf("%sprompt_tokens%s=%v", Cyan, Reset, value)
	case "comp_tokens":
		return fmt.Sprintf("%scomp_tokens%s=%v", Cyan, Reset, value)
	case "workspace_id":
		return fmt.Sprintf("%sworkspace_id%s=%v", Purple, Reset, value)
	case "tool_calls":
		return fmt.Sprintf("%stool_calls%s=%v", Blue, Reset, value)
	case "success":
		successVal := fmt.Sprintf("%v", value)
		color := Green
		if successVal == "false" {
			color = Red
		}
		return fmt.Sprintf("%ssuccess%s=%s%v%s", color, Reset, color, value, Reset)
	case "files_changed":
		return fmt.Sprintf("%sfiles_changed%s=%v", Purple, Reset, value)
	case "messages":
		return fmt.Sprintf("%smessages%s=%v", Cyan, Reset, value)
	case "max_iterations":
		return fmt.Sprintf("%smax_iterations%s=%v", Yellow, Reset, value)
	case "stop_reason":
		return fmt.Sprintf("%sstop_reason%s=%v", Gray, Reset, value)
	case "port":
		return fmt.Sprintf("%sport%s=%v", Blue, Reset, value)
	case "method":
		return fmt.Sprintf("%s%v%s", Yellow, value, Reset)
	case "endpoint":
		return fmt.Sprintf("%sendpoint%s=%v", Cyan, Reset, value)
	case "path":
		return fmt.Sprintf("%spath%s=%v", Cyan, Reset, value)
	case "client":
		return fmt.Sprintf("%sclient%s=%v", Gray, Reset, value)
	case "sessions_removed":
		return fmt.Sprintf("%ssessions_removed%s=%s%v%s", Green, Reset, Green, value, Reset)
	case "interval":
		return fmt.Sprintf("%sinterval%s=%v", Cyan, Reset, value)
	case "ttl":
		return fmt.Sprintf("%sttl%s=%v", Cyan, Reset, value)
	case "remaining_credits":
		return fmt.Sprintf("%sremaining_credits%s=%s%v%s", Yellow, Reset, Yellow, value, Reset)
	case "content":
		// Truncate content for display and show in gray
		contentStr := fmt.Sprintf("%v", value)
		if len(contentStr) > 100 {
			contentStr = contentStr[:100] + "..."
		}
		return fmt.Sprintf("%scontent%s=%s%q%s", Gray, Reset, Gray, contentStr, Reset)
	default:
		if value != nil && fmt.Sprintf("%v", value) != "" {
			return fmt.Sprintf("%s=%v", key, value)
		}
	}
	return ""
}

func (f *PrettyFormatter) formatFieldNoColor(key string, value interface{}) string {
	switch key {
	case "duration":
		duration := f.formatDuration(value)
		if duration != "" {
			return fmt.Sprintf("duration=%s", duration)
		}
	case "iteration", "iterations":
		return fmt.Sprintf("iteration=%v", value)
	case "content":
		// Truncate content for display
		contentStr := fmt.Sprintf("%v", value)
		if len(contentStr) > 100 {
			contentStr = contentStr[:100] + "..."
		}
		return fmt.Sprintf("content=%q", contentStr)
	default:
		if value != nil && fmt.Sprintf("%v", value) != "" {
			return fmt.Sprintf("%s=%v", key, value)
		}
	}
	return ""
}

func (f *PrettyFormatter) formatDuration(value interface{}) string {
	switch v := value.(type) {
	case int64:
		d := time.Duration(v)
		return f.formatDurationValue(d)
	case int:
		d := time.Duration(v)
		return f.formatDurationValue(d)
	case time.Duration:
		return f.formatDurationValue(v)
	case string:
		if d, err := time.ParseDuration(v); err == nil {
			return f.formatDurationValue(d)
		}
		// If it's already formatted (e.g., "1.23s"), return as-is
		return v
	}
	return ""
}

func (f *PrettyFormatter) formatDurationValue(d time.Duration) string {
	if d == 0 {
		return ""
	}

	if d < time.Millisecond {
		return fmt.Sprintf("%.2fμs", float64(d.Nanoseconds())/1000)
	} else if d < time.Second {
		return fmt.Sprintf("%.2fms", float64(d.Nanoseconds())/1e6)
	}
	return fmt.Sprintf("%.2fs", d.Seconds())
}

func (f *PrettyFormatter) contains(slice []string, item string) bool {
	for _, s := range slice {
		if s == item {
			return true
		}
	}
	return false
}
