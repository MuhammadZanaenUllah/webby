import { useTranslation } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Pencil, Palette, Sparkles, X } from 'lucide-react';
import type { InspectorElement } from '@/types/inspector';
import { EDITABLE_TEXT_SELECTORS } from '@/types/inspector';

interface ElementToolbarProps {
    element: InspectorElement;
    onEdit: () => void;
    onStyle: () => void;
    onAiEdit: () => void;
    onClose: () => void;
}

export function ElementToolbar({ element, onEdit, onStyle, onAiEdit, onClose }: ElementToolbarProps) {
    const { t } = useTranslation();
    const isTextEditable = (EDITABLE_TEXT_SELECTORS as readonly string[]).includes(element.tagName);

    // Position above the element
    const top = Math.max(8, element.boundingRect.top - 44);
    const left = Math.max(8, element.boundingRect.left);

    return (
        <div
            className="fixed z-[99999] flex items-center gap-1 px-2 py-1 bg-background/95 backdrop-blur-sm border border-border rounded-lg shadow-lg animate-in fade-in-0 zoom-in-95 duration-150"
            style={{ top, left }}
        >
            <span className="text-[10px] font-mono text-muted-foreground mr-1 max-w-[120px] truncate">
                &lt;{element.tagName}{element.classNames[0] ? `.${element.classNames[0]}` : ''}&gt;
            </span>

            {isTextEditable && (
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onEdit} title={t('Edit Text')}>
                    <Pencil className="h-3 w-3" />
                </Button>
            )}

            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onStyle} title={t('Style')}>
                <Palette className="h-3 w-3" />
            </Button>

            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onAiEdit} title={t('AI Edit')}>
                <Sparkles className="h-3 w-3" />
            </Button>

            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose} title={t('Close')}>
                <X className="h-3 w-3" />
            </Button>
        </div>
    );
}
