import { useTranslation } from '@/contexts/LanguageContext';
import { SHADOW_OPTIONS, findClassValue } from './tailwind-data';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';

interface EffectsTabProps {
    classes: string[];
    breakpoint: string;
    onUpdateClasses: (add: string[], remove: string[]) => void;
}

export function EffectsTab({ classes, breakpoint, onUpdateClasses }: EffectsTabProps) {
    const { t } = useTranslation();
    const bp = breakpoint ? `${breakpoint}:` : '';

    const activeShadow = findClassValue(classes, 'shadow-', breakpoint)
        ?? (classes.some(c => c === (bp ? bp + 'shadow' : 'shadow')) ? '' : null);
    const activeOpacity = findClassValue(classes, 'opacity-', breakpoint);
    const opacityValue = activeOpacity ? parseInt(activeOpacity) : 100;

    const applyShadow = (value: string) => {
        const remove = SHADOW_OPTIONS.map(s => s.value === '' ? `${bp}shadow` : `${bp}shadow-${s.value}`);
        const add = value === '' ? `${bp}shadow` : `${bp}shadow-${value}`;
        onUpdateClasses([add], remove);
    };

    const applyOpacity = (value: number) => {
        const remove = Array.from({ length: 21 }, (_, i) => `${bp}opacity-${i * 5}`);
        onUpdateClasses([`${bp}opacity-${value}`], remove);
    };

    return (
        <div className="space-y-4 p-3">
            {/* Shadow */}
            <div>
                <label className="text-[11px] font-medium text-muted-foreground mb-1.5 block">{t('Shadow')}</label>
                <div className="flex flex-wrap gap-1">
                    {SHADOW_OPTIONS.map(s => (
                        <button key={s.value || 'base'} onClick={() => applyShadow(s.value)}
                            className={cn('px-2 py-1.5 text-[10px] rounded border transition-colors',
                                activeShadow === s.value ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'
                            )}>
                            {s.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Opacity */}
            <div>
                <label className="text-[11px] font-medium text-muted-foreground mb-1.5 block">
                    {t('Opacity')}: {opacityValue}%
                </label>
                <Slider
                    value={[opacityValue]}
                    onValueChange={([v]) => applyOpacity(Math.round(v / 5) * 5)}
                    min={0}
                    max={100}
                    step={5}
                    className="w-full"
                />
            </div>
        </div>
    );
}
