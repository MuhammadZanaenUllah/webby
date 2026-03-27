<?php

namespace App\Helpers;

use App\Models\SystemSetting;
use Carbon\Carbon;

class DateHelper
{
    /**
     * Format a date for display using the system date_format and timezone.
     * Database dates stay in UTC; this converts only for display.
     *
     * @param  Carbon|null  $date  The date to format (typically stored in UTC).
     * @param  string|null  $format  Override format (uses system setting if null).
     * @return string Formatted date string, or '-' if date is null.
     */
    public static function format(?Carbon $date, ?string $format = null): string
    {
        if ($date === null) {
            return '-';
        }

        return $date->copy()
            ->timezone(self::getTimezone())
            ->format($format ?? self::getFormat());
    }

    /**
     * Format a date with time for display.
     * Appends locale-aware time to the configured date format.
     *
     * @param  Carbon|null  $date  The date to format (typically stored in UTC).
     * @param  string|null  $format  Override date format (uses system setting if null).
     * @return string Formatted date+time string, or '-' if date is null.
     */
    public static function formatDateTime(?Carbon $date, ?string $format = null): string
    {
        if ($date === null) {
            return '-';
        }

        $dateFormat = $format ?? self::getFormat();
        $converted = $date->copy()->timezone(self::getTimezone());

        $datePart = $converted->format($dateFormat);
        $timePart = $converted->locale(app()->getLocale())->translatedFormat('g:i A');

        return $datePart.' '.$timePart;
    }

    /**
     * Get the system timezone from settings.
     */
    public static function getTimezone(): string
    {
        return SystemSetting::get('timezone', 'UTC');
    }

    /**
     * Get the system date format from settings.
     */
    public static function getFormat(): string
    {
        return SystemSetting::get('date_format', 'Y-m-d');
    }
}
