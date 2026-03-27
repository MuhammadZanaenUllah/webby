import { useState, useRef, useEffect } from 'react';
import { useTranslation } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { X, Type, Box, Palette, LayoutGrid, Square, Sparkles, Code2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { InspectorElement } from '@/types/inspector';
import { BreakpointBar } from './BreakpointBar';
import { TypographyTab } from './TypographyTab';
import { SpacingTab } from './SpacingTab';
import { ColorsTab } from './ColorsTab';
import { LayoutTab } from './LayoutTab';
import { BordersTab } from './BordersTab';
import { EffectsTab } from './EffectsTab';
import { ClassesTab } from './ClassesTab';

type TabId = 'typography' | 'spacing' | 'colors' | 'layout' | 'borders' | 'effects' | 'classes';

const TABS: { id: TabId; label: string; Icon: typeof Type }[] = [
    { id: 'typography', label: 'Typography', Icon: Type },
    { id: 'spacing', label: 'Spacing', Icon: Box },
    { id: 'colors', label: 'Colors', Icon: Palette },
    { id: 'layout', label: 'Layout', Icon: LayoutGrid },
    { id: 'borders', label: 'Borders', Icon: Square },
    { id: 'effects', label: 'Effects', Icon: Sparkles },
    { id: 'classes', label: 'Classes', Icon: Code2 },
];

interface StylePanelProps {
    element: InspectorElement;
    classes: string[];
    onUpdateClasses: (add: string[], remove: string[]) => void;
    onApply: () => void;
    onReset: () => void;
    onClose: () => void;
}

export function StylePanel({ element, classes, onUpdateClasses, onApply, onReset, onClose }: StylePanelProps) {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<TabId>('typography');
    const [breakpoint, setBreakpoint] = useState('');
    const panelRef = useRef<HTMLDivElement>(null);

    // Close on Escape
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    const tabProps = {
        classes,
        breakpoint,
        onUpdateClasses,
    };

    const renderTab = () => {
        switch (activeTab) {
            case 'typography': return <TypographyTab {...tabProps} />;
            case 'spacing': return <SpacingTab {...tabProps} />;
            case 'colors': return <ColorsTab {...tabProps} />;
            case 'layout': return <LayoutTab {...tabProps} />;
            case 'borders': return <BordersTab {...tabProps} />;
            case 'effects': return <EffectsTab {...tabProps} />;
            case 'classes': return <ClassesTab {...tabProps} />;
        }
    };

    return (
        <div
            ref={panelRef}
            className="fixed right-4 top-20 bottom-20 w-[340px] bg-background border border-border rounded-xl shadow-xl z-50 flex flex-col overflow-hidden animate-in slide-in-from-right-5 duration-200"
        >
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
                <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-medium truncate">
                        &lt;{element.tagName}{element.classNames[0] ? `.${element.classNames[0]}` : ''}&gt;
                    </span>
                </div>
                <button onClick={onClose} className="p-1 hover:bg-muted rounded transition-colors">
                    <X className="h-3.5 w-3.5" />
                </button>
            </div>

            {/* Tab Bar */}
            <div className="flex items-center gap-0.5 px-2 py-1.5 border-b bg-muted/40">
                {TABS.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={cn(
                            'flex-1 flex items-center justify-center gap-1 py-1.5 text-[10px] font-medium rounded-md transition-all',
                            activeTab === tab.id
                                ? 'bg-background text-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                        )}
                        title={t(tab.label)}
                    >
                        <tab.Icon className="h-3.5 w-3.5" />
                    </button>
                ))}
            </div>

            {/* Breakpoint Bar */}
            <BreakpointBar active={breakpoint} onChange={setBreakpoint} classes={classes} />

            {/* Tab Content */}
            <ScrollArea className="flex-1">
                {renderTab()}
            </ScrollArea>

            {/* Footer */}
            <Separator />
            <div className="flex items-center gap-2 px-3 py-2">
                <Button variant="outline" size="sm" onClick={onReset} className="h-7 text-xs flex-1">
                    {t('Reset')}
                </Button>
                <Button size="sm" onClick={onApply} className="h-7 text-xs flex-1">
                    {t('Apply')}
                </Button>
            </div>
        </div>
    );
}
