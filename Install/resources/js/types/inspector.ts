/**
 * Types for the preview element inspector feature.
 * Enables element selection and inline editing in the live preview.
 */

/**
 * Represents an element selected in the preview iframe.
 */
export interface InspectorElement {
    /** Unique identifier for this selection instance */
    id: string;
    /** HTML tag name (lowercase) e.g., 'button', 'h1', 'div' */
    tagName: string;
    /** Element's id attribute if present */
    elementId: string | null;
    /** Array of CSS class names */
    classNames: string[];
    /** First 50 characters of text content */
    textPreview: string;
    /** Full XPath to the element */
    xpath: string;
    /** CSS selector that uniquely identifies this element */
    cssSelector: string;
    /** Bounding rectangle in viewport coordinates */
    boundingRect: {
        top: number;
        left: number;
        width: number;
        height: number;
    };
    /** Key attributes for editing (href, src, alt, placeholder, title) */
    attributes: Record<string, string>;
    /** Parent element's tag name for context */
    parentTagName: string | null;
}

/**
 * Simplified element reference for chat mentions.
 */
export interface ElementMention {
    /** Unique identifier matching InspectorElement.id */
    id: string;
    /** HTML tag name */
    tagName: string;
    /** CSS selector for identifying the element */
    selector: string;
    /** Truncated text content for display */
    textPreview: string;
}

/**
 * Represents a pending text or attribute edit.
 */
export interface PendingEdit {
    /** Unique identifier for this edit */
    id: string;
    /** The element being edited */
    element: InspectorElement;
    /** Which field is being edited */
    field: 'text' | 'href' | 'src' | 'placeholder' | 'title' | 'alt';
    /** Original value before editing */
    originalValue: string;
    /** New value after editing */
    newValue: string;
    /** Timestamp when edit was made */
    timestamp: Date;
}

// ============================================
// postMessage Protocol Types
// ============================================

/**
 * Message types sent from iframe to parent.
 */
export type InspectorToParentMessageType =
    | 'inspector-ready'
    | 'inspector-element-hover'
    | 'inspector-element-click'
    | 'inspector-element-edited'
    | 'inspector-edit-cancelled'
    | 'inspector-classes-response'
    | 'inspector-classes-updated';

/**
 * Message types sent from parent to iframe.
 */
export type ParentToInspectorMessageType =
    | 'inspector-set-mode'
    | 'inspector-highlight-element'
    | 'inspector-clear-highlights'
    | 'inspector-edit-element'
    | 'inspector-revert-edits'
    | 'inspector-set-theme'
    | 'inspector-apply-theme'
    | 'inspector-set-translations'
    | 'inspector-get-classes'
    | 'inspector-update-classes'
    | 'inspector-preview-class'
    | 'inspector-set-breakpoint';

/**
 * Inspector mode states.
 */
export type InspectorMode = 'preview' | 'inspect';

/**
 * Messages sent from iframe to parent window.
 */
export interface InspectorReadyMessage {
    type: 'inspector-ready';
}

export interface InspectorHoverMessage {
    type: 'inspector-element-hover';
    element: InspectorElement | null;
}

export interface InspectorClickMessage {
    type: 'inspector-element-click';
    element: InspectorElement;
    position: { x: number; y: number };
}

export interface InspectorEditedMessage {
    type: 'inspector-element-edited';
    edit: PendingEdit;
}

export interface InspectorEditCancelledMessage {
    type: 'inspector-edit-cancelled';
    elementId: string;
}

export interface ClassesResponseMessage {
    type: 'inspector-classes-response';
    selector: string;
    classes: string[];
    computedStyle: Record<string, string>;
}

export interface ClassesUpdatedMessage {
    type: 'inspector-classes-updated';
    selector: string;
    classes: string[];
}

export type InspectorToParentMessage =
    | InspectorReadyMessage
    | InspectorHoverMessage
    | InspectorClickMessage
    | InspectorEditedMessage
    | InspectorEditCancelledMessage
    | ClassesResponseMessage
    | ClassesUpdatedMessage;

/**
 * Messages sent from parent window to iframe.
 */
export interface SetModeMessage {
    type: 'inspector-set-mode';
    mode: InspectorMode;
}

export interface HighlightElementMessage {
    type: 'inspector-highlight-element';
    selector: string;
}

