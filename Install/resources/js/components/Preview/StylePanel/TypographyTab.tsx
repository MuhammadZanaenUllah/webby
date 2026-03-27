import { useTranslation } from '@/contexts/LanguageContext';
import { FONT_SIZES, FONT_WEIGHTS, TEXT_ALIGNS, LINE_HEIGHTS, LETTER_SPACINGS, findClassValue, findExactClass } from './tailwind-data';

/** Font size and weight use findExactClass instead of findClassValue because the
 *  'text-' prefix overlaps with color classes (text-transparent, text-blue-600)
 *  and 'font-' prefix overlaps with family classes (font-serif, font-sans). */
import { cn } from '@/lib/utils';
import { AlignLeft, AlignCenter, AlignRight, AlignJustify } from 'lucide-react';

interface TypographyTabProps {
    classes: string[];
    breakpoint: string;
    onUpdateClasses: (add: string[], remove: string[]) => void;
}

export function TypographyTab({ classes, breakpoint, onUpdateClasses }: TypographyTabProps) {
    const { t } = useTranslation();
    const bp = breakpoint ? `${breakpoint}:` : '';

    const activeSize = findExactClass(classes, FONT_SIZES.map(s => `text-${s}`), breakpoint)?.replace('text-', '') ?? null;
    const activeWeight = findExactClass(classes, FONT_WEIGHTS.map(w => `font-${w.value}`), breakpoint)?.replace('font-', '') ?? null;
    const activeAlign = findExactClass(classes, TEXT_ALIGNS.map(a => `text-${a}`), breakpoint)?.replace('text-', '') ?? null;
    const activeLeading = findClassValue(classes, 'leading-', breakpoint);
    const activeTracking = findClassValue(classes, 'tracking-', breakpoint);
    const activeFamily = findExactClass(classes, ['font-sans', 'font-serif', 'font-mono'], breakpoint);

    const apply = (prefix: string, value: string, possibleValues: readonly string[]) => {
        const remove = possibleValues.map(v => `${bp}${prefix}${v}`);
        onUpdateClasses([`${bp}${prefix}${value}`], remove);
    };

    const applyExact = (value: string, possibleValues: readonly string[]) => {
        const remove = possibleValues.map(v => `${bp}${v}`);
        onUpdateClasses([`${bp}${value}`], remove);
    };

    return (
        <div className="space-y-4 p-3">
            {/* Font Family */}
            <div>
                <label className="text-[11px] font-medium text-muted-foreground mb-1.5 block">{t('Font Family')}</label>
                <div className="flex gap-1">
                    {(['font-sans', 'font-serif', 'font-mono'] as const).map(f => (
                        <button key={f} onClick={() => applyExact(f, ['font-sans', 'font-serif', 'font-mono'])}
                            className={cn('flex-1 px-2 py-1 text-xs rounded border transition-colors',
                                activeFamily === f ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'
                            )}>
                            {f.replace('font-', '')}
                        </button>
                    ))}
                </div>
            </div>

            {/* Font Size */}
            <div>
                <label className="text-[11px] font-medium text-muted-foreground mb-1.5 block">{t('Font Size')}</label>
                <div className="flex flex-wrap gap-1">
                    {FONT_SIZES.map(size => (
                        <button key={size} onClick={() => apply('text-', size, FONT_SIZES)}
                            className={cn('px-1.5 py-0.5 text-[10px] rounded border transition-colors',
                                activeSize === size ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'
                            )}>
                            {size}
                        </button>
                    ))}
                </div>
            </div>

            {/* Font Weight */}
            <div>
                <label className="text-[11px] font-medium text-muted-foreground mb-1.5 block">{t('Font Weight')}</label>
                <div className="flex flex-wrap gap-1">
                    {FONT_WEIGHTS.map(w => (
                        <button key={w.value} onClick={() => apply('font-', w.value, FONT_WEIGHTS.map(fw => fw.value))}
                            className={cn('px-1.5 py-0.5 text-[10px] rounded border transition-colors',
                                activeWeight === w.value ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'
                            )}>
                            {w.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Text Align */}
            <div>
                <label className="text-[11px] font-medium text-muted-foreground mb-1.5 block">{t('Text Align')}</label>
                <div className="flex gap-1">
                    {[
                        { value: 'left', Icon: AlignLeft },
                        { value: 'center', Icon: AlignCenter },
                        { value: 'right', Icon: AlignRight },
                        { value: 'justify', Icon: AlignJustify },
                    ].map(({ value, Icon }) => (
                        <button key={value} onClick={() => apply('text-', value, TEXT_ALIGNS)}
                            className={cn('flex-1 flex justify-center py-1.5 rounded border transition-colors',
                                activeAlign === value ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'
                            )}>
                            <Icon className="h-3.5 w-3.5" />
                        </button>
                    ))}
                </div>
            </div>

            {/* Line Height */}
            <div>
                <label className="text-[11px] font-medium text-muted-foreground mb-1.5 block">{t('Line Height')}</label>
                <div className="flex flex-wrap gap-1">
                    {LINE_HEIGHTS.map(lh => (
                        <button key={lh.value} onClick={() => apply('leading-', lh.value, LINE_HEIGHTS.map(l => l.value))}
                            className={cn('px-1.5 py-0.5 text-[10px] rounded border transition-colors',
                                activeLeading === lh.value ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'
                            )}>
                            {lh.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Letter Spacing */}
            <div>
                <label className="text-[11px] font-medium text-muted-foreground mb-1.5 block">{t('Letter Spacing')}</label>
                <div className="flex flex-wrap gap-1">
                    {LETTER_SPACINGS.map(ls => (
                        <button key={ls.value} onClick={() => apply('tracking-', ls.value, LETTER_SPACINGS.map(l => l.value))}
                            className={cn('px-1.5 py-0.5 text-[10px] rounded border transition-colors',
                                activeTracking === ls.value ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'
                            )}>
                            {ls.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Text Transform */}
            <div>
                <label className="text-[11px] font-medium text-muted-foreground mb-1.5 block">{t('Text Transform')}</label>
                <div className="flex gap-1">
                    {(['normal-case', 'uppercase', 'lowercase', 'capitalize'] as const).map(tt => (
                        <button key={tt} onClick={() => applyExact(tt, ['normal-case', 'uppercase', 'lowercase', 'capitalize'])}
                            className={cn('flex-1 px-1 py-1 text-[10px] rounded border transition-colors',
                                classes.includes(bp + tt) ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'
                            )}>
                            {tt === 'normal-case' ? 'None' : tt}
                        </button>
                    ))}
                </div>
            </div>

            {/* Text Decoration */}
            <div>
                <label className="text-[11px] font-medium text-muted-foreground mb-1.5 block">{t('Text Decoration')}</label>
                <div className="flex gap-1">
                    {(['no-underline', 'underline', 'line-through'] as const).map(td => (
                        <button key={td} onClick={() => applyExact(td, ['no-underline', 'underline', 'line-through'])}
                            className={cn('flex-1 px-1 py-1 text-[10px] rounded border transition-colors',
                                classes.includes(bp + td) ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'
                            )}>
                            {td === 'no-underline' ? 'None' : td}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
