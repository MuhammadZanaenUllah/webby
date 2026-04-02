import { Key, Infinity as InfinityIcon, Coins } from 'lucide-react';
import { useTranslation } from '@/contexts/LanguageContext';
import type { UserCredits } from '@/types/notifications';

/**
 * Compact credit display for dashboard headers.
 * Shows "Using your API key" for own API key users (takes priority).
 * Shows "Unlimited Credits" for unlimited plans.
 * Shows "remaining / total credits" for limited plans.
 */
export function GlobalCredits({
    remaining,
    monthlyLimit,
    isUnlimited,
    usingOwnKey,
}: UserCredits) {
    const { t } = useTranslation();

    // Using own API key takes priority
    if (usingOwnKey) {
        return (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/5 border border-primary/10 text-[11px] font-semibold text-primary/80 shadow-sm">
                <Key className="h-3 w-3" />
                {t('Personal Key')}
            </div>
        );
    }

    // Unlimited credits
    if (isUnlimited) {
        return (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20 text-[11px] font-bold text-primary shadow-sm animate-pulse-subtle">
                <InfinityIcon className="h-3 w-3" />
                {t('Unlimited')}
            </div>
        );
    }

    // Limited credits
    return (
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted/50 border border-border/50 text-[11px] font-medium text-muted-foreground shadow-sm">
            <Coins className="h-3 w-3 text-primary/60" />
            <span>
                <span className="text-foreground font-bold">{remaining.toLocaleString()}</span>
                <span className="mx-1 opacity-40">/</span>
                <span className="opacity-70">{monthlyLimit.toLocaleString()}</span>
            </span>
        </div>
    );
}
