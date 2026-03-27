.PHONY: help build build-linux build-arm64 build-macos zip run dev test test-coverage lint fmt clean tidy update install-tools deploy-check setup

# Variables
BINARY_NAME=webby-builder
BINARY_DIR=dist
MAIN_FILE=app.go
BUILD_FLAGS=-ldflags="-s -w"

# Colors for output
COLOR_RESET=\033[0m
COLOR_BLUE=\033[36m
COLOR_GREEN=\033[32m
COLOR_YELLOW=\033[33m

# Default target - show help
.DEFAULT_GOAL := help

help: ## Show this help message
	@echo "$(COLOR_BLUE)Available commands:$(COLOR_RESET)"
	@grep -E '^[a-zA-Z0-9_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(COLOR_GREEN)%-20s$(COLOR_RESET) %s\n", $$1, $$2}'

# Development commands
build: ## Build development binary
	@echo "$(COLOR_BLUE)🔨 Building $(BINARY_NAME)...$(COLOR_RESET)"
	@mkdir -p $(BINARY_DIR)
	@CGO_ENABLED=0 go build $(BUILD_FLAGS) -o $(BINARY_DIR)/$(BINARY_NAME) $(MAIN_FILE)
	@echo "$(COLOR_GREEN)✅ Build complete: $(BINARY_DIR)/$(BINARY_NAME)$(COLOR_RESET)"

run: build ## Build and run the application
	@echo "$(COLOR_BLUE)🚀 Running $(BINARY_NAME)...$(COLOR_RESET)"
	@./$(BINARY_DIR)/$(BINARY_NAME)

dev: ## Run with live reload (requires air)
	@if command -v air > /dev/null; then \
		echo "$(COLOR_BLUE)🚀 Starting with live reload...$(COLOR_RESET)"; \
		air; \
	else \
		echo "$(COLOR_YELLOW)⚠️  'air' not installed. Run 'make install-tools' to enable live reload$(COLOR_RESET)"; \
		go run $(MAIN_FILE); \
	fi

# Testing commands
test: ## Run all tests
	@echo "$(COLOR_BLUE)🧪 Running tests...$(COLOR_RESET)"
	@go test ./... -v
	@echo "$(COLOR_GREEN)✅ Tests complete$(COLOR_RESET)"

test-coverage: ## Run tests with HTML coverage report
	@echo "$(COLOR_BLUE)🧪 Running tests with coverage...$(COLOR_RESET)"
	@go test ./... -coverprofile=coverage.out
	@go tool cover -html=coverage.out -o coverage.html
	@echo "$(COLOR_GREEN)✅ Coverage report generated: coverage.html$(COLOR_RESET)"

# Code quality commands
lint: ## Run linter (uses golangci-lint or falls back to go vet)
	@if command -v golangci-lint > /dev/null; then \
		echo "$(COLOR_BLUE)🔍 Running golangci-lint...$(COLOR_RESET)"; \
		golangci-lint run; \
	else \
		echo "$(COLOR_YELLOW)⚠️  golangci-lint not installed, running go vet...$(COLOR_RESET)"; \
		go vet ./...; \
	fi

fmt: ## Format all Go code
	@echo "$(COLOR_BLUE)🎨 Formatting code...$(COLOR_RESET)"
	@go fmt ./...
	@echo "$(COLOR_GREEN)✅ Code formatted$(COLOR_RESET)"

# Maintenance commands
clean: ## Clean build artifacts and coverage files
	@echo "$(COLOR_BLUE)🧹 Cleaning...$(COLOR_RESET)"
	@rm -rf $(BINARY_DIR)
	@rm -f coverage.out coverage.html
	@rm -rf storage/workspaces/* storage/logs/*
	@echo "$(COLOR_GREEN)✅ Clean complete$(COLOR_RESET)"

tidy: ## Tidy and verify Go dependencies
	@echo "$(COLOR_BLUE)📦 Tidying dependencies...$(COLOR_RESET)"
	@go mod tidy
	@go mod verify
	@echo "$(COLOR_GREEN)✅ Dependencies verified$(COLOR_RESET)"

update: ## Update all Go packages to latest versions
	@echo "$(COLOR_BLUE)📦 Updating all packages to latest versions...$(COLOR_RESET)"
	@go get -u ./...
	@go mod tidy
	@echo "$(COLOR_GREEN)✅ Packages updated$(COLOR_RESET)"
	@echo "$(COLOR_YELLOW)⚠️  Run 'make test' to verify everything still works$(COLOR_RESET)"

install-tools: ## Install development tools (air for live reload)
	@echo "$(COLOR_BLUE)🔧 Installing development tools...$(COLOR_RESET)"
	@go install github.com/air-verse/air@latest
	@echo "$(COLOR_GREEN)✅ All tools installed$(COLOR_RESET)"
	@echo "$(COLOR_BLUE)ℹ️  Installed: air (live reload)$(COLOR_RESET)"

# Cross-platform builds
build-linux: ## Build for Linux AMD64
	@echo "$(COLOR_BLUE)🔨 Building for Linux AMD64...$(COLOR_RESET)"
	@mkdir -p $(BINARY_DIR)
	@CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build $(BUILD_FLAGS) -o $(BINARY_DIR)/$(BINARY_NAME)-linux $(MAIN_FILE)
	@echo "$(COLOR_GREEN)✅ Linux build complete: $(BINARY_DIR)/$(BINARY_NAME)-linux$(COLOR_RESET)"

build-arm64: ## Build for Linux ARM64
	@echo "$(COLOR_BLUE)🔨 Building for Linux ARM64...$(COLOR_RESET)"
	@mkdir -p $(BINARY_DIR)
	@CGO_ENABLED=0 GOOS=linux GOARCH=arm64 go build $(BUILD_FLAGS) -o $(BINARY_DIR)/$(BINARY_NAME)-arm64 $(MAIN_FILE)
	@echo "$(COLOR_GREEN)✅ ARM64 build complete: $(BINARY_DIR)/$(BINARY_NAME)-arm64$(COLOR_RESET)"

build-macos: ## Build for macOS ARM64
	@echo "$(COLOR_BLUE)🔨 Building for macOS ARM64...$(COLOR_RESET)"
	@mkdir -p $(BINARY_DIR)
	@CGO_ENABLED=0 GOOS=darwin GOARCH=arm64 go build $(BUILD_FLAGS) -o $(BINARY_DIR)/$(BINARY_NAME)-macos $(MAIN_FILE)
	@echo "$(COLOR_GREEN)✅ macOS build complete: $(BINARY_DIR)/$(BINARY_NAME)-macos$(COLOR_RESET)"

# Package binaries into zip files
zip: ## Create zip files for Linux, ARM64, and macOS binaries
	@echo "$(COLOR_BLUE)📦 Creating zip packages...$(COLOR_RESET)"
	@if [ ! -d "$(BINARY_DIR)" ]; then \
		echo "$(COLOR_YELLOW)⚠️  $(BINARY_DIR) directory not found. Run builds first.$(COLOR_RESET)"; \
		exit 1; \
	fi
	@cd $(BINARY_DIR) && \
	if [ -f "$(BINARY_NAME)-linux" ]; then \
		echo "$(COLOR_BLUE)  Zipping Linux binary...$(COLOR_RESET)"; \
		zip -q linux.zip $(BINARY_NAME)-linux && \
		echo "$(COLOR_GREEN)  ✅ Created linux.zip$(COLOR_RESET)"; \
	fi
	@cd $(BINARY_DIR) && \
	if [ -f "$(BINARY_NAME)-arm64" ]; then \
		echo "$(COLOR_BLUE)  Zipping ARM64 binary...$(COLOR_RESET)"; \
		zip -q arm64.zip $(BINARY_NAME)-arm64 && \
		echo "$(COLOR_GREEN)  ✅ Created arm64.zip$(COLOR_RESET)"; \
	fi
	@cd $(BINARY_DIR) && \
	if [ -f "$(BINARY_NAME)-macos" ]; then \
		echo "$(COLOR_BLUE)  Zipping macOS binary...$(COLOR_RESET)"; \
		zip -q macos.zip $(BINARY_NAME)-macos && \
		echo "$(COLOR_GREEN)  ✅ Created macos.zip$(COLOR_RESET)"; \
	fi
	@echo "$(COLOR_GREEN)✅ Zip packaging complete$(COLOR_RESET)"

# Production workflow
deploy-check: lint test build ## Run all checks before deployment
	@echo "$(COLOR_GREEN)✅ All deployment checks passed$(COLOR_RESET)"

# Setup directories
setup: ## Create required storage and prompt directories
	@echo "$(COLOR_BLUE)📁 Creating directories...$(COLOR_RESET)"
	@mkdir -p storage/workspaces storage/logs prompts
	@echo "$(COLOR_GREEN)✅ Directories created$(COLOR_RESET)"
