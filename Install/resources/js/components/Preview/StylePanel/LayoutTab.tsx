import { useTranslation } from '@/contexts/LanguageContext';
import { DISPLAY_OPTIONS, POSITION_OPTIONS, FLEX_DIRECTIONS, JUSTIFY_OPTIONS, ALIGN_OPTIONS, SPACING_SCALE, findExactClass, findClassValue } from './tailwind-data';
import { cn } from '@/lib/utils';

interface LayoutTabProps {
    classes: string[];
    breakpoint: string;
    onUpdateClasses: (add: string[], remove: string[]) => void;
}

export function LayoutTab({ classes, breakpoint, onUpdateClasses }: LayoutTabProps) {
    const { t } = useTranslation();
    const bp = breakpoint ? `${breakpoint}:` : '';

    const activeDisplay = findExactClass(classes, DISPLAY_OPTIONS.map(d => d.value), breakpoint);
    const activePosition = findExactClass(classes, [...POSITION_OPTIONS], breakpoint);
    const isFlex = activeDisplay === 'flex' || activeDisplay === 'inline-flex';
    const isGrid = activeDisplay === 'grid' || activeDisplay === 'inline-grid';

    const activeFlexDir = findExactClass(classes, FLEX_DIRECTIONS.map(d => d.value), breakpoint);
    const activeJustify = findClassValue(classes, 'justify-', breakpoint);
    const activeItems = findClassValue(classes, 'items-', breakpoint);
    const activeGap = findClassValue(classes, 'gap-', breakpoint);
    const activeCols = findClassValue(classes, 'grid-cols-', breakpoint);

    const applyExact = (value: string, possibleValues: readonly string[]) => {
        const remove = possibleValues.map(v => `${bp}${v}`);
        onUpdateClasses([`${bp}${value}`], remove);
    };

    const apply = (prefix: string, value: string, possibleValues: readonly string[]) => {
        const remove = possibleValues.map(v => `${bp}${prefix}${v}`);
        onUpdateClasses([`${bp}${prefix}${value}`], remove);
    };

    return (
        <div className="space-y-4 p-3">
            {/* Display */}
            <div>
                <label className="text-[11px] font-medium text-muted-foreground mb-1.5 block">{t('Display')}</label>
                <div className="flex flex-wrap gap-1">
                    {DISPLAY_OPTIONS.map(d => (
                        <button key={d.value} onClick={() => applyExact(d.value, DISPLAY_OPTIONS.map(o => o.value))}
                            className={cn('px-2 py-1 text-[10px] rounded border transition-colors',
                                activeDisplay === d.value ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'
                            )}>
                            {d.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Position */}
            <div>
                <label className="text-[11px] font-medium text-muted-foreground mb-1.5 block">{t('Position')}</label>
                <div className="flex flex-wrap gap-1">
                    {POSITION_OPTIONS.map(p => (
                        <button key={p} onClick={() => applyExact(p, POSITION_OPTIONS)}
                            className={cn('px-2 py-1 text-[10px] rounded border transition-colors capitalize',
                                activePosition === p ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'
                            )}>
                            {p}
                        </button>
                    ))}
                </div>
            </div>

            {/* Flex Controls */}
            {isFlex && (
                <>
                    <div>
                        <label className="text-[11px] font-medium text-muted-foreground mb-1.5 block">{t('Direction')}</label>
                        <div className="flex gap-1">
                            {FLEX_DIRECTIONS.map(d => (
                                <button key={d.value} onClick={() => applyExact(d.value, FLEX_DIRECTIONS.map(fd => fd.value))}
                                    className={cn('flex-1 px-1 py-1 text-[10px] rounded border transition-colors',
                                        activeFlexDir === d.value ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'
                                    )}>
                                    {d.label}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label className="text-[11px] font-medium text-muted-foreground mb-1.5 block">{t('Justify')}</label>
                        <div className="flex flex-wrap gap-1">
                            {JUSTIFY_OPTIONS.map(j => (
                                <button key={j.value} onClick={() => apply('justify-', j.value, JUSTIFY_OPTIONS.map(o => o.value))}
                                    className={cn('px-1.5 py-1 text-[10px] rounded border transition-colors',
                                        activeJustify === j.value ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'
                                    )}>
                                    {j.label}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label className="text-[11px] font-medium text-muted-foreground mb-1.5 block">{t('Align')}</label>
                        <div className="flex flex-wrap gap-1">
                            {ALIGN_OPTIONS.map(a => (
                                <button key={a.value} onClick={() => apply('items-', a.value, ALIGN_OPTIONS.map(o => o.value))}
                                    className={cn('px-1.5 py-1 text-[10px] rounded border transition-colors',
                                        activeItems === a.value ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'
                                    )}>
                                    {a.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </>
            )}

            {/* Grid Controls */}
            {isGrid && (
                <div>
                    <label className="text-[11px] font-medium text-muted-foreground mb-1.5 block">{t('Columns')}</label>
                    <div className="flex flex-wrap gap-1">
                        {Array.from({ length: 12 }, (_, i) => String(i + 1)).map(n => (
                            <button key={n} onClick={() => apply('grid-cols-', n, Array.from({ length: 12 }, (_, i) => String(i + 1)))}
                                className={cn('w-7 h-7 text-[10px] rounded border transition-colors flex items-center justify-center',
                                    activeCols === n ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'
                                )}>
                                {n}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Gap (for flex and grid) */}
            {(isFlex || isGrid) && (
                <div>
                    <label className="text-[11px] font-medium text-muted-foreground mb-1.5 block">
                        Gap{activeGap ? `: ${activeGap}` : ''}
                    </label>
                    <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                        {SPACING_SCALE.slice(0, 20).map(v => (
                            <button key={v} onClick={() => apply('gap-', v, SPACING_SCALE)}
                                className={cn('px-1.5 py-0.5 text-[10px] rounded border transition-colors min-w-[24px]',
                                    activeGap === v ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'
                                )}>
                                {v}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
