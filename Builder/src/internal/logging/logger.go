package logging

import (
	"fmt"
	"io"
	"os"

	"github.com/sirupsen/logrus"
)

// Logger is the global logger instance
var Logger *logrus.Logger

// Init initializes the global logger with the specified debug mode
func Init(debug bool) *logrus.Logger {
	logger := logrus.New()
	logger.SetOutput(os.Stdout)
	logger.SetFormatter(&PrettyFormatter{
		TimestampFormat: "15:04:05.000",
	})

	if debug {
		logger.SetLevel(logrus.DebugLevel)
	} else {
		logger.SetLevel(logrus.InfoLevel)
	}

	Logger = logger
	return logger
}

// NewWorkspaceLogger creates a logger that writes to both stdout and a workspace log file.
// Returns the logger and a cleanup function to close the file.
func NewWorkspaceLogger(workspaceID string, debug bool) (*logrus.Logger, func()) {
	logger := logrus.New()
	logger.SetFormatter(&PrettyFormatter{TimestampFormat: "15:04:05.000"})

	if debug {
		logger.SetLevel(logrus.DebugLevel)
	} else {
		logger.SetLevel(logrus.InfoLevel)
	}

	// Note: Log file is already named by workspace_id (./storage/logs/{workspaceID}.log)
	// Callers should include workspace_id in log entries using WithField for consistency

	// Create log file
	logPath := fmt.Sprintf("./storage/logs/%s.log", workspaceID)
	file, err := os.OpenFile(logPath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
	if err != nil {
		// Fallback to stdout only
		logger.SetOutput(os.Stdout)
		return logger, func() {}
	}

	// Write to both stdout and file
	logger.SetOutput(io.MultiWriter(os.Stdout, file))

	cleanup := func() {
		_ = file.Close()
	}

	return logger, cleanup
}

// Info logs at INFO level
func Info(msg string, args ...interface{}) {
	if Logger != nil {
		if len(args) > 0 {
			Logger.WithFields(argsToFields(args...)).Info(msg)
		} else {
			Logger.Info(msg)
		}
	}
}

// Debug logs at DEBUG level
func Debug(msg string, args ...interface{}) {
	if Logger != nil {
		if len(args) > 0 {
			Logger.WithFields(argsToFields(args...)).Debug(msg)
		} else {
			Logger.Debug(msg)
		}
	}
}

// Warn logs at WARN level
func Warn(msg string, args ...interface{}) {
	if Logger != nil {
		if len(args) > 0 {
			Logger.WithFields(argsToFields(args...)).Warn(msg)
		} else {
			Logger.Warn(msg)
		}
	}
}

// Error logs at ERROR level
func Error(msg string, args ...interface{}) {
	if Logger != nil {
		if len(args) > 0 {
			Logger.WithFields(argsToFields(args...)).Error(msg)
		} else {
			Logger.Error(msg)
		}
	}
}

// WithFields returns a logger entry with the given fields
func WithFields(fields logrus.Fields) *logrus.Entry {
	if Logger != nil {
		return Logger.WithFields(fields)
	}
	noop := logrus.New()
	noop.SetOutput(io.Discard)
	return noop.WithFields(fields)
}

// argsToFields converts key-value pairs to logrus.Fields
// Expects pairs of (key, value) where key is a string
func argsToFields(args ...interface{}) logrus.Fields {
	fields := make(logrus.Fields)
	for i := 0; i < len(args)-1; i += 2 {
		if key, ok := args[i].(string); ok {
			fields[key] = args[i+1]
		}
	}
	return fields
}
