package revision

import (
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

// FileSnapshot captures a single file's state
type FileSnapshot struct {
	Path    string `json:"path"`
	Content []byte `json:"-"`
	Size    int64  `json:"size"`
	Exists  bool   `json:"exists"`
}

// Revision represents a workspace state at a point in time
type Revision struct {
	ID        int            `json:"id"`
	Label     string         `json:"label"`
	Files     []FileSnapshot `json:"-"`
	FileCount int            `json:"file_count"`
	Timestamp time.Time      `json:"timestamp"`
}

// RevisionInfo is the API-safe representation (no file content)
type RevisionInfo struct {
	ID        int       `json:"id"`
	Label     string    `json:"label"`
	FileCount int       `json:"file_count"`
	Timestamp time.Time `json:"timestamp"`
}

func (r *Revision) toInfo() RevisionInfo {
	return RevisionInfo{
		ID:        r.ID,
		Label:     r.Label,
		FileCount: r.FileCount,
		Timestamp: r.Timestamp,
	}
}

// Manager manages revision snapshots for a workspace
type Manager struct {
	workspacePath string
	revisions     []Revision
	pointer       int // Current position in revision stack (-1 = no revisions)
	mu            sync.Mutex
	maxRevisions  int
	nextID        int
}

// NewManager creates a revision manager for the given workspace
func NewManager(workspacePath string) *Manager {
	return &Manager{
		workspacePath: workspacePath,
		pointer:       -1,
		maxRevisions:  20,
		nextID:        1,
	}
}

// CreateSnapshot captures the current state of src/ files.
// Call this BEFORE an agent run to save the "before" state.
func (m *Manager) CreateSnapshot(label string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	files, err := m.snapshotSrcFiles()
	if err != nil {
		return fmt.Errorf("failed to snapshot files: %w", err)
	}

	// If we're not at the end of the stack, truncate future revisions
	if m.pointer < len(m.revisions)-1 {
		m.revisions = m.revisions[:m.pointer+1]
	}

	rev := Revision{
		ID:        m.nextID,
		Label:     label,
		Files:     files,
		FileCount: len(files),
		Timestamp: time.Now(),
	}
	m.nextID++

	m.revisions = append(m.revisions, rev)
	m.pointer = len(m.revisions) - 1

	// Enforce max revisions
	if len(m.revisions) > m.maxRevisions {
		excess := len(m.revisions) - m.maxRevisions
		m.revisions = m.revisions[excess:]
		m.pointer -= excess
		if m.pointer < 0 {
			m.pointer = 0
		}
	}

	return nil
}

// Undo reverts workspace to the previous revision state.
// Decrements the pointer first, then restores the revision at the new pointer.
// Returns info about the restored revision, or error if at the beginning.
func (m *Manager) Undo() (*RevisionInfo, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.pointer <= 0 || len(m.revisions) == 0 {
		return nil, fmt.Errorf("nothing to undo")
	}

	m.pointer--
	rev := &m.revisions[m.pointer]
	if err := m.restoreRevision(rev); err != nil {
		m.pointer++ // rollback on failure
		return nil, fmt.Errorf("failed to restore revision: %w", err)
	}

	info := rev.toInfo()
	return &info, nil
}

// Redo moves forward to the next revision.
// Returns info about the restored revision, or error if at the end.
func (m *Manager) Redo() (*RevisionInfo, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.pointer >= len(m.revisions)-1 {
		return nil, fmt.Errorf("nothing to redo")
	}

	m.pointer++
	rev := &m.revisions[m.pointer]
	if err := m.restoreRevision(rev); err != nil {
		m.pointer-- // rollback pointer on failure
		return nil, fmt.Errorf("failed to restore revision: %w", err)
	}

	info := rev.toInfo()
	return &info, nil
}

// List returns all revisions with the current pointer position.
func (m *Manager) List() ([]RevisionInfo, int) {
	m.mu.Lock()
	defer m.mu.Unlock()

	infos := make([]RevisionInfo, len(m.revisions))
	for i, rev := range m.revisions {
		infos[i] = rev.toInfo()
	}
	return infos, m.pointer
}

// HasRevisions returns whether any snapshots exist
func (m *Manager) HasRevisions() bool {
	m.mu.Lock()
	defer m.mu.Unlock()
	return len(m.revisions) > 0
}

// restoreRevision writes all file snapshots from a revision to disk.
// Files that existed in the snapshot are written; files not in the snapshot
// that currently exist in src/ are removed.
func (m *Manager) restoreRevision(rev *Revision) error {
	srcDir := filepath.Join(m.workspacePath, "src")

	// Build set of files in the revision
	revFiles := make(map[string]bool)
	for _, snap := range rev.Files {
		revFiles[snap.Path] = true
	}

	// Remove files that exist now but weren't in the revision
	currentFiles, _ := m.walkSrcFiles()
	for _, path := range currentFiles {
		if !revFiles[path] {
			if err := os.Remove(filepath.Join(m.workspacePath, path)); err != nil && !os.IsNotExist(err) {
				return fmt.Errorf("failed to remove %s during restore: %w", path, err)
			}
		}
	}

	// Restore files from the revision
	for _, snap := range rev.Files {
		if !snap.Exists {
			// File was absent in this revision — remove it
			if err := os.Remove(filepath.Join(m.workspacePath, snap.Path)); err != nil && !os.IsNotExist(err) {
				return fmt.Errorf("failed to remove %s during restore: %w", snap.Path, err)
			}
			continue
		}
		fullPath := filepath.Join(m.workspacePath, snap.Path)
		dir := filepath.Dir(fullPath)
		if err := os.MkdirAll(dir, 0755); err != nil {
			return fmt.Errorf("failed to create directory %s: %w", dir, err)
		}
		if err := os.WriteFile(fullPath, snap.Content, 0644); err != nil {
			return fmt.Errorf("failed to write %s: %w", snap.Path, err)
		}
	}

	// Clean up empty directories in src/
	cleanEmptyDirs(srcDir)

	return nil
}

// snapshotSrcFiles walks src/ and captures all file contents
func (m *Manager) snapshotSrcFiles() ([]FileSnapshot, error) {
	srcDir := filepath.Join(m.workspacePath, "src")
	var snapshots []FileSnapshot

	err := filepath.WalkDir(srcDir, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return nil // skip unreadable paths
		}
		if d.IsDir() {
			if d.Name() == "node_modules" || strings.HasPrefix(d.Name(), ".") {
				return filepath.SkipDir
			}
			return nil
		}

		relPath, err := filepath.Rel(m.workspacePath, path)
		if err != nil {
			return nil
		}

		content, err := os.ReadFile(path)
		if err != nil {
			return nil // skip unreadable files
		}

		snapshots = append(snapshots, FileSnapshot{
			Path:    relPath,
			Content: content,
			Size:    int64(len(content)),
			Exists:  true,
		})
		return nil
	})

	if err != nil && !os.IsNotExist(err) {
		return nil, err
	}

	return snapshots, nil
}

// walkSrcFiles returns all file paths under src/ relative to workspace
func (m *Manager) walkSrcFiles() ([]string, error) {
	srcDir := filepath.Join(m.workspacePath, "src")
	var paths []string

	_ = filepath.WalkDir(srcDir, func(path string, d fs.DirEntry, err error) error {
		if err != nil || d.IsDir() {
			return nil
		}
		relPath, err := filepath.Rel(m.workspacePath, path)
		if err != nil {
			return nil
		}
		paths = append(paths, relPath)
		return nil
	})

	return paths, nil
}

// cleanEmptyDirs removes empty directories under the given path
func cleanEmptyDirs(root string) {
	_ = filepath.WalkDir(root, func(path string, d fs.DirEntry, err error) error {
		if err != nil || !d.IsDir() || path == root {
			return nil
		}
		entries, _ := os.ReadDir(path)
		if len(entries) == 0 {
			_ = os.Remove(path)
		}
		return nil
	})
}
