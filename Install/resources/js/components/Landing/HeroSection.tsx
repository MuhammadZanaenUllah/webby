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

function TypingText({ texts }: { texts: string[] }) {
    const displayText = useTypingAnimation(texts);
    return <span>{displayText}</span>;
}

function ScrambleText({ text, replayRef }: { text: string; replayRef: React.MutableRefObject<(() => void) | null> }) {
    const { ref, replay } = useScramble({
        text: text,
        speed: 0.8,
        tick: 1,
        step: 1,
        scramble: 4,
        seed: 2,
    });

    useEffect(() => {
        replayRef.current = replay;
    }, [replay, replayRef]);

    return <span ref={ref} />;
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
    const replayScrambleRef = useRef<(() => void) | null>(null);

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

    const showAnimatedPlaceholder = !prompt && !isFocused && !isDisabled;

    // Replay scramble animation on Inertia navigation (handles same-page navigation)
    useEffect(() => {
        const removeListener = router.on('finish', (event) => {
            if (event.detail.visit.url.pathname === '/' && replayScrambleRef.current) {
                replayScrambleRef.current();
            }
        });

        return () => removeListener();
    }, []);

    // Replay scramble animation when locale changes (skip initial mount)
    useEffect(() => {
        if (isInitialMount.current) {
            isInitialMount.current = false;
            return;
        }
        // Only replay if locale actually changed
        if (prevLocale.current !== locale && replayScrambleRef.current) {
            prevLocale.current = locale;
            replayScrambleRef.current();
        }
    }, [locale]);

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
        <section className="relative min-h-[110vh] flex flex-col items-center justify-center bg-[#0a0a0a] overflow-hidden">
            {/* Dynamic Noise Mesh Background */}
            <div className="absolute inset-0 opacity-20 pointer-events-none">
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] brightness-50 contrast-150" />
                <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 via-transparent to-primary/10 animate-pulse" />
            </div>

            {/* Specialized HUD Grid */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:60px_60px] pointer-events-none" />
            
            {/* Vertical HUD Status Line */}
            <div className="absolute left-8 top-1/2 -translate-y-1/2 h-2/3 w-px bg-gradient-to-b from-transparent via-primary/30 to-transparent hidden xl:block">
                <div className="absolute top-0 -left-1 text-[10px] font-black uppercase tracking-[0.5em] text-primary/40 -rotate-90 origin-top-left translate-y-[-100%] translate-x-3">
                    System.initialize(webby_core)
                </div>
                <div className="absolute bottom-0 -left-1 text-[10px] font-black uppercase tracking-[0.5em] text-primary/40 -rotate-90 origin-bottom-left translate-x-3">
                    Status.operational(100%)
                </div>
            </div>

            <div className="relative z-10 w-full max-w-[1400px] mx-auto px-6 lg:px-12 grid grid-cols-1 lg:grid-cols-12 gap-16 items-center">
                {/* Left Side - Command Center (60%) */}
                <div className="lg:col-span-7 text-start flex flex-col space-y-10">
                    <div className="space-y-4">
                        <div className="inline-flex items-center gap-3 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-[10px] font-black uppercase tracking-[0.3em] text-primary animate-fade-in">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                            </span>
                            v4.0 Protocol Active
                        </div>
                        <h1 className="text-5xl sm:text-7xl md:text-8xl lg:text-9xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-b from-white to-white/40 leading-[0.9] animate-fade-in translate-z-0">
                            <ScrambleText text={headline} replayRef={replayScrambleRef} />
                        </h1>
                    </div>

                    <p className="text-lg md:text-xl text-neutral-400 max-w-2xl leading-relaxed font-medium animate-fade-in animation-delay-1000 translate-z-0">
                        {subtitle}
                    </p>

                    {/* HUD-Style Command Input */}
                    <div className="animate-fade-in animation-delay-2000">
                        <form onSubmit={handleSubmit} className="relative group max-w-xl">
                            <div className="relative rounded-3xl border border-white/10 bg-white/[0.05] backdrop-blur-md shadow-2xl transition-all duration-700 group-focus-within:border-primary/50 group-focus-within:shadow-[0_0_50px_rgba(var(--primary-rgb),0.3)] group-focus-within:-translate-y-1 will-change-transform translate-z-0">
                                <div className="p-1 flex items-center">
                                    <div className="flex-1 relative flex items-center min-h-[5rem]">
                                        <textarea
                                            ref={textareaRef}
                                            value={prompt}
                                            onChange={(e) => setPrompt(e.target.value)}
                                            onFocus={() => setIsFocused(true)}
                                            onBlur={() => setIsFocused(false)}
                                            onKeyDown={handleKeyDown}
                                            placeholder={!showAnimatedPlaceholder ? t('I want to build...') : ""}
                                            disabled={isDisabled}
                                            className="w-full px-8 py-8 text-lg font-bold tracking-tight resize-none focus:outline-none focus:ring-0 border-0 bg-transparent text-white disabled:opacity-50 disabled:cursor-not-allowed placeholder:text-white/20 leading-snug"
                                            rows={1}
                                        />
                                        {showAnimatedPlaceholder && (
                                            <div className="absolute left-8 pointer-events-none text-lg font-bold tracking-tight text-white/20">
                                                <TypingText texts={typingPrompts} />
                                            </div>
                                        )}
                                    </div>
                                    <Button
                                        type="submit"
                                        disabled={!prompt.trim() || isDisabled}
                                        className="h-16 w-16 rounded-2xl m-1 transition-all hover:scale-[1.05] bg-primary text-primary-foreground shadow-2xl shadow-primary/20 shrink-0"
                                    >
                                        {isRtl ? <ArrowLeft className="h-8 w-8" /> : <ArrowRight className="h-8 w-8" />}
                                    </Button>
                                </div>
                            </div>
                            
                            {/* Suggestions HUD strip */}
                            <div className="mt-6 flex flex-wrap gap-3">
                                {suggestions.slice(0, 3).map((suggestion) => (
                                    <button
                                        key={suggestion}
                                        onClick={() => handleSuggestionClick(suggestion)}
                                        className="text-[10px] font-black uppercase tracking-[0.2em] px-4 py-2 rounded-lg border border-white/5 bg-white/5 text-white/40 hover:text-primary hover:border-primary/30 transition-all"
                                    >
                                        {suggestion}
                                    </button>
                                ))}
                            </div>
                        </form>
                    </div>
                </div>

                {/* Right Side - Interactive Digital Twin (40%) */}
                <div className="lg:col-span-5 relative hidden lg:block animate-fade-in animation-delay-3000">
                    <Parallax speed={-0.08}>
                        <div className="relative aspect-square translate-z-0">
                            {/* Central Orbiting Orb */}
                            <div className="absolute inset-0 bg-primary/10 blur-[60px] rounded-full animate-pulse-soft will-change-opacity translate-z-0" />
                            
                            {/* Code Floating Window */}
                            <div className="absolute top-0 right-0 w-64 p-6 rounded-3xl border border-white/10 bg-white/10 backdrop-blur-md shadow-2xl animate-float will-change-transform translate-z-0">
                                <div className="flex gap-1.5 mb-4">
                                    <div className="w-2 h-2 rounded-full bg-red-500/40" />
                                    <div className="w-2 h-2 rounded-full bg-yellow-500/40" />
                                    <div className="w-2 h-2 rounded-full bg-green-500/40" />
                                </div>
                                <div className="space-y-2">
                                    <div className="h-2 w-full bg-primary/20 rounded-full" />
                                    <div className="h-2 w-2/3 bg-white/10 rounded-full" />
                                    <div className="h-2 w-4/5 bg-white/10 rounded-full" />
                                </div>
                            </div>

                            {/* UI Preview Window */}
                            <div className="absolute bottom-12 left-0 w-80 p-1.5 rounded-[2.5rem] border border-white/10 bg-white/10 backdrop-blur-md shadow-[0_50px_100px_rgba(0,0,0,0.5)] rotate-[-4deg] animate-float animation-delay-2000 will-change-transform translate-z-0">
                                <div className="rounded-[2rem] overflow-hidden aspect-[4/3] bg-[#1d1d1d] relative">
                                    <div className="absolute inset-0 bg-gradient-to-tr from-primary/10 to-transparent" />
                                    <div className="p-6 space-y-4">
                                        <div className="h-8 w-1/2 bg-white/10 rounded-xl" />
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="h-24 bg-white/5 rounded-2xl border border-white/5" />
                                            <div className="h-24 bg-white/5 rounded-2xl border border-white/5" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Circuit Lines Ornaments */}
                            <svg className="absolute inset-0 w-full h-full opacity-10" viewBox="0 0 400 400">
                                <path d="M 50 100 L 350 100 M 350 100 L 350 300 M 50 300 L 350 300" stroke="currentColor" fill="none" strokeWidth="1" className="text-primary" strokeDasharray="10 10" />
                                <circle cx="50" cy="100" r="4" fill="currentColor" className="text-primary" />
                                <circle cx="350" cy="300" r="4" fill="currentColor" className="text-primary" />
                            </svg>
                        </div>
                    </Parallax>
                </div>
            </div>

            {/* Bottom Trusted By - Minimal Strip */}
            <div className="absolute bottom-0 left-0 w-full p-8 border-t border-white/5 bg-gradient-to-t from-black to-transparent">
                <div className="max-w-7xl mx-auto opacity-40 hover:opacity-100 transition-opacity duration-700">
                    {trustedBy?.enabled !== false && (
                        <TrustedBy
                            content={trustedBy?.content}
                            items={trustedBy?.items as Array<{ name: string; initial: string; color: string; image_url?: string | null }>}
                        />
                    )}
                </div>
            </div>
        </section>
    );
}
