/**
 * Preview Inspector Script
 *
 * This script is injected into preview iframes to enable:
 * - Element inspection with hover highlighting
 * - Element selection with context menu
 * - Inline text/attribute editing
 *
 * Communication with parent window via postMessage.
 */

// Type definitions (inline to avoid bundling issues)
interface InspectorElement {
    id: string;
    tagName: string;
    elementId: string | null;
    classNames: string[];
    textPreview: string;
    xpath: string;
    cssSelector: string;
    boundingRect: {
        top: number;
        left: number;
        width: number;
        height: number;
    };
    attributes: Record<string, string>;
    parentTagName: string | null;
}

interface PendingEdit {
    id: string;
    element: InspectorElement;
    field: 'text' | 'href' | 'src' | 'placeholder' | 'title' | 'alt';
    originalValue: string;
    newValue: string;
    timestamp: Date;
}

type InspectorMode = 'preview' | 'inspect';

// ============================================
// State
// ============================================

let mode: InspectorMode = 'preview';
let highlightOverlay: HTMLDivElement | null = null;
let tagTooltip: HTMLDivElement | null = null;
let currentHoveredElement: HTMLElement | null = null;
let editingElement: HTMLElement | null = null;
let editFloatingButtons: HTMLDivElement | null = null;
let originalTextContent: string = '';
let translations: Record<string, string> = {
    Save: 'Save',
    Cancel: 'Cancel',
};

// ============================================
// Utility Functions
// ============================================

/**
 * Generate a unique ID.
 */
function generateId(): string {
    return `el-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get XPath for an element.
 */
function getXPath(element: HTMLElement): string {
    if (element.id) {
        return `//*[@id="${element.id}"]`;
    }

    const parts: string[] = [];
    let current: HTMLElement | null = element;

    while (current && current.nodeType === Node.ELEMENT_NODE) {
        let index = 1;
        let sibling = current.previousElementSibling;

        while (sibling) {
            if (sibling.nodeName === current.nodeName) {
                index++;
            }
            sibling = sibling.previousElementSibling;
        }

        const tagName = current.nodeName.toLowerCase();
        const part = index > 1 ? `${tagName}[${index}]` : tagName;
        parts.unshift(part);

        current = current.parentElement;
    }

    return '/' + parts.join('/');
}

/**
 * Generate a unique CSS selector for an element.
 */
function getCssSelector(element: HTMLElement): string {
    // If element has ID, use it
    if (element.id) {
        return `#${CSS.escape(element.id)}`;
    }

    const parts: string[] = [];
    let current: HTMLElement | null = element;

    while (current && current.nodeType === Node.ELEMENT_NODE && current !== document.body) {
        let selector = current.tagName.toLowerCase();

        // Add class if available (use first meaningful class)
        const classes = Array.from(current.classList).filter(c =>
            !c.startsWith('inspector-') && !c.startsWith('preview-inspector-') && c.length < 30
        );
        if (classes.length > 0) {
            selector += `.${CSS.escape(classes[0])}`;
        }

        // Check if selector is unique among siblings
        const siblings = current.parentElement?.querySelectorAll(`:scope > ${selector}`);
        if (siblings && siblings.length > 1) {
            const index = Array.from(siblings).indexOf(current) + 1;
            selector += `:nth-of-type(${index})`;
        }

        parts.unshift(selector);

        // Check if current path is unique in document
        const fullSelector = parts.join(' > ');
        if (document.querySelectorAll(fullSelector).length === 1) {
            return fullSelector;
        }

        current = current.parentElement;
    }

    return parts.join(' > ');
}

/**
 * Get text preview from element (truncated).
 */
function getTextPreview(element: HTMLElement): string {
    const text = element.textContent?.trim() || '';
    return text.length > 50 ? text.substring(0, 50) + '...' : text;
}

/**
 * Get editable attributes for an element.
 */
function getEditableAttributes(element: HTMLElement): Record<string, string> {
    const attrs: Record<string, string> = {};
    const tagName = element.tagName.toLowerCase();

    const attrMap: Record<string, string[]> = {
        a: ['href', 'title'],
        img: ['src', 'alt', 'title'],
        input: ['placeholder', 'title'],
        textarea: ['placeholder', 'title'],
        button: ['title'],
    };

    const editableAttrs = attrMap[tagName] || [];
    for (const attr of editableAttrs) {
        const value = element.getAttribute(attr);
        if (value !== null) {
            attrs[attr] = value;
        }
    }

    return attrs;
}

/**
 * Serialize an element for postMessage.
 */
function serializeElement(element: HTMLElement): InspectorElement {
    const rect = element.getBoundingClientRect();

    return {
        id: generateId(),
        tagName: element.tagName.toLowerCase(),
        elementId: element.id || null,
        classNames: Array.from(element.classList),
        textPreview: getTextPreview(element),
        xpath: getXPath(element),
        cssSelector: getCssSelector(element),
        boundingRect: {
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
        },
        attributes: getEditableAttributes(element),
        parentTagName: element.parentElement?.tagName.toLowerCase() || null,
    };
}

