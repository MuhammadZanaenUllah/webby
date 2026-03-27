<?php

namespace App\Console\Commands;

use App\Helpers\CurrencyHelper;
use App\Models\CronLog;
use App\Models\Plugin;
use App\Models\Subscription;
use App\Services\PluginManager;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class ProcessYooKassaRenewals extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'yookassa:process-renewals
                            {--triggered-by=cron : Who triggered this command (cron or manual:user_id)}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Process automatic subscription renewals for YooKassa payment method';

    protected int $processed = 0;

    protected int $skipped = 0;

    protected int $errors = 0;

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        // Check if plugin is active
        $pluginActive = Plugin::where('slug', 'yookassa')
            ->where('status', 'active')
            ->exists();

        if (! $pluginActive) {
            $this->info('YooKassa plugin is not active. Skipping.');

            return self::SUCCESS;
        }

        $cronLog = CronLog::startLog(
            'Process YooKassa Renewals',
            self::class,
            $this->option('triggered-by')
        );

        try {
            $this->info('Processing YooKassa subscription renewals...');

            $this->processRenewals();

            $message = "Processed: {$this->processed}, Skipped: {$this->skipped}, Errors: {$this->errors}";
            $this->info("Completed. {$message}");

            $cronLog->markSuccess($message);

            Log::info('YooKassa renewal processing completed', [
                'processed' => $this->processed,
                'skipped' => $this->skipped,
                'errors' => $this->errors,
            ]);

            return self::SUCCESS;

        } catch (\Exception $e) {
            $this->error("Failed to process YooKassa renewals: {$e->getMessage()}");

            $cronLog->markFailed($e->getTraceAsString(), $e->getMessage());

            Log::error('YooKassa renewal processing failed', [
                'error' => $e->getMessage(),
            ]);

            return self::FAILURE;
        }
    }

    private function processRenewals(): void
    {
        // Find active YooKassa subscriptions due for renewal within 1 day
        $subscriptions = Subscription::where('payment_method', Subscription::PAYMENT_YOOKASSA)
            ->where('status', Subscription::STATUS_ACTIVE)
            ->where('renewal_at', '<=', now()->addDay())
            ->with(['user', 'plan'])
            ->get();

        if ($subscriptions->isEmpty()) {
            $this->info('No subscriptions due for renewal.');

            return;
        }

        $this->info("Found {$subscriptions->count()} subscription(s) due for renewal.");

        /** @var PluginManager $pluginManager */
        $pluginManager = app(PluginManager::class);
        $gateway = $pluginManager->getGatewayBySlug('yookassa');

        if (! $gateway) {
            Log::error('YooKassa: could not instantiate gateway from plugin manager');
            $this->errors++;

            return;
        }

        foreach ($subscriptions as $subscription) {
            $this->processSubscriptionRenewal($subscription, $gateway);
        }
    }

    private function processSubscriptionRenewal(Subscription $subscription, $gateway): void
    {
        $metadata = $subscription->metadata ?? [];
        $paymentMethodId = $metadata['yookassa_payment_method_id'] ?? null;

        if (! $paymentMethodId) {
            Log::warning('YooKassa: no saved payment method for subscription', [
                'subscription_id' => $subscription->id,
            ]);
            $this->skipped++;

            return;
        }

        $user = $subscription->user;
        $plan = $subscription->plan;

        if (! $user || ! $plan) {
            Log::warning('YooKassa: subscription missing user or plan', [
                'subscription_id' => $subscription->id,
            ]);
            $this->skipped++;

            return;
        }

        // Bump renewal_at BEFORE API call to prevent ManageSubscriptions
        // from expiring this subscription while the payment is in-flight.
        // The webhook handler will set the correct renewal date on payment.succeeded.
        $subscription->update(['renewal_at' => now()->addDays(3)]);

        try {
            $currency = CurrencyHelper::getCode();
            $amount = number_format($plan->price, 2, '.', '');

            $result = $gateway->createRenewalPayment(
                $paymentMethodId,
                $amount,
                $currency,
                "Renewal - {$plan->name}",
                [
                    'user_id' => (string) $user->id,
                    'plan_id' => (string) $plan->id,
                    'subscription_id' => (string) $subscription->id,
                ],
            );

            $this->processed++;

            Log::info('YooKassa: renewal payment initiated', [
                'subscription_id' => $subscription->id,
                'payment_id' => $result['id'],
                'status' => $result['status'],
            ]);

        } catch (\Exception $e) {
            // Set a short backoff instead of reverting to the original (already-past)
            // renewal_at, which would cause an immediate retry on the next cron run.
            try {
                $subscription->update(['renewal_at' => now()->addHours(4)]);
            } catch (\Exception $revertException) {
                Log::error('YooKassa: failed to set renewal backoff after payment failure', [
                    'subscription_id' => $subscription->id,
                    'error' => $revertException->getMessage(),
                ]);
            }
            $this->errors++;

            Log::error('YooKassa: renewal payment failed', [
                'subscription_id' => $subscription->id,
                'error' => $e->getMessage(),
            ]);
        }
    }
}
