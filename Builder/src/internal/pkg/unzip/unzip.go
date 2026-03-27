package unzip

import (
	"archive/zip"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
)

// Extract extracts a ZIP file to the destination directory
func Extract(src, dest string) error {
	// Open the ZIP file
	r, err := zip.OpenReader(src)
	if err != nil {
		return fmt.Errorf("opening zip file: %w", err)
	}
	defer func() { _ = r.Close() }()

	// Ensure destination directory exists
	if err := os.MkdirAll(dest, 0755); err != nil {
		return fmt.Errorf("creating destination directory: %w", err)
	}

	// Clean destination path for security checks
	cleanDest := filepath.Clean(dest)

	// Extract each file
	for _, f := range r.File {
		// Build the full path for this file
		path := filepath.Join(dest, f.Name)

		// Security check: ensure the path is within the destination directory
		// This prevents ZipSlip attacks
		if !strings.HasPrefix(path, cleanDest+string(os.PathSeparator)) {
			return fmt.Errorf("invalid file path (ZipSlip detected): %s", f.Name)
		}

		if f.FileInfo().IsDir() {
			// Create directory
			if err := os.MkdirAll(path, f.Mode()); err != nil {
				return fmt.Errorf("creating directory %s: %w", path, err)
			}
			continue
		}

		// Create parent directory for file
		if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
			return fmt.Errorf("creating parent directory for %s: %w", path, err)
		}

		// Extract the file
		if err := extractFile(f, path); err != nil {
			return fmt.Errorf("extracting file %s: %w", f.Name, err)
		}
	}

	return nil
}

// extractFile extracts a single file from the ZIP archive
func extractFile(f *zip.File, destPath string) error {
	// Open the file in the ZIP archive
	rc, err := f.Open()
	if err != nil {
		return err
	}
	defer func() { _ = rc.Close() }()

	// Create the destination file
	outFile, err := os.OpenFile(destPath, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, f.Mode())
	if err != nil {
		return err
	}
	defer func() { _ = outFile.Close() }()

	// Copy the file contents
	_, err = io.Copy(outFile, rc)
	return err
}