/**
 * Check if element should be ignored.
 */
function shouldIgnoreElement(element: HTMLElement): boolean {
    const ignoredTags = ['script', 'style', 'link', 'meta', 'head', 'html'];
    const tagName = element.tagName.toLowerCase();

    if (ignoredTags.includes(tagName)) return true;
    if (element.id === 'preview-inspector') return true;
    if (element.hasAttribute('data-preview-inspector')) return true;
    if (element.closest('[data-preview-inspector]')) return true;

    return false;
}

/**
 * Check if element has editable text.
 */
function isTextEditable(element: HTMLElement): boolean {
    const editableTags = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'label', 'li', 'a', 'button', 'td', 'th'];
    return editableTags.includes(element.tagName.toLowerCase());
}

// ============================================
// UI Elements
// ============================================

/**
 * Create highlight overlay element.
 */
function createHighlightOverlay(): HTMLDivElement {
    const overlay = document.createElement('div');
    overlay.setAttribute('data-preview-inspector', 'highlight');
    overlay.style.cssText = `
        position: fixed;
        pointer-events: none;
        border: 2px solid hsl(221.2 83.2% 53.3%);
        background: hsla(221.2, 83.2%, 53.3%, 0.1);
        z-index: 999999;
        transition: all 0.1s ease;
        display: none;
        border-radius: 4px;
    `;
    document.body.appendChild(overlay);
    return overlay;
}

/**
 * Create tag tooltip element.
 */
function createTagTooltip(): HTMLDivElement {
    const tooltip = document.createElement('div');
    tooltip.setAttribute('data-preview-inspector', 'tooltip');
    tooltip.style.cssText = `
        position: fixed;
        background: hsl(240 5.9% 10%);
        color: hsl(0 0% 98%);
        padding: 4px 10px;
        border-radius: 6px;
        font-size: 11px;
        font-family: ui-monospace, SFMono-Regular, monospace;
        z-index: 1000000;
        pointer-events: none;
        display: none;
        white-space: nowrap;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    `;
    document.body.appendChild(tooltip);
    return tooltip;
}

/**
 * Create floating edit buttons.
 */
function createEditFloatingButtons(): HTMLDivElement {
    const container = document.createElement('div');
    container.setAttribute('data-preview-inspector', 'edit-buttons');
    container.style.cssText = `
        position: fixed;
        display: none;
        gap: 6px;
        z-index: 1000001;
        font-family: system-ui, -apple-system, sans-serif;
        background: hsl(0 0% 100%);
        border: 1px solid hsl(240 5.9% 90%);
        border-radius: 8px;
        padding: 6px;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1);
    `;

    const saveBtn = document.createElement('button');
    saveBtn.textContent = translations.Save;
    saveBtn.style.cssText = `
        padding: 6px 12px;
        background: hsl(240 5.9% 10%);
        color: hsl(0 0% 98%);
        border: none;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        transition: opacity 0.15s;
    `;
    saveBtn.onmouseenter = () => { saveBtn.style.opacity = '0.9'; };
    saveBtn.onmouseleave = () => { saveBtn.style.opacity = '1'; };
    saveBtn.onclick = handleSaveEdit;

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = translations.Cancel;
    cancelBtn.style.cssText = `
        padding: 6px 12px;
        background: transparent;
        color: hsl(240 5.9% 10%);
        border: 1px solid hsl(240 5.9% 90%);
        border-radius: 6px;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        transition: background 0.15s;
    `;
    cancelBtn.onmouseenter = () => { cancelBtn.style.background = 'hsl(240 5.9% 96%)'; };
    cancelBtn.onmouseleave = () => { cancelBtn.style.background = 'transparent'; };
    cancelBtn.onclick = handleCancelEdit;

    container.appendChild(saveBtn);
    container.appendChild(cancelBtn);
    document.body.appendChild(container);

    return container;
}

/**
 * Update highlight position.
 */
function updateHighlight(element: HTMLElement | null): void {
    if (!highlightOverlay || !tagTooltip) return;

    if (!element || mode === 'preview') {
        highlightOverlay.style.display = 'none';
        tagTooltip.style.display = 'none';
        return;
    }

    const rect = element.getBoundingClientRect();

    highlightOverlay.style.display = 'block';
    highlightOverlay.style.top = `${rect.top}px`;
    highlightOverlay.style.left = `${rect.left}px`;
    highlightOverlay.style.width = `${rect.width}px`;
    highlightOverlay.style.height = `${rect.height}px`;

    highlightOverlay.style.borderColor = '#3b82f6';
    highlightOverlay.style.borderStyle = 'solid';
    highlightOverlay.style.background = 'rgba(59, 130, 246, 0.1)';

    // Position tooltip
    const tagName = element.tagName.toLowerCase();
    const id = element.id ? `#${element.id}` : '';
    const className = element.classList.length > 0 ? `.${element.classList[0]}` : '';
    tagTooltip.textContent = `<${tagName}${id}${className}>`;
    tagTooltip.style.display = 'block';
    tagTooltip.style.top = `${Math.max(0, rect.top - 24)}px`;
    tagTooltip.style.left = `${rect.left}px`;
}

