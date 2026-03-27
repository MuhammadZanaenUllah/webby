package main

import (
	"fmt"
	"os"
	"os/signal"
	"syscall"

	"webby-builder/internal/api"
	"webby-builder/internal/config"
	"webby-builder/internal/logging"
)

const version = "1.0.5"

func main() {
	// Load configuration with CLI flags
	cfg, err := config.LoadWithCLI(version)
	if err != nil {
		fmt.Printf("\n❌ ERROR: %s\n\n", err)
		fmt.Println("Run with --help to see usage information")
		os.Exit(1)
	}

	// Initialize logger with debug flag
	logger := logging.Init(cfg.Debug)
	if cfg.Debug {
		logger.Info("Debug mode enabled")
	}

	// Create storage directories (hardcoded to ./storage)
	if err := createDirectories(); err != nil {
		fmt.Printf("\n❌ ERROR: %s\n\n", err)
		fmt.Println("Failed to create storage directories")
		os.Exit(1)
	}

	// Create and start server
	server := api.NewServer(api.ServerConfig{
		Host:          cfg.Host,
		Port:          fmt.Sprintf("%d", cfg.Port),
		ServerKey:     cfg.Key,
		WorkspacePath: "./storage/workspaces",
		Version:       version,
		Debug:         cfg.Debug,
	}, logger)

	// Start HTTP server in goroutine
	go func() {
		addr := fmt.Sprintf("%s:%d", cfg.Host, cfg.Port)
		if err := server.RunAddr(addr); err != nil {
			fmt.Printf("\n❌ ERROR: %s\n\n", err)
			fmt.Println("Server failed to start")
			os.Exit(1)
		}
	}()

	// Print startup banner
	fmt.Println()
	fmt.Println("🌐 WEBBY BUILD SERVER")
	fmt.Printf("📦 Version:   %s\n", version)
	fmt.Printf("🔌 Port:      %d\n", cfg.Port)
	fmt.Println()

	// Wait for interrupt signal
	logging.Info("Server is running. Press Ctrl+C to stop.")
	waitForShutdown()

	logging.Info("Shutting down gracefully...")
}

// createDirectories ensures all required directories exist
func createDirectories() error {
	dirs := []string{
		"./storage/workspaces",
		"./storage/logs",
	}

	for _, dir := range dirs {
		if err := os.MkdirAll(dir, 0755); err != nil {
			return err
		}
	}

	return nil
}

func waitForShutdown() {
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)
	<-sigChan
}
