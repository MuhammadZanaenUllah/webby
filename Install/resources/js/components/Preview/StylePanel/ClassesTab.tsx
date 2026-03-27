import { useState, KeyboardEvent } from 'react';
import { useTranslation } from '@/contexts/LanguageContext';
import { Input } from '@/components/ui/input';
import { X } from 'lucide-react';

interface ClassesTabProps {
    classes: string[];
    breakpoint: string;
    onUpdateClasses: (add: string[], remove: string[]) => void;
}

export function ClassesTab({ classes, breakpoint, onUpdateClasses }: ClassesTabProps) {
    const { t } = useTranslation();
    const [input, setInput] = useState('');
    const bp = breakpoint ? `${breakpoint}:` : '';

    // Filter to show classes relevant to current breakpoint
    const displayClasses = breakpoint
        ? classes.filter(c => c.startsWith(`${breakpoint}:`))
        : classes.filter(c => !c.includes(':'));

    const handleAdd = () => {
        const cls = input.trim();
        if (!cls) return;
        const fullClass = bp + cls;
        if (!classes.includes(fullClass)) {
            onUpdateClasses([fullClass], []);
        }
        setInput('');
    };

    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAdd();
        }
    };

    const handleRemove = (cls: string) => {
        onUpdateClasses([], [cls]);
    };

    return (
        <div className="space-y-3 p-3">
            {/* Add class input */}
            <div>
                <label className="text-[11px] font-medium text-muted-foreground mb-1.5 block">{t('Add class')}</label>
                <div className="flex gap-1">
                    <Input
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="e.g. rounded-lg"
                        className="h-7 text-xs"
                    />
                    <button
                        onClick={handleAdd}
                        className="px-3 h-7 text-xs rounded border border-border hover:bg-muted transition-colors"
                    >
                        +
                    </button>
                </div>
            </div>

            {/* Current classes */}
            <div>
                <label className="text-[11px] font-medium text-muted-foreground mb-1.5 block">
                    {breakpoint ? `${breakpoint}: classes` : 'Base classes'} ({displayClasses.length})
                </label>
                <div className="flex flex-wrap gap-1 max-h-64 overflow-y-auto">
                    {displayClasses.length === 0 ? (
                        <p className="text-[11px] text-muted-foreground italic">No classes at this breakpoint</p>
                    ) : (
                        displayClasses.map(cls => (
                            <span key={cls} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] bg-muted rounded border border-border">
                                <span className="font-mono">{breakpoint ? cls.slice(breakpoint.length + 1) : cls}</span>
                                <button
                                    onClick={() => handleRemove(cls)}
                                    className="hover:text-destructive transition-colors"
                                >
                                    <X className="h-2.5 w-2.5" />
                                </button>
                            </span>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
