<?php

namespace App\Plugins\PaymentGateways;

use App\Contracts\PaymentGatewayPlugin;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\Transaction;
use App\Models\User;
use App\Notifications\AdminPaymentNotification;
use App\Notifications\PaymentCompletedNotification;
use App\Notifications\SubscriptionActivatedNotification;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use App\Models\SystemSetting;

class PayPalPlugin implements PaymentGatewayPlugin
{
    private array $config;

    private ?string $accessToken = null;

    private string $apiUrl;

    /**
     * PayPal supported currencies for recurring payments.
     *
     * @see https://developer.paypal.com/docs/reports/reference/paypal-supported-currencies/
     */
    private const SUPPORTED_CURRENCIES = [
        'AUD', 'BRL', 'CAD', 'CHF', 'CZK', 'DKK', 'EUR', 'GBP',
        'HKD', 'HUF', 'ILS', 'JPY', 'MXN', 'NOK', 'NZD', 'PHP',
        'PLN', 'SEK', 'SGD', 'THB', 'TWD', 'USD',
    ];

    public function __construct(?array $config = null)
    {
        $this->config = $config ?? [];
        $this->apiUrl = ($this->config['sandbox'] ?? false)
            ? 'https://api-m.sandbox.paypal.com'
            : 'https://api-m.paypal.com';
    }

    /*
    |--------------------------------------------------------------------------
    | Base Plugin Methods
    |--------------------------------------------------------------------------
    */

    public function getName(): string
    {
        return 'PayPal';
    }

    public function getDescription(): string
    {
        return 'Accept recurring payments via PayPal subscriptions';
    }

    public function getType(): string
    {
        return 'payment_gateway';
    }

    public function getIcon(): string
    {
        return 'plugins/paypal/icon.svg';
    }

    public function getVersion(): string
    {
        return '1.0.1';
    }

    public function getAuthor(): string
    {
        return 'Titan Systems';
    }

    public function getAuthorUrl(): string
    {
        return 'https://titansys.dev';
    }

    public function isConfigured(): bool
    {
        return ! empty($this->config['client_id']) && ! empty($this->config['client_secret']);
    }

    public function validateConfig(array $config): void
    {
        if (empty($config['client_id'])) {
            throw new \Exception('PayPal Client ID is required');
        }

        if (empty($config['client_secret'])) {
            throw new \Exception('PayPal Client Secret is required');
        }

        if (empty($config['webhook_id'])) {
            throw new \Exception('PayPal Webhook ID is required for webhook security');
        }

        // Test API connection
        try {
            $this->config = $config;
            $this->apiUrl = ($config['sandbox'] ?? false)
                ? 'https://api-m.sandbox.paypal.com'
                : 'https://api-m.paypal.com';

            $this->authenticate();
        } catch (\Exception $e) {
            throw new \Exception('Invalid PayPal credentials: '.$e->getMessage());
        }
    }

    public function getConfigSchema(): array
    {
        return [
            [
                'name' => 'webhook_url',
                'label' => 'Webhook URL',
                'type' => 'readonly',
                'default' => url('/payment-gateways/paypal/webhook'),
                'help' => 'Copy this URL and paste it in your PayPal dashboard webhook settings.',
            ],
            [
                'name' => 'client_id',
                'label' => 'Client ID',
                'type' => 'text',
                'required' => true,
                'placeholder' => 'Your PayPal Client ID',
                'help' => 'Found in your PayPal Developer Dashboard under your app credentials.',
            ],
            [
                'name' => 'client_secret',
                'label' => 'Client Secret',
                'type' => 'password',
                'required' => true,
                'sensitive' => true,
                'placeholder' => 'Your PayPal Client Secret',
                'help' => 'Found in your PayPal Developer Dashboard under your app credentials.',
            ],
            [
                'name' => 'webhook_id',
                'label' => 'Webhook ID',
                'type' => 'text',
                'required' => true,
                'placeholder' => 'Your PayPal Webhook ID',
                'help' => 'Create a webhook endpoint in your PayPal dashboard with the URL above.',
            ],
            [
                'name' => 'sandbox',
                'label' => 'Sandbox Mode',
                'type' => 'toggle',
                'default' => false,
                'help' => 'Enable for testing with PayPal sandbox environment. Disable for production.',
            ],
        ];
    }

    /*
    |--------------------------------------------------------------------------
    | Payment Gateway Methods
    |--------------------------------------------------------------------------
    */

