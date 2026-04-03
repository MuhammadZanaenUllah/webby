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
        <section className="py-24 lg:py-48 relative overflow-hidden bg-background">
            {/* Ambient Background Glows */}
            <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary/5 blur-[150px] rounded-full -mr-64 -mt-64 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-primary/10 blur-[150px] rounded-full -ml-64 -mb-64 pointer-events-none" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-4xl h-96 bg-primary/5 blur-[120px] rounded-full pointer-events-none" />

            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
                {/* Headline */}
                <h2 className="text-4xl md:text-6xl lg:text-8xl font-black tracking-tighter mb-8 bg-clip-text text-transparent bg-gradient-to-b from-foreground to-foreground/50 animate-fade-in uppercase">
                    {title}
                </h2>

                {/* Subtitle */}
                <p className="text-lg md:text-2xl text-muted-foreground/70 mb-16 max-w-2xl mx-auto leading-relaxed font-medium animate-fade-in animation-delay-1000">
                    {subtitle}
                </p>

                {/* Cannot create project warning (for logged-in users) */}
                {auth.user && !isPusherConfigured && (
                    <Alert variant="destructive" className="max-w-2xl mx-auto mb-8 text-left border-destructive/20 glass-morphism">
                        <AlertCircle className="h-5 w-5" />
                        <AlertDescription className="font-bold">
                            {t('Real-time features are not configured. Please contact support.')}
                        </AlertDescription>
                    </Alert>
                )}

                {auth.user && !canCreateProject && isPusherConfigured && (
                    <Alert variant="destructive" className="max-w-2xl mx-auto mb-8 text-left border-destructive/20 glass-morphism">
                        <AlertCircle className="h-5 w-5" />
                        <AlertDescription className="font-bold">
                            {cannotCreateReason}{' '}
                            <Link href="/billing/plans" className="underline font-black hover:text-primary transition-colors">
                                {t('View Plans')}
                            </Link>
                        </AlertDescription>
                    </Alert>
                )}

                {/* Prompt Input Area - High-End Command Center Style */}
                <div className="max-w-4xl mx-auto animate-fade-in animation-delay-2000">
                    <form onSubmit={handleSubmit} className="relative group">
                        <div className="relative rounded-[3rem] border border-primary/20 glass-morphism shadow-[0_50px_100px_-20px_rgba(var(--primary-rgb),0.25)] overflow-hidden transition-all duration-700 hover:shadow-[0_80px_150px_-30px_rgba(var(--primary-rgb),0.35)] hover:-translate-y-2 group-focus-within:border-primary/50 group-focus-within:shadow-[0_0_80px_rgba(var(--primary-rgb),0.2)]">
                            <textarea
                                ref={textareaRef}
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder={t('Describe what you want to build...')}
                                disabled={isDisabled}
                                className="w-full px-8 sm:px-12 py-10 sm:py-12 text-lg sm:text-2xl lg:text-3xl font-bold tracking-tight resize-none focus:outline-none focus:ring-0 border-0 min-h-[160px] bg-transparent text-start disabled:opacity-50 disabled:cursor-not-allowed placeholder:text-muted-foreground/30 leading-snug"
                                rows={2}
                            />
                            <div className="flex flex-col sm:flex-row items-center justify-between gap-6 px-8 sm:px-12 py-8 bg-primary/5 border-t border-primary/10">
                                <div className="flex items-center gap-4 text-xs font-black uppercase tracking-[0.2em] text-muted-foreground/50">
                                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-background/50 border border-primary/10">
                                        <kbd className="font-mono">⌘</kbd>
                                        <kbd className="font-mono">ENTER</kbd>
                                    </div>
                                    <span>{t('to deploy instantly')}</span>
                                </div>
                                <div className="flex items-center gap-4 w-full sm:w-auto">
                                    <Button
                                        type="submit"
                                        disabled={!prompt.trim() || isDisabled}
                                        className="w-full sm:w-auto px-10 py-8 rounded-2xl transition-all duration-300 hover:scale-[1.05] hover:shadow-[0_0_30px_rgba(var(--primary-rgb),0.4)] active:scale-95 bg-primary text-primary-foreground font-black text-lg tracking-tight shadow-2xl shadow-primary/20"
                                    >
                                        <span>
                                            {auth.user ? t('Begin Construction') : t('Enter the Future')}
                                        </span>
                                        {isRtl ? (
                                            <ArrowLeft className="h-5 w-5 me-3 transition-transform group-hover:-translate-x-1" />
                                        ) : (
                                            <ArrowRight className="h-5 w-5 ms-3 transition-transform group-hover:translate-x-1" />
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </form>
                </div>

                {/* Trust Note */}
                <div className="mt-12 flex items-center justify-center gap-3 text-xs font-black uppercase tracking-[0.3em] text-muted-foreground/40 animate-fade-in animation-delay-3000">
                    <div className="h-px w-8 bg-muted-foreground/20" />
                    {t('Join the elite builders club')}
                    <div className="h-px w-8 bg-muted-foreground/20" />
                </div>
            </div>
        </section>
    );
}