export interface ClearHighlightsMessage {
    type: 'inspector-clear-highlights';
}

export interface EditElementMessage {
    type: 'inspector-edit-element';
    selector: string;
}

export interface RevertEditsMessage {
    type: 'inspector-revert-edits';
    edits: Array<{
        selector: string;
        field: PendingEdit['field'];
        originalValue: string;
    }>;
}

export interface SetThemeMessage {
    type: 'inspector-set-theme';
    theme: 'light' | 'dark';
}

export interface SetTranslationsMessage {
    type: 'inspector-set-translations';
    translations: Record<string, string>;
}

export interface GetClassesMessage {
    type: 'inspector-get-classes';
    selector: string;
}

export interface UpdateClassesMessage {
    type: 'inspector-update-classes';
    selector: string;
    add?: string[];
    remove?: string[];
}

export interface PreviewClassMessage {
    type: 'inspector-preview-class';
    selector: string;
    addClass?: string;
    removeClass?: string;
}

export interface ApplyThemeMessage {
    type: 'inspector-apply-theme';
    light: Record<string, string>;
    dark: Record<string, string>;
}

export interface SetBreakpointMessage {
    type: 'inspector-set-breakpoint';
    breakpoint: string;
}

export type ParentToInspectorMessage =
    | SetModeMessage
    | HighlightElementMessage
    | ClearHighlightsMessage
    | EditElementMessage
    | RevertEditsMessage
    | SetThemeMessage
    | ApplyThemeMessage
    | SetTranslationsMessage
    | GetClassesMessage
    | UpdateClassesMessage
    | PreviewClassMessage
    | SetBreakpointMessage;

// ============================================
// Utility Types
// ============================================

/**
 * Props for components that display element info.
 */
export interface ElementDisplayProps {
    element: InspectorElement | ElementMention;
    onRemove?: () => void;
}

/**
 * Context menu state.
 */
export interface ContextMenuState {
    element: InspectorElement;
    position: { x: number; y: number };
}

/**
 * Hook return type for usePreviewInspector.
 */
export interface UsePreviewInspectorReturn {
    /** Currently hovered element (null when not hovering) */
    hoveredElement: InspectorElement | null;
    /** Context menu state (null when closed) */
    contextMenu: ContextMenuState | null;
    /** Close the context menu */
    closeContextMenu: () => void;
    /** Array of pending edits */
    pendingEdits: PendingEdit[];
    /** Add a new pending edit */
    addPendingEdit: (edit: PendingEdit) => void;
    /** Remove a pending edit by id */
    removePendingEdit: (id: string) => void;
    /** Clear all pending edits */
    clearPendingEdits: () => void;
    /** Whether inspector is ready (script loaded in iframe) */
    isReady: boolean;
    /** Start editing a specific element by selector */
    startEditingElement: (selector: string) => void;
    /** Revert edits in the iframe (restore original values) */
    revertEdits: (edits: PendingEdit[]) => void;
    /** Whether the style panel is open */
    stylePanelOpen: boolean;
    /** Element currently being styled */
    styleElement: InspectorElement | null;
    /** Current classes on the styled element */
    styleClasses: string[];
    /** Original classes before any style changes */
    originalClasses: string[];
    /** Open the style panel for an element */
    openStylePanel: (element: InspectorElement) => void;
    /** Close the style panel */
    closeStylePanel: () => void;
    /** Update classes on the styled element */
    updateStyleClasses: (add: string[], remove: string[]) => void;
    /** Reset classes to original values */
    resetStyleClasses: () => void;
}

/**
 * Editable element types for inline editing.
 */
export const EDITABLE_TEXT_SELECTORS = [
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'p', 'span', 'label', 'li',
    'a', 'button',
    'td', 'th',
] as const;

/**
 * Elements with editable attributes.
 */
export const EDITABLE_ATTRIBUTE_MAP: Record<string, string[]> = {
    a: ['href', 'title'],
    img: ['src', 'alt', 'title'],
    input: ['placeholder', 'title'],
    textarea: ['placeholder', 'title'],
    button: ['title'],
};

/**
 * Elements to exclude from selection.
 */
export const NON_SELECTABLE_SELECTORS = [
    'script',
    'style',
    'link',
    'meta',
    'head',
    'html',
    '#preview-inspector',
    '[data-preview-inspector]',
] as const;
