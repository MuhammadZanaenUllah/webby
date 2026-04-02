import { useState, useRef } from 'react';
import { Link, router } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowRight, ArrowLeft, AlertCircle } from 'lucide-react';
import { useTranslation } from '@/contexts/LanguageContext';
import { Parallax } from '@/components/ui/Parallax';

interface FinalCTAProps {
    auth: {
        user: { id: number; name: string; email: string } | null;
    };
    isPusherConfigured?: boolean;
    canCreateProject?: boolean;
    cannotCreateReason?: string | null;
    content?: Record<string, unknown>;
}

export function FinalCTA({
    auth,
    isPusherConfigured = true,
    canCreateProject = true,
    cannotCreateReason = null,
    content,
}: FinalCTAProps) {
    const { t, isRtl } = useTranslation();

    // Extract content with defaults - DB content takes priority
    const title = (content?.title as string) || t('Ready to build something amazing?');
    const subtitle = (content?.subtitle as string) || t('Start building for free. No credit card required.');
    const [prompt, setPrompt] = useState('');
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Compute disabled state for logged-in users
    const isDisabled = !!(auth.user && (!isPusherConfigured || !canCreateProject));

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!prompt.trim()) return;

        if (!auth.user) {
            sessionStorage.setItem('landing_prompt', prompt.trim());
            router.visit('/register');
        } else {
            router.post('/projects', { prompt: prompt.trim() });
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            handleSubmit(e);
        }
    };

    return (
        <section className="py-24 lg:py-32 relative overflow-hidden bg-background border-t border-primary/5">
            <Parallax 
                className="absolute inset-0 bg-primary/[0.02] [mask-image:radial-gradient(100%_100%_at_50%_0%,#000_0%,transparent_100%)] pointer-events-none" 
                speed={-0.08}
            />
            
            {/* Decorative Ornaments */}
            <Parallax 
                className="absolute top-0 right-0 w-96 h-96 bg-primary/5 blur-3xl rounded-full -mr-48 -mt-48"
                speed={0.12}
            />
            <Parallax 
                className="absolute bottom-0 left-0 w-96 h-96 bg-primary/5 blur-3xl rounded-full -ml-48 -mb-48"
                speed={0.15}
            />

            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
                {/* Headline */}
                <h2 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight mb-6">
                    {title}
                </h2>

                {/* Subtitle */}
                <p className="text-lg md:text-xl text-muted-foreground/90 mb-10 max-w-2xl mx-auto leading-relaxed">
                    {subtitle}
                </p>

                {/* Cannot create project warning (for logged-in users) */}
                {auth.user && !isPusherConfigured && (
                    <Alert variant="destructive" className="max-w-2xl mx-auto mb-4 text-left">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                            {t('Real-time features are not configured. Please contact support.')}
                        </AlertDescription>
                    </Alert>
                )}

                {auth.user && !canCreateProject && isPusherConfigured && (
                    <Alert variant="destructive" className="max-w-2xl mx-auto mb-4 text-left">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                            {cannotCreateReason}{' '}
                            <Link href="/billing/plans" className="underline font-semibold">
                                {t('View Plans')}
                            </Link>
                        </AlertDescription>
                    </Alert>
                )}

                {/* Prompt Input */}
                <div className="max-w-3xl mx-auto">
                    <form onSubmit={handleSubmit} className="relative">
                        <div className="relative bg-card rounded-3xl sm:rounded-[2rem] shadow-2xl border border-primary/10 overflow-hidden hover:border-primary/20 transition-all duration-500 group">
                            <textarea
                                ref={textareaRef}
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder={t('Describe what you want to build...')}
                                disabled={isDisabled}
                                className="w-full px-6 sm:px-10 py-6 sm:py-8 text-base sm:text-lg lg:text-xl resize-none focus:outline-none focus:ring-0 border-0 min-h-[120px] bg-transparent text-start disabled:opacity-50 disabled:cursor-not-allowed placeholder:text-muted-foreground/60"
                                rows={2}
                            />
                            <div className="flex items-center justify-between gap-2 px-6 sm:px-10 py-4 sm:py-6 bg-muted/30 border-t border-border/50">
                                <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground/80 transition-opacity group-focus-within:opacity-100">
                                    <span>{t('Press')}</span>
                                    <kbd className="px-2 py-0.5 bg-background rounded-md border border-border/50 text-[10px] uppercase font-medium">
                                        ⌘ Enter
                                    </kbd>
                                    <span>{t('to deploy')}</span>
                                </div>
                                <div className="flex items-center gap-2 ms-auto">
                                    <Button
                                        type="submit"
                                        disabled={!prompt.trim() || isDisabled}
                                        className="shrink-0 h-10 sm:h-12 px-6 sm:px-8 rounded-full transition-all hover:scale-[1.05] hover:shadow-lg active:scale-95 bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-md shadow-primary/20"
                                    >
                                        <span className="text-sm sm:text-base">
                                            {auth.user ? t('Launch project') : t('Get started now')}
                                        </span>
                                        {isRtl ? (
                                            <ArrowLeft className="h-4 w-4 me-2 group-hover:-translate-x-1 transition-transform" />
                                        ) : (
                                            <ArrowRight className="h-4 w-4 ms-2 group-hover:translate-x-1 transition-transform" />
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </form>
                </div>

                {/* Trust Note */}
                <p className="mt-6 text-sm text-muted-foreground">
                    {t('Start building today')}
                </p>
            </div>
        </section>
    );
}