/**
 * Position floating buttons near element.
 */
function positionEditButtons(element: HTMLElement): void {
    if (!editFloatingButtons) return;

    const rect = element.getBoundingClientRect();
    editFloatingButtons.style.display = 'flex';
    editFloatingButtons.style.top = `${rect.bottom + 4}px`;
    editFloatingButtons.style.left = `${rect.left}px`;
}

/**
 * Hide floating buttons.
 */
function hideEditButtons(): void {
    if (editFloatingButtons) {
        editFloatingButtons.style.display = 'none';
    }
}

/**
 * Update button text with current translations.
 */
function updateButtonTranslations(): void {
    if (!editFloatingButtons) return;
    const buttons = editFloatingButtons.querySelectorAll('button');
    if (buttons.length >= 2) {
        buttons[0].textContent = translations.Save;
        buttons[1].textContent = translations.Cancel;
    }
}

// ============================================
// Event Handlers
// ============================================

/**
 * Handle mouse movement for hover highlighting.
 */
function handleMouseMove(e: MouseEvent): void {
    if (mode === 'preview') return;

    // Don't show highlight overlay while editing an element
    if (editingElement) {
        updateHighlight(null);
        return;
    }

    const target = e.target as HTMLElement;
    if (shouldIgnoreElement(target)) {
        updateHighlight(null);
        return;
    }

    if (target !== currentHoveredElement) {
        currentHoveredElement = target;
        updateHighlight(target);

        // Send hover event to parent
        const message = {
            type: 'inspector-element-hover',
            element: serializeElement(target),
        };
        window.parent.postMessage(message, '*');
    }
}

/**
 * Handle mouse leave.
 */
function handleMouseLeave(): void {
    currentHoveredElement = null;
    updateHighlight(null);

    const message = {
        type: 'inspector-element-hover',
        element: null,
    };
    window.parent.postMessage(message, '*');
}

/**
 * Handle click for element selection.
 */
function handleClick(e: MouseEvent): void {
    if (mode === 'preview') return;

    const target = e.target as HTMLElement;
    if (shouldIgnoreElement(target)) return;

    // When editing: clicks inside the element are for cursor placement,
    // clicks outside cancel editing and fall through to show the toolbar
    if (editingElement) {
        if (editingElement.contains(target)) return;
        handleCancelEdit();
    }

    e.preventDefault();
    e.stopPropagation();

    window.parent.postMessage({
        type: 'inspector-element-click',
        element: serializeElement(target),
        position: { x: e.clientX, y: e.clientY },
    }, '*');
}

/**
 * Handle double-click for inline editing.
 */
function handleDoubleClick(e: MouseEvent): void {
    if (mode !== 'inspect') return;

    const target = e.target as HTMLElement;
    if (shouldIgnoreElement(target)) return;

    // If already editing a different element, cancel first
    if (editingElement) {
        if (editingElement.contains(target)) return;
        handleCancelEdit();
    }
    if (!isTextEditable(target)) return;

    e.preventDefault();
    e.stopPropagation();

    startEditing(target);
}

/**
 * Start inline editing.
 */
function startEditing(element: HTMLElement): void {
    if (editingElement) {
        handleCancelEdit();
    }

    editingElement = element;
    originalTextContent = element.textContent || '';

    element.setAttribute('contenteditable', 'true');
    element.style.outline = '2px solid #22c55e';
    element.style.outlineOffset = '2px';
    element.focus();

    // Select all text
    const range = document.createRange();
    range.selectNodeContents(element);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);

    positionEditButtons(element);
}

/**
 * Handle save edit.
 */
function handleSaveEdit(): void {
    if (!editingElement) return;

    const newValue = editingElement.textContent || '';
    const elementData = serializeElement(editingElement);

    const edit: PendingEdit = {
        id: generateId(),
        element: elementData,
        field: 'text',
        originalValue: originalTextContent,
        newValue: newValue,
        timestamp: new Date(),
    };

    // Send edit to parent
    const message = {
        type: 'inspector-element-edited',
        edit: edit,
    };
    window.parent.postMessage(message, '*');

    finishEditing();
}

/**
 * Handle cancel edit.
 */
function handleCancelEdit(): void {
    if (!editingElement) return;

    editingElement.textContent = originalTextContent;

    const message = {
        type: 'inspector-edit-cancelled',
        elementId: editingElement.id || getCssSelector(editingElement),
    };
    window.parent.postMessage(message, '*');

    finishEditing();
}

/**
 * Clean up after editing.
 */
function finishEditing(): void {
    if (editingElement) {
        editingElement.removeAttribute('contenteditable');
        editingElement.style.outline = '';
        editingElement.style.outlineOffset = '';
        editingElement.blur();
    }

    // Clear lingering text selection from editing
    window.getSelection()?.removeAllRanges();

    editingElement = null;
    originalTextContent = '';
    currentHoveredElement = null;
    hideEditButtons();
}

/**
 * Handle keydown during editing.
 */
