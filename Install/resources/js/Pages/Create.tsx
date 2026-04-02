import { useState, useEffect } from 'react';
import { useScramble } from 'use-scramble';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { toast } from 'sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Toaster } from '@/components/ui/sonner';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AppSidebar } from '@/components/Sidebar/AppSidebar';
import { GradientBackground } from '@/components/Dashboard/GradientBackground';
import { PromptInput } from '@/components/Dashboard/PromptInput';
import { ChatPageSkeleton } from '@/components/Skeleton';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LanguageSelector } from '@/components/LanguageSelector';
import { NotificationBell } from '@/components/Notifications/NotificationBell';
import { GlobalCredits } from '@/components/Header/GlobalCredits';
import { useNotifications } from '@/hooks/useNotifications';
import { useUserChannel } from '@/hooks/useUserChannel';
import { usePageTransition } from '@/hooks/usePageTransition';
import { useTranslation } from '@/contexts/LanguageContext';
import { CreateProps, PageProps } from '@/types';
import type { UserCredits, UserNotification } from '@/types/notifications';
import type { BroadcastConfig } from '@/hooks/useBuilderPusher';
import { LogOut, AlertCircle } from 'lucide-react';
import { DemoResetNotice } from '@/components/DemoResetNotice';
import axios from 'axios';

