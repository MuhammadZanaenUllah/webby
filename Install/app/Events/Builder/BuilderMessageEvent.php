<?php

namespace App\Events\Builder;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class BuilderMessageEvent implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public string $sessionId,
        public string $content,
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
        return 'message';
    }

    public function broadcastWith(): array
    {
        $content = $this->content;
        if (strlen($content) > 8000) {
            $content = mb_strcut($content, 0, 8000, 'UTF-8')."\n\n[truncated]";
        }

        return ['content' => $content];
    }
}
