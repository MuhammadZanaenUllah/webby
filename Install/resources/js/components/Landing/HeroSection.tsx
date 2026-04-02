import { useState, useEffect, useRef } from 'react';
import { Link, router } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { GradientBackground } from '@/components/Dashboard/GradientBackground';
import { ArrowRight, ArrowLeft, AlertCircle } from 'lucide-react';
import { useScramble } from 'use-scramble';
import { TrustedBy } from './TrustedBy';
import { useTranslation } from '@/contexts/LanguageContext';
import { Parallax } from '@/components/ui/Parallax';
import axios from 'axios';

interface HeroSectionProps {
    auth: {
        user: { id: number; name: string; email: string } | null;
    };
    initialSuggestions: string[];
    initialTypingPrompts: string[];
    initialHeadline: string;
    initialSubtitle: string;
    isPusherConfigured?: boolean;
    canCreateProject?: boolean;
    cannotCreateReason?: string | null;
    content?: {
        headlines?: string[];
        subtitles?: string[];
        cta_button?: string;
    };
    trustedBy?: {
        enabled?: boolean;
        content?: Record<string, unknown>;
        items?: Array<Record<string, unknown>>;
    };
}

function useTypingAnimation(texts: string[], typingSpeed = 50, pauseDuration = 2000, deletingSpeed = 30) {
    const [displayText, setDisplayText] = useState('');
    const [textIndex, setTextIndex] = useState(0);
    const [isTyping, setIsTyping] = useState(true);
    const [isPaused, setIsPaused] = useState(false);

    // Reset animation state when texts array changes (e.g., language switch)
    // Use JSON.stringify to compare by value, not reference
    const textsKey = JSON.stringify(texts);
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- resetting animation state machine on texts change
        setDisplayText('');
        setTextIndex(0);
        setIsTyping(true);
        setIsPaused(false);
    }, [textsKey]);

    useEffect(() => {
        if (texts.length === 0) return;

        const currentText = texts[textIndex];

        if (isPaused) {
            const pauseTimer = setTimeout(() => {
                setIsPaused(false);
                setIsTyping(false);
            }, pauseDuration);
            return () => clearTimeout(pauseTimer);
        }

        if (isTyping) {
            if (displayText.length < currentText.length) {
                const typingTimer = setTimeout(() => {
                    setDisplayText(currentText.slice(0, displayText.length + 1));
                }, typingSpeed);
                return () => clearTimeout(typingTimer);
            } else {
                // eslint-disable-next-line react-hooks/set-state-in-effect -- animation state machine transition
                setIsPaused(true);
            }
        } else {
            if (displayText.length > 0) {
                const deletingTimer = setTimeout(() => {
                    setDisplayText(displayText.slice(0, -1));
                }, deletingSpeed);
                return () => clearTimeout(deletingTimer);
            } else {
                setTextIndex((prev) => (prev + 1) % texts.length);
                setIsTyping(true);
            }
        }
    }, [displayText, isTyping, isPaused, textIndex, texts, typingSpeed, pauseDuration, deletingSpeed]);

    return displayText;
}

