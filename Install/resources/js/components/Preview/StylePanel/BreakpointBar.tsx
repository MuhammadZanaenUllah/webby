import { BREAKPOINTS, BREAKPOINT_LABELS } from './tailwind-data';
import { cn } from '@/lib/utils';

interface BreakpointBarProps {
    active: string;
    onChange: (bp: string) => void;
    classes: string[];
}

export function BreakpointBar({ active, onChange, classes }: BreakpointBarProps) {
    return (
        <div className="flex items-center gap-1 px-3 py-1.5 border-b bg-muted/30">
            {BREAKPOINTS.map((bp) => {
                const prefix = bp ? `${bp}:` : '';
                const hasClasses = bp === '' || classes.some(c => c.startsWith(prefix));
                return (
                    <button
                        key={bp || 'base'}
                        onClick={() => onChange(bp)}
                        className={cn(
                            'relative px-2 py-0.5 text-[11px] font-medium rounded transition-colors',
                            active === bp
                                ? 'bg-primary text-primary-foreground'
                                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                        )}
                    >
                        {BREAKPOINT_LABELS[bp]}
                        {hasClasses && bp !== '' && (
                            <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-primary" />
                        )}
                    </button>
                );
            })}
        </div>
    );
}
