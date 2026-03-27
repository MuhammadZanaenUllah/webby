package executor

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// ResolveAndValidatePath validates a relative path and resolves it to an absolute path
// within the workspace, following symlinks to detect path escapes.
// Returns the resolved absolute path or an error if the path would escape the workspace.
func ResolveAndValidatePath(workspacePath, relativePath string) (string, error) {
	// Reject obvious traversal patterns
	cleaned := filepath.Clean(relativePath)
	if strings.HasPrefix(cleaned, "..") || strings.HasPrefix(cleaned, "/") {
		return "", fmt.Errorf("path traversal not allowed: %s", relativePath)
	}

	// Resolve workspace path itself (handles macOS /tmp -> /private/tmp)
	// If workspace doesn't exist yet, fall back to filepath.Clean
	realWorkspace, err := filepath.EvalSymlinks(workspacePath)
	if err != nil {
		if os.IsNotExist(err) {
			realWorkspace = filepath.Clean(workspacePath)
		} else {
			return "", fmt.Errorf("cannot resolve workspace path: %w", err)
		}
	}

	fullPath := filepath.Join(realWorkspace, cleaned)

	// Check if the file exists
	if _, err := os.Lstat(fullPath); err == nil {
		// File exists — resolve symlinks and validate
		realPath, err := filepath.EvalSymlinks(fullPath)
		if err != nil {
			return "", fmt.Errorf("cannot resolve path: %w", err)
		}
		if !strings.HasPrefix(realPath, realWorkspace+string(filepath.Separator)) && realPath != realWorkspace {
			return "", fmt.Errorf("path escapes workspace boundary: %s", relativePath)
		}
		return realPath, nil
	}

	// File doesn't exist — resolve the parent directory
	parentDir := filepath.Dir(fullPath)
	if _, err := os.Stat(parentDir); err == nil {
		realParent, err := filepath.EvalSymlinks(parentDir)
		if err != nil {
			return "", fmt.Errorf("cannot resolve parent path: %w", err)
		}
		if !strings.HasPrefix(realParent, realWorkspace+string(filepath.Separator)) && realParent != realWorkspace {
			return "", fmt.Errorf("path escapes workspace boundary: %s", relativePath)
		}
		// Return the resolved path (parent is real, file is new)
		return filepath.Join(realParent, filepath.Base(fullPath)), nil
	}

	// Parent doesn't exist either — just validate the cleaned path stays in workspace
	if !strings.HasPrefix(fullPath, realWorkspace+string(filepath.Separator)) && fullPath != realWorkspace {
		return "", fmt.Errorf("path traversal not allowed: %s", relativePath)
	}
	return fullPath, nil
}
