import { useLayoutEffect, useRef, useState, useEffect } from "react";
import { Link, usePage } from "@inertiajs/react";
import {
    Sidebar,
    SidebarContent,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarFooter,
    useSidebar,
} from "@/components/ui/sidebar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
    FolderOpen,
    Files,
    Database,
    LayoutTemplate,
    ChevronDown,
    LayoutDashboard,
    Users,
    CreditCard,
    Crown,
    Receipt,
    Package,
    Puzzle,
    Globe,
    Clock,
    Settings,
    Sparkles,
    Bot,
    Cpu,
    Paintbrush,
    Gift,
    Layout,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import ApplicationLogo from "@/components/ApplicationLogo";
import { ShareDialog } from "@/components/Referral/ShareDialog";
import { PageProps } from "@/types";
import { useTranslation } from "@/contexts/LanguageContext";

interface User {
    id: number;
    name: string;
    email: string;
    avatar?: string | null;
    role?: "admin" | "user";
}

interface AppSidebarProps {
    user: User;
}

const SCROLL_POSITION_KEY = "sidebar-scroll-position";
const RECENT_COLLAPSED_KEY = "sidebar-recent-collapsed";

export function AppSidebar({ user }: AppSidebarProps) {
    const { url, props } = usePage<PageProps>();
    const { t } = useTranslation();
    const { state } = useSidebar();
    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const recentProjects = props.recentProjects;
    const hasUpgradablePlans = props.hasUpgradablePlans;

    // Share dialog state
    const [shareDialogOpen, setShareDialogOpen] = useState(false);

    // Recent collapsible state - persisted to localStorage
    const [recentOpen, setRecentOpen] = useState(() => {
        if (typeof window !== "undefined") {
            const saved = localStorage.getItem(RECENT_COLLAPSED_KEY);
            return saved !== "closed"; // Default to open
        }
        return true;
    });

    // Save recent collapsible state to localStorage
    useEffect(() => {
        localStorage.setItem(
            RECENT_COLLAPSED_KEY,
            recentOpen ? "open" : "closed",
        );
    }, [recentOpen]);

    // Persist and restore scroll position across navigation
    // useLayoutEffect runs synchronously before paint to prevent visual flash
    useLayoutEffect(() => {
        const scrollArea = scrollAreaRef.current;
        if (!scrollArea) return;

        // Find the viewport element inside ScrollArea
        const viewport = scrollArea.querySelector(
            '[data-slot="scroll-area-viewport"]',
        ) as HTMLElement;
        if (!viewport) return;

        // Restore scroll position
        const savedPosition = sessionStorage.getItem(SCROLL_POSITION_KEY);
        if (savedPosition) {
            viewport.scrollTop = parseInt(savedPosition, 10);
        }

        // Save scroll position on scroll
        const handleScroll = () => {
            sessionStorage.setItem(
                SCROLL_POSITION_KEY,
                viewport.scrollTop.toString(),
            );
        };

        viewport.addEventListener("scroll", handleScroll);
        return () => viewport.removeEventListener("scroll", handleScroll);
    }, []);

    const projectItems = [
        { titleKey: "All Projects", href: "/projects", icon: FolderOpen },
        { titleKey: "File Manager", href: "/file-manager", icon: Files },
        { titleKey: "Database", href: "/database", icon: Database },
        { titleKey: "Billing", href: "/billing", icon: CreditCard },
        { titleKey: "Settings", href: "/profile", icon: Settings },
    ];

    const adminItems = [
        {
            titleKey: "Overview",
            href: "/admin/overview",
            icon: LayoutDashboard,
        },
        { titleKey: "Users", href: "/admin/users", icon: Users },
        { titleKey: "Projects", href: "/admin/projects", icon: FolderOpen },
        {
            titleKey: "Subscriptions",
            href: "/admin/subscriptions",
            icon: Crown,
        },
        {
            titleKey: "Transactions",
            href: "/admin/transactions",
            icon: Receipt,
        },
        { titleKey: "Referrals", href: "/admin/referrals", icon: Gift },
        { titleKey: "Plans", href: "/admin/plans", icon: Package },
        { titleKey: "AI Builders", href: "/admin/ai-builders", icon: Bot },
        { titleKey: "AI Providers", href: "/admin/ai-providers", icon: Cpu },
        {
            titleKey: "AI Templates",
            href: "/admin/ai-templates",
            icon: LayoutTemplate,
        },
        {
            titleKey: "Landing Page",
            href: "/admin/landing-builder",
            icon: Layout,
        },
        { titleKey: "Plugins", href: "/admin/plugins", icon: Puzzle },
        { titleKey: "Languages", href: "/admin/languages", icon: Globe },
        { titleKey: "Cronjobs", href: "/admin/cronjobs", icon: Clock },
        { titleKey: "Settings", href: "/admin/settings", icon: Settings },
    ];

    const isActive = (href: string) => url.startsWith(href);

    return (
        <Sidebar
            variant="floating"
            collapsible="icon"
            className="group/sidebar border-none bg-transparent transition-all duration-300"
        >
            {/* Sidebar Overlay for Blur Effect - Responsive to collapsed state */}
            <div className="absolute inset-4 group-data-[collapsible=icon]:inset-[4px_10px] rounded-[2.5rem] group-data-[collapsible=icon]:rounded-[1.5rem] glass-morphism border border-primary/10 shadow-2xl z-0 pointer-events-none transition-all duration-300" />

            <SidebarHeader className="h-[80px] px-6 group-data-[collapsible=icon]:px-0 flex-row items-center border-b border-primary/5 mb-2 relative z-10 transition-all duration-300">
                <Link
                    href="/create"
                    className="flex items-center w-full justify-center transition-transform hover:scale-[1.02]"
                >
                    <ApplicationLogo
                        showText={state === "expanded"}
                        size={state === "expanded" ? "lg" : "md"}
                    />
                </Link>
            </SidebarHeader>

            <SidebarContent className="!overflow-hidden flex-1 relative z-10 px-2">
                <div ref={scrollAreaRef} className="h-full">
                    <ScrollArea
                        className="h-full [&_[data-slot=scroll-area-scrollbar]]:opacity-0 [&_[data-slot=scroll-area-scrollbar]]:transition-opacity group-hover/sidebar:[&_[data-slot=scroll-area-scrollbar]]:opacity-100"
                        type="always"
                    >
                        {/* Create Link */}
                        <SidebarGroup className="pt-6">
                            <SidebarGroupContent>
                                <SidebarMenu>
                                    <SidebarMenuItem>
                                        <SidebarMenuButton
                                            asChild
                                            isActive={url === "/create"}
                                            className="h-14 px-5 text-lg font-black bg-primary hover:bg-primary/90 text-primary-foreground shadow-[0_0_30px_rgba(var(--primary-rgb),0.3)] transition-all hover:scale-[1.05] active:scale-[0.95] rounded-2xl mb-6 group-data-[collapsible=icon]:!size-10 group-data-[collapsible=icon]:!p-0 group-data-[collapsible=icon]:mx-auto"
                                        >
                                            <Link
                                                href="/create"
                                                className="flex items-center justify-center w-full h-full"
                                            >
                                                <Paintbrush className="h-6 w-6 shrink-0" />
                                                <span className="truncate transition-all duration-300 group-data-[collapsible=icon]:hidden opacity-100">
                                                    {t("Launch AI")}
                                                </span>
                                            </Link>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                </SidebarMenu>
                            </SidebarGroupContent>
                        </SidebarGroup>

                        {/* Projects Section */}
                        <Collapsible defaultOpen className="group/collapsible">
                            <SidebarGroup>
                                <CollapsibleTrigger asChild>
                                    <SidebarGroupLabel className="cursor-pointer hover:bg-primary/5 rounded-xl px-4 py-2 flex items-center justify-between text-[10px] uppercase font-black tracking-widest text-muted-foreground/60">
                                        <span>{t("Workspace")}</span>
                                        <ChevronDown className="h-3 w-3 transition-transform group-data-[state=closed]/collapsible:rotate-[-90deg]" />
                                    </SidebarGroupLabel>
                                </CollapsibleTrigger>
                                <CollapsibleContent className="px-2">
                                    <SidebarGroupContent>
                                        <SidebarMenu className="gap-1">
                                            {/* Recent Projects - More minimal */}
                                            {recentProjects &&
                                                recentProjects.length > 0 && (
                                                    <Collapsible
                                                        open={recentOpen}
                                                        onOpenChange={
                                                            setRecentOpen
                                                        }
                                                    >
                                                        <SidebarMenuItem>
                                                            <CollapsibleTrigger
                                                                asChild
                                                            >
                                                                <SidebarMenuButton className="group/recent h-10 px-4 rounded-xl hover:bg-primary/5">
                                                                    <div className="relative h-4 w-4">
                                                                        <Clock className="absolute h-4 w-4 opacity-100 group-hover/recent:opacity-0 transition-opacity text-primary/60" />
                                                                        <ChevronDown className="absolute h-4 w-4 opacity-0 group-hover/recent:opacity-100 transition-opacity" />
                                                                    </div>
                                                                    <span className="font-bold text-sm">
                                                                        {t(
                                                                            "Recent",
                                                                        )}
                                                                    </span>
                                                                </SidebarMenuButton>
                                                            </CollapsibleTrigger>
                                                            <CollapsibleContent>
                                                                <div className="ml-6 mt-1 mb-2 space-y-1 border-s border-primary/10">
                                                                    {recentProjects.map(
                                                                        (
                                                                            project,
                                                                        ) => {
                                                                            const displayName =
                                                                                project
                                                                                    .name
                                                                                    .length >
                                                                                25
                                                                                    ? project.name.slice(
                                                                                          0,
                                                                                          25,
                                                                                      ) +
                                                                                      "..."
                                                                                    : project.name;
                                                                            return (
                                                                                <div
                                                                                    key={
                                                                                        project.id
                                                                                    }
                                                                                    className="px-2"
                                                                                >
                                                                                    <Link
                                                                                        href={`/project/${project.id}`}
                                                                                        className="flex items-center h-8 px-3 text-xs font-medium text-muted-foreground/70 hover:text-primary hover:bg-primary/5 rounded-lg transition-all"
                                                                                        title={
                                                                                            project.name
                                                                                        }
                                                                                    >
                                                                                        <span className="truncate">
                                                                                            {
                                                                                                displayName
                                                                                            }
                                                                                        </span>
                                                                                    </Link>
                                                                                </div>
                                                                            );
                                                                        },
                                                                    )}
                                                                </div>
                                                            </CollapsibleContent>
                                                        </SidebarMenuItem>
                                                    </Collapsible>
                                                )}
                                            {projectItems.map((item) => (
                                                <SidebarMenuItem
                                                    key={item.titleKey}
                                                >
                                                    <SidebarMenuButton
                                                        asChild
                                                        isActive={isActive(
                                                            item.href,
                                                        )}
                                                        className={`h-11 px-4 transition-all rounded-xl group group-data-[collapsible=icon]:!size-9 group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:!p-0 ${
                                                            isActive(item.href)
                                                                ? "bg-primary/10 text-primary font-black shadow-[inset_0_0_20px_rgba(var(--primary-rgb),0.1)]"
                                                                : "hover:bg-primary/5 text-muted-foreground/80 hover:text-foreground"
                                                        }`}
                                                    >
                                                        <Link
                                                            href={item.href}
                                                            className="flex items-center justify-center w-full h-full"
                                                        >
                                                            <item.icon
                                                                className={`h-5 w-5 shrink-0 ${isActive(item.href) ? "text-primary" : "text-muted-foreground/50 group-hover:text-primary transition-colors"}`}
                                                            />
                                                            <span className="ms-3 font-bold tracking-tight truncate transition-all duration-300 group-data-[collapsible=icon]:hidden opacity-100">
                                                                {t(
                                                                    item.titleKey,
                                                                )}
                                                            </span>
                                                        </Link>
                                                    </SidebarMenuButton>
                                                </SidebarMenuItem>
                                            ))}
                                        </SidebarMenu>
                                    </SidebarGroupContent>
                                </CollapsibleContent>
                            </SidebarGroup>
                        </Collapsible>

                        {/* Administration Section */}
                        {user.role === "admin" && (
                            <Collapsible
                                defaultOpen
                                className="group/collapsible"
                            >
                                <SidebarGroup>
                                    <CollapsibleTrigger asChild>
                                        <SidebarGroupLabel className="cursor-pointer hover:bg-primary/5 rounded-xl px-4 py-2 flex items-center justify-between text-[10px] uppercase font-black tracking-widest text-muted-foreground/60">
                                            <span>{t("Administration")}</span>
                                            <ChevronDown className="h-3 w-3 transition-transform group-data-[state=closed]/collapsible:rotate-[-90deg]" />
                                        </SidebarGroupLabel>
                                    </CollapsibleTrigger>
                                    <CollapsibleContent className="px-2">
                                        <SidebarGroupContent>
                                            <SidebarMenu className="gap-0.5">
                                                {adminItems.map((item) => (
                                                    <SidebarMenuItem
                                                        key={item.titleKey}
                                                    >
                                                        <SidebarMenuButton
                                                            asChild
                                                            isActive={isActive(
                                                                item.href,
                                                            )}
                                                            className={`h-9 px-4 transition-all rounded-lg group group-data-[collapsible=icon]:!size-8 group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:!p-0 ${
                                                                isActive(
                                                                    item.href,
                                                                )
                                                                    ? "bg-primary/10 text-primary font-bold"
                                                                    : "hover:bg-primary/5 text-muted-foreground/70 hover:text-foreground"
                                                            }`}
                                                        >
                                                            <Link
                                                                href={item.href}
                                                                className="flex items-center justify-center w-full h-full"
                                                            >
                                                                <item.icon
                                                                    className={`h-4 w-4 shrink-0 ${isActive(item.href) ? "text-primary" : "text-muted-foreground/40"}`}
                                                                />
                                                                <span className="ms-3 text-xs font-bold truncate transition-all duration-300 group-data-[collapsible=icon]:hidden opacity-100">
                                                                    {t(
                                                                        item.titleKey,
                                                                    )}
                                                                </span>
                                                            </Link>
                                                        </SidebarMenuButton>
                                                    </SidebarMenuItem>
                                                ))}
                                            </SidebarMenu>
                                        </SidebarGroupContent>
                                    </CollapsibleContent>
                                </SidebarGroup>
                            </Collapsible>
                        )}
                    </ScrollArea>
                </div>
            </SidebarContent>

            <SidebarFooter className="p-6 group-data-[collapsible=icon]:p-2 space-y-3 relative z-10 transition-all duration-300">
                <Button
                    variant="outline"
                    className="w-full justify-start h-auto py-3 px-4 group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:size-10 group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:justify-center rounded-2xl border-primary/20 bg-primary/5 hover:bg-primary/10 hover:border-primary/40 transition-all group overflow-hidden"
                    size="sm"
                    onClick={() => setShareDialogOpen(true)}
                >
                    <div className="h-9 w-9 group-data-[collapsible=icon]:h-full group-data-[collapsible=icon]:w-full group-data-[collapsible=icon]:me-0 rounded-xl bg-primary/10 flex items-center justify-center me-3 group-hover:scale-110 transition-transform">
                        <Gift className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex flex-col items-start overflow-hidden group-data-[collapsible=icon]:hidden">
                        <span className="font-bold text-sm tracking-tight">
                            {t("Earn Rewards")}
                        </span>
                        <span className="text-[10px] font-medium text-muted-foreground/70">
                            {t("Refer Friends")}
                        </span>
                    </div>
                </Button>
                <ShareDialog
                    open={shareDialogOpen}
                    onOpenChange={setShareDialogOpen}
                />
                {hasUpgradablePlans && (
                    <Button
                        asChild
                        className="w-full justify-start h-auto py-3 px-4 group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:size-10 group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:scale-[1.02] transition-all overflow-hidden"
                        size="sm"
                    >
                        <Link href="/billing/plans">
                            <div className="h-9 w-9 group-data-[collapsible=icon]:h-full group-data-[collapsible=icon]:w-full group-data-[collapsible=icon]:me-0 rounded-xl bg-white/20 flex items-center justify-center me-3 group-data-[collapsible=icon]:me-0 transition-all">
                                <Sparkles className="h-5 w-5" />
                            </div>
                            <div className="flex flex-col items-start overflow-hidden group-data-[collapsible=icon]:hidden">
                                <span className="font-black text-sm tracking-tight">
                                    {t("Elite Access")}
                                </span>
                                <span className="text-[10px] font-bold opacity-80 uppercase tracking-widest">
                                    {t("Upgrade Now")}
                                </span>
                            </div>
                        </Link>
                    </Button>
                )}
            </SidebarFooter>
        </Sidebar>
    );
}
