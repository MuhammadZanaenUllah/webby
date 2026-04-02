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
use Illuminate\Support\Facades\Log;
use Stripe\StripeClient;
use App\Models\SystemSetting;

class StripePlugin implements PaymentGatewayPlugin
{
    private array $config;
    private ?StripeClient $stripe = null;

    public function __construct(?array $config = null)
    {
        $this->config = $config ?? [];
        $secretKey = $this->config['secret_key'] ?? null;
        if ($secretKey) {
            $this->stripe = new StripeClient($secretKey);
        }
    }

    /*
    |--------------------------------------------------------------------------
    | Base Plugin Methods
    |--------------------------------------------------------------------------
    */

    public function getName(): string
    {
        return 'Stripe';
    }

    public function getDescription(): string
    {
        return 'Accept recurring and one-time payments via Stripe Checkout';
    }

    public function getType(): string
    {
        return 'payment_gateway';
    }

    public function getIcon(): string
    {
        return 'plugins/stripe/icon.svg';
    }

    public function getVersion(): string
    {
        return '1.0.0';
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
        return !empty($this->config['secret_key']) && !empty($this->config['publishable_key']);
    }

    public function validateConfig(array $config): void
    {
        if (empty($config['secret_key'])) {
            throw new \Exception('Stripe Secret Key is required');
        }

        if (empty($config['publishable_key'])) {
            throw new \Exception('Stripe Publishable Key is required');
        }

        try {
            $stripe = new StripeClient($config['secret_key']);
            $stripe->balance->retrieve();
        } catch (\Exception $e) {
            throw new \Exception('Invalid Stripe API key: ' . $e->getMessage());
        }
    }

    public function getConfigSchema(): array
    {
        return [
            [
                'name' => 'webhook_url',
                'label' => 'Webhook URL',
                'type' => 'readonly',
                'default' => url('/payment-gateways/stripe/webhook'),
                'help' => 'Add this URL to your Stripe Dashboard under Developers > Webhooks.',
            ],
            [
                'name' => 'publishable_key',
                'label' => 'Publishable Key',
                'type' => 'text',
                'required' => true,
                'placeholder' => 'pk_test_...',
                'help' => 'Your Stripe Publishable Key from the Developers > API keys section.',
            ],
            [
                'name' => 'secret_key',
                'label' => 'Secret Key',
                'type' => 'password',
                'required' => true,
                'sensitive' => true,
                'placeholder' => 'sk_test_...',
                'help' => 'Your Stripe Secret Key from the Developers > API keys section.',
            ],
            [
                'name' => 'webhook_secret',
                'label' => 'Webhook Secret',
                'type' => 'password',
                'required' => false,
                'sensitive' => true,
                'placeholder' => 'whsec_...',
                'help' => 'The Signing Secret for your webhook, found in the Stripe Dashboard.',
            ],
        ];
    }

    /*
    |--------------------------------------------------------------------------
    | Payment Gateway Methods
    |--------------------------------------------------------------------------
    */

    public function initPayment(Plan $plan, User $user): RedirectResponse|string|array
    {
        $this->ensureStripeIsInitialized();
        $currency = strtolower(\App\Helpers\CurrencyHelper::getCode());
        
        $sessionData = [
            'payment_method_types' => ['card'],
            'line_items' => [[
                'price_data' => [
                    'currency' => $currency,
                    'product_data' => [
                        'name' => $plan->name,
                        'description' => $plan->description ?? "Subscription to {$plan->name}",
                    ],
                    'unit_amount' => (int) ($plan->price * 100),
                ],
                'quantity' => 1,
            ]],
            'mode' => $plan->billing_period === 'lifetime' ? 'payment' : 'subscription',
            'customer_email' => $user->email,
            'success_url' => route('payment.callback', ['gateway' => 'stripe', 'session_id' => '{CHECKOUT_SESSION_ID}']),
            'cancel_url' => route('payment.callback', ['gateway' => 'stripe', 'cancelled' => 1]),
            'metadata' => [
                'user_id' => $user->id,
                'plan_id' => $plan->id,
            ],
        ];

        // Handle recurring rules if it's a subscription
        if ($plan->billing_period !== 'lifetime') {
            $sessionData['line_items'][0]['price_data']['recurring'] = [
                'interval' => $plan->billing_period === 'yearly' ? 'year' : 'month',
            ];
            $sessionData['subscription_data'] = [
                'metadata' => [
                    'user_id' => $user->id,
                    'plan_id' => $plan->id,
                ],
            ];
        }

        try {
            $session = $this->stripe->checkout->sessions->create($sessionData);
            return $session->url;
        } catch (\Exception $e) {
            Log::error('Stripe Session creation failed: ' . $e->getMessage());
            throw new \Exception('Stripe error: ' . $e->getMessage());
        }
    }

    public function handleWebhook(Request $request): Response
    {
        $payload = $request->getContent();
        $sig_header = $request->header('Stripe-Signature');
        $webhookSecret = $this->config['webhook_secret'] ?? '';

        try {
            $event = \Stripe\Webhook::constructEvent($payload, $sig_header, $webhookSecret);
        } catch (\UnexpectedValueException $e) {
            return response('Invalid payload', 400);
        } catch (\Stripe\Exception\SignatureVerificationException $e) {
            return response('Invalid signature', 400);
        }

        Log::info('Stripe Webhook received: ' . $event->type);

        switch ($event->type) {
            case 'checkout.session.completed':
                $this->handleCheckoutCompleted($event->data->object);
                break;
            case 'invoice.paid':
                $this->handleInvoicePaid($event->data->object);
                break;
            case 'customer.subscription.deleted':
                $this->handleSubscriptionDeleted($event->data->object);
                break;
        }

        return response('Webhook Handled', 200);
    }