    public function initPayment(Plan $plan, User $user): RedirectResponse|string
    {
        $this->authenticate();

        // Validate currency
        $currency = \App\Helpers\CurrencyHelper::getCode();
        if (! in_array($currency, self::SUPPORTED_CURRENCIES)) {
            throw new \Exception(
                "PayPal does not support {$currency}. Supported: ".implode(', ', self::SUPPORTED_CURRENCIES)
            );
        }

        // PayPal doesn't support lifetime billing
        if ($plan->billing_period === 'lifetime') {
            throw new \Exception('PayPal does not support lifetime billing plans');
        }

        // Ensure product exists
        $productId = $this->getOrCreateProduct();

        // Get or create PayPal plan (billing plan) with caching
        $paypalPlan = $this->getOrCreatePayPalPlan($plan, $productId);

        // Store metadata in cache for callback
        $uniqueId = Str::uuid()->toString();
        $clientIdHash = md5($this->config['client_id']);
        Cache::put("paypal_subscription_{$clientIdHash}_{$uniqueId}", [
            'user_id' => $user->id,
            'plan_id' => $plan->id,
        ], 24 * 60 * 60); // 24 hours

        // Create PayPal subscription
        $response = Http::withToken($this->accessToken)
            ->asJson()
            ->post("{$this->apiUrl}/v1/billing/subscriptions", [
                'plan_id' => $paypalPlan['id'],
                'custom_id' => $uniqueId,
                'application_context' => [
                    'brand_name' => SystemSetting::get('site_name', config('app.name')),
                    'shipping_preference' => 'NO_SHIPPING',
                    'user_action' => 'SUBSCRIBE_NOW',
                    'return_url' => route('payment.callback', ['gateway' => 'paypal']),
                    'cancel_url' => route('payment.callback', ['gateway' => 'paypal', 'cancelled' => 1]),
                ],
            ])
            ->throw();

        $body = $response->json();

        Log::info('PayPal Subscription created', [
            'subscription_id' => $body['id'],
            'user_id' => $user->id,
            'plan_id' => $plan->id,
        ]);

        // Return PayPal approval URL
        foreach ($body['links'] as $link) {
            if ($link['rel'] === 'approve') {
                return $link['href'];
            }
        }

        throw new \Exception('PayPal approval URL not found');
    }

