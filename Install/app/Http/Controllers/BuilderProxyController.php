<?php

namespace App\Http\Controllers;

use App\Models\Builder;
use App\Models\Project;
use App\Models\Template;
use App\Services\BuilderService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class BuilderProxyController extends Controller
{
    /**
     * Stale session fallback threshold (minutes).
     * Used when builder is unreachable to decide if a session is stale.
     */
    private const STALE_FALLBACK_MINUTES = 10;

    public function __construct(
        protected BuilderService $builderService
    ) {}

    /**
     * Check for an active build, verifying with the Go builder before blocking.
     *
     * Returns the blocking Project if the session is genuinely active,
     * or null if no active build exists (stale sessions are auto-resolved).
     */
    public static function resolveBlockingBuild(int $userId): ?Project
    {
        $activeProject = Project::where('user_id', $userId)
            ->where('build_status', 'building')
            ->first();

        if (! $activeProject) {
            return null;
        }

        // Data inconsistency: no builder or session ID means we can't verify,
        // and the stale checker skips these too — auto-fail to unblock user
        if (! $activeProject->builder || ! $activeProject->build_session_id) {
            Log::info('Auto-resolved stuck build (no builder/session)', [
                'project_id' => $activeProject->id,
            ]);

            $activeProject->update([
                'build_status' => 'failed',
                'build_completed_at' => now(),
            ]);

            return null;
        }

        // Verify with the Go builder whether the session actually exists
        try {
            $response = Http::timeout(5)
                ->withHeaders(['X-Server-Key' => $activeProject->builder->server_key])
                ->get("{$activeProject->builder->full_url}/api/status/{$activeProject->build_session_id}");

            if ($response->status() === 404) {
                // Session gone (builder restarted, session expired)
                Log::info('Auto-resolved stale build (builder 404)', [
                    'project_id' => $activeProject->id,
                    'session_id' => $activeProject->build_session_id,
                ]);

                $activeProject->update([
                    'build_status' => 'failed',
                    'build_completed_at' => now(),
                ]);

                return null;
            }

            if ($response->successful()) {
                $status = $response->json('status');

                // Terminal status — sync it and unblock
                if (in_array($status, ['completed', 'failed', 'cancelled'])) {
                    Log::info('Auto-synced terminal build status from builder', [
                        'project_id' => $activeProject->id,
                        'status' => $status,
                    ]);

                    $activeProject->update([
                        'build_status' => $status,
                        'build_completed_at' => now(),
                    ]);

                    return null;
                }

                // Non-terminal (e.g. "running") — genuinely active
                return $activeProject;
            }

            // Non-404, non-success (e.g. 500) — fall through to time-based fallback
        } catch (\Exception $e) {
            // Builder unreachable — fall through to time-based fallback
            Log::warning('Builder unreachable during active session check', [
                'project_id' => $activeProject->id,
                'error' => $e->getMessage(),
            ]);
        }

        // Fallback: if builder is unreachable, use time-based heuristic
        $isStale = $activeProject->build_started_at === null
            || $activeProject->build_started_at->lt(now()->subMinutes(self::STALE_FALLBACK_MINUTES));

        if ($isStale) {
            Log::info('Auto-resolved stale build (builder unreachable, time fallback)', [
                'project_id' => $activeProject->id,
                'build_started_at' => $activeProject->build_started_at?->toIso8601String(),
            ]);

            $activeProject->update([
                'build_status' => 'failed',
                'build_completed_at' => now(),
            ]);

            return null;
        }

        // Session is recent and builder is unreachable — assume still active
        return $activeProject;
    }

    /**
     * Get available builders for the current user.
     */
    public function getAvailableBuilders(Request $request): JsonResponse
    {
        $builders = Builder::active()->get();

        return response()->json([
            'builders' => $builders->map(fn ($b) => [
                'id' => $b->id,
                'name' => $b->name,
            ]),
        ]);
    }

    /**
     * Start a new build session.
     */
    public function startBuild(Request $request, Project $project): JsonResponse
    {
        $this->authorize('update', $project);

        // Block demo admin from starting builds
        if (config('app.demo') && Auth::id() === 1) {
            return response()->json([
                'error' => __('The demo admin account cannot start builds. Register your own account to test the AI website builder.'),
            ], 403);
        }

        $validated = $request->validate([
            'prompt' => 'required|string|max:10000',
            'builder_id' => 'nullable|exists:builders,id',
            'template_url' => 'nullable|url',
            'template_id' => 'nullable|string',
            'history' => 'array',
            'file_ids' => 'nullable|array',
            'file_ids.*' => 'integer',
        ]);

        $user = $request->user();

        // Block concurrent builds for the same user (verifies with Go builder)
        $blockingProject = self::resolveBlockingBuild($user->id);

        if ($blockingProject) {
            return response()->json([
                'error' => __('You have an active session on ":project". Wait for it to complete, or stop it.', [
                    'project' => str($blockingProject->name)->limit(50)->toString(),
                ]),
            ], 409);
        }

        // Validate all prerequisites BEFORE claiming the build slot
        $buildCreditService = app(\App\Services\BuildCreditService::class);
        $canBuild = $buildCreditService->canPerformBuild($user);

        if (! $canBuild['allowed']) {
            return response()->json([
                'error' => $canBuild['reason'],
            ], 403);
        }

        // Resolve attached files if file_ids provided
        $attachedFiles = [];
        $fileRefs = null;
        if (! empty($validated['file_ids'])) {
            $plan = $user->getCurrentPlan();
            if (! $plan || ! $plan->fileStorageEnabled()) {
                return response()->json([
                    'error' => __('File storage is not enabled for your plan.'),
                ], 403);
            }
            $files = $project->files()->whereIn('id', $validated['file_ids'])->get();
            $attachedFiles = $files->map(fn ($f) => [
                'filename' => $f->original_filename,
                'api_url' => $f->getApiUrl(),
                'mime_type' => $f->mime_type,
                'size' => $f->size,
                'human_size' => $f->getHumanReadableSize(),
            ])->toArray();
            $fileRefs = $files->map(fn ($f) => [
                'id' => $f->id,
                'filename' => $f->original_filename,
                'mime_type' => $f->mime_type,
            ])->toArray();
        }

        // Get AI config from user's plan
        try {
            $aiConfig = $this->builderService->getAiConfigForUser($user);
            // Pass remaining credits to builder for mid-session enforcement
            // 0 = unlimited (user has own API key or unlimited plan)
            $aiConfig['agent']['remaining_build_credits'] = $user->getRemainingBuildCredits();
        } catch (\Exception $e) {
            return response()->json([
                'error' => $e->getMessage(),
            ], 400);
        }

        // Select builder based on plan or auto-select
        $builder = null;

        // First try to get builder from user's plan
        if ($user->plan) {
            $builder = $user->plan->getBuilderWithFallbacks();
        }

        // If no builder from plan, allow manual selection or auto-select
        if (! $builder && ! empty($validated['builder_id'])) {
            $builder = Builder::findOrFail($validated['builder_id']);

            // Check builder is active
            if ($builder->status !== 'active') {
                return response()->json([
                    'error' => __('Selected builder is not active'),
                ], 400);
            }
        }

        if (! $builder) {
            return response()->json([
                'error' => __('No builders are currently available. Please try again later.'),
            ], 503);
        }

        // Validate and select template
        $templateId = $validated['template_id'] ?? null;

        // For first build: use the template selected during project creation
        // (only when no explicit template_id in request and project has no history yet)
        if (! $templateId && $project->template_id && empty($project->conversation_history)) {
            $templateId = (string) $project->template_id;
        }

        // Validate explicit template_id against user's plan
        if ($templateId) {
            $template = Template::find($templateId);
            if ($template && ! $template->isAvailableForPlan($user->getCurrentPlan())) {
                return response()->json([
                    'error' => __('The selected template is not available for your plan.'),
                ], 403);
            }
        }

        // Atomic re-check with row lock to prevent race between concurrent requests
        // All validations above pass before we claim the slot
        $raceConflict = DB::transaction(function () use ($user, $project) {
            $stillBuilding = Project::where('user_id', $user->id)
                ->where('build_status', 'building')
                ->lockForUpdate()
                ->exists();

            if ($stillBuilding) {
                return true;
            }

            // Claim the build slot before releasing the lock
            $project->update([
                'build_status' => 'building',
                'build_started_at' => now(),
            ]);

            return false;
        });

        if ($raceConflict) {
            return response()->json([
                'error' => __('You have an active session. Wait for it to complete, or stop it.'),
            ], 409);
        }

        try {
            // Detect repeated prompts before appending to history
            $promptToSend = $validated['prompt'];
            $repeated = $project->detectRepeatedPrompts($validated['prompt']);
            if ($repeated) {
                $promptToSend .= "\n\nNOTE: The user has asked about this issue {$repeated['count']} times before. Previous attempts may not have fully resolved it. Try a fundamentally different approach.";
            }

            // Append user message to conversation history (raw prompt + file refs)
            $project->appendToHistory('user', $validated['prompt'], null, null, $fileRefs);

            // Enrich prompt with attached file context for builder
            if (! empty($attachedFiles)) {
                $fileLines = array_map(
                    fn ($f) => sprintf('- %s (%s, %s): %s', $f['filename'], $f['mime_type'], $f['human_size'], $f['api_url']),
                    $attachedFiles
                );
                $promptToSend .= "\n\n[Attached Files]\n".implode("\n", $fileLines)
                    ."\nUse these URLs directly in img src, href, or background-image attributes in the generated code.";
            }

            // Get optimized history (uses compacted if available)
            $historyData = $project->getHistoryForBuilderOptimized();

            $result = $this->builderService->startSession(
                $builder,
                $project,
                $promptToSend,
                [], // Legacy parameter, use historyData instead
                $validated['template_url'] ?? null,
                $templateId, // Use auto-selected or provided template
                $aiConfig,
                $historyData // Optimized history with is_compacted flag
            );

            // Update project with session info (build_status already claimed above)
            $project->update([
                'builder_id' => $builder->id,
                'build_session_id' => $result['session_id'],
                'build_completed_at' => null,
            ]);

            return response()->json([
                'session_id' => $result['session_id'],
                'builder_id' => $builder->id,
                'builder_name' => $builder->name,
            ]);
        } catch (\Exception $e) {
            // Release the build slot on failure
            $project->update([
                'build_status' => 'failed',
                'build_completed_at' => now(),
            ]);

            return response()->json([
                'error' => __('Failed to start build').': '.$e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get build status.
     */
    public function getStatus(Request $request, Project $project): JsonResponse
    {
        $this->authorize('view', $project);

        // Quick mode: return only DB status (skips HTTP call to builder service)
        // Used by frontend polling for faster, cheaper status checks
        if ($request->boolean('quick')) {
            $data = ['status' => $project->build_status];
            if (in_array($project->build_status, ['completed', 'failed'])) {
                $data['recent_messages'] = $project->getRecentHistory(10);
            }

            return response()->json($data);
        }

        if (! $project->builder || ! $project->build_session_id) {
            return response()->json([
                'status' => $project->build_status,
                'has_session' => false,
            ]);
        }

        try {
            $status = $this->builderService->getSessionStatus(
                $project->builder,
                $project->build_session_id
            );

            // Builder returned 404 — session ended (completed/failed/cancelled)
            if ($status === null) {
                // Fix stale DB status if it still says 'building'
                if ($project->build_status === 'building') {
                    $project->update([
                        'build_status' => 'completed',
                        'build_completed_at' => $project->build_completed_at ?? now(),
                    ]);
                }

                return response()->json([
                    'status' => $project->fresh()->build_status,
                    'has_session' => false,
                    'preview_url' => Storage::disk('local')->exists("previews/{$project->id}")
                        ? "/preview/{$project->id}"
                        : null,
                ]);
            }

            return response()->json([
                'status' => $project->build_status,
                'has_session' => true,
                'session_status' => $status,
                'build_session_id' => $project->build_session_id,
                'build_started_at' => $project->build_started_at?->toIso8601String(),
                'can_reconnect' => $project->build_status === 'building',
                'preview_url' => Storage::disk('local')->exists("previews/{$project->id}")
                    ? "/preview/{$project->id}"
                    : null,
            ]);
        } catch (\Exception $e) {
            // Builder unreachable — don't claim session is active
            return response()->json([
                'status' => $project->build_status,
                'has_session' => false,
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Send a chat message to continue the session.
     */
    public function chat(Request $request, Project $project): JsonResponse
    {
        $this->authorize('update', $project);

        // Block demo admin from continuing AI builds
        if (config('app.demo') && Auth::id() === 1) {
            return response()->json([
                'error' => __('The demo admin account cannot use the AI builder. Register your own account to test the AI website builder.'),
            ], 403);
        }

        $validated = $request->validate([
            'message' => 'required|string|max:10000',
            'file_ids' => 'nullable|array',
            'file_ids.*' => 'integer',
        ]);

        if (! $project->builder || ! $project->build_session_id) {
            return response()->json([
                'error' => __('No active build session'),
            ], 404);
        }

        // Resolve attached files if file_ids provided
        $attachedFiles = [];
        $fileRefs = null;
        if (! empty($validated['file_ids'])) {
            $user = $request->user();
            $plan = $user->getCurrentPlan();
            if (! $plan || ! $plan->fileStorageEnabled()) {
                return response()->json([
                    'error' => __('File storage is not enabled for your plan.'),
                ], 403);
            }
            $files = $project->files()->whereIn('id', $validated['file_ids'])->get();
            $attachedFiles = $files->map(fn ($f) => [
                'filename' => $f->original_filename,
                'api_url' => $f->getApiUrl(),
                'mime_type' => $f->mime_type,
                'size' => $f->size,
                'human_size' => $f->getHumanReadableSize(),
            ])->toArray();
            $fileRefs = $files->map(fn ($f) => [
                'id' => $f->id,
                'filename' => $f->original_filename,
                'mime_type' => $f->mime_type,
            ])->toArray();
        }

        try {
            // Detect repeated prompts before appending to history
            $messageToSend = $validated['message'];
            $repeated = $project->detectRepeatedPrompts($validated['message']);
            if ($repeated) {
                $messageToSend .= "\n\nNOTE: The user has asked about this issue {$repeated['count']} times before. Previous attempts may not have fully resolved it. Try a fundamentally different approach.";
            }

            // Save user message BEFORE sending to builder (raw message + file refs)
            // Note: This clears compacted_history since it's now stale
            $project->appendToHistory('user', $validated['message'], null, null, $fileRefs);

            // Enrich message with attached file context for builder
            if (! empty($attachedFiles)) {
                $fileLines = array_map(
                    fn ($f) => sprintf('- %s (%s, %s): %s', $f['filename'], $f['mime_type'], $f['human_size'], $f['api_url']),
                    $attachedFiles
                );
                $messageToSend .= "\n\n[Attached Files]\n".implode("\n", $fileLines)
                    ."\nUse these URLs directly in img src, href, or background-image attributes in the generated code.";
            }

            // Get optimized history (uses compacted if available, but after appendToHistory
            // it will be cleared and use full conversation_history)
            $historyData = $project->getHistoryForBuilderOptimized();

            $result = $this->builderService->sendMessage(
                $project->builder,
                $project->build_session_id,
                $messageToSend,
                [], // Legacy parameter, use historyData instead
                $historyData // Optimized history with is_compacted flag
            );

            return response()->json($result);
        } catch (\Exception $e) {
            return response()->json([
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Cancel a running build session.
     */
    public function cancel(Request $request, Project $project): JsonResponse
    {
        $this->authorize('update', $project);

        if (! $project->builder || ! $project->build_session_id) {
            return response()->json([
                'error' => __('No active build session'),
            ], 404);
        }

        try {
            $cancelled = $this->builderService->cancelSession(
                $project->builder,
                $project->build_session_id
            );

            if ($cancelled) {
                $this->builderService->completeSession($project->builder);
            }
        } catch (\Exception $e) {
            Log::warning('Builder cancel HTTP call failed, force-cancelling project', [
                'project_id' => $project->id,
                'session_id' => $project->build_session_id,
                'error' => $e->getMessage(),
            ]);
        }

        // Always update project status so user is never permanently stuck
        $project->update([
            'build_status' => 'cancelled',
            'build_completed_at' => now(),
        ]);

        return response()->json([
            'cancelled' => true,
        ]);
    }

    /**
     * Mark build as complete.
     */
    public function completeBuild(Request $request, Project $project): JsonResponse
    {
        $this->authorize('update', $project);

        if ($project->builder) {
            $this->builderService->completeSession($project->builder);
        }

        $project->update([
            'build_status' => 'completed',
            'build_completed_at' => now(),
        ]);

        return response()->json([
            'success' => true,
        ]);
    }

    /**
     * Download build output.
     */
    public function downloadOutput(Request $request, Project $project): JsonResponse
    {
        $this->authorize('view', $project);

        if (! $project->builder) {
            return response()->json([
                'error' => __('No build to download'),
            ], 404);
        }

        try {
            $path = $this->builderService->fetchBuildOutput(
                $project->builder,
                $project->id,
                $project
            );

            $project->update(['build_path' => $path]);

            return response()->json([
                'success' => true,
                'path' => $path,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get workspace files.
     */
    public function getFiles(Request $request, Project $project): JsonResponse
    {
        $this->authorize('view', $project);

        // Must have a builder to proceed
        if (! $project->builder) {
            return response()->json([
                'error' => __('No builder assigned to this project'),
            ], 404);
        }

        try {
            $files = $this->builderService->getWorkspaceFiles(
                $project->builder,
                $project->id
            );

            return response()->json($files);
        } catch (\Exception $e) {
            return response()->json([
                'error' => __('Failed to get workspace files'),
            ], 500);
        }
    }

    /**
     * Get a specific file.
     */
    public function getFile(Request $request, Project $project): JsonResponse
    {
        $this->authorize('view', $project);

        $validated = $request->validate([
            'path' => 'required|string',
        ]);

        // Must have a builder to proceed
        if (! $project->builder) {
            return response()->json([
                'error' => __('No builder assigned to this project'),
            ], 404);
        }

        try {
            $file = $this->builderService->getFile(
                $project->builder,
                $project->id,
                $validated['path']
            );

            return response()->json($file);
        } catch (\Exception $e) {
            return response()->json([
                'error' => __('Failed to get file'),
            ], 500);
        }
    }

    /**
     * Update a file in workspace.
     */
    public function updateFile(Request $request, Project $project): JsonResponse
    {
        $this->authorize('update', $project);

        $validated = $request->validate([
            'path' => 'required|string',
            'content' => 'required|string',
        ]);

        // Must have a builder to proceed
        if (! $project->builder) {
            return response()->json([
                'error' => __('No builder assigned to this project'),
            ], 404);
        }

        try {
            $success = $this->builderService->updateFile(
                $project->builder,
                $project->id,
                $validated['path'],
                $validated['content']
            );

            return response()->json(['success' => $success]);
        } catch (\Exception $e) {
            return response()->json([
                'error' => __('Failed to update file'),
            ], 500);
        }
    }

    /**
     * Trigger a build.
     */
    public function triggerBuild(Request $request, Project $project): JsonResponse
    {
        $this->authorize('update', $project);

        // Must have a builder to proceed
        if (! $project->builder) {
            return response()->json([
                'error' => __('No builder assigned to this project'),
            ], 404);
        }

        try {
            $result = $this->builderService->triggerBuild(
                $project->builder,
                $project->id,
                $project->id
            );

            return response()->json($result);
        } catch (\Exception $e) {
            return response()->json([
                'error' => __('Build failed').': '.$e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get AI suggestions.
     */
    public function getSuggestions(Request $request, Project $project): JsonResponse
    {
        $this->authorize('view', $project);

        if (! $project->builder || ! $project->build_session_id) {
            return response()->json([
                'suggestions' => [],
            ]);
        }

        try {
            $result = $this->builderService->getSuggestions(
                $project->builder,
                $project->build_session_id
            );

            return response()->json($result);
        } catch (\Exception $e) {
            return response()->json([
                'suggestions' => [],
            ]);
        }
    }

    /**
     * Check if the builder is online/healthy.
     */
    public function checkBuilderHealth(Request $request, Project $project): JsonResponse
    {
        $this->authorize('view', $project);

        // Get the builder for this project
        $builder = $project->builder;

        // If no builder assigned, try to get one from user's plan
        if (! $builder) {
            $user = $request->user();
            if ($user->plan) {
                $builder = $user->plan->getBuilderWithFallbacks();
            }
        }

        if (! $builder) {
            return response()->json([
                'online' => false,
                'message' => __('No builder available'),
            ]);
        }

        // Check builder health by pinging the root URL
        $details = $builder->getDetails();

        return response()->json([
            'online' => $details['online'],
            'builder_id' => $builder->id,
            'builder_name' => $builder->name,
            'builder_url' => $builder->full_url,
            'version' => $details['version'],
            'sessions' => $details['sessions'],
        ]);
    }

    /**
     * Attempt to recover a workspace from a failed build.
     */
    public function recoverBuild(Request $request, Project $project): JsonResponse
    {
        $this->authorize('update', $project);

        if (! $project->builder) {
            return response()->json(['error' => __('No builder assigned')], 404);
        }

        try {
            $result = $this->builderService->recoverWorkspace($project->builder, $project->id);

            if ($result['success'] ?? false) {
                $project->update(['build_status' => 'idle']);
            }

            return response()->json($result);
        } catch (\Exception $e) {
            return response()->json(['error' => __('Recovery failed').': '.$e->getMessage()], 500);
        }
    }

    /**
     * Perform className-aware edit on a workspace file.
     */
    public function classEdit(Request $request, Project $project): JsonResponse
    {
        $this->authorize('update', $project);

        if (! $project->builder) {
            return response()->json(['error' => __('No builder assigned')], 404);
        }

        $validated = $request->validate([
            'path' => 'required|string',
            'old_class_name' => 'required|string',
            'new_class_name' => 'required|string',
        ]);

        try {
            $result = $this->builderService->classEditWorkspace(
                $project->builder,
                $project->id,
                $validated['path'],
                $validated['old_class_name'],
                $validated['new_class_name']
            );

            return response()->json($result);
        } catch (\Exception $e) {
            return response()->json(['error' => __('Class edit failed').': '.$e->getMessage()], 500);
        }
    }

    /**
     * Undo the last revision in the workspace.
     */
    public function undo(Request $request, Project $project): JsonResponse
    {
        $this->authorize('update', $project);

        if (! $project->builder) {
            return response()->json(['error' => __('No builder assigned')], 404);
        }

        try {
            $result = $this->builderService->undoWorkspace($project->builder, $project->id);

            if ($result['success'] ?? false) {
                $this->builderService->triggerBuild($project->builder, $project->id, $project->id);
            }

            return response()->json($result);
        } catch (\Exception $e) {
            return response()->json(['error' => __('Undo failed').': '.$e->getMessage()], 500);
        }
    }

    /**
     * Redo the next revision in the workspace.
     */
    public function redo(Request $request, Project $project): JsonResponse
    {
        $this->authorize('update', $project);

        if (! $project->builder) {
            return response()->json(['error' => __('No builder assigned')], 404);
        }

        try {
            $result = $this->builderService->redoWorkspace($project->builder, $project->id);

            if ($result['success'] ?? false) {
                $this->builderService->triggerBuild($project->builder, $project->id, $project->id);
            }

            return response()->json($result);
        } catch (\Exception $e) {
            return response()->json(['error' => __('Redo failed').': '.$e->getMessage()], 500);
        }
    }

    /**
     * Get revision history for the workspace.
     */
    public function getRevisions(Request $request, Project $project): JsonResponse
    {
        $this->authorize('view', $project);

        if (! $project->builder) {
            return response()->json(['error' => __('No builder assigned')], 404);
        }

        try {
            $revisions = $this->builderService->getRevisions($project->builder, $project->id);

            return response()->json($revisions);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }
}