    public function callback(Request $request): RedirectResponse
    {
        if ($request->has('cancelled')) {
            return redirect()->route('create')->with('error', 'Payment was cancelled');
        }

        return redirect()->route('create')->with('success', 'Your payment is being processed. It will take a few minutes to activate your subscription.');
    }

    public function cancelSubscription(Subscription $subscription): void
    {
        if (!$subscription->external_subscription_id) {
            return;
        }

        $this->ensureStripeIsInitialized();
        try {
            $this->stripe->subscriptions->cancel($subscription->external_subscription_id);
            Log::info('Stripe subscription cancelled: ' . $subscription->external_subscription_id);
        } catch (\Exception $e) {
            Log::error('Stripe cancellation failed: ' . $e->getMessage());
            throw new \Exception('Failed to cancel Stripe subscription: ' . $e->getMessage());
        }
    }

    public function getSubscriptionStatus(string $subscriptionId): array
    {
        $this->ensureStripeIsInitialized();
        $sub = $this->stripe->subscriptions->retrieve($subscriptionId);
        return [
            'status' => $sub->status === 'active' ? Subscription::STATUS_ACTIVE : Subscription::STATUS_PENDING,
            'next_billing_time' => $sub->current_period_end,
        ];
    }

    private function ensureStripeIsInitialized(): void
    {
        if ($this->stripe === null) {
            $secretKey = $this->config['secret_key'] ?? null;
            if (!$secretKey) {
                throw new \Exception('Stripe API Key not configured');
            }
            $this->stripe = new StripeClient($secretKey);
        }
    }

    public function getSupportedCurrencies(): array
    {
        return []; // All supported
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
    | Webhook Handlers
    |--------------------------------------------------------------------------
    */

    private function handleCheckoutCompleted($session): void
    {
        $userId = $session->metadata->user_id;
        $planId = $session->metadata->plan_id;
        $subscriptionId = $session->subscription; // Will be null for one-time payments

        $user = User::find($userId);
        $plan = Plan::find($planId);

        if (!$user || !$plan) {
            Log::error('Stripe Webhook: User or Plan not found', ['session_id' => $session->id]);
            return;
        }

        // Create or update subscription
        $subscription = Subscription::updateOrCreate(
            ['user_id' => $user->id, 'external_subscription_id' => $subscriptionId],
            [
                'plan_id' => $plan->id,
                'status' => Subscription::STATUS_ACTIVE,
                'payment_method' => Subscription::PAYMENT_STRIPE,
                'amount' => $session->amount_total / 100,
                'starts_at' => now(),
                'renewal_at' => $this->calculateRenewalDate($plan),
            ]
        );

        $user->update(['plan_id' => $plan->id]);

        // Record Initial Transaction
        Transaction::create([
            'external_transaction_id' => $session->payment_intent ?? $session->id,
            'user_id' => $user->id,
            'subscription_id' => $subscription->id,
            'amount' => $session->amount_total / 100,
            'currency' => strtoupper($session->currency),
            'status' => Transaction::STATUS_COMPLETED,
            'type' => Transaction::TYPE_SUBSCRIPTION_NEW,
            'payment_method' => Transaction::PAYMENT_STRIPE,
        ]);

        $user->notify(new SubscriptionActivatedNotification($subscription));
        AdminPaymentNotification::sendIfEnabled('subscription_activated', $user, $subscription);
    }

    private function handleInvoicePaid($invoice): void
    {
        $stripeSubId = $invoice->subscription;
        if (!$stripeSubId) return;

        $subscription = Subscription::where('external_subscription_id', $stripeSubId)->first();
        if (!$subscription) return;

        // Don't record again if we handled checkout.completed for this invoice's payment intent
        if (Transaction::where('external_transaction_id', $invoice->payment_intent)->exists()) {
            return;
        }

        $transaction = Transaction::create([
            'external_transaction_id' => $invoice->payment_intent,
            'user_id' => $subscription->user_id,
            'subscription_id' => $subscription->id,
            'amount' => $invoice->amount_paid / 100,
            'currency' => strtoupper($invoice->currency),
            'status' => Transaction::STATUS_COMPLETED,
            'type' => Transaction::TYPE_SUBSCRIPTION_RENEWAL,
            'payment_method' => Transaction::PAYMENT_STRIPE,
        ]);

        $subscription->update([
            'renewal_at' => $this->calculateRenewalDate($subscription->plan),
        ]);

        $user = $subscription->user;
        if ($user) {
            $user->notify(new PaymentCompletedNotification($transaction));
            AdminPaymentNotification::sendIfEnabled('payment_completed', $user, $subscription, $transaction);
        }
    }

    private function handleSubscriptionDeleted($stripeSubscription): void
    {
        $subscription = Subscription::where('external_subscription_id', $stripeSubscription->id)->first();
        if ($subscription) {
            $subscription->update(['status' => Subscription::STATUS_CANCELLED]);
        }
    }

    private function calculateRenewalDate(Plan $plan): \Carbon\Carbon
    {
        return match ($plan->billing_period) {
            'yearly' => now()->addYear(),
            'lifetime' => now()->addYears(100),
            default => now()->addMonth(),
        };
    }
}