function handleKeyDown(e: KeyboardEvent): void {
    if (!editingElement) return;

    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSaveEdit();
    } else if (e.key === 'Escape') {
        e.preventDefault();
        handleCancelEdit();
    }
}

/**
 * Handle messages from parent window.
 */
function handleMessage(e: MessageEvent): void {
    const data = e.data;
    if (!data || !data.type || !data.type.startsWith('inspector-')) return;

    switch (data.type) {
        case 'inspector-set-mode':
            setMode(data.mode);
            break;
        case 'inspector-highlight-element':
            highlightBySelector(data.selector);
            break;
        case 'inspector-clear-highlights':
            updateHighlight(null);
            break;
        case 'inspector-edit-element':
            // Start editing a specific element by selector
            if (data.selector) {
                const element = document.querySelector(data.selector) as HTMLElement;
                if (element) {
                    startEditing(element);
                }
            }
            break;
        case 'inspector-revert-edits':
            // Revert edited elements to their original values
            if (data.edits && Array.isArray(data.edits)) {
                revertEdits(data.edits);
            }
            break;
        case 'inspector-set-translations':
            // Set translations for UI labels
            if (data.translations && typeof data.translations === 'object') {
                translations = { ...translations, ...data.translations };
                // Update existing button text if buttons exist
                updateButtonTranslations();
            }
            break;
        case 'inspector-get-classes':
            if (data.selector) handleGetClasses(data.selector);
            break;
        case 'inspector-update-classes':
            if (data.selector) handleUpdateClasses(data.selector, data.add, data.remove);
            break;
        case 'inspector-preview-class':
            if (data.selector) handlePreviewClass(data.selector, data.addClass, data.removeClass);
            break;
        case 'inspector-set-breakpoint':
            // Breakpoint stored for future breakpoint-aware JIT
            break;
    }
}

/**
 * Set inspector mode.
 */
function setMode(newMode: InspectorMode): void {
    mode = newMode;

    if (mode === 'preview') {
        updateHighlight(null);
        hideEditButtons();
        if (editingElement) {
            handleCancelEdit();
        }
    }
}

/**
 * Highlight element by selector.
 */
function highlightBySelector(selector: string): void {
    try {
        const element = document.querySelector(selector) as HTMLElement;
        if (element) {
            updateHighlight(element);
        }
    } catch {
        console.warn('Invalid selector:', selector);
    }
}

/**
 * Revert edited elements to their original values.
 */
function revertEdits(edits: Array<{ selector: string; field: string; originalValue: string }>): void {
    for (const edit of edits) {
        try {
            const element = document.querySelector(edit.selector) as HTMLElement;
            if (!element) continue;

            if (edit.field === 'text') {
                element.textContent = edit.originalValue;
            } else {
                // For attributes like href, src, alt, placeholder, title
                element.setAttribute(edit.field, edit.originalValue);
            }
        } catch {
            console.warn('Failed to revert edit for selector:', edit.selector);
        }
    }
}

// ============================================
// JIT CSS Engine — generates Tailwind CSS on-the-fly
// ============================================

const jitCache = new Set<string>();
let jitStyleElement: HTMLStyleElement | null = null;

function getJitStyle(): HTMLStyleElement {
    if (!jitStyleElement) {
        jitStyleElement = document.createElement('style');
        jitStyleElement.id = 'webby-jit-css';
        jitStyleElement.setAttribute('data-preview-inspector', 'jit');
        document.head.appendChild(jitStyleElement);
    }
    return jitStyleElement;
}

// Tailwind spacing scale
const SPACING: Record<string, string> = {
    '0':'0px','0.5':'0.125rem','1':'0.25rem','1.5':'0.375rem','2':'0.5rem','2.5':'0.625rem',
    '3':'0.75rem','3.5':'0.875rem','4':'1rem','5':'1.25rem','6':'1.5rem','7':'1.75rem',
    '8':'2rem','9':'2.25rem','10':'2.5rem','11':'2.75rem','12':'3rem','14':'3.5rem',
    '16':'4rem','20':'5rem','24':'6rem','28':'7rem','32':'8rem','36':'9rem','40':'10rem',
    '44':'11rem','48':'12rem','52':'13rem','56':'14rem','60':'15rem','64':'16rem',
    '72':'18rem','80':'20rem','96':'24rem','px':'1px','auto':'auto',
};

// Tailwind font sizes
const FONT_SIZE: Record<string, [string, string]> = {
    'xs':['0.75rem','1rem'],'sm':['0.875rem','1.25rem'],'base':['1rem','1.5rem'],
    'lg':['1.125rem','1.75rem'],'xl':['1.25rem','1.75rem'],'2xl':['1.5rem','2rem'],
    '3xl':['1.875rem','2.25rem'],'4xl':['2.25rem','2.5rem'],'5xl':['3rem','1'],
    '6xl':['3.75rem','1'],'7xl':['4.5rem','1'],'8xl':['6rem','1'],'9xl':['8rem','1'],
};

// Tailwind font weights
const FONT_WEIGHT: Record<string, string> = {
    thin:'100',extralight:'200',light:'300',normal:'400',medium:'500',
    semibold:'600',bold:'700',extrabold:'800',black:'900',
};

