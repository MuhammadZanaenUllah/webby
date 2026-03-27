import { useState } from 'react';
import { useTranslation } from '@/contexts/LanguageContext';
import { SPACING_SCALE, findClassValue } from './tailwind-data';
import { cn } from '@/lib/utils';

interface SpacingTabProps {
    classes: string[];
    breakpoint: string;
    onUpdateClasses: (add: string[], remove: string[]) => void;
}

type SpacingMode = 'padding' | 'margin' | 'gap';
type SpacingSide = 'all' | 'x' | 'y' | 't' | 'r' | 'b' | 'l';

const SIDES: { value: SpacingSide; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'x', label: 'X' },
    { value: 'y', label: 'Y' },
    { value: 't', label: 'T' },
    { value: 'r', label: 'R' },
    { value: 'b', label: 'B' },
    { value: 'l', label: 'L' },
];

export function SpacingTab({ classes, breakpoint, onUpdateClasses }: SpacingTabProps) {
    const { t } = useTranslation();
    const [mode, setMode] = useState<SpacingMode>('padding');
    const [side, setSide] = useState<SpacingSide>('all');
    const bp = breakpoint ? `${breakpoint}:` : '';

    const prefix = mode === 'gap' ? 'gap-' : `${mode[0]}${side === 'all' ? '' : side}-`;
    const activeValue = findClassValue(classes, prefix, breakpoint);

    const apply = (value: string) => {
        // Build remove list for all possible values at this prefix
        const remove = SPACING_SCALE.map(v => `${bp}${prefix}${v}`);
        remove.push(`${bp}${prefix}auto`);
        onUpdateClasses([`${bp}${prefix}${value}`], remove);
    };

    return (
        <div className="space-y-4 p-3">
            {/* Mode Toggle */}
            <div className="flex gap-1">
                {(['padding', 'margin', 'gap'] as const).map(m => (
                    <button key={m} onClick={() => { setMode(m); if (m === 'gap') setSide('all'); }}
                        className={cn('flex-1 px-2 py-1 text-xs rounded border transition-colors capitalize',
                            mode === m ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'
                        )}>
                        {t(m.charAt(0).toUpperCase() + m.slice(1))}
                    </button>
                ))}
            </div>

            {/* Side Selector (not for gap) */}
            {mode !== 'gap' && (
                <div>
                    <label className="text-[11px] font-medium text-muted-foreground mb-1.5 block">Side</label>
                    <div className="flex gap-1">
                        {SIDES.map(s => (
                            <button key={s.value} onClick={() => setSide(s.value)}
                                className={cn('flex-1 px-1 py-1 text-[10px] rounded border transition-colors',
                                    side === s.value ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'
                                )}>
                                {s.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Value Scale */}
            <div>
                <label className="text-[11px] font-medium text-muted-foreground mb-1.5 block">
                    {t('Value')}{activeValue ? `: ${activeValue}` : ''}
                </label>
                <div className="flex flex-wrap gap-1 max-h-48 overflow-y-auto">
                    {SPACING_SCALE.map(v => (
                        <button key={v} onClick={() => apply(v)}
                            className={cn('px-1.5 py-0.5 text-[10px] rounded border transition-colors min-w-[28px]',
                                activeValue === v ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'
                            )}>
                            {v}
                        </button>
                    ))}
                    {mode === 'margin' && (
                        <button onClick={() => apply('auto')}
                            className={cn('px-1.5 py-0.5 text-[10px] rounded border transition-colors',
                                activeValue === 'auto' ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'
                            )}>
                            auto
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
