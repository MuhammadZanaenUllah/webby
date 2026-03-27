package models

// PusherConfig holds Pusher configuration for direct streaming.
// Supports both Pusher cloud (Cluster) and self-hosted servers like Reverb (Host + Scheme).
type PusherConfig struct {
	AppID   string `json:"app_id"`
	Key     string `json:"key"`
	Secret  string `json:"secret"`
	Cluster string `json:"cluster,omitempty"`
	Host    string `json:"host,omitempty"`   // Custom host:port for Reverb
	Scheme  string `json:"scheme,omitempty"` // "http" or "https"
}

// FeatureFlags controls optional features per-request
type FeatureFlags struct {
	ParallelTools  bool `json:"parallel_tools"`  // Enable parallel tool execution (default: true)
	RetryLLM       bool `json:"retry_llm"`       // Enable LLM retry with backoff (default: true)
	AutoCompaction bool `json:"auto_compaction"` // Enable auto context compaction (default: true)
	GranularEvents bool `json:"granular_events"` // Enable granular progress events (default: true)
}

// DefaultFeatureFlags returns the default feature flags
func DefaultFeatureFlags() FeatureFlags {
	return FeatureFlags{
		ParallelTools:  true,
		RetryLLM:       true,
		AutoCompaction: true,
		GranularEvents: true, // Enabled by default for better progress visibility
	}
}

// ProjectCapabilities holds project feature availability passed from Laravel.
// This tells the agent what dynamic features are available for code generation.
type ProjectCapabilities struct {
	Firebase *FirebaseCapability `json:"firebase,omitempty"`
	Storage  *StorageCapability  `json:"storage,omitempty"`
}

// FirebaseCapability indicates Firebase availability for the project
type FirebaseCapability struct {
	Enabled          bool   `json:"enabled"`
	CollectionPrefix string `json:"collection_prefix"`
}

// StorageCapability indicates file storage availability for the project
type StorageCapability struct {
	Enabled          bool     `json:"enabled"`
	MaxFileSizeMB    int      `json:"max_file_size_mb"`
	AllowedFileTypes []string `json:"allowed_file_types"`
}

// ThemePreset holds theme preset data passed from Laravel.
// Contains CSS variables for light and dark modes.
type ThemePreset struct {
	ID          string            `json:"id"`
	Name        string            `json:"name"`
	Description string            `json:"description"`
	Light       map[string]string `json:"light"`
	Dark        map[string]string `json:"dark"`
}

// FirestoreCollection represents a Firestore collection with metadata
type FirestoreCollection struct {
	Name          string   `json:"name"`
	DocumentCount any      `json:"document_count"` // int or string like "100+"
	SampleFields  []string `json:"sample_fields"`
}

// FirestoreCollectionsResponse from Laravel endpoint
type FirestoreCollectionsResponse struct {
	Success          bool                  `json:"success"`
	Error            string                `json:"error,omitempty"`
	Message          string                `json:"message,omitempty"`
	Collections      []FirestoreCollection `json:"collections"`
	CollectionPrefix string                `json:"collection_prefix,omitempty"`
}

// CustomPrompts holds admin-editable system prompts from Laravel
type CustomPrompts struct {
	SystemPrompt  string `json:"system_prompt"`
	CompactPrompt string `json:"compact_prompt"`
}

// RunRequest is the request body for POST /api/run
type RunRequest struct {
	Goal                string               `json:"goal" binding:"required"`
	MaxIterations       int                  `json:"max_iterations"`
	History             []HistoryMessage     `json:"history"`
	IsCompacted         bool                 `json:"is_compacted"` // Skip summarization if history is already compacted
	Config              RequestConfig        `json:"config" binding:"required"`
	Template            *TemplateConfig      `json:"template,omitempty"`
	WorkspaceID         string               `json:"workspace_id" binding:"required"`
	WebhookURL          string               `json:"webhook_url" binding:"required"`
	Pusher              *PusherConfig        `json:"pusher,omitempty"`
	Features            *FeatureFlags        `json:"features,omitempty"`             // Optional feature flags
	LaravelURL          string               `json:"laravel_url,omitempty"`          // Laravel API URL for template fetching
	ProjectCapabilities *ProjectCapabilities `json:"project_capabilities,omitempty"` // Project feature availability
	ThemePreset         *ThemePreset         `json:"theme_preset,omitempty"`         // Theme preset from user selection
	CustomPrompts       *CustomPrompts       `json:"custom_prompts,omitempty"`       // Admin-editable system prompts
}

