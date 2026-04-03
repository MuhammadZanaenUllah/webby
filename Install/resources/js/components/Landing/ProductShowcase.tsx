import { useState, useMemo } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from '@/contexts/LanguageContext';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Parallax } from '@/components/ui/Parallax';
import { cn } from '@/lib/utils';

interface ShowcaseTab {
    value: string;
    label: string;
    screenshot_light?: string | null;
    screenshot_dark?: string | null;
}

interface ProductShowcaseProps {
    content?: Record<string, unknown>;
    items?: ShowcaseTab[];
    settings?: {
        showcase_type?: 'video' | 'screenshots';
    };
}

// Default tabs with default screenshots - labels are translation keys
const DEFAULT_TAB_VALUES = [
    { value: 'preview', labelKey: 'Preview', screenshot_light: '/screenshots/preview-light.png', screenshot_dark: '/screenshots/preview-dark.png' },
    { value: 'inspect', labelKey: 'Inspect', screenshot_light: '/screenshots/inspect-light.png', screenshot_dark: '/screenshots/inspect-dark.png' },
    { value: 'code', labelKey: 'Code', screenshot_light: '/screenshots/code-light.png', screenshot_dark: '/screenshots/code-dark.png' },
];

export function ProductShowcase({ content, items, settings }: ProductShowcaseProps = {}) {
    const { resolvedTheme } = useTheme();
    const { t } = useTranslation();
    const [activeView, setActiveView] = useState<string>('preview');

    // Get content with defaults - DB content takes priority
    const title = (content?.title as string) || t('See it in action');
    const subtitle = (content?.subtitle as string) || t('A powerful development environment that lets you chat with AI, edit code, and manage projects all in one place.');
    const videoUrl = content?.video_url as string | undefined;
    const showcaseType = settings?.showcase_type || 'screenshots';

    // Use database items if provided, otherwise fall back to translated defaults
    const tabs = useMemo(() => {
        if (items && items.length > 0) {
            // Map database items to tab format
            return items.map(item => ({
                value: item.value || item.label?.toLowerCase().replace(/\s+/g, '-') || 'tab',
                label: item.label || 'Tab',
                screenshot_light: item.screenshot_light || null,
                screenshot_dark: item.screenshot_dark || null,
            }));
        }
        // Default tabs with translated labels
        return DEFAULT_TAB_VALUES.map(tab => ({
            ...tab,
            label: t(tab.labelKey),
        }));
    }, [items, t]);

    // Set initial active view to first tab
    const initialTab = tabs[0]?.value || 'preview';
    if (activeView !== initialTab && !tabs.find(t => t.value === activeView)) {
        setActiveView(initialTab);
    }

    // Get screenshot URL for a tab
    const getScreenshotUrl = (tab: ShowcaseTab) => {
        const isDark = resolvedTheme === 'dark';
        // Use custom screenshots if provided, otherwise fall back to default paths
        if (isDark && tab.screenshot_dark) {
            return tab.screenshot_dark;
        }
        if (!isDark && tab.screenshot_light) {
            return tab.screenshot_light;
        }
        // Fallback to default screenshot paths
        return `/screenshots/${tab.value}-${isDark ? 'dark' : 'light'}.png`;
    };

    // Extract YouTube video ID from URL
    const getYouTubeEmbedUrl = (url: string) => {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const match = url.match(regExp);
        const videoId = match && match[2].length === 11 ? match[2] : null;
        if (videoId) {
            return `https://www.youtube.com/embed/${videoId}?rel=0`;
        }
        return null;
    };

    return (
        <section className="py-24 lg:py-40 bg-[#0a0a0a] relative overflow-hidden">
            {/* Ambient Background Glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-7xl h-[600px] bg-primary/5 blur-[150px] rounded-full pointer-events-none" />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                {/* Section Header */}
                <div className="text-center mb-20 animate-fade-in">
                    <h2 className="text-4xl md:text-5xl lg:text-7xl font-black tracking-tighter mb-8 bg-clip-text text-transparent bg-gradient-to-b from-foreground to-foreground/50">
                        {title}
                    </h2>
                    <p className="text-lg md:text-xl text-muted-foreground/70 max-w-3xl mx-auto leading-relaxed font-medium">
                        {subtitle}
                    </p>
                </div>

                {/* Video Mode */}
                {showcaseType === 'video' && videoUrl && (
                    <div className="max-w-5xl mx-auto animate-fade-in animation-delay-2000">
                        <div className="rounded-[3rem] border border-primary/20 glass-morphism shadow-2xl overflow-hidden group hover:border-primary/40 transition-all duration-700">
                            {/* Browser Header */}
                            <div className="flex items-center justify-between px-8 py-5 bg-primary/5 border-b border-primary/10">
                                {/* Traffic Lights */}
                                <div className="flex items-center gap-2">
                                    <div className="w-3.5 h-3.5 rounded-full bg-red-500/40" />
                                    <div className="w-3.5 h-3.5 rounded-full bg-yellow-500/40" />
                                    <div className="w-3.5 h-3.5 rounded-full bg-green-500/40" />
                                </div>
                                <div className="px-6 py-1.5 rounded-xl bg-background/50 border border-primary/20 text-[11px] text-primary font-black tracking-widest uppercase">
                                    {t('demo.webby.app')}
                                </div>
                                <div className="w-12" />
                            </div>

                            {/* Video Area */}
                            <div className="relative aspect-video bg-black/20">
                                {getYouTubeEmbedUrl(videoUrl) ? (
                                    <iframe
                                        src={getYouTubeEmbedUrl(videoUrl)!}
                                        title="Product demo video"
                                        className="absolute inset-0 w-full h-full"
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                        allowFullScreen
                                    />
                                ) : (
                                    <div className="absolute inset-0 flex items-center justify-center text-muted-foreground font-bold">
                                        {t('Invalid video URL')}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Screenshots Mode */}
                {(showcaseType === 'screenshots' || !videoUrl) && (
                    <>
                        {/* Tab Switcher - More premium custom buttons */}
                        <div className="flex justify-center mb-12 animate-fade-in animation-delay-2000">
                            <div className="p-1.5 rounded-[1.5rem] glass-morphism border border-primary/20 flex gap-2">
                                {tabs.map((tab) => (
                                    <button
                                        key={tab.value}
                                        onClick={() => setActiveView(tab.value)}
                                        className={cn(
                                            "px-8 py-2.5 rounded-xl text-sm font-black transition-all duration-500 uppercase tracking-widest",
                                            activeView === tab.value 
                                                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-105" 
                                                : "text-muted-foreground hover:text-foreground hover:bg-primary/5"
                                        )}
                                    >
                                        {tab.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Browser Frame with Premium 3D Feel */}
                        <Parallax 
                            className="max-w-6xl mx-auto relative group perspective-1000 animate-fade-in animation-delay-3000"
                            speed={-0.03}
                        >
                            <div className="relative rounded-[3rem] border border-primary/20 glass-morphism shadow-[0_50px_100px_-20px_rgba(var(--primary-rgb),0.25)] overflow-hidden transition-all duration-1000 group-hover:shadow-[0_80px_150px_-30px_rgba(var(--primary-rgb),0.35)] group-hover:-translate-y-4">
                                {/* Browser Header - Matching Hero Mockup */}
                                <div className="flex items-center justify-between px-8 py-5 bg-primary/5 border-b border-primary/20">
                                    {/* Traffic Lights */}
                                    <div className="flex items-center gap-2">
                                        <div className="w-3.5 h-3.5 rounded-full bg-red-500/40" />
                                        <div className="w-3.5 h-3.5 rounded-full bg-yellow-500/40" />
                                        <div className="w-3.5 h-3.5 rounded-full bg-green-500/40" />
                                    </div>
                                    <div className="px-8 py-2 rounded-xl bg-background/50 border border-primary/20 text-[11px] text-primary font-black tracking-widest uppercase">
                                        {activeView}.webby.app
                                    </div>
                                    <div className="w-12" />
                                </div>
                                
                                {/* Screenshot Area */}
                                <div className="relative aspect-[4/3] sm:aspect-[16/10] bg-black/10 overflow-hidden">
                                    {tabs.map((tab) => (
                                        <img
                                            key={tab.value}
                                            src={getScreenshotUrl(tab)}
                                            alt={`${tab.label} view`}
                                            className={cn(
                                                'absolute inset-0 w-full h-full object-cover object-top transition-all duration-1000 ease-out',
                                                activeView === tab.value ? 'opacity-100 scale-105 blur-0' : 'opacity-0 scale-100 blur-xl'
                                            )}
                                            loading="lazy"
                                        />
                                    ))}
                                    
                                    {/* Glass Overlay Ornament */}
                                    <div className="absolute inset-0 pointer-events-none bg-gradient-to-tr from-primary/10 via-transparent to-primary/10 opacity-30" />
                                </div>
                            </div>

                            {/* Decorative Background Ornaments */}
                            <Parallax 
                                className="absolute -top-24 -left-24 w-80 h-80 bg-primary/10 blur-[120px] rounded-full -z-10"
                                speed={0.08}
                            />
                            <Parallax 
                                className="absolute -bottom-24 -right-24 w-96 h-96 bg-primary/20 blur-[120px] rounded-full -z-10"
                                speed={0.15}
                            />
                        </Parallax>
                    </>
                )}
            </div>
        </section>
    );
}
