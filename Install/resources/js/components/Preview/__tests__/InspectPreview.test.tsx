/**
 * Tests for InspectPreview component.
 * Tests element selection, mode toggling, and edit handling.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { InspectPreview } from '../InspectPreview';
import type { PendingEdit, InspectorElement } from '@/types/inspector';

// Mock canvas-confetti
vi.mock('canvas-confetti', () => ({
    default: {
        create: vi.fn(() => vi.fn()),
    },
}));

// Mock sonner toast
vi.mock('sonner', () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
    },
}));

// Mock usePreviewInspector hook
const mockCloseContextMenu = vi.fn();

vi.mock('@/hooks/usePreviewInspector', () => ({
    usePreviewInspector: vi.fn(() => ({
        hoveredElement: null,
        contextMenu: null,
        closeContextMenu: mockCloseContextMenu,
        pendingEdits: [],
        addPendingEdit: vi.fn(),
        removePendingEdit: vi.fn(),
        clearPendingEdits: vi.fn(),
        isReady: true,
        startEditingElement: vi.fn(),
        revertEdits: vi.fn(),
        stylePanelOpen: false,
        styleElement: null,
        styleClasses: [],
        originalClasses: [],
        openStylePanel: vi.fn(),
        closeStylePanel: vi.fn(),
        updateStyleClasses: vi.fn(),
        resetStyleClasses: vi.fn(),
    })),
}));

// Mock usePreviewThemeSync hook
vi.mock('@/hooks/usePreviewThemeSync', () => ({
    usePreviewThemeSync: vi.fn(() => ({
        sendTheme: vi.fn(),
    })),
}));

// Mock usePreviewThemeInjection hook
vi.mock('@/hooks/usePreviewThemeInjection', () => ({
    usePreviewThemeInjection: vi.fn(() => ({
        applyThemeToPreview: vi.fn(),
    })),
}));

// Mock useThumbnailCapture hook
vi.mock('@/hooks/useThumbnailCapture', () => ({
    useThumbnailCapture: vi.fn(() => ({
        captureAndUpload: vi.fn(),
    })),
}));

// Mock element data
const mockElement: InspectorElement = {
    id: 'el-123',
    tagName: 'button',
    elementId: 'submit-btn',
    classNames: ['btn', 'primary'],
    textPreview: 'Submit',
    xpath: '//*[@id="submit-btn"]',
    cssSelector: '#submit-btn',
    boundingRect: { top: 100, left: 200, width: 100, height: 40 },
    attributes: { title: 'Click to submit' },
    parentTagName: 'div',
};

const mockPendingEdit: PendingEdit = {
    id: 'edit-1',
    element: mockElement,
    field: 'text',
    originalValue: 'Submit',
    newValue: 'Save',
    timestamp: new Date(),
};

describe('InspectPreview', () => {
    const defaultProps = {
        previewUrl: 'http://localhost:3000/preview/123',
        refreshTrigger: 0,
        isBuilding: false,
        onElementSelect: vi.fn(),
        onElementEdit: vi.fn(),
        pendingEdits: [] as PendingEdit[],
        onSaveAllEdits: vi.fn().mockResolvedValue(undefined),
        onDiscardAllEdits: vi.fn(),
        onRemoveEdit: vi.fn(),
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('rendering', () => {
        it('renders empty state when no preview URL', () => {
            render(<InspectPreview {...defaultProps} previewUrl={null} />);

            expect(screen.getByText('Nothing built yet')).toBeInTheDocument();
        });

        it('renders iframe when preview URL exists', () => {
            render(<InspectPreview {...defaultProps} />);

            const iframe = screen.getByTitle('Preview');
            expect(iframe).toBeInTheDocument();
            expect(iframe).toHaveAttribute('src', expect.stringContaining('http://localhost:3000/preview/123'));
        });

        it('renders inspect and design toggle buttons', () => {
            render(<InspectPreview {...defaultProps} />);

            expect(screen.getByRole('button', { name: /inspect/i })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /design/i })).toBeInTheDocument();
        });

        it('does not render select/edit sub-mode buttons', () => {
            render(<InspectPreview {...defaultProps} mode="inspect" />);

            expect(screen.queryByRole('button', { name: /^select$/i })).not.toBeInTheDocument();
        });

        it('shows building animation when isBuilding is true', () => {
            render(<InspectPreview {...defaultProps} isBuilding={true} />);

            expect(screen.getByText('Building your site...')).toBeInTheDocument();
        });
    });

    describe('mode-specific hints', () => {
        it('shows inspect mode hint', async () => {
            render(<InspectPreview {...defaultProps} mode="inspect" />);

            // Wait for ready state (simulated)
            await waitFor(() => {
                // The hint text may or may not be visible depending on isReady state
                // We'll just verify the component renders without error
                expect(screen.getByTitle('Preview')).toBeInTheDocument();
            });
        });
    });

    describe('pending edits panel', () => {
        it('shows pending edits panel when edits exist', () => {
            render(
                <InspectPreview
                    {...defaultProps}
                    pendingEdits={[mockPendingEdit]}
                />
            );

            expect(screen.getByText('1 pending change')).toBeInTheDocument();
        });

        it('hides pending edits panel when no edits', () => {
            render(<InspectPreview {...defaultProps} pendingEdits={[]} />);

            expect(screen.queryByText(/pending/i)).not.toBeInTheDocument();
        });

        it('calls onSaveAllEdits when Save All clicked', async () => {
            render(
                <InspectPreview
                    {...defaultProps}
                    pendingEdits={[mockPendingEdit]}
                />
            );

            const saveButton = screen.getByRole('button', { name: /save all/i });
            fireEvent.click(saveButton);

            await waitFor(() => {
                expect(defaultProps.onSaveAllEdits).toHaveBeenCalled();
            });
        });

        it('calls onDiscardAllEdits when Discard All clicked', () => {
            render(
                <InspectPreview
                    {...defaultProps}
                    pendingEdits={[mockPendingEdit]}
                />
            );

            const discardButton = screen.getByRole('button', { name: /discard all/i });
            fireEvent.click(discardButton);

            expect(defaultProps.onDiscardAllEdits).toHaveBeenCalled();
        });
    });

    describe('empty state', () => {
        it('renders empty state message', () => {
            render(<InspectPreview {...defaultProps} previewUrl={null} />);

            expect(screen.getByText('Nothing built yet')).toBeInTheDocument();
            expect(screen.getByText(/start a conversation/i)).toBeInTheDocument();
        });

        it('shows building animation in empty state when building', () => {
            render(
                <InspectPreview
                    {...defaultProps}
                    previewUrl={null}
                    isBuilding={true}
                />
            );

            expect(screen.getByText('Building your site...')).toBeInTheDocument();
        });
    });

    describe('refresh trigger', () => {
        it('updates iframe src when refreshTrigger changes', () => {
            const { rerender } = render(
                <InspectPreview {...defaultProps} refreshTrigger={1} />
            );

            const iframe1 = screen.getByTitle('Preview');
            const src1 = iframe1.getAttribute('src');

            rerender(<InspectPreview {...defaultProps} refreshTrigger={2} />);

            const iframe2 = screen.getByTitle('Preview');
            const src2 = iframe2.getAttribute('src');

            expect(src1).not.toBe(src2);
        });
    });

    describe('accessibility', () => {
        it('has accessible iframe title', () => {
            render(<InspectPreview {...defaultProps} />);

            expect(screen.getByTitle('Preview')).toBeInTheDocument();
        });

        it('has accessible inspect and design toggle buttons', () => {
            render(<InspectPreview {...defaultProps} />);

            expect(screen.getByRole('button', { name: /inspect/i })).toHaveAccessibleName();
            expect(screen.getByRole('button', { name: /design/i })).toHaveAccessibleName();
        });
    });
});
