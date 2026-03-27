/** Shared Tailwind CSS data for the style panel tabs */

export const SPACING_SCALE = [
    '0', '0.5', '1', '1.5', '2', '2.5', '3', '3.5', '4', '5', '6', '7', '8',
    '9', '10', '11', '12', '14', '16', '20', '24', '28', '32', '36', '40',
    '44', '48', '52', '56', '60', '64', '72', '80', '96',
] as const;

export const FONT_SIZES = ['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl', '6xl', '7xl', '8xl', '9xl'] as const;

export const FONT_WEIGHTS = [
    { value: 'thin', label: 'Thin' },
    { value: 'extralight', label: 'Extra Light' },
    { value: 'light', label: 'Light' },
    { value: 'normal', label: 'Normal' },
    { value: 'medium', label: 'Medium' },
    { value: 'semibold', label: 'Semibold' },
    { value: 'bold', label: 'Bold' },
    { value: 'extrabold', label: 'Extra Bold' },
    { value: 'black', label: 'Black' },
] as const;

export const TEXT_ALIGNS = ['left', 'center', 'right', 'justify'] as const;

export const LINE_HEIGHTS = [
    { value: 'none', label: 'None (1)' },
    { value: 'tight', label: 'Tight (1.25)' },
    { value: 'snug', label: 'Snug (1.375)' },
    { value: 'normal', label: 'Normal (1.5)' },
    { value: 'relaxed', label: 'Relaxed (1.625)' },
    { value: 'loose', label: 'Loose (2)' },
] as const;

export const LETTER_SPACINGS = [
    { value: 'tighter', label: 'Tighter' },
    { value: 'tight', label: 'Tight' },
    { value: 'normal', label: 'Normal' },
    { value: 'wide', label: 'Wide' },
    { value: 'wider', label: 'Wider' },
    { value: 'widest', label: 'Widest' },
] as const;

export const COLOR_FAMILIES = [
    'slate', 'gray', 'zinc', 'neutral', 'stone',
    'red', 'orange', 'amber', 'yellow', 'lime',
    'green', 'emerald', 'teal', 'cyan', 'sky',
    'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose',
] as const;

export const COLOR_SHADES = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'] as const;

// Inline hex values for the swatch preview (subset for display only)
export const COLOR_SWATCH: Record<string, string> = {
    slate: '#64748b', gray: '#6b7280', zinc: '#71717a', neutral: '#737373', stone: '#78716c',
    red: '#ef4444', orange: '#f97316', amber: '#f59e0b', yellow: '#eab308', lime: '#84cc16',
    green: '#22c55e', emerald: '#10b981', teal: '#14b8a6', cyan: '#06b6d4', sky: '#0ea5e9',
    blue: '#3b82f6', indigo: '#6366f1', violet: '#8b5cf6', purple: '#a855f7', fuchsia: '#d946ef',
    pink: '#ec4899', rose: '#f43f5e',
};

export const SHADE_HEX: Record<string, Record<string, string>> = {
    slate: { 50:'#f8fafc',100:'#f1f5f9',200:'#e2e8f0',300:'#cbd5e1',400:'#94a3b8',500:'#64748b',600:'#475569',700:'#334155',800:'#1e293b',900:'#0f172a',950:'#020617' },
    gray: { 50:'#f9fafb',100:'#f3f4f6',200:'#e5e7eb',300:'#d1d5db',400:'#9ca3af',500:'#6b7280',600:'#4b5563',700:'#374151',800:'#1f2937',900:'#111827',950:'#030712' },
    red: { 50:'#fef2f2',100:'#fee2e2',200:'#fecaca',300:'#fca5a5',400:'#f87171',500:'#ef4444',600:'#dc2626',700:'#b91c1c',800:'#991b1b',900:'#7f1d1d',950:'#450a0a' },
    orange: { 50:'#fff7ed',100:'#ffedd5',200:'#fed7aa',300:'#fdba74',400:'#fb923c',500:'#f97316',600:'#ea580c',700:'#c2410c',800:'#9a3412',900:'#7c2d12',950:'#431407' },
    amber: { 50:'#fffbeb',100:'#fef3c7',200:'#fde68a',300:'#fcd34d',400:'#fbbf24',500:'#f59e0b',600:'#d97706',700:'#b45309',800:'#92400e',900:'#78350f',950:'#451a03' },
    yellow: { 50:'#fefce8',100:'#fef9c3',200:'#fef08a',300:'#fde047',400:'#facc15',500:'#eab308',600:'#ca8a04',700:'#a16207',800:'#854d0e',900:'#713f12',950:'#422006' },
    green: { 50:'#f0fdf4',100:'#dcfce7',200:'#bbf7d0',300:'#86efac',400:'#4ade80',500:'#22c55e',600:'#16a34a',700:'#15803d',800:'#166534',900:'#14532d',950:'#052e16' },
    teal: { 50:'#f0fdfa',100:'#ccfbf1',200:'#99f6e4',300:'#5eead4',400:'#2dd4bf',500:'#14b8a6',600:'#0d9488',700:'#0f766e',800:'#115e59',900:'#134e4a',950:'#042f2e' },
    blue: { 50:'#eff6ff',100:'#dbeafe',200:'#bfdbfe',300:'#93c5fd',400:'#60a5fa',500:'#3b82f6',600:'#2563eb',700:'#1d4ed8',800:'#1e40af',900:'#1e3a8a',950:'#172554' },
    indigo: { 50:'#eef2ff',100:'#e0e7ff',200:'#c7d2fe',300:'#a5b4fc',400:'#818cf8',500:'#6366f1',600:'#4f46e5',700:'#4338ca',800:'#3730a3',900:'#312e81',950:'#1e1b4b' },
    violet: { 50:'#f5f3ff',100:'#ede9fe',200:'#ddd6fe',300:'#c4b5fd',400:'#a78bfa',500:'#8b5cf6',600:'#7c3aed',700:'#6d28d9',800:'#5b21b6',900:'#4c1d95',950:'#2e1065' },
    purple: { 50:'#faf5ff',100:'#f3e8ff',200:'#e9d5ff',300:'#d8b4fe',400:'#c084fc',500:'#a855f7',600:'#9333ea',700:'#7e22ce',800:'#6b21a8',900:'#581c87',950:'#3b0764' },
    pink: { 50:'#fdf2f8',100:'#fce7f3',200:'#fbcfe8',300:'#f9a8d4',400:'#f472b6',500:'#ec4899',600:'#db2777',700:'#be185d',800:'#9d174d',900:'#831843',950:'#500724' },
    rose: { 50:'#fff1f2',100:'#ffe4e6',200:'#fecdd3',300:'#fda4af',400:'#fb7185',500:'#f43f5e',600:'#e11d48',700:'#be123c',800:'#9f1239',900:'#881337',950:'#4c0519' },
};

