<?php

namespace App\Listeners;

use Illuminate\Auth\Events\Verified;

class LogDemoRegistration
{
    public function handle(Verified $event): void
    {
        if (! config('app.demo')) {
            return;
        }

        $email = $event->user->email;
        $logPath = base_path('demo-registrations.txt');
        $handle = fopen($logPath, 'c+');

        if ($handle && flock($handle, LOCK_EX)) {
            $contents = stream_get_contents($handle);
            $existingEmails = array_filter(array_map('trim', explode("\n", $contents)));

            if (! in_array($email, $existingEmails, true)) {
                fseek($handle, 0, SEEK_END);
                fwrite($handle, $email."\n");
            }

            flock($handle, LOCK_UN);
            fclose($handle);
        } elseif ($handle) {
            fclose($handle);
        }
    }
}
