import { usePage } from '@inertiajs/react';

/**
 * Format a date string using the admin-configured date_format and timezone.
 *
 * Supported PHP formats:
 * - 'Y-m-d'  → 2024-01-15
 * - 'd/m/Y'  → 15/01/2024
 * - 'm/d/Y'  → 01/15/2024
 * - 'F j, Y' → January 15, 2024
 * - 'M j, Y' → Jan 15, 2024
 *
 * @param dateString - ISO date string from backend (always UTC)
 * @param format - PHP date format from appSettings.date_format
 * @param timezone - IANA timezone from appSettings.timezone
 * @param locale - Locale for month names (defaults to 'en')
 */
export function formatDate(
    dateString: string | null | undefined,
    format: string = 'Y-m-d',
    timezone: string = 'UTC',
    locale: string = 'en',
): string {
    if (!dateString) return '-';

    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '-';

    // For numeric-only formats, use manual formatting with timezone-aware parts
    const manual = manualFormatWithTimezone(date, format, timezone);
    if (manual !== null) return manual;

    // For text-based formats (F j, Y and M j, Y), use Intl.DateTimeFormat
    const options = getIntlOptions(format);
    return new Intl.DateTimeFormat(locale, {
        ...options,
        timeZone: timezone,
    }).format(date);
}

/**
 * Format a date string with time.
 */
export function formatDateTime(
    dateString: string | null | undefined,
    format: string = 'Y-m-d',
    timezone: string = 'UTC',
    locale: string = 'en',
): string {
    if (!dateString) return '-';

    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '-';

    const datePart = formatDate(dateString, format, timezone, locale);
    const timePart = new Intl.DateTimeFormat(locale, {
        timeZone: timezone,
        hour: 'numeric',
        minute: '2-digit',
    }).format(date);

    return `${datePart} ${timePart}`;
}

/**
 * Format a relative time ("5 minutes ago", "in 3 days").
 */
export function formatRelativeTime(
    dateString: string | null | undefined,
    locale: string = 'en',
): string {
    if (!dateString) return '-';

    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '-';

    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffSec = Math.round(diffMs / 1000);
    const diffMin = Math.round(diffSec / 60);
    const diffHour = Math.round(diffMin / 60);
    const diffDay = Math.round(diffHour / 24);

    try {
        const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

        if (Math.abs(diffDay) >= 1) return rtf.format(diffDay, 'day');
        if (Math.abs(diffHour) >= 1) return rtf.format(diffHour, 'hour');
        if (Math.abs(diffMin) >= 1) return rtf.format(diffMin, 'minute');
        return rtf.format(diffSec, 'second');
    } catch {
        // Fallback for environments without RelativeTimeFormat
        const prefix = diffMs > 0 ? 'in ' : '';
        const suffix = diffMs <= 0 ? ' ago' : '';
        if (Math.abs(diffDay) >= 1) return `${prefix}${Math.abs(diffDay)}d${suffix}`;
        if (Math.abs(diffHour) >= 1) return `${prefix}${Math.abs(diffHour)}h${suffix}`;
        if (Math.abs(diffMin) >= 1) return `${prefix}${Math.abs(diffMin)}m${suffix}`;
        return `${prefix}${Math.abs(diffSec)}s${suffix}`;
    }
}

/**
 * React hook that reads appSettings and returns bound date formatters.
 */
export function useAppDate() {
    const { appSettings } = usePage().props;
    const timezone = appSettings?.timezone ?? 'UTC';
    const dateFormat = appSettings?.date_format ?? 'Y-m-d';

    return {
        timezone,
        dateFormat,
        formatDate: (dateString: string | null | undefined, locale?: string) =>
            formatDate(dateString, dateFormat, timezone, locale),
        formatDateTime: (dateString: string | null | undefined, locale?: string) =>
            formatDateTime(dateString, dateFormat, timezone, locale),
        formatRelativeTime: (dateString: string | null | undefined, locale?: string) =>
            formatRelativeTime(dateString, locale),
    };
}

// --- Internal helpers ---

/**
 * For numeric-only formats (Y-m-d, d/m/Y, m/d/Y), extract date parts
 * in the target timezone and manually build the ordered string.
 * Returns null for text-based formats so Intl can handle them.
 */
function manualFormatWithTimezone(
    date: Date,
    phpFormat: string,
    timezone: string,
): string | null {
    if (!['Y-m-d', 'd/m/Y', 'm/d/Y'].includes(phpFormat)) return null;

    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(date);

    const year = parts.find((p) => p.type === 'year')?.value ?? '';
    const month = parts.find((p) => p.type === 'month')?.value ?? '';
    const day = parts.find((p) => p.type === 'day')?.value ?? '';

    switch (phpFormat) {
        case 'Y-m-d':
            return `${year}-${month}-${day}`;
        case 'd/m/Y':
            return `${day}/${month}/${year}`;
        case 'm/d/Y':
            return `${month}/${day}/${year}`;
        default:
            return null;
    }
}

/**
 * Map text-based PHP date formats to Intl.DateTimeFormat options.
 */
function getIntlOptions(phpFormat: string): Intl.DateTimeFormatOptions {
    switch (phpFormat) {
        case 'F j, Y':
            return { year: 'numeric', month: 'long', day: 'numeric' };
        case 'M j, Y':
            return { year: 'numeric', month: 'short', day: 'numeric' };
        default:
            return { year: 'numeric', month: 'short', day: 'numeric' };
    }
}