export function HeroSection({
    auth,
    initialSuggestions,
    initialTypingPrompts,
    initialHeadline,
    initialSubtitle,
    isPusherConfigured = true,
    canCreateProject = true,
    cannotCreateReason = null,
    trustedBy,
}: HeroSectionProps) {
    const { t, locale, isRtl } = useTranslation();
    const [prompt, setPrompt] = useState('');
    const [isFocused, setIsFocused] = useState(false);
    const [suggestions, setSuggestions] = useState(initialSuggestions);
    const [typingPrompts, setTypingPrompts] = useState(initialTypingPrompts);
    const [headline, setHeadline] = useState(initialHeadline);
    const [subtitle, setSubtitle] = useState(initialSubtitle);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const isInitialMount = useRef(true);
    const prevLocale = useRef(locale);

    // Update state when props change (e.g., after language switch)
    useEffect(() => {
        setSuggestions(initialSuggestions);
        setTypingPrompts(initialTypingPrompts);
        if (initialHeadline !== headline) {
            setHeadline(initialHeadline);
        }
        if (initialSubtitle !== subtitle) {
            setSubtitle(initialSubtitle);
        }
    }, [initialSuggestions, initialTypingPrompts, initialHeadline, initialSubtitle, headline, subtitle]);

    // Compute disabled state for logged-in users
    const isDisabled = !!(auth.user && (!isPusherConfigured || !canCreateProject));

    // Scramble animation for headline
    const { ref: headlineRef, replay: replayScramble } = useScramble({
        text: headline,
        speed: 0.8,
        tick: 1,
        step: 1,
        scramble: 4,
        seed: 2,
    });

    const animatedPlaceholder = useTypingAnimation(typingPrompts);
    const showAnimatedPlaceholder = !prompt && !isFocused && !isDisabled;

    // Replay scramble animation on Inertia navigation (handles same-page navigation)
    useEffect(() => {
        const removeListener = router.on('finish', (event) => {
            if (event.detail.visit.url.pathname === '/') {
                replayScramble();
            }
        });

        return () => removeListener();
    }, [replayScramble]);

    // Replay scramble animation when locale changes (skip initial mount)
    useEffect(() => {
        if (isInitialMount.current) {
            isInitialMount.current = false;
            return;
        }
        // Only replay if locale actually changed
        if (prevLocale.current !== locale) {
            prevLocale.current = locale;
            replayScramble();
        }
    }, [locale, replayScramble]);

    // Fetch AI-powered content after page loads (only suggestions and typing prompts)
    useEffect(() => {
        const fetchAiContent = async () => {
            try {
                const response = await axios.get('/landing/ai-content');
                if (response.data) {
                    setSuggestions(response.data.suggestions || initialSuggestions);
                    setTypingPrompts(response.data.typingPrompts || initialTypingPrompts);
                }
            } catch {
                // Keep static content on error
            }
        };

        // Defer fetch to not block initial render
        const timeoutId = setTimeout(fetchAiContent, 100);
        return () => clearTimeout(timeoutId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!prompt.trim()) return;

        if (!auth.user) {
            // Save prompt for post-registration retrieval
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

    const handleSuggestionClick = (suggestion: string) => {
        if (isDisabled) return;
        setPrompt(suggestion);
        textareaRef.current?.focus();
    };

    return (
        <section className="relative min-h-screen flex flex-col items-center pt-44 pb-32 sm:pb-40 bg-background overflow-hidden">
            {/* Specialized Tech Grid Background */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />
            <GradientBackground />

            <div className="relative z-10 w-full max-w-5xl mx-auto px-4 text-center">
                {/* Headline with scramble animation */}
                <h1
                    ref={headlineRef}
                    className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-extrabold tracking-tight mb-8 bg-clip-text text-transparent bg-gradient-to-b from-foreground to-foreground/70 leading-[1.05]"
                />

                {/* Subtitle */}
                <p className="text-lg sm:text-xl md:text-2xl text-muted-foreground/90 mb-12 max-w-3xl mx-auto leading-relaxed">
                    {subtitle}
                </p>

                {/* Cannot create project warning (for logged-in users) */}
                {auth.user && !isPusherConfigured && (
                    <Alert variant="destructive" className="max-w-2xl mb-8 mx-auto text-center">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                            {t('Real-time features are not configured. Please contact support.')}
                        </AlertDescription>
                    </Alert>
                )}

                {auth.user && !canCreateProject && isPusherConfigured && (
                    <Alert variant="destructive" className="max-w-2xl mb-8 mx-auto text-center">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                            {cannotCreateReason}{' '}
                            <Link href="/billing/plans" className="underline font-semibold text-primary">
                                {t('View Plans')}
                            </Link>
                        </AlertDescription>
                    </Alert>
                )}

                {/* Prompt Input - Command Center Style */}
                <div className="max-w-4xl mx-auto mb-24">
                    <form onSubmit={handleSubmit} className="relative">
                        <div className="relative bg-card/60 backdrop-blur-xl rounded-[3rem] shadow-[0_0_50px_-12px_rgba(var(--primary-rgb),0.3)] border border-primary/20 overflow-hidden hover:border-primary/40 transition-all duration-700 group ring-4 ring-primary/5">
                            <div className="relative">
                                <textarea
                                    ref={textareaRef}
                                    value={prompt}
                                    onChange={(e) => setPrompt(e.target.value)}
                                    onFocus={() => setIsFocused(true)}
                                    onBlur={() => setIsFocused(false)}
                                    onKeyDown={handleKeyDown}
                                    placeholder={!showAnimatedPlaceholder ? t('I want to build...') : ""}
                                    disabled={isDisabled}
                                    className="w-full px-10 py-10 text-lg sm:text-xl lg:text-2xl resize-none focus:outline-none focus:ring-0 border-0 min-h-[160px] bg-transparent relative z-10 text-center disabled:opacity-50 disabled:cursor-not-allowed placeholder:text-muted-foreground/40"
                                    rows={1}
                                />
                                {/* Animated placeholder overlay */}
                                {showAnimatedPlaceholder && (
                                    <div
                                        className="absolute inset-0 px-10 py-10 pointer-events-none text-muted-foreground/40 text-lg sm:text-xl lg:text-2xl text-center"
                                        onClick={() => textareaRef.current?.focus()}
                                    >
                                        {animatedPlaceholder}
                                        <span className="inline-block w-0.5 h-7 bg-primary/60 ms-0.5 animate-pulse align-middle" />
                                    </div>
                                )}
                            </div>
                            <div className="flex items-center justify-between gap-4 px-8 py-5 bg-muted/40 border-t border-border/50">
                                <div className="hidden sm:flex items-center gap-3 text-xs text-muted-foreground/70 transition-opacity group-focus-within:opacity-100 opacity-60">
                                    <span>{t('Launch with')}</span>
                                    <kbd className="px-2 py-1 bg-background rounded-md border border-border/50 text-[10px] uppercase font-black text-primary/80">
                                        ⌘ Enter
                                    </kbd>
                                </div>
                                <div className="flex items-center gap-2 ms-auto">
                                    <Button
                                        type="submit"
                                        disabled={!prompt.trim() || isDisabled}
                                        className="shrink-0 h-14 px-12 rounded-full transition-all hover:scale-[1.02] hover:shadow-2xl active:scale-95 bg-primary hover:bg-primary/90 text-primary-foreground font-black shadow-xl shadow-primary/20"
                                    >
                                        <span className="text-lg">
                                            {auth.user ? t('Launch Engine') : t('Start Building')}
                                        </span>
                                        {isRtl ? (
                                            <ArrowLeft className="h-6 w-6 me-3 group-hover:-translate-x-1 transition-transform" />
                                        ) : (
                                            <ArrowRight className="h-6 w-6 ms-3 group-hover:translate-x-1 transition-transform" />
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </form>

                    {/* Suggestions - Centered Marquee */}
                    <div className="mt-14 overflow-hidden max-w-3xl mx-auto relative px-12">
                        <div className="absolute start-0 top-0 bottom-0 w-24 bg-gradient-to-r from-background via-background/80 to-transparent z-10 pointer-events-none" />
                        <div className="absolute end-0 top-0 bottom-0 w-24 bg-gradient-to-l from-background via-background/80 to-transparent z-10 pointer-events-none" />
                        <div className={`flex gap-6 hover:[animation-play-state:paused] ${isRtl ? 'animate-marquee-rtl' : 'animate-marquee'}`}>
                            {[...suggestions, ...suggestions].map((suggestion, index) => (
                                <button
                                    key={`${suggestion}-${index}`}
                                    onClick={() => handleSuggestionClick(suggestion)}
                                    disabled={isDisabled}
                                    className="text-sm font-bold px-6 py-3 rounded-full bg-card/60 backdrop-blur-md hover:bg-primary hover:text-primary-foreground hover:border-primary border border-primary/10 text-muted-foreground transition-all shadow-lg whitespace-nowrap shrink-0 disabled:opacity-50"
                                >
                                    {suggestion}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Integrated Product Showcase Frame - Overlapping Hero bottom with Parallax */}
                <Parallax 
                    className="relative w-full max-w-6xl mx-auto mt-12 mb-[-15%] group perspective-1000"
                    speed={-0.05}
                >
                    <div className="relative bg-card/80 backdrop-blur-xl rounded-[2.5rem] border border-primary/20 shadow-[0_50px_100px_-20px_rgba(var(--primary-rgb),0.2)] overflow-hidden transition-all duration-700 hover:shadow-[0_80px_150px_-30px_rgba(var(--primary-rgb),0.3)] hover:-translate-y-4">
                        {/* Browser Top Bar */}
                        <div className="p-4 bg-muted/40 flex items-center justify-between border-b border-border/50">
                            <div className="flex gap-2">
                                <div className="w-3 h-3 rounded-full bg-destructive/40" />
                                <div className="w-3 h-3 rounded-full bg-amber-500/40" />
                                <div className="w-3 h-3 rounded-full bg-primary/40" />
                            </div>
                            <div className="px-4 py-1 rounded-lg bg-background/50 border border-border/50 text-[10px] text-muted-foreground font-black tracking-widest uppercase">
                                yourproject.webby.app
                            </div>
                            <div className="w-8" />
                        </div>
                        {/* Mock Content */}
                        <div className="aspect-[16/9] bg-background/30 p-8">
                            <div className="grid grid-cols-12 gap-8 h-full">
                                <div className="col-span-3 space-y-6">
                                    <div className="h-40 bg-primary/5 rounded-3xl border border-primary/5 animate-pulse" />
                                    <div className="space-y-2">
                                        <div className="h-4 w-full bg-muted rounded-full" />
                                        <div className="h-4 w-2/3 bg-muted rounded-full" />
                                    </div>
                                </div>
                                <div className="col-span-9 space-y-8">
                                    <div className="h-16 w-1/2 bg-primary/10 rounded-2xl" />
                                    <div className="grid grid-cols-2 gap-8">
                                        <div className="h-64 bg-card/40 rounded-3xl border border-primary/10" />
                                        <div className="h-64 bg-card/40 rounded-3xl border border-primary/10" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    {/* Floating Ornaments with Enhanced Parallax */}
                    <Parallax 
                        className="absolute -top-12 -right-12 w-32 h-32 bg-primary/20 blur-3xl rounded-full"
                        speed={0.15}
                    />
                    <Parallax 
                        className="absolute -bottom-12 -left-12 w-48 h-48 bg-primary/10 blur-3xl rounded-full"
                        speed={0.25}
                    />
                </Parallax>
            </div>

                {/* Trusted by strip */}
                <div className="pt-44 border-t border-primary/5">
                    {trustedBy?.enabled !== false && (
                        <TrustedBy
                            content={trustedBy?.content}
                            items={trustedBy?.items as Array<{ name: string; initial: string; color: string; image_url?: string | null }>}
                        />
                    )}
                </div>
            </section>
        );
    }
