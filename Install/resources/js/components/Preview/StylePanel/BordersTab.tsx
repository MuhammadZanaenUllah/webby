import { useState } from 'react';
import { useTranslation } from '@/contexts/LanguageContext';
import { BORDER_WIDTHS, BORDER_STYLES, BORDER_RADIUS, BORDER_RADIUS_LABELS, COLOR_FAMILIES, COLOR_SHADES, COLOR_SWATCH, SHADE_HEX, findExactClass } from './tailwind-data';
import { cn } from '@/lib/utils';

interface BordersTabProps {
    classes: string[];
    breakpoint: string;
    onUpdateClasses: (add: string[], remove: string[]) => void;
}

export function BordersTab({ classes, breakpoint, onUpdateClasses }: BordersTabProps) {
    const { t } = useTranslation();
    const bp = breakpoint ? `${breakpoint}:` : '';
    const [colorFamily, setColorFamily] = useState<string | null>(null);

    const activeStyle = findExactClass(classes, BORDER_STYLES.map(s => `border-${s}`), breakpoint)?.replace('border-', '') ?? null;
    const activeWidth = findExactClass(classes, ['border', ...BORDER_WIDTHS.filter(w => w !== '1').map(w => `border-${w}`)], breakpoint);
    const activeWidthValue = activeWidth === 'border' ? '1' : activeWidth?.replace('border-', '') ?? null;
    const activeRadius = findExactClass(classes, ['rounded', ...BORDER_RADIUS.filter(r => r !== '').map(r => `rounded-${r}`)], breakpoint);
    const activeRadiusValue = activeRadius === 'rounded' ? '' : activeRadius?.replace('rounded-', '') ?? null;

    const apply = (prefix: string, value: string, possibleValues: readonly string[]) => {
        // Handle base case (e.g., 'rounded' not 'rounded-')
        const add = value === '' ? `${bp}${prefix.slice(0, -1)}` : `${bp}${prefix}${value}`;
        const remove = possibleValues.map(v => v === '' ? `${bp}${prefix.slice(0, -1)}` : `${bp}${prefix}${v}`);
        onUpdateClasses([add], remove);
    };

    const applyBorderWidth = (value: string) => {
        // border-1 → 'border', border-0/2/4/8 → 'border-N'
        const add = value === '1' ? `${bp}border` : `${bp}border-${value}`;
        const remove = [`${bp}border`, ...BORDER_WIDTHS.filter(w => w !== '1').map(w => `${bp}border-${w}`)];
        onUpdateClasses([add], remove);
    };

    const applyBorderColor = (family: string, shade: string) => {
        const remove: string[] = [];
        for (const f of COLOR_FAMILIES) {
            for (const s of COLOR_SHADES) {
                remove.push(`${bp}border-${f}-${s}`);
            }
        }
        onUpdateClasses([`${bp}border-${family}-${shade}`], remove);
    };

    return (
        <div className="space-y-4 p-3">
            {/* Border Width */}
            <div>
                <label className="text-[11px] font-medium text-muted-foreground mb-1.5 block">{t('Border Width')}</label>
                <div className="flex gap-1">
                    {BORDER_WIDTHS.map(w => (
                        <button key={w} onClick={() => applyBorderWidth(w)}
                            className={cn('flex-1 px-2 py-1 text-[10px] rounded border transition-colors',
                                activeWidthValue === w ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'
                            )}>
                            {w}px
                        </button>
                    ))}
                </div>
            </div>

            {/* Border Style */}
            <div>
                <label className="text-[11px] font-medium text-muted-foreground mb-1.5 block">{t('Border Style')}</label>
                <div className="flex gap-1">
                    {BORDER_STYLES.map(s => (
                        <button key={s} onClick={() => apply('border-', s, BORDER_STYLES)}
                            className={cn('flex-1 px-1 py-1 text-[10px] rounded border transition-colors capitalize',
                                activeStyle === s ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'
                            )}>
                            {s}
                        </button>
                    ))}
                </div>
            </div>

            {/* Border Radius */}
            <div>
                <label className="text-[11px] font-medium text-muted-foreground mb-1.5 block">{t('Border Radius')}</label>
                <div className="flex flex-wrap gap-1">
                    {BORDER_RADIUS.map(r => (
                        <button key={r || 'base'} onClick={() => apply('rounded-', r, BORDER_RADIUS)}
                            className={cn('px-1.5 py-1 text-[10px] rounded border transition-colors',
                                activeRadiusValue === r ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'
                            )}>
                            {BORDER_RADIUS_LABELS[r]}
                        </button>
                    ))}
                </div>
            </div>

            {/* Border Color */}
            <div>
                <label className="text-[11px] font-medium text-muted-foreground mb-1.5 block">{t('Border Color')}</label>
                <div className="grid grid-cols-8 gap-1">
                    {COLOR_FAMILIES.slice(0, 16).map(family => (
                        <button
                            key={family}
                            onClick={() => setColorFamily(colorFamily === family ? null : family)}
                            className={cn('aspect-square rounded-sm border transition-all',
                                colorFamily === family ? 'ring-2 ring-primary' : 'hover:scale-110'
                            )}
                            style={{ backgroundColor: COLOR_SWATCH[family] }}
                            title={family}
                        />
                    ))}
                </div>
                {colorFamily && (
                    <div className="flex gap-0.5 mt-2">
                        {COLOR_SHADES.map(shade => {
                            const hex = SHADE_HEX[colorFamily]?.[shade] ?? COLOR_SWATCH[colorFamily];
                            return (
                                <button
                                    key={shade}
                                    onClick={() => applyBorderColor(colorFamily, shade)}
                                    className="flex-1 aspect-square rounded-sm border hover:scale-110 transition-all"
                                    style={{ backgroundColor: hex }}
                                    title={`border-${colorFamily}-${shade}`}
                                />
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
