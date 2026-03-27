import { describe, it, expect } from 'vitest';
import { formatDate, formatDateTime, formatRelativeTime } from '../date';

describe('formatDate', () => {
    it('returns dash for null input', () => {
        expect(formatDate(null)).toBe('-');
    });

    it('returns dash for undefined input', () => {
        expect(formatDate(undefined)).toBe('-');
    });

    it('returns dash for empty string', () => {
        expect(formatDate('')).toBe('-');
    });

    it('returns dash for invalid date string', () => {
        expect(formatDate('not-a-date')).toBe('-');
    });

    it('formats with Y-m-d format', () => {
        const result = formatDate('2024-01-15T10:30:00Z', 'Y-m-d', 'UTC');
        expect(result).toBe('2024-01-15');
    });

    it('formats with d/m/Y format', () => {
        const result = formatDate('2024-01-15T10:30:00Z', 'd/m/Y', 'UTC');
        expect(result).toBe('15/01/2024');
    });

    it('formats with m/d/Y format', () => {
        const result = formatDate('2024-01-15T10:30:00Z', 'm/d/Y', 'UTC');
        expect(result).toBe('01/15/2024');
    });

    it('formats with F j, Y format (long month)', () => {
        const result = formatDate('2024-01-15T10:30:00Z', 'F j, Y', 'UTC', 'en-US');
        expect(result).toBe('January 15, 2024');
    });

    it('formats with M j, Y format (short month)', () => {
        const result = formatDate('2024-01-15T10:30:00Z', 'M j, Y', 'UTC', 'en-US');
        expect(result).toBe('Jan 15, 2024');
    });

    it('applies timezone conversion — UTC to Tokyo crosses date boundary', () => {
        // 2024-01-15 22:00 UTC = 2024-01-16 07:00 Asia/Tokyo
        const result = formatDate('2024-01-15T22:00:00Z', 'Y-m-d', 'Asia/Tokyo');
        expect(result).toBe('2024-01-16');
    });

    it('applies timezone conversion with d/m/Y format', () => {
        // 2024-01-15 22:00 UTC = 2024-01-16 07:00 Asia/Tokyo
        const result = formatDate('2024-01-15T22:00:00Z', 'd/m/Y', 'Asia/Tokyo');
        expect(result).toBe('16/01/2024');
    });

    it('uses defaults when format and timezone omitted', () => {
        const result = formatDate('2024-01-15T10:30:00Z');
        expect(result).toBe('2024-01-15');
    });
});

describe('formatDateTime', () => {
    it('returns dash for null input', () => {
        expect(formatDateTime(null)).toBe('-');
    });

    it('returns dash for undefined input', () => {
        expect(formatDateTime(undefined)).toBe('-');
    });

    it('includes time component', () => {
        const result = formatDateTime('2024-01-15T14:30:00Z', 'Y-m-d', 'UTC', 'en-US');
        // Should contain the date and a time like "2:30 PM"
        expect(result).toContain('2024-01-15');
        expect(result).toMatch(/2:30/);
    });

    it('applies timezone to time component', () => {
        // 2024-01-15 22:00 UTC = 2024-01-16 07:00 Asia/Tokyo
        const result = formatDateTime('2024-01-15T22:00:00Z', 'Y-m-d', 'Asia/Tokyo', 'en-US');
        expect(result).toContain('2024-01-16');
        expect(result).toMatch(/7:00/);
    });
});

describe('formatRelativeTime', () => {
    it('returns dash for null input', () => {
        expect(formatRelativeTime(null)).toBe('-');
    });

    it('returns dash for undefined input', () => {
        expect(formatRelativeTime(undefined)).toBe('-');
    });

    it('returns a relative string for recent past date', () => {
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        const result = formatRelativeTime(fiveMinutesAgo, 'en');
        expect(result).toBeTruthy();
        expect(result).not.toBe('-');
    });

    it('returns a relative string for future date', () => {
        const inTwoDays = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
        const result = formatRelativeTime(inTwoDays, 'en');
        expect(result).toBeTruthy();
        expect(result).not.toBe('-');
    });
});
