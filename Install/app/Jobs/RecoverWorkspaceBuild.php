<?php

namespace App\Jobs;

use App\Models\Project;
use App\Services\BuilderService;
use App\Services\NotificationService;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Log;

class RecoverWorkspaceBuild implements ShouldBeUnique, ShouldQueue
{
    use Queueable;

    public int $tries = 2;

    public int $backoff = 30;

    public int $uniqueFor = 120;

    public function uniqueId(): string
    {
        return 'recover-workspace:'.$this->project->id;
    }

    public function __construct(
        public Project $project,
        public string $errorMessage,
    ) {}

    public function handle(BuilderService $builderService, NotificationService $notificationService): void
    {
        $builder = $this->project->builder;
        if (! $builder) {
            Log::warning('RecoverWorkspaceBuild: No builder for project', [
                'project_id' => $this->project->id,
            ]);

            return;
        }

        try {
            $result = $builderService->recoverWorkspace($builder, $this->project->id);

            if ($result['success'] ?? false) {
                $this->project->update([
                    'build_status' => 'idle',
                ]);

                Log::info('Workspace recovery successful', [
                    'project_id' => $this->project->id,
                ]);

                $notificationService->notify(
                    $this->project->user,
                    'build_recovered',
                    'Build Recovered',
                    'Your build session was recovered after a failure. You can continue building.'
                );
            } else {
                Log::warning('Workspace recovery returned failure', [
                    'project_id' => $this->project->id,
                    'result' => $result,
                ]);
            }
        } catch (\Exception $e) {
            Log::error('Workspace recovery failed', [
                'project_id' => $this->project->id,
                'error' => $e->getMessage(),
            ]);
        }
    }
}