// Tailwind border radius
const BORDER_RADIUS: Record<string, string> = {
    'none':'0px','sm':'0.125rem','':'0.25rem','md':'0.375rem','lg':'0.5rem',
    'xl':'0.75rem','2xl':'1rem','3xl':'1.5rem','full':'9999px',
};

// Tailwind shadows
const SHADOWS: Record<string, string> = {
    'sm':'0 1px 2px 0 rgb(0 0 0/0.05)',
    '':'0 1px 3px 0 rgb(0 0 0/0.1),0 1px 2px -1px rgb(0 0 0/0.1)',
    'md':'0 4px 6px -1px rgb(0 0 0/0.1),0 2px 4px -2px rgb(0 0 0/0.1)',
    'lg':'0 10px 15px -3px rgb(0 0 0/0.1),0 4px 6px -4px rgb(0 0 0/0.1)',
    'xl':'0 20px 25px -5px rgb(0 0 0/0.1),0 8px 10px -6px rgb(0 0 0/0.1)',
    '2xl':'0 25px 50px -12px rgb(0 0 0/0.25)',
    'inner':'inset 0 2px 4px 0 rgb(0 0 0/0.05)',
    'none':'0 0 #0000',
};

// Tailwind colors (16 families × 11 shades)
const COLORS: Record<string, Record<string, string>> = {
    slate:{50:'#f8fafc',100:'#f1f5f9',200:'#e2e8f0',300:'#cbd5e1',400:'#94a3b8',500:'#64748b',600:'#475569',700:'#334155',800:'#1e293b',900:'#0f172a',950:'#020617'},
    gray:{50:'#f9fafb',100:'#f3f4f6',200:'#e5e7eb',300:'#d1d5db',400:'#9ca3af',500:'#6b7280',600:'#4b5563',700:'#374151',800:'#1f2937',900:'#111827',950:'#030712'},
    zinc:{50:'#fafafa',100:'#f4f4f5',200:'#e4e4e7',300:'#d4d4d8',400:'#a1a1aa',500:'#71717a',600:'#52525b',700:'#3f3f46',800:'#27272a',900:'#18181b',950:'#09090b'},
    neutral:{50:'#fafafa',100:'#f5f5f5',200:'#e5e5e5',300:'#d4d4d4',400:'#a3a3a3',500:'#737373',600:'#525252',700:'#404040',800:'#262626',900:'#171717',950:'#0a0a0a'},
    stone:{50:'#fafaf9',100:'#f5f5f4',200:'#e7e5e4',300:'#d6d3d1',400:'#a8a29e',500:'#78716c',600:'#57534e',700:'#44403c',800:'#292524',900:'#1c1917',950:'#0c0a09'},
    red:{50:'#fef2f2',100:'#fee2e2',200:'#fecaca',300:'#fca5a5',400:'#f87171',500:'#ef4444',600:'#dc2626',700:'#b91c1c',800:'#991b1b',900:'#7f1d1d',950:'#450a0a'},
    orange:{50:'#fff7ed',100:'#ffedd5',200:'#fed7aa',300:'#fdba74',400:'#fb923c',500:'#f97316',600:'#ea580c',700:'#c2410c',800:'#9a3412',900:'#7c2d12',950:'#431407'},
    amber:{50:'#fffbeb',100:'#fef3c7',200:'#fde68a',300:'#fcd34d',400:'#fbbf24',500:'#f59e0b',600:'#d97706',700:'#b45309',800:'#92400e',900:'#78350f',950:'#451a03'},
    yellow:{50:'#fefce8',100:'#fef9c3',200:'#fef08a',300:'#fde047',400:'#facc15',500:'#eab308',600:'#ca8a04',700:'#a16207',800:'#854d0e',900:'#713f12',950:'#422006'},
    lime:{50:'#f7fee7',100:'#ecfccb',200:'#d9f99d',300:'#bef264',400:'#a3e635',500:'#84cc16',600:'#65a30d',700:'#4d7c0f',800:'#3f6212',900:'#365314',950:'#1a2e05'},
    green:{50:'#f0fdf4',100:'#dcfce7',200:'#bbf7d0',300:'#86efac',400:'#4ade80',500:'#22c55e',600:'#16a34a',700:'#15803d',800:'#166534',900:'#14532d',950:'#052e16'},
    emerald:{50:'#ecfdf5',100:'#d1fae5',200:'#a7f3d0',300:'#6ee7b7',400:'#34d399',500:'#10b981',600:'#059669',700:'#047857',800:'#065f46',900:'#064e3b',950:'#022c22'},
    teal:{50:'#f0fdfa',100:'#ccfbf1',200:'#99f6e4',300:'#5eead4',400:'#2dd4bf',500:'#14b8a6',600:'#0d9488',700:'#0f766e',800:'#115e59',900:'#134e4a',950:'#042f2e'},
    cyan:{50:'#ecfeff',100:'#cffafe',200:'#a5f3fc',300:'#67e8f9',400:'#22d3ee',500:'#06b6d4',600:'#0891b2',700:'#0e7490',800:'#155e75',900:'#164e63',950:'#083344'},
    sky:{50:'#f0f9ff',100:'#e0f2fe',200:'#bae6fd',300:'#7dd3fc',400:'#38bdf8',500:'#0ea5e9',600:'#0284c7',700:'#0369a1',800:'#075985',900:'#0c4a6e',950:'#082f49'},
    blue:{50:'#eff6ff',100:'#dbeafe',200:'#bfdbfe',300:'#93c5fd',400:'#60a5fa',500:'#3b82f6',600:'#2563eb',700:'#1d4ed8',800:'#1e40af',900:'#1e3a8a',950:'#172554'},
    indigo:{50:'#eef2ff',100:'#e0e7ff',200:'#c7d2fe',300:'#a5b4fc',400:'#818cf8',500:'#6366f1',600:'#4f46e5',700:'#4338ca',800:'#3730a3',900:'#312e81',950:'#1e1b4b'},
    violet:{50:'#f5f3ff',100:'#ede9fe',200:'#ddd6fe',300:'#c4b5fd',400:'#a78bfa',500:'#8b5cf6',600:'#7c3aed',700:'#6d28d9',800:'#5b21b6',900:'#4c1d95',950:'#2e1065'},
    purple:{50:'#faf5ff',100:'#f3e8ff',200:'#e9d5ff',300:'#d8b4fe',400:'#c084fc',500:'#a855f7',600:'#9333ea',700:'#7e22ce',800:'#6b21a8',900:'#581c87',950:'#3b0764'},
    fuchsia:{50:'#fdf4ff',100:'#fae8ff',200:'#f5d0fe',300:'#f0abfc',400:'#e879f9',500:'#d946ef',600:'#c026d3',700:'#a21caf',800:'#86198f',900:'#701a75',950:'#4a044e'},
    pink:{50:'#fdf2f8',100:'#fce7f3',200:'#fbcfe8',300:'#f9a8d4',400:'#f472b6',500:'#ec4899',600:'#db2777',700:'#be185d',800:'#9d174d',900:'#831843',950:'#500724'},
    rose:{50:'#fff1f2',100:'#ffe4e6',200:'#fecdd3',300:'#fda4af',400:'#fb7185',500:'#f43f5e',600:'#e11d48',700:'#be123c',800:'#9f1239',900:'#881337',950:'#4c0519'},
};