export const DISPLAY_OPTIONS = [
    { value: 'block', label: 'Block' },
    { value: 'inline-block', label: 'Inline Block' },
    { value: 'inline', label: 'Inline' },
    { value: 'flex', label: 'Flex' },
    { value: 'inline-flex', label: 'Inline Flex' },
    { value: 'grid', label: 'Grid' },
    { value: 'hidden', label: 'Hidden' },
] as const;

export const POSITION_OPTIONS = ['static', 'relative', 'absolute', 'fixed', 'sticky'] as const;

export const FLEX_DIRECTIONS = [
    { value: 'flex-row', label: 'Row' },
    { value: 'flex-col', label: 'Column' },
    { value: 'flex-row-reverse', label: 'Row Reverse' },
    { value: 'flex-col-reverse', label: 'Col Reverse' },
] as const;

export const JUSTIFY_OPTIONS = [
    { value: 'start', label: 'Start' },
    { value: 'center', label: 'Center' },
    { value: 'end', label: 'End' },
    { value: 'between', label: 'Between' },
    { value: 'around', label: 'Around' },
    { value: 'evenly', label: 'Evenly' },
] as const;

export const ALIGN_OPTIONS = [
    { value: 'start', label: 'Start' },
    { value: 'center', label: 'Center' },
    { value: 'end', label: 'End' },
    { value: 'stretch', label: 'Stretch' },
    { value: 'baseline', label: 'Baseline' },
] as const;

export const BORDER_WIDTHS = ['0', '1', '2', '4', '8'] as const;
export const BORDER_STYLES = ['solid', 'dashed', 'dotted', 'double', 'none'] as const;
export const BORDER_RADIUS = ['none', 'sm', '', 'md', 'lg', 'xl', '2xl', '3xl', 'full'] as const;
export const BORDER_RADIUS_LABELS: Record<string, string> = {
    none: 'None', sm: 'SM', '': 'Base', md: 'MD', lg: 'LG', xl: 'XL', '2xl': '2XL', '3xl': '3XL', full: 'Full',
};

export const SHADOW_OPTIONS = [
    { value: 'none', label: 'None' },
    { value: 'sm', label: 'SM' },
    { value: '', label: 'Base' },
    { value: 'md', label: 'MD' },
    { value: 'lg', label: 'LG' },
    { value: 'xl', label: 'XL' },
    { value: '2xl', label: '2XL' },
    { value: 'inner', label: 'Inner' },
] as const;

export const BREAKPOINTS = ['', 'sm', 'md', 'lg', 'xl', '2xl'] as const;
export const BREAKPOINT_LABELS: Record<string, string> = {
    '': 'Base', sm: 'SM', md: 'MD', lg: 'LG', xl: 'XL', '2xl': '2XL',
};

/**
 * Parse current Tailwind classes to find the active value for a given prefix.
 * E.g., findClassValue(['text-lg', 'font-bold', 'p-4'], 'text-', breakpoint) → 'lg'
 */
export function findClassValue(classes: string[], prefix: string, breakpoint: string = ''): string | null {
    const bp = breakpoint ? `${breakpoint}:` : '';
    for (const cls of classes) {
        if (cls.startsWith(bp + prefix)) {
            return cls.slice((bp + prefix).length);
        }
        // Exact match (e.g., 'flex', 'block', 'hidden')
        if (!prefix.includes('-') && cls === (bp ? bp + prefix : prefix)) {
            return prefix;
        }
    }
    return null;
}

/**
 * Find which exact class matches a set of possible values.
 * E.g., findExactClass(['flex', 'p-4'], ['block', 'flex', 'grid'], '') → 'flex'
 */
export function findExactClass(classes: string[], possibleValues: readonly string[], breakpoint: string = ''): string | null {
    const bp = breakpoint ? `${breakpoint}:` : '';
    for (const val of possibleValues) {
        if (classes.includes(bp + val)) return val;
    }
    return null;
}

/**
 * Find the color value for a given property prefix, matching only color patterns.
 * Avoids false positives from non-color classes sharing the same prefix
 * (e.g., border-2, border-solid when prefix is 'border-').
 */
export function findColorValue(classes: string[], prefix: string, breakpoint: string = ''): string | null {
    const bp = breakpoint ? `${breakpoint}:` : '';
    const full = bp + prefix;
    for (const cls of classes) {
        if (!cls.startsWith(full)) continue;
        const rest = cls.slice(full.length);
        // Match family-shade (e.g., blue-500) or special values
        if (/^[a-z]+-\d+(\/\d+)?$/.test(rest) || ['white', 'black', 'transparent'].includes(rest)) {
            return rest;
        }
    }
    return null;
}