// HistoryMessage represents a message in conversation history
type HistoryMessage struct {
	Role    string `json:"role"` // "user" or "assistant"
	Content string `json:"content"`
}

// RunResponse is returned when a session is started
type RunResponse struct {
	SessionID string `json:"session_id"`
}

// StatusResponse is returned for session status queries
type StatusResponse struct {
	SessionID      string `json:"session_id"`
	Status         string `json:"status"`
	Iterations     int    `json:"iterations"`
	TokensUsed     int    `json:"tokens_used"`
	ActiveSessions int    `json:"active_sessions"`
	Error          string `json:"error,omitempty"`
}

// FileListResponse is returned for file listing
type FileListResponse struct {
	Files []FileInfo `json:"files"`
}

// FileInfo describes a file in the workspace
type FileInfo struct {
	Path    string `json:"path"`
	Name    string `json:"name"`
	Size    int64  `json:"size"`
	IsDir   bool   `json:"is_dir"`
	ModTime string `json:"mod_time"`
}

// FileResponse is returned when getting a file
type FileResponse struct {
	Path    string `json:"path"`
	Content string `json:"content"`
	Size    int64  `json:"size"`
}

// FileUpdateRequest is the request body for PUT /api/file/:session_id
type FileUpdateRequest struct {
	Path    string `json:"path" binding:"required"`
	Content string `json:"content" binding:"required"`
}

// ApplyThemeRequest is the request body for PUT /api/theme-workspace/:workspace_id
type ApplyThemeRequest struct {
	Light map[string]string `json:"light" binding:"required"` // CSS variables for :root
	Dark  map[string]string `json:"dark" binding:"required"`  // CSS variables for .dark
}

// BuildResponse is returned after a build
type BuildResponse struct {
	Success    bool     `json:"success"`
	Message    string   `json:"message"`
	Output     string   `json:"output,omitempty"`
	Errors     []string `json:"errors,omitempty"`
	FilesCount int      `json:"files_count,omitempty"`
	OutputSize int64    `json:"output_size,omitempty"`
}

// SuggestionsResponse is returned for suggestion queries
type SuggestionsResponse struct {
	Suggestions []string `json:"suggestions"`
}

// ChatRequest is the request body for POST /api/chat/:session_id
type ChatRequest struct {
	Message     string           `json:"message" binding:"required"`
	History     []HistoryMessage `json:"history"`
	IsCompacted bool             `json:"is_compacted"` // Skip summarization if history is already compacted
	Config      *RequestConfig   `json:"config,omitempty"`
}

// ErrorResponse is returned for errors
type ErrorResponse struct {
	Error string `json:"error"`
}

// ListWorkspacesResponse is returned for GET /api/workspaces
type ListWorkspacesResponse struct {
	WorkspaceIDs []string `json:"workspace_ids"`
	Count        int      `json:"count"`
}

// CleanupWorkspacesRequest is the request body for POST /api/cleanup-workspaces
type CleanupWorkspacesRequest struct {
	WorkspaceIDs []string `json:"workspace_ids" binding:"required"`
}

// CleanupWorkspaceResult represents the result for a single workspace cleanup
type CleanupWorkspaceResult struct {
	WorkspaceID string `json:"workspace_id"`
	Status      string `json:"status"` // "deleted", "not_found", "skipped", "failed"
	Reason      string `json:"reason,omitempty"`
}

// CleanupWorkspacesResponse is returned for POST /api/cleanup-workspaces
type CleanupWorkspacesResponse struct {
	Results  []CleanupWorkspaceResult `json:"results"`
	Deleted  int                      `json:"deleted"`
	NotFound int                      `json:"not_found"`
	Skipped  int                      `json:"skipped"`
	Failed   int                      `json:"failed"`
}
