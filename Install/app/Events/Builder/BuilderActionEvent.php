<?php

namespace App\Events\Builder;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class BuilderActionEvent implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public string $sessionId,
        public string $action,
        public string $target,
        public string $details,
        public string $category,
        public bool $shouldBroadcast = true
    ) {}

    public function broadcastWhen(): bool
    {
        return $this->shouldBroadcast;
    }

    public function broadcastOn(): array
    {
        return [
            new Channel('session.'.$this->sessionId),
        ];
    }

    public function broadcastAs(): string
    {
        return 'action';
    }

    public function broadcastWith(): array
    {
        return [
            'action' => $this->action,
            'target' => $this->target,
            'details' => $this->details,
            'category' => $this->category,
        ];
    }
}
