import { useState, useEffect, useCallback, useRef, RefObject } from 'react';
import { useTranslation } from '@/contexts/LanguageContext';
import type {
    InspectorElement,
    PendingEdit,
    ContextMenuState,
    UsePreviewInspectorReturn,
    InspectorToParentMessage,
    ParentToInspectorMessage,
} from '@/types/inspector';

interface UsePreviewInspectorOptions {
    /** Reference to the iframe element */
    iframeRef: RefObject<HTMLIFrameElement>;
    /** Whether the inspector is enabled (e.g., Inspect tab is active) */
    enabled: boolean;
    /** Callback when an element is selected for mentioning in chat */
    onElementSelect?: (element: InspectorElement) => void;
    /** Callback when an edit is made */
    onElementEdit?: (edit: PendingEdit) => void;
}

/**
 * Hook for managing preview element inspector state and communication.
 * Handles postMessage communication with the inspector script in the iframe.
 */
export function usePreviewInspector({
    iframeRef,
    enabled,
    onElementSelect,
    onElementEdit,
}: UsePreviewInspectorOptions): UsePreviewInspectorReturn {
    const { t } = useTranslation();
    const [hoveredElement, setHoveredElement] = useState<InspectorElement | null>(null);
    const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
    const [pendingEdits, setPendingEdits] = useState<PendingEdit[]>([]);
    const [isReady, setIsReady] = useState(false);

    // Style panel state (declared early so message handler can reference them)
    const [stylePanelOpen, setStylePanelOpen] = useState(false);
    const [styleElement, setStyleElement] = useState<InspectorElement | null>(null);
    const [styleClasses, setStyleClasses] = useState<string[]>([]);
    const [originalClasses, setOriginalClasses] = useState<string[]>([]);

    // Track if iframe has loaded the inspector script
    const inspectorReadyRef = useRef(false);

    // Ref to track original classes without causing handleMessage to recreate
    const originalClassesInitRef = useRef(false);

    // Refs for callbacks and enabled to avoid recreating handleMessage on every render
    const onElementSelectRef = useRef(onElementSelect);
    const onElementEditRef = useRef(onElementEdit);
    const enabledRef = useRef(enabled);
    useEffect(() => {
        onElementSelectRef.current = onElementSelect;
        onElementEditRef.current = onElementEdit;
        enabledRef.current = enabled;
    });

    /**
     * Send a message to the iframe.
     */
    const sendToIframe = useCallback((message: ParentToInspectorMessage) => {
        if (!iframeRef.current?.contentWindow) return;
        iframeRef.current.contentWindow.postMessage(message, '*');
    }, [iframeRef]);

    /**
     * Close the context menu.
     */
    const closeContextMenu = useCallback(() => {
        setContextMenu(null);
    }, []);

    /**
     * Add a pending edit.
     */
    const addPendingEdit = useCallback((edit: PendingEdit) => {
        setPendingEdits(prev => {
            // Replace if editing same element and field
            const existingIndex = prev.findIndex(
                e => e.element.cssSelector === edit.element.cssSelector && e.field === edit.field
            );
            if (existingIndex >= 0) {
                const updated = [...prev];
                updated[existingIndex] = edit;
                return updated;
            }
            return [...prev, edit];
        });
        onElementEditRef.current?.(edit);
    }, []);

    /**
     * Remove a pending edit by id.
     */
    const removePendingEdit = useCallback((id: string) => {
        setPendingEdits(prev => prev.filter(e => e.id !== id));
    }, []);

    /**
     * Clear all pending edits.
     */
    const clearPendingEdits = useCallback(() => {
        setPendingEdits([]);
    }, []);

    /**
     * Handle messages from the iframe inspector script.
     */
    const handleMessage = useCallback((event: MessageEvent<InspectorToParentMessage>) => {
        const data = event.data;
        if (!data || typeof data.type !== 'string' || !data.type.startsWith('inspector-')) {
            return;
        }

        switch (data.type) {
            case 'inspector-ready':
                inspectorReadyRef.current = true;
                setIsReady(true);
                // Send translations to iframe
                sendToIframe({
                    type: 'inspector-set-translations',
                    translations: {
                        Save: t('Save'),
                        Cancel: t('Cancel'),
                    },
                } as ParentToInspectorMessage);
                // Send current mode to iframe
                if (enabledRef.current) {
                    sendToIframe({ type: 'inspector-set-mode', mode: 'inspect' });
                }
                break;

            case 'inspector-element-hover':
                setHoveredElement(data.element);
                break;

            case 'inspector-element-click':
                if (iframeRef.current) {
                    // Adjust position to account for iframe offset in the page
                    const iframeRect = iframeRef.current.getBoundingClientRect();
                    setContextMenu({
                        element: data.element,
                        position: {
                            x: data.position.x + iframeRect.left,
                            y: data.position.y + iframeRect.top,
                        },
                    });
                    onElementSelectRef.current?.(data.element);
                }
                break;

            case 'inspector-element-edited':
                addPendingEdit(data.edit);
                break;

            case 'inspector-edit-cancelled':
                // Could remove from pending edits if needed
                break;

            case 'inspector-classes-response':
                if (data.classes) {
                    // Only update working classes — originals are locked in openStylePanel
                    setStyleClasses(data.classes);
                }
                break;

            case 'inspector-classes-updated':
                if (data.classes) {
                    setStyleClasses(data.classes);
                }
                break;
        }
    }, [sendToIframe, addPendingEdit, iframeRef, t]);

    /**
     * Set up message listener.
     */
    useEffect(() => {
        window.addEventListener('message', handleMessage);
        return () => {
            window.removeEventListener('message', handleMessage);
        };
    }, [handleMessage]);

    /**
     * Update iframe mode when enabled state changes.
     */
    useEffect(() => {
        if (!inspectorReadyRef.current) return;

        if (enabled) {
            sendToIframe({ type: 'inspector-set-mode', mode: 'inspect' });
        } else {
            sendToIframe({ type: 'inspector-set-mode', mode: 'preview' });
            // eslint-disable-next-line react-hooks/set-state-in-effect -- clearing UI state when inspector is disabled
            setContextMenu(null);
            setHoveredElement(null);
        }
    }, [enabled, sendToIframe]);

    /**
     * Send translations to iframe when ready or when translations change.
     */
    useEffect(() => {
        if (!isReady) return;

        sendToIframe({
            type: 'inspector-set-translations',
            translations: {
                Save: t('Save'),
                Cancel: t('Cancel'),
            },
        } as ParentToInspectorMessage);
    }, [isReady, t, sendToIframe]);

    /**
     * Reset ready state when iframe src changes.
     * Uses MutationObserver to detect src attribute changes before load completes,
     * avoiding race conditions with the inspector-ready message.
     */
    useEffect(() => {
        const iframe = iframeRef.current;
        if (!iframe) return;

        // Use MutationObserver to detect src changes before load completes
        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.type === 'attributes' && mutation.attributeName === 'src') {
                    inspectorReadyRef.current = false;
                    setIsReady(false);
                }
            }
        });

        observer.observe(iframe, { attributes: true, attributeFilter: ['src'] });

        // Also handle the key prop change case (iframe remount) - this is handled
        // by the initial false state when the hook first runs

        return () => {
            observer.disconnect();
        };
    }, [iframeRef]);

    /**
     * Start editing a specific element by its selector.
     */
    const startEditingElement = useCallback((selector: string) => {
        sendToIframe({ type: 'inspector-edit-element', selector });
    }, [sendToIframe]);

    /**
     * Revert edits in the iframe (restore original values).
     * Uses direct DOM manipulation since we have same-origin access.
     */
    const revertEdits = useCallback((edits: PendingEdit[]) => {
        if (edits.length === 0) return;

        const iframeDoc = iframeRef.current?.contentDocument;
        if (!iframeDoc) return;

        for (const edit of edits) {
            try {
                const element = iframeDoc.querySelector(edit.element.cssSelector) as HTMLElement;
                if (!element) continue;

                if (edit.field === 'text') {
                    element.textContent = edit.originalValue;
                } else {
                    // For attributes like href, src, alt, placeholder, title
                    element.setAttribute(edit.field, edit.originalValue);
                }
            } catch {
                console.warn('Failed to revert edit for selector:', edit.element.cssSelector);
            }
        }
    }, [iframeRef]);

    // ============================================
    // Style Panel Methods
    // ============================================

    const openStylePanel = useCallback((element: InspectorElement) => {
        setStyleElement(element);
        setStylePanelOpen(true);
        setOriginalClasses([...element.classNames]);
        setStyleClasses([...element.classNames]);
        originalClassesInitRef.current = true;
        // Request current classes from iframe (may have changed since selection)
        sendToIframe({ type: 'inspector-get-classes', selector: element.cssSelector });
    }, [sendToIframe]);

    const closeStylePanel = useCallback(() => {
        setStylePanelOpen(false);
        setStyleElement(null);
        setStyleClasses([]);
        setOriginalClasses([]);
        originalClassesInitRef.current = false;
    }, []);

    const updateStyleClasses = useCallback((add: string[], remove: string[]) => {
        if (!styleElement) return;
        // Update local state
        setStyleClasses(prev => {
            const next = prev.filter(c => !remove.includes(c));
            for (const cls of add) {
                if (!next.includes(cls)) next.push(cls);
            }
            return next;
        });
        // Apply live in iframe via JIT
        sendToIframe({ type: 'inspector-update-classes', selector: styleElement.cssSelector, add, remove });
    }, [styleElement, sendToIframe]);

    const resetStyleClasses = useCallback(() => {
        if (!styleElement || !originalClassesInitRef.current) return;
        // Calculate diff to restore
        const toRemove = styleClasses.filter(c => !originalClasses.includes(c));
        const toAdd = originalClasses.filter(c => !styleClasses.includes(c));
        if (toRemove.length > 0 || toAdd.length > 0) {
            sendToIframe({ type: 'inspector-update-classes', selector: styleElement.cssSelector, add: toAdd, remove: toRemove });
        }
        setStyleClasses([...originalClasses]);
    }, [styleElement, styleClasses, originalClasses, sendToIframe]);

    return {
        hoveredElement,
        contextMenu,
        closeContextMenu,
        pendingEdits,
        addPendingEdit,
        removePendingEdit,
        clearPendingEdits,
        isReady,
        startEditingElement,
        revertEdits,
        stylePanelOpen,
        styleElement,
        styleClasses,
        originalClasses,
        openStylePanel,
        closeStylePanel,
        updateStyleClasses,
        resetStyleClasses,
    };
}

export type { UsePreviewInspectorOptions };
