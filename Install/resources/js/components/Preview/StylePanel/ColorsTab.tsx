import { useState } from 'react';
import { useTranslation } from '@/contexts/LanguageContext';
import { COLOR_FAMILIES, COLOR_SHADES, COLOR_SWATCH, SHADE_HEX, findColorValue } from './tailwind-data';
import { cn } from '@/lib/utils';

interface ColorsTabProps {
    classes: string[];
    breakpoint: string;
    onUpdateClasses: (add: string[], remove: string[]) => void;
}

type ColorProp = 'text' | 'bg' | 'border';

export function ColorsTab({ classes, breakpoint, onUpdateClasses }: ColorsTabProps) {
    const { t } = useTranslation();
    const [prop, setProp] = useState<ColorProp>('text');
    const [expandedFamily, setExpandedFamily] = useState<string | null>(null);
    const bp = breakpoint ? `${breakpoint}:` : '';

    // Find current color for this property (uses color-specific matching to avoid
    // false positives from non-color classes like border-2, border-solid, text-center)
    const currentColor = findColorValue(classes, `${prop}-`, breakpoint);

    const apply = (family: string, shade: string) => {
        // Remove all color classes for this property at this breakpoint
        const remove: string[] = [];
        for (const f of COLOR_FAMILIES) {
            for (const s of COLOR_SHADES) {
                remove.push(`${bp}${prop}-${f}-${s}`);
            }
        }
        remove.push(`${bp}${prop}-white`, `${bp}${prop}-black`, `${bp}${prop}-transparent`);
        onUpdateClasses([`${bp}${prop}-${family}-${shade}`], remove);
    };

    const applySpecial = (value: string) => {
        const remove: string[] = [];
        for (const f of COLOR_FAMILIES) {
            for (const s of COLOR_SHADES) {
                remove.push(`${bp}${prop}-${f}-${s}`);
            }
        }
        remove.push(`${bp}${prop}-white`, `${bp}${prop}-black`, `${bp}${prop}-transparent`);
        onUpdateClasses([`${bp}${prop}-${value}`], remove);
    };

    return (
        <div className="space-y-3 p-3">
            {/* Property Toggle */}
            <div className="flex gap-1">
                {([
                    { value: 'text' as const, label: t('Text Color') },
                    { value: 'bg' as const, label: t('Background') },
                    { value: 'border' as const, label: t('Border Color') },
                ]).map(p => (
                    <button key={p.value} onClick={() => setProp(p.value)}
                        className={cn('flex-1 px-2 py-1 text-[10px] rounded border transition-colors',
                            prop === p.value ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'
                        )}>
                        {p.label}
                    </button>
                ))}
            </div>

            {/* Special Colors */}
            <div className="flex gap-1">
                {['white', 'black', 'transparent'].map(c => (
                    <button key={c} onClick={() => applySpecial(c)}
                        className={cn('flex-1 py-1.5 text-[10px] rounded border transition-colors',
                            currentColor === c ? 'ring-2 ring-primary' : '',
                            c === 'white' ? 'bg-white text-black border-border' :
                            c === 'black' ? 'bg-black text-white border-black' :
                            'bg-[repeating-conic-gradient(#e5e5e5_0%_25%,white_0%_50%)_0_0/16px_16px] border-border text-foreground'
                        )}>
                        {c}
                    </button>
                ))}
            </div>

            {/* Color Families Grid */}
            <div className="space-y-1">
                <label className="text-[11px] font-medium text-muted-foreground block">
                    {currentColor ? `Current: ${prop}-${currentColor}` : 'Select color'}
                </label>
                <div className="grid grid-cols-6 gap-1.5">
                    {COLOR_FAMILIES.map(family => (
                        <button
                            key={family}
                            onClick={() => setExpandedFamily(expandedFamily === family ? null : family)}
                            className={cn(
                                'w-full aspect-square rounded-md border transition-all',
                                expandedFamily === family ? 'ring-2 ring-primary scale-110' : 'hover:scale-105'
                            )}
                            style={{ backgroundColor: COLOR_SWATCH[family] }}
                            title={family}
                        />
                    ))}
                </div>
            </div>

            {/* Shade Selector (expanded) */}
            {expandedFamily && (
                <div>
                    <label className="text-[11px] font-medium text-muted-foreground mb-1.5 block capitalize">
                        {expandedFamily}
                    </label>
                    <div className="flex gap-0.5">
                        {COLOR_SHADES.map(shade => {
                            const hex = SHADE_HEX[expandedFamily]?.[shade] ?? COLOR_SWATCH[expandedFamily];
                            const isActive = currentColor === `${expandedFamily}-${shade}`;
                            return (
                                <button
                                    key={shade}
                                    onClick={() => apply(expandedFamily, shade)}
                                    className={cn(
                                        'flex-1 aspect-square rounded-sm border transition-all',
                                        isActive ? 'ring-2 ring-primary ring-offset-1' : 'hover:scale-110'
                                    )}
                                    style={{ backgroundColor: hex }}
                                    title={`${expandedFamily}-${shade}`}
                                />
                            );
                        })}
                    </div>
                    <div className="flex justify-between text-[9px] text-muted-foreground mt-0.5 px-0.5">
                        <span>50</span>
                        <span>500</span>
                        <span>950</span>
                    </div>
                </div>
            )}
        </div>
    );
}
