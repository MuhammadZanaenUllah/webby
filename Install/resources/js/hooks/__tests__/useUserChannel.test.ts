import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useUserChannel } from '../useUserChannel';
import type { BroadcastConfig } from '../useBuilderPusher';

// Mock Echo and Pusher
const mockChannel = {
    listen: vi.fn().mockReturnThis(),
};

const mockEcho = {
    private: vi.fn().mockReturnValue(mockChannel),
    leave: vi.fn(),
};

// Mock Echo as a constructor function (must use `function`, not arrow, to support `new`)
vi.mock('laravel-echo', () => ({
    default: vi.fn().mockImplementation(function () { return mockEcho; }),
}));

vi.mock('pusher-js', () => ({
    default: vi.fn(),
}));

// Track config key counter so each test gets a unique key (avoids module-level echoInstances cache)
let configCounter = 0;

describe('useUserChannel', () => {
    let defaultConfig: BroadcastConfig;

    beforeEach(() => {
        // Only clear call history, not implementations
        mockEcho.private.mockClear();
        mockEcho.leave.mockClear();
        mockChannel.listen.mockClear();
        // Re-set return values
        mockChannel.listen.mockReturnThis();
        mockEcho.private.mockReturnValue(mockChannel);
        // Each test gets a unique config key to avoid the module-level echoInstances cache
        configCounter++;
        defaultConfig = {
            provider: 'pusher',
            key: `test-key-${configCounter}`,
            cluster: 'mt1',
        };
    });

    it('does not subscribe when disabled', () => {
        const { result } = renderHook(() =>
            useUserChannel({
                userId: 1,
                broadcastConfig: defaultConfig,
                enabled: false,
            })
        );

        expect(result.current.isConnected).toBe(false);
    });

    it('does not subscribe when userId is null', () => {
        const { result } = renderHook(() =>
            useUserChannel({
                userId: null,
                broadcastConfig: defaultConfig,
                enabled: true,
            })
        );

        expect(result.current.isConnected).toBe(false);
    });

    it('does not subscribe when broadcastConfig is null', () => {
        const { result } = renderHook(() =>
            useUserChannel({
                userId: 1,
                broadcastConfig: null,
                enabled: true,
            })
        );

        expect(result.current.isConnected).toBe(false);
    });

    it('does not subscribe when broadcastConfig has no key', () => {
        const { result } = renderHook(() =>
            useUserChannel({
                userId: 1,
                broadcastConfig: { ...defaultConfig, key: '' },
                enabled: true,
            })
        );

        expect(result.current.isConnected).toBe(false);
    });

    it('returns error as null when not connected', () => {
        const { result } = renderHook(() =>
            useUserChannel({
                userId: null,
                broadcastConfig: defaultConfig,
                enabled: true,
            })
        );

        expect(result.current.error).toBeNull();
    });

    it('accepts onNotification callback', () => {
        const onNotification = vi.fn();
        const { result } = renderHook(() =>
            useUserChannel({
                userId: 1,
                broadcastConfig: defaultConfig,
                enabled: true,
                onNotification,
            })
        );

        // Hook should render without error
        expect(result.current).toBeDefined();
    });

    it('accepts onCreditsUpdated callback', () => {
        const onCreditsUpdated = vi.fn();
        const { result } = renderHook(() =>
            useUserChannel({
                userId: 1,
                broadcastConfig: defaultConfig,
                enabled: true,
                onCreditsUpdated,
            })
        );

        // Hook should render without error
        expect(result.current).toBeDefined();
    });

    it('accepts onProjectStatus callback', () => {
        const onProjectStatus = vi.fn();
        const { result } = renderHook(() =>
            useUserChannel({
                userId: 1,
                broadcastConfig: defaultConfig,
                enabled: true,
                onProjectStatus,
            })
        );

        // Hook should render without error
        expect(result.current).toBeDefined();
    });

    it('returns isConnected and error in result', () => {
        const { result } = renderHook(() =>
            useUserChannel({
                userId: 1,
                broadcastConfig: defaultConfig,
                enabled: true,
            })
        );

        expect(result.current).toHaveProperty('isConnected');
        expect(result.current).toHaveProperty('error');
    });

    it('does not re-subscribe when broadcastConfig reference changes but values stay same', () => {
        const uniqueKey = `stable-key-${configCounter}`;
        const configA: BroadcastConfig = { provider: 'pusher', key: uniqueKey, cluster: 'mt1' };
        const configB: BroadcastConfig = { provider: 'pusher', key: uniqueKey, cluster: 'mt1' };

        const { rerender } = renderHook(
            ({ config }) =>
                useUserChannel({
                    userId: 1,
                    broadcastConfig: config,
                    enabled: true,
                }),
            { initialProps: { config: configA } }
        );

        // First render subscribes
        expect(mockEcho.private).toHaveBeenCalledTimes(1);

        // Rerender with a new object reference but identical values
        rerender({ config: configB });

        // Should NOT subscribe again — broadcastConfigKey is stable
        expect(mockEcho.private).toHaveBeenCalledTimes(1);
    });

    it('unsubscribes from old channel when userId changes', () => {
        const { rerender } = renderHook(
            ({ userId }) =>
                useUserChannel({
                    userId,
                    broadcastConfig: defaultConfig,
                    enabled: true,
                }),
            { initialProps: { userId: 1 as number } }
        );

        // First render subscribes to user 1
        expect(mockEcho.private).toHaveBeenCalledTimes(1);
        expect(mockEcho.private).toHaveBeenCalledWith('App.Models.User.1');

        // Change userId to 2
        rerender({ userId: 2 });

        // Should have left the old channel and subscribed to the new one
        expect(mockEcho.leave).toHaveBeenCalledWith('App.Models.User.1');
        expect(mockEcho.private).toHaveBeenCalledWith('App.Models.User.2');
    });
});