// Breakpoint widths
const BREAKPOINTS: Record<string, number> = {
    sm:640, md:768, lg:1024, xl:1280, '2xl':1536,
};

/**
 * Convert a Tailwind class name to a CSS rule string.
 * Returns null if the class is not recognized.
 */
function classToCSS(className: string): string | null {
    // Parse optional breakpoint prefix
    let bp = '';
    let cls = className;
    for (const prefix of ['sm:', 'md:', 'lg:', 'xl:', '2xl:']) {
        if (className.startsWith(prefix)) {
            bp = prefix.slice(0, -1);
            cls = className.slice(prefix.length);
            break;
        }
    }

    const escapedName = className.replace(/[.:/[\]%#(),!]/g, '\\$&');
    const css = resolveSingleClass(cls);
    if (!css) return null;

    let rule = `.${escapedName}{${css}}`;
    if (bp && BREAKPOINTS[bp]) {
        rule = `@media(min-width:${BREAKPOINTS[bp]}px){${rule}}`;
    }
    return rule;
}

function resolveSingleClass(cls: string): string | null {
    // Padding
    let m = cls.match(/^p([xytrbl]?)-(.+)$/);
    if (m) return resolveSpacing('padding', m[1], m[2]);

    // Margin (including negative)
    m = cls.match(/^-?m([xytrbl]?)-(.+)$/);
    if (m) {
        const neg = cls.startsWith('-');
        const val = SPACING[m[2]];
        if (!val) return null;
        return resolveSpacing('margin', m[1], m[2], neg);
    }

    // Gap
    m = cls.match(/^gap-([xy]?)-?(.+)$/);
    if (m && m[1]) {
        const val = SPACING[m[2]]; if (!val) return null;
        return m[1] === 'x' ? `column-gap:${val}` : `row-gap:${val}`;
    }
    m = cls.match(/^gap-(.+)$/);
    if (m) { const val = SPACING[m[1]]; if (val) return `gap:${val}`; }

    // Font size
    m = cls.match(/^text-(xs|sm|base|lg|xl|[2-9]xl)$/);
    if (m) { const fs = FONT_SIZE[m[1]]; if (fs) return `font-size:${fs[0]};line-height:${fs[1]}`; }

    // Font weight
    m = cls.match(/^font-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black)$/);
    if (m) { const fw = FONT_WEIGHT[m[1]]; if (fw) return `font-weight:${fw}`; }

    // Font family
    if (cls === 'font-sans') return "font-family:ui-sans-serif,system-ui,sans-serif";
    if (cls === 'font-serif') return "font-family:ui-serif,Georgia,serif";
    if (cls === 'font-mono') return "font-family:ui-monospace,monospace";

    // Text alignment
    if (cls === 'text-left') return 'text-align:left';
    if (cls === 'text-center') return 'text-align:center';
    if (cls === 'text-right') return 'text-align:right';
    if (cls === 'text-justify') return 'text-align:justify';

    // Text transform
    if (cls === 'uppercase') return 'text-transform:uppercase';
    if (cls === 'lowercase') return 'text-transform:lowercase';
    if (cls === 'capitalize') return 'text-transform:capitalize';
    if (cls === 'normal-case') return 'text-transform:none';

    // Text decoration
    if (cls === 'underline') return 'text-decoration-line:underline';
    if (cls === 'line-through') return 'text-decoration-line:line-through';
    if (cls === 'no-underline') return 'text-decoration-line:none';

    // Line height
    m = cls.match(/^leading-(.+)$/);
    if (m) {
        const lhMap: Record<string, string> = {none:'1',tight:'1.25',snug:'1.375',normal:'1.5',relaxed:'1.625',loose:'2'};
        if (lhMap[m[1]]) return `line-height:${lhMap[m[1]]}`;
        if (/^\d+$/.test(m[1])) return `line-height:${parseInt(m[1]) * 0.25}rem`;
    }

    // Letter spacing
    m = cls.match(/^tracking-(.+)$/);
    if (m) {
        const lsMap: Record<string, string> = {tighter:'-0.05em',tight:'-0.025em',normal:'0em',wide:'0.025em',wider:'0.05em',widest:'0.1em'};
        if (lsMap[m[1]]) return `letter-spacing:${lsMap[m[1]]}`;
    }

    // Text/bg/border colors
    for (const [prop, cssProp] of [['text','color'],['bg','background-color'],['border','border-color']] as const) {
        m = cls.match(new RegExp(`^${prop}-(\\w+)-(\\d+)$`));
        if (m && COLORS[m[1]]?.[m[2]]) return `${cssProp}:${COLORS[m[1]][m[2]]}`;
    }
    if (cls === 'text-white') return 'color:#fff';
    if (cls === 'text-black') return 'color:#000';
    if (cls === 'text-transparent') return 'color:transparent';
    if (cls === 'bg-white') return 'background-color:#fff';
    if (cls === 'bg-black') return 'background-color:#000';
    if (cls === 'bg-transparent') return 'background-color:transparent';

    // Display
    const displays: Record<string, string> = {block:'block','inline-block':'inline-block',inline:'inline',flex:'flex','inline-flex':'inline-flex',grid:'grid','inline-grid':'inline-grid',hidden:'none'};
    if (displays[cls]) return `display:${displays[cls]}`;

    // Position
    const positions = ['static','relative','absolute','fixed','sticky'];
    if (positions.includes(cls)) return `position:${cls}`;

    // Flex direction
    if (cls === 'flex-row') return 'flex-direction:row';
    if (cls === 'flex-col') return 'flex-direction:column';
    if (cls === 'flex-row-reverse') return 'flex-direction:row-reverse';
    if (cls === 'flex-col-reverse') return 'flex-direction:column-reverse';

    // Justify content
    m = cls.match(/^justify-(.+)$/);
    if (m) {
        const jMap: Record<string, string> = {start:'flex-start',end:'flex-end',center:'center',between:'space-between',around:'space-around',evenly:'space-evenly'};
        if (jMap[m[1]]) return `justify-content:${jMap[m[1]]}`;
    }

    // Align items
    m = cls.match(/^items-(.+)$/);
    if (m) {
        const aMap: Record<string, string> = {start:'flex-start',end:'flex-end',center:'center',stretch:'stretch',baseline:'baseline'};
        if (aMap[m[1]]) return `align-items:${aMap[m[1]]}`;
    }

    // Grid columns
    m = cls.match(/^grid-cols-(\d+)$/);
    if (m) return `grid-template-columns:repeat(${m[1]},minmax(0,1fr))`;

    // Grid rows
    m = cls.match(/^grid-rows-(\d+)$/);
    if (m) return `grid-template-rows:repeat(${m[1]},minmax(0,1fr))`;

    // Border width
    m = cls.match(/^border(?:-([trbl]))?(?:-(\d+))?$/);
    if (m !== null && cls.startsWith('border') && !cls.includes('color') && !cls.includes('radius') && !cls.includes('collapse')) {
        const side = m[1] ? {t:'top',r:'right',b:'bottom',l:'left'}[m[1]] : '';
        const w = m[2] || '1';
        const prop = side ? `border-${side}-width` : 'border-width';
        return `${prop}:${w}px`;
    }

    // Border style
    for (const bs of ['solid','dashed','dotted','double','none'] as const) {
        if (cls === `border-${bs}`) return `border-style:${bs}`;
    }

    // Border radius
    m = cls.match(/^rounded(?:-([trbl]{1,2}))?(?:-(.+))?$/);
    if (m !== null && cls.startsWith('rounded')) {
        const val = BORDER_RADIUS[m[2] || ''] ?? BORDER_RADIUS[''];
        if (!val) return null;
        if (!m[1]) return `border-radius:${val}`;
        // Individual corners
        const cornerMap: Record<string, string> = {
            t: `border-top-left-radius:${val};border-top-right-radius:${val}`,
            r: `border-top-right-radius:${val};border-bottom-right-radius:${val}`,
            b: `border-bottom-left-radius:${val};border-bottom-right-radius:${val}`,
            l: `border-top-left-radius:${val};border-bottom-left-radius:${val}`,
            tl: `border-top-left-radius:${val}`,
            tr: `border-top-right-radius:${val}`,
            br: `border-bottom-right-radius:${val}`,
            bl: `border-bottom-left-radius:${val}`,
        };
        return cornerMap[m[1]] || null;
    }

    // Shadow
    m = cls.match(/^shadow(?:-(.+))?$/);
    if (m !== null && cls.startsWith('shadow')) {
        const key = m[1] || '';
        if (SHADOWS[key] !== undefined) return `box-shadow:${SHADOWS[key]}`;
    }

    // Opacity
    m = cls.match(/^opacity-(\d+)$/);
    if (m) return `opacity:${parseInt(m[1]) / 100}`;

    return null;
}

function resolveSpacing(property: string, axis: string, value: string, negative: boolean = false): string | null {
    const val = SPACING[value];
    if (!val) return null;
    const v = negative && val !== '0px' && val !== 'auto' ? `-${val}` : val;
    const sides: Record<string, string> = {
        '': `${property}:${v}`,
        x: `${property}-left:${v};${property}-right:${v}`,
        y: `${property}-top:${v};${property}-bottom:${v}`,
        t: `${property}-top:${v}`,
        r: `${property}-right:${v}`,
        b: `${property}-bottom:${v}`,
        l: `${property}-left:${v}`,
    };
    return sides[axis] || null;
}

/**
 * Inject JIT CSS for a class if not already cached.
 */
function injectJIT(className: string): void {
    if (jitCache.has(className)) return;
    const css = classToCSS(className);
    if (css) {
        getJitStyle().textContent += css + '\n';
        jitCache.add(className);
    }
}

// ============================================
// Style Editing Message Handlers
// ============================================

/**
 * Get all classes from an element, responding to parent.
 */
function handleGetClasses(selector: string): void {
    try {
        const el = document.querySelector(selector) as HTMLElement;
        if (!el) return;
        const computed = window.getComputedStyle(el);
        window.parent.postMessage({
            type: 'inspector-classes-response',
            selector,
            classes: Array.from(el.classList),
            computedStyle: {
                fontSize: computed.fontSize,
                fontWeight: computed.fontWeight,
                fontFamily: computed.fontFamily,
                textAlign: computed.textAlign,
                lineHeight: computed.lineHeight,
                letterSpacing: computed.letterSpacing,
                color: computed.color,
                backgroundColor: computed.backgroundColor,
                borderColor: computed.borderColor,
                borderWidth: computed.borderWidth,
                borderRadius: computed.borderRadius,
                padding: computed.padding,
                margin: computed.margin,
                display: computed.display,
                position: computed.position,
                opacity: computed.opacity,
                boxShadow: computed.boxShadow,
            },
        }, '*');
    } catch { /* ignore invalid selectors */ }
}

/**
 * Update classes on an element (add/remove).
 */
function handleUpdateClasses(selector: string, add?: string[], remove?: string[]): void {
    try {
        const el = document.querySelector(selector) as HTMLElement;
        if (!el) return;
        if (remove) {
            for (const cls of remove) el.classList.remove(cls);
        }
        if (add) {
            for (const cls of add) {
                injectJIT(cls);
                el.classList.add(cls);
            }
        }
        window.parent.postMessage({
            type: 'inspector-classes-updated',
            selector,
            classes: Array.from(el.classList),
        }, '*');
    } catch { /* ignore */ }
}

/**
 * Preview a class change temporarily (for hover previews).
 */
function handlePreviewClass(selector: string, addClass?: string, removeClass?: string): void {
    try {
        const el = document.querySelector(selector) as HTMLElement;
        if (!el) return;
        if (removeClass) el.classList.remove(removeClass);
        if (addClass) {
            injectJIT(addClass);
            el.classList.add(addClass);
        }
    } catch { /* ignore */ }
}

// ============================================
// Initialization
// ============================================

/**
 * Initialize the inspector.
 */
function init(): void {
    // Create UI elements
    highlightOverlay = createHighlightOverlay();
    tagTooltip = createTagTooltip();
    editFloatingButtons = createEditFloatingButtons();

    // Add event listeners
    document.addEventListener('mousemove', handleMouseMove, { passive: true });
    document.addEventListener('mouseleave', handleMouseLeave);
    document.addEventListener('click', handleClick, true);
    document.addEventListener('dblclick', handleDoubleClick, true);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('message', handleMessage);

    // Notify parent that inspector is ready
    window.parent.postMessage({ type: 'inspector-ready' }, '*');
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// Export for testing (will be stripped in production build)
export {
    serializeElement,
    getXPath,
    getCssSelector,
    getTextPreview,
    shouldIgnoreElement,
    isTextEditable,
};
