/**
 * Style save utilities for persisting visual editor class changes.
 *
 * Two strategies:
 * 1. Mechanical: Direct className string replacement in source files
 * 2. AI fallback: Send class changes as a chat message for AI to apply
 */

export type SaveStrategy = 'mechanical' | 'ai';

/**
 * Determine whether a className change can be saved mechanically
 * (simple string replacement) or needs AI assistance.
 */
export function determineSaveStrategy(
    fileContent: string,
    originalClassStr: string,
): SaveStrategy {
    // Check for simple className="..." literal containing the exact classes
    const patterns = [
        `className="${originalClassStr}"`,
        `className='${originalClassStr}'`,
        `class="${originalClassStr}"`,
        `class='${originalClassStr}'`,
    ];
    for (const pattern of patterns) {
        if (fileContent.includes(pattern)) {
            return 'mechanical';
        }
    }
    return 'ai';
}

/**
 * Format class changes as a chat message for AI-assisted save.
 */
export function formatStyleEditMessage(
    elementDescription: string,
    oldClasses: string[],
    newClasses: string[],
): string {
    const added = newClasses.filter(c => !oldClasses.includes(c));
    const removed = oldClasses.filter(c => !newClasses.includes(c));

    const parts: string[] = ['[STYLE_EDIT] Update element classes:'];
    parts.push(`Element: ${elementDescription}`);
    if (removed.length > 0) {
        parts.push(`Remove: ${removed.join(' ')}`);
    }
    if (added.length > 0) {
        parts.push(`Add: ${added.join(' ')}`);
    }
    parts.push(`Final classes: ${newClasses.join(' ')}`);

    return parts.join('\n');
}

/**
 * Build a mechanical replacement payload for the builder file update API.
 */
export function buildMechanicalEdit(
    originalClassStr: string,
    newClassStr: string,
): { search: string; replace: string } {
    return {
        search: `className="${originalClassStr}"`,
        replace: `className="${newClassStr}"`,
    };
}
