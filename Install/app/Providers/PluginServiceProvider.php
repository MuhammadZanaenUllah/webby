<?php

namespace App\Providers;

use App\Services\PluginManager;
use Illuminate\Support\ServiceProvider;

class PluginServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        // Register PluginManager as singleton
        $this->app->singleton(PluginManager::class, function ($app) {
            return new PluginManager;
        });

        // Also bind to 'plugins' for convenience
        $this->app->alias(PluginManager::class, 'plugins');
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Boot plugins after application is ready
        $this->app->make(PluginManager::class)->boot();
    }
}