    public function handleWebhook(Request $request): Response
    {
        $payload = $request->all();
        $eventType = $payload['event_type'] ?? null;

        Log::info('PayPal Webhook received', [
            'event_type' => $eventType,
            'event_id' => $payload['id'] ?? null,
        ]);

        // Verify webhook signature
        if (empty($this->config['webhook_id'])) {
            Log::error('PayPal webhook_id not configured — rejecting webhook for security');

            return response('Webhook ID not configured', 500);
        }

        if (! $this->verifyWebhookSignature($request)) {
            Log::error('PayPal Webhook signature verification failed');

            return response('Invalid signature', 400);
        }

        try {
            match ($eventType) {
                'BILLING.SUBSCRIPTION.ACTIVATED' => $this->handleSubscriptionActivated($payload),
                'BILLING.SUBSCRIPTION.CANCELLED' => $this->handleSubscriptionCancelled($payload),
                'BILLING.SUBSCRIPTION.EXPIRED' => $this->handleSubscriptionExpired($payload),
                'BILLING.SUBSCRIPTION.SUSPENDED' => $this->handleSubscriptionSuspended($payload),
                'PAYMENT.SALE.COMPLETED' => $this->handlePaymentCompleted($payload),
                default => Log::info('Unhandled PayPal webhook event', ['event_type' => $eventType]),
            };

            return response('Webhook handled', 200);
        } catch (\Throwable $e) {
            Log::error('PayPal webhook processing failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            // Return 500 so PayPal retries — prevents silent data loss
            return response('Webhook processing failed', 500);
        }
    }

    public function callback(Request $request): RedirectResponse
    {
        if ($request->has('cancelled')) {
            return redirect()->route('create')
                ->with('error', 'Payment was cancelled');
        }

        // Simply redirect to create page - webhook will handle subscription activation
        // This is more reliable as webhooks are guaranteed to be processed
        return redirect()->route('create')
            ->with('info', 'Processing your subscription. You will receive a confirmation shortly.');
    }

    public function cancelSubscription(Subscription $subscription): void
    {
        if (! $subscription->external_subscription_id) {
            return;
        }

        try {
            $this->authenticate();

            Http::withToken($this->accessToken)
                ->asJson()
                ->post("{$this->apiUrl}/v1/billing/subscriptions/{$subscription->external_subscription_id}/cancel", [
                    'reason' => 'User requested cancellation',
                ])
                ->throw();

            Log::info('PayPal subscription cancelled', [
                'subscription_id' => $subscription->id,
                'paypal_subscription_id' => $subscription->external_subscription_id,
            ]);
        } catch (\Exception $e) {
            Log::error('PayPal subscription cancellation failed', [
                'subscription_id' => $subscription->id,
                'error' => $e->getMessage(),
            ]);
            throw new \Exception('Failed to cancel subscription: '.$e->getMessage());
        }
    }

    public function getSubscriptionStatus(string $subscriptionId): array
    {
        $this->authenticate();

        $response = Http::withToken($this->accessToken)
            ->get("{$this->apiUrl}/v1/billing/subscriptions/{$subscriptionId}")
            ->throw();

        $data = $response->json();

        return [
            'status' => $this->mapPayPalStatus($data['status']),
            'next_billing_time' => $data['billing_info']['next_billing_time'] ?? null,
            'last_payment' => $data['billing_info']['last_payment'] ?? null,
        ];
    }

    public function getSupportedCurrencies(): array
    {
        return self::SUPPORTED_CURRENCIES;
    }

    public function supportsAutoRenewal(): bool
    {
        return true;
    }

    public function requiresManualApproval(): bool
    {
        return false;
    }

    /*
    |--------------------------------------------------------------------------
    | Private Helper Methods
    |--------------------------------------------------------------------------
    */

    private function authenticate(): void
    {
        if ($this->accessToken) {
            return;
        }

        // Cache the access token for 50 minutes (tokens last 60 min)
        $cacheKey = 'paypal_access_token_'.md5($this->config['client_id']);

        $this->accessToken = Cache::remember($cacheKey, 50 * 60, function () {
            $response = Http::asForm()
                ->withBasicAuth($this->config['client_id'], $this->config['client_secret'])
                ->post("{$this->apiUrl}/v1/oauth2/token", [
                    'grant_type' => 'client_credentials',
                ])
                ->throw();

            return $response->json('access_token');
        });
    }

    private function getOrCreateProduct(): string
    {
        // Check if we have a cached product ID
        $productIdKey = 'paypal_product_id_'.md5($this->config['client_id']);
        $productId = Cache::get($productIdKey);

        if ($productId) {
            return $productId;
        }

        // Create new product
        $response = Http::withToken($this->accessToken)
            ->asJson()
            ->post("{$this->apiUrl}/v1/catalogs/products", [
                'name' => SystemSetting::get('site_name', config('app.name')).' Subscription',
                'description' => 'Subscription to '.SystemSetting::get('site_name', config('app.name')),
                'type' => 'SERVICE',
                'category' => 'SOFTWARE',
            ])
            ->throw();

        $productId = $response->json('id');
        Cache::put($productIdKey, $productId, 60 * 60 * 24 * 30); // 30 days

        return $productId;
    }

    private function getOrCreatePayPalPlan(Plan $plan, string $productId): array
    {
        $currency = \App\Helpers\CurrencyHelper::getCode();
        $cacheKey = "paypal_plan_{$plan->id}_{$currency}_{$plan->price}";

        $cachedPlanId = Cache::get($cacheKey);
        if ($cachedPlanId) {
            try {
                $response = Http::withToken($this->accessToken)
                    ->get("{$this->apiUrl}/v1/billing/plans/{$cachedPlanId}");
                if ($response->successful()) {
                    return $response->json();
                }
            } catch (\Exception $e) {
                // Plan doesn't exist, create new one
            }
        }

        $newPlan = $this->createPayPalPlan($plan, $productId);
        Cache::put($cacheKey, $newPlan['id'], 60 * 60 * 24 * 30);

        return $newPlan;
    }

    private function createPayPalPlan(Plan $plan, string $productId): array
    {
        $interval = match ($plan->billing_period) {
            'yearly' => ['interval_unit' => 'YEAR', 'interval_count' => 1],
            default => ['interval_unit' => 'MONTH', 'interval_count' => 1],
        };

        $response = Http::withToken($this->accessToken)
            ->asJson()
            ->post("{$this->apiUrl}/v1/billing/plans", [
                'product_id' => $productId,
                'name' => $plan->name,
                'description' => $plan->description ?? "Subscription to {$plan->name}",
                'status' => 'ACTIVE',
                'billing_cycles' => [
                    [
                        'frequency' => $interval,
                        'tenure_type' => 'REGULAR',
                        'sequence' => 1,
                        'total_cycles' => 0, // Infinite
                        'pricing_scheme' => [
                            'fixed_price' => [
                                'value' => number_format($plan->price, 2, '.', ''),
                                'currency_code' => \App\Helpers\CurrencyHelper::getCode(),
                            ],
                        ],
                    ],
                ],
                'payment_preferences' => [
                    'auto_bill_outstanding' => true,
                    'setup_fee_failure_action' => 'CONTINUE',
                    'payment_failure_threshold' => 3,
                ],
            ])
            ->throw();

        return $response->json();
    }

    private function verifyWebhookSignature(Request $request): bool
    {
        try {
            $this->authenticate();

            $response = Http::withToken($this->accessToken)
                ->asJson()
                ->post("{$this->apiUrl}/v1/notifications/verify-webhook-signature", [
                    'auth_algo' => $request->header('PAYPAL-AUTH-ALGO'),
                    'cert_url' => $request->header('PAYPAL-CERT-URL'),
                    'transmission_id' => $request->header('PAYPAL-TRANSMISSION-ID'),
                    'transmission_sig' => $request->header('PAYPAL-TRANSMISSION-SIG'),
                    'transmission_time' => $request->header('PAYPAL-TRANSMISSION-TIME'),
                    'webhook_id' => $this->config['webhook_id'],
                    'webhook_event' => $request->all(),
                ])
                ->throw();

            return $response->json('verification_status') === 'SUCCESS';
        } catch (\Exception $e) {
            Log::error('PayPal webhook signature verification error', [
                'error' => $e->getMessage(),
            ]);

            return false;
        }
    }

    private function handleSubscriptionActivated(array $payload): void
    {
        $resource = $payload['resource'] ?? [];
        $subscriptionId = $resource['id'] ?? null;
        $customId = $resource['custom_id'] ?? null;

        if (! $subscriptionId) {
            return;
        }

        // Try to find existing subscription or create from cache
        $subscription = Subscription::where('external_subscription_id', $subscriptionId)->first();

        if (! $subscription && $customId) {
            // Try to create from cached metadata
            $clientIdHash = md5($this->config['client_id']);
            $cacheKey = "paypal_subscription_{$clientIdHash}_{$customId}";
            $cachedData = Cache::get($cacheKey);

            if ($cachedData) {
                $plan = Plan::find($cachedData['plan_id']);
                if ($plan) {
                    $subscription = Subscription::create([
                        'user_id' => $cachedData['user_id'],
                        'plan_id' => $cachedData['plan_id'],
                        'external_subscription_id' => $subscriptionId,
                        'payment_method' => Subscription::PAYMENT_PAYPAL,
                        'status' => Subscription::STATUS_ACTIVE,
                        'amount' => $plan->price,
                        'starts_at' => now(),
                        'renewal_at' => $this->calculateRenewalDate($plan),
                    ]);

                    Cache::forget($cacheKey);
                }
            }
        }

        if ($subscription) {
            $wasAlreadyActive = $subscription->isActive();

            if (! $wasAlreadyActive) {
                $subscription->update([
                    'status' => Subscription::STATUS_ACTIVE,
                    'starts_at' => now(),
                    'renewal_at' => $this->calculateRenewalDate($subscription->plan),
                ]);
            }

            // Only perform side-effects when newly activated
            if (! $wasAlreadyActive) {
                $user = $subscription->user;
                $plan = $subscription->plan;

                if ($user && $plan) {
                    // Cancel all other active/pending subscriptions for this user
                    Subscription::where('user_id', $user->id)
                        ->where('id', '!=', $subscription->id)
                        ->whereIn('status', [Subscription::STATUS_ACTIVE, Subscription::STATUS_PENDING])
                        ->update([
                            'status' => Subscription::STATUS_CANCELLED,
                            'ends_at' => now(),
                        ]);

                    // Update user's plan
                    $user->update(['plan_id' => $plan->id]);

                    // Send user notification
                    try {
                        $user->notify(new SubscriptionActivatedNotification($subscription));
                    } catch (\Exception $e) {
                        Log::error('Failed to send SubscriptionActivatedNotification', [
                            'user_id' => $user->id,
                            'subscription_id' => $subscription->id,
                            'error' => $e->getMessage(),
                        ]);
                    }

                    // Send admin notification
                    AdminPaymentNotification::sendIfEnabled(
                        'subscription_activated',
                        $user,
                        $subscription
                    );

                    Log::info('PayPal subscription activated', [
                        'subscription_id' => $subscription->id,
                        'user_id' => $user->id,
                        'plan_id' => $plan->id,
                    ]);
                }
            }
        }
    }

    private function handleSubscriptionCancelled(array $payload): void
    {
        $resource = $payload['resource'] ?? [];
        $subscriptionId = $resource['id'] ?? null;

        if (! $subscriptionId) {
            return;
        }

        $subscription = Subscription::where('external_subscription_id', $subscriptionId)->first();

        if ($subscription) {
            $subscription->cancel(reason: 'Cancelled via PayPal');
        }
    }

    private function handleSubscriptionExpired(array $payload): void
    {
        $resource = $payload['resource'] ?? [];
        $subscriptionId = $resource['id'] ?? null;

        if (! $subscriptionId) {
            return;
        }

        $subscription = Subscription::where('external_subscription_id', $subscriptionId)->first();

        if ($subscription) {
            $subscription->expire();
        }
    }

    private function handleSubscriptionSuspended(array $payload): void
    {
        $resource = $payload['resource'] ?? [];
        $subscriptionId = $resource['id'] ?? null;

        if (! $subscriptionId) {
            return;
        }

        $subscription = Subscription::where('external_subscription_id', $subscriptionId)->first();

        if ($subscription) {
            $subscription->update(['status' => Subscription::STATUS_PENDING]);
        }
    }

    private function handlePaymentCompleted(array $payload): void
    {
        $resource = $payload['resource'] ?? [];
        $billingAgreementId = $resource['billing_agreement_id'] ?? null;

        if (! $billingAgreementId) {
            return;
        }

        $subscription = Subscription::where('external_subscription_id', $billingAgreementId)->first();

        if (! $subscription) {
            return;
        }

        // Determine if this is the first payment for this subscription
        $isFirstPayment = ! Transaction::where('subscription_id', $subscription->id)->exists();

        // Create transaction record
        $transaction = Transaction::firstOrCreate(
            ['external_transaction_id' => $resource['id']],
            [
                'transaction_id' => 'TXN-'.strtoupper(Str::random(12)),
                'user_id' => $subscription->user_id,
                'subscription_id' => $subscription->id,
                'amount' => $resource['amount']['total'] ?? $subscription->amount,
                'currency' => $resource['amount']['currency'] ?? 'USD',
                'status' => Transaction::STATUS_COMPLETED,
                'type' => $isFirstPayment ? Transaction::TYPE_SUBSCRIPTION_NEW : Transaction::TYPE_SUBSCRIPTION_RENEWAL,
                'payment_method' => Transaction::PAYMENT_PAYPAL,
                'transaction_date' => now(),
                'metadata' => [
                    'paypal_sale_id' => $resource['id'],
                    'paypal_subscription_id' => $billingAgreementId,
                ],
            ]
        );

        if ($transaction->wasRecentlyCreated) {
            $user = $subscription->user;
            if ($user) {
                try {
                    $user->notify(new PaymentCompletedNotification($transaction));
                } catch (\Exception $e) {
                    Log::error('Failed to send PaymentCompletedNotification', [
                        'user_id' => $user->id,
                        'transaction_id' => $transaction->id,
                        'error' => $e->getMessage(),
                    ]);
                }

                AdminPaymentNotification::sendIfEnabled(
                    'payment_completed',
                    $user,
                    $subscription,
                    $transaction
                );
            }
        }

        // Update subscription renewal date
        $subscription->update([
            'renewal_at' => $this->calculateRenewalDate($subscription->plan),
        ]);
    }

    private function mapPayPalStatus(string $paypalStatus): string
    {
        return match (strtoupper($paypalStatus)) {
            'ACTIVE' => Subscription::STATUS_ACTIVE,
            'APPROVAL_PENDING', 'APPROVED' => Subscription::STATUS_PENDING,
            'CANCELLED' => Subscription::STATUS_CANCELLED,
            'EXPIRED', 'SUSPENDED' => Subscription::STATUS_EXPIRED,
            default => Subscription::STATUS_PENDING,
        };
    }

    private function calculateRenewalDate(Plan $plan): \Carbon\Carbon
    {
        $billingPeriod = $plan->billing_period ?? 'monthly';

        return match ($billingPeriod) {
            'yearly' => now()->addYear(),
            'lifetime' => now()->addYears(100),
            default => now()->addMonth(),
        };
    }
}