export default function Create({
    user,
    isPusherConfigured,
    canCreateProject,
    cannotCreateReason,
    suggestions: initialSuggestions,
    typingPrompts: initialTypingPrompts,
    greeting: initialGreeting,
    templates,
}: CreateProps) {
    const { t, locale } = useTranslation();
    const [suggestions, setSuggestions] = useState(initialSuggestions);
    const [typingPrompts, setTypingPrompts] = useState(initialTypingPrompts);
    const [greeting, setGreeting] = useState(initialGreeting);
    const [isLoadingAi, setIsLoadingAi] = useState(true);
    const { errors, broadcastConfig, userCredits, unreadNotificationCount } = usePage<PageProps & {
        errors?: { prompt?: string };
        broadcastConfig: BroadcastConfig | null;
        userCredits: UserCredits | null;
        unreadNotificationCount: number;
    }>().props;
    const { isNavigating, destinationUrl } = usePageTransition();

    // Notification state
    const {
        notifications,
        unreadCount,
        isLoading: isLoadingNotifications,
        addNotification,
        markAsRead,
        markAllAsRead,
    } = useNotifications(unreadNotificationCount);

    // Credits state
    const [credits, setCredits] = useState<UserCredits | null>(userCredits);

    // Subscribe to user channel for real-time updates
    useUserChannel({
        userId: user.id,
        broadcastConfig,
        enabled: !!broadcastConfig?.key,
        onNotification: (notification: UserNotification) => {
            addNotification(notification);
            // Show toast for important notifications
            if (notification.type === 'credits_low') {
                toast(notification.title, {
                    description: notification.message,
                });
            }
        },
        onCreditsUpdated: (updated) => {
            setCredits({
                remaining: updated.remaining,
                monthlyLimit: updated.monthlyLimit,
                isUnlimited: updated.isUnlimited,
                usingOwnKey: updated.usingOwnKey,
            });
        },
    });

    // Update state when props change (e.g., after language switch)
    useEffect(() => {
        setSuggestions(initialSuggestions);
        setTypingPrompts(initialTypingPrompts);
        if (initialGreeting !== greeting) {
            setGreeting(initialGreeting);
        }
    }, [initialSuggestions, initialTypingPrompts, initialGreeting, greeting]);

    // Show toast when there are errors
    useEffect(() => {
        if (errors?.prompt) {
            toast.error(errors.prompt);
        }
    }, [errors]);

    // Scramble animation for greeting
    const { ref: greetingRef, replay: replayScramble } = useScramble({
        text: greeting,
        speed: 0.8,
        tick: 1,
        step: 1,
        scramble: 4,
        seed: 2,
    });

    // Replay scramble animation on Inertia navigation (handles same-page navigation)
    useEffect(() => {
        const removeListener = router.on('finish', (event) => {
            if (event.detail.visit.url.pathname === '/create') {
                replayScramble();
            }
        });

        return () => removeListener();
    }, [replayScramble]);

    // Replay scramble animation when locale changes
    useEffect(() => {
        replayScramble();
    }, [locale, replayScramble]);

    // Fetch AI-powered content after page loads
    useEffect(() => {
        const fetchAiContent = async () => {
            try {
                const response = await axios.get('/create/ai-content');
                if (response.data) {
                    setSuggestions(response.data.suggestions || initialSuggestions);
                    setTypingPrompts(response.data.typingPrompts || initialTypingPrompts);
                    if (response.data.greeting && response.data.greeting !== greeting) {
                        setGreeting(response.data.greeting);
                        // Replay scramble animation for new greeting
                        setTimeout(() => replayScramble(), 50);
                    }
                }
            } catch {
                // Keep static content on error
            } finally {
                setIsLoadingAi(false);
            }
        };

        // Defer fetch to not block initial render
        const timeoutId = setTimeout(fetchAiContent, 100);
        return () => clearTimeout(timeoutId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handlePromptSubmit = (prompt: string, templateId: number | null, themePreset: string | null) => {
        // Create a new project with the prompt and redirect to it
        router.post('/projects', {
            prompt,
            template_id: templateId,
            theme_preset: themePreset,
        });
    };

    return (
        <div className="flex min-h-screen bg-background relative overflow-hidden">
            <Head title={t("Create")} />
            <GradientBackground />
            <Toaster />
            <DemoResetNotice variant={user.role === 'admin' ? 'admin' : 'user'} />

            <TooltipProvider>
                <SidebarProvider defaultOpen={true}>
                    <AppSidebar user={user} />
                    <SidebarInset className="m-2 md:m-4 lg:m-6 xl:m-8 rounded-3xl md:rounded-[2.5rem] lg:rounded-[3rem] bg-card/40 backdrop-blur-3xl border border-primary/5 shadow-2xl overflow-hidden transition-all duration-500">
                        <div className="flex flex-col h-full relative">
                            {/* Header - Integrated into the floating card */}
                            <header className="sticky top-0 z-40 flex h-[70px] items-center justify-between border-b border-primary/5 bg-background/20 backdrop-blur-md px-6 md:px-10">
                                <div className="flex items-center gap-4">
                                    <SidebarTrigger className="-ml-1" />
                                    <div className="h-4 w-px bg-primary/10" />
                                    {credits && <GlobalCredits {...credits} />}
                                </div>

                                <div className="flex items-center gap-3">
                                    <LanguageSelector />
                                    <NotificationBell
                                        notifications={notifications}
                                        unreadCount={unreadCount}
                                        onMarkAsRead={markAsRead}
                                        onMarkAllAsRead={markAllAsRead}
                                        isLoading={isLoadingNotifications}
                                    />
                                    <ThemeToggle />

                                    {/* User Profile */}
                                    <div className="h-4 w-px bg-primary/10 mx-1" />
                                    <DropdownMenu>
                                        <DropdownMenuTrigger className="outline-none flex items-center gap-3 hover:bg-primary/5 rounded-full px-2 py-1 transition-all">
                                            <div className="text-end hidden lg:block">
                                                <p className="text-xs font-bold tracking-tight">{user.name}</p>
                                                <p className="text-[10px] text-muted-foreground/70 uppercase font-medium tracking-wider">{user.role}</p>
                                            </div>
                                            <Avatar className="h-9 w-9 border-2 border-primary/10 shadow-lg group-hover:border-primary/30 transition-colors">
                                                <AvatarImage src={user.avatar || undefined} />
                                                <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                                                    {user.name.charAt(0).toUpperCase()}
                                                </AvatarFallback>
                                            </Avatar>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-56 mt-2">
                                            <div className="px-2 py-2">
                                                <p className="text-sm font-bold">{user.name}</p>
                                                <p className="text-xs text-muted-foreground">{user.email}</p>
                                            </div>
                                            <DropdownMenuSeparator className="bg-primary/5" />
                                            <DropdownMenuItem asChild className="cursor-pointer hover:bg-primary/5 focus:bg-primary/5">
                                                <Link href="/logout" method="post" as="button" className="w-full flex items-center">
                                                    <LogOut className="h-4 w-4 me-2 text-destructive/70" />
                                                    <span className="font-medium">{t('Log Out')}</span>
                                                </Link>
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </header>

                            {/* Hero Section - Centered within the inset card */}
                            <div className="relative flex flex-col items-center justify-center flex-1 px-4 md:px-8 py-12">
                                <div className="max-w-3xl text-center mb-12">
                                    <h1
                                        ref={greetingRef}
                                        className="text-4xl md:text-5xl font-bold text-foreground mb-4 tracking-tight font-heading leading-tight"
                                    />
                                    <p className="text-muted-foreground text-lg font-medium opacity-80">
                                        {t('What will we build today?')}
                                    </p>
                                </div>

                                {/* Warnings & Input */}
                                <div className="w-full max-w-3xl space-y-4">
                                    {!isPusherConfigured && (
                                        <Alert variant="destructive" className="bg-destructive/5 border-destructive/10">
                                            <AlertCircle className="h-4 w-4" />
                                            <AlertDescription>
                                                {t('Real-time features are not configured. Please configure broadcast settings in Admin Settings → Integrations.')}
                                            </AlertDescription>
                                        </Alert>
                                    )}

                                    {!canCreateProject && isPusherConfigured && (
                                        <Alert variant="destructive" className="bg-destructive/5 border-destructive/10">
                                            <AlertCircle className="h-4 w-4" />
                                            <AlertDescription>
                                                {cannotCreateReason}
                                                {user.role !== 'admin' && (
                                                    <>
                                                        {' '}
                                                        <Link href="/billing/plans" className="underline font-semibold text-primary">
                                                            {t('View Plans')}
                                                        </Link>
                                                    </>
                                                )}
                                            </AlertDescription>
                                        </Alert>
                                    )}

                                    <div className="w-full">
                                        <PromptInput
                                            onSubmit={handlePromptSubmit}
                                            disabled={!isPusherConfigured || !canCreateProject}
                                            suggestions={suggestions}
                                            typingPrompts={typingPrompts}
                                            isLoadingSuggestions={isLoadingAi}
                                            templates={templates ?? []}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </SidebarInset>
                </SidebarProvider>
            </TooltipProvider>

            {/* Page transition skeleton */}
            {isNavigating && destinationUrl?.startsWith('/project/') && (
                <div className="fixed inset-0 z-[100] bg-background">
                    <ChatPageSkeleton />
                </div>
            )}
        </div>
    );
}
