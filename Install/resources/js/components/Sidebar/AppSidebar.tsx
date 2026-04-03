import { useLayoutEffect, useRef, useState, useEffect } from "react";
import { Link, usePage } from "@inertiajs/react";
import {
    Sidebar,
    SidebarContent,
    SidebarGroup,
    SidebarGroupContent,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarFooter,
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
    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const recentProjects = props.recentProjects;
    const hasUpgradablePlans = props.hasUpgradablePlans;

    const [shareDialogOpen, setShareDialogOpen] = useState(false);
    const [recentOpen, setRecentOpen] = useState(() => {
        if (typeof window !== "undefined") {
            const saved = localStorage.getItem(RECENT_COLLAPSED_KEY);
            return saved !== "closed";
        }
        return true;
    });

    useEffect(() => {
        localStorage.setItem(RECENT_COLLAPSED_KEY, recentOpen ? "open" : "closed");
    }, [recentOpen]);

    useLayoutEffect(() => {
        const scrollArea = scrollAreaRef.current;
        if (!scrollArea) return;
        const viewport = scrollArea.querySelector(
            '[data-slot="scroll-area-viewport"]',
        ) as HTMLElement;
        if (!viewport) return;
        const savedPosition = sessionStorage.getItem(SCROLL_POSITION_KEY);
        if (savedPosition) {
            viewport.scrollTop = parseInt(savedPosition, 10);
        }
        const handleScroll = () => {
            sessionStorage.setItem(SCROLL_POSITION_KEY, viewport.scrollTop.toString());
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
        { titleKey: "Overview", href: "/admin/overview", icon: LayoutDashboard },
        { titleKey: "Users", href: "/admin/users", icon: Users },
        { titleKey: "Projects", href: "/admin/projects", icon: FolderOpen },
        { titleKey: "Subscriptions", href: "/admin/subscriptions", icon: Crown },
        { titleKey: "Transactions", href: "/admin/transactions", icon: Receipt },
        { titleKey: "Referrals", href: "/admin/referrals", icon: Gift },
        { titleKey: "Plans", href: "/admin/plans", icon: Package },
        { titleKey: "AI Builders", href: "/admin/ai-builders", icon: Bot },
        { titleKey: "AI Providers", href: "/admin/ai-providers", icon: Cpu },
        { titleKey: "AI Templates", href: "/admin/ai-templates", icon: LayoutTemplate },
        { titleKey: "Landing Page", href: "/admin/landing-builder", icon: Layout },
        { titleKey: "Plugins", href: "/admin/plugins", icon: Puzzle },
        { titleKey: "Languages", href: "/admin/languages", icon: Globe },
        { titleKey: "Cronjobs", href: "/admin/cronjobs", icon: Clock },
        { titleKey: "Settings", href: "/admin/settings", icon: Settings },
    ];

    const isActive = (href: string) => url.startsWith(href);

    return (
        <Sidebar
            variant="floating"
            collapsible="none"
            className="group/sidebar border-none bg-transparent"
        >
            {/* Glassmorphism card overlay */}
            <div className="absolute inset-3 rounded-[2rem] bg-background/80 backdrop-blur-xl border border-border/60 shadow-xl z-0 pointer-events-none" />

            {/* Logo Header */}
            <SidebarHeader className="h-[72px] px-6 flex-row items-center border-b border-border/40 relative z-10">
                <Link
                    href="/create"
                    className="flex items-center w-full transition-opacity hover:opacity-80"
                >
                    <ApplicationLogo showText={true} size="lg" />
                </Link>
            </SidebarHeader>

            <SidebarContent className="!overflow-hidden flex-1 relative z-10 px-3 py-2">
                <div ref={scrollAreaRef} className="h-full">
                    <ScrollArea
                        className="h-full [&_[data-slot=scroll-area-scrollbar]]:opacity-0 [&_[data-slot=scroll-area-scrollbar]]:transition-opacity group-hover/sidebar:[&_[data-slot=scroll-area-scrollbar]]:opacity-100"
                        type="always"
                    >
                        {/* Launch AI Button */}
                        <div className="px-1 pt-4 pb-2">
                            <Link
                                href="/create"
                                className={`flex items-center gap-3 w-full h-12 px-4 rounded-xl font-bold text-sm transition-all duration-200 ${
                                    url === "/create"
                                        ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                                        : "bg-primary text-primary-foreground shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 hover:scale-[1.02] active:scale-[0.98]"
                                }`}
                            >
                                <Paintbrush className="h-5 w-5 shrink-0" />
                                <span className="font-black tracking-tight">{t("Launch AI")}</span>
                            </Link>
                        </div>

                        {/* Workspace Section */}
                        <Collapsible defaultOpen className="group/collapsible">
                            <SidebarGroup className="px-0 py-1">
                                <CollapsibleTrigger asChild>
                                    <button className="flex items-center justify-between w-full px-3 py-2 mb-1 rounded-lg hover:bg-muted/50 transition-colors group">
                                        <span className="text-[10px] font-black uppercase tracking-[0.12em] text-muted-foreground/50 group-hover:text-muted-foreground/70 transition-colors">
                                            {t("Workspace")}
                                        </span>
                                        <ChevronDown className="h-3 w-3 text-muted-foreground/40 transition-transform duration-200 group-data-[state=closed]/collapsible:rotate-[-90deg]" />
                                    </button>
                                </CollapsibleTrigger>
                                <CollapsibleContent>
                                    <SidebarGroupContent>
                                        <SidebarMenu className="gap-0.5">
                                            {/* Recent Projects */}
                                            {recentProjects && recentProjects.length > 0 && (
                                                <Collapsible open={recentOpen} onOpenChange={setRecentOpen}>
                                                    <SidebarMenuItem>
                                                        <CollapsibleTrigger asChild>
                                                            <SidebarMenuButton className="h-10 px-3 rounded-xl hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-all group/recent">
                                                                <div className="flex items-center gap-3 w-full">
                                                                    <div className="w-5 h-5 flex items-center justify-center shrink-0">
                                                                        <Clock className="h-4 w-4 text-muted-foreground/50 group-hover/recent:text-primary transition-colors" />
                                                                    </div>
                                                                    <span className="text-sm font-semibold flex-1 text-start">
                                                                        {t("Recent")}
                                                                    </span>
                                                                    <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground/40 transition-transform duration-200 ${recentOpen ? "" : "rotate-[-90deg]"}`} />
                                                                </div>
                                                            </SidebarMenuButton>
                                                        </CollapsibleTrigger>
                                                        <CollapsibleContent>
                                                            <div className="ms-8 mt-1 mb-1 border-s-2 border-primary/10 ps-3 space-y-0.5">
                                                                {recentProjects.map((project) => {
                                                                    const displayName =
                                                                        project.name.length > 24
                                                                            ? project.name.slice(0, 24) + "…"
                                                                            : project.name;
                                                                    return (
                                                                        <Link
                                                                            key={project.id}
                                                                            href={`/project/${project.id}`}
                                                                            className="flex items-center h-8 px-2 text-xs font-medium text-muted-foreground/60 hover:text-primary hover:bg-primary/5 rounded-lg transition-all truncate"
                                                                            title={project.name}
                                                                        >
                                                                            {displayName}
                                                                        </Link>
                                                                    );
                                                                })}
                                                            </div>
                                                        </CollapsibleContent>
                                                    </SidebarMenuItem>
                                                </Collapsible>
                                            )}

                                            {/* Main Nav Items */}
                                            {projectItems.map((item) => (
                                                <SidebarMenuItem key={item.titleKey}>
                                                    <SidebarMenuButton
                                                        asChild
                                                        isActive={isActive(item.href)}
                                                        className={`h-10 px-3 rounded-xl transition-all duration-150 group/item ${
                                                            isActive(item.href)
                                                                ? "bg-primary/10 text-primary"
                                                                : "hover:bg-muted/60 text-muted-foreground hover:text-foreground"
                                                        }`}
                                                    >
                                                        <Link href={item.href} className="flex items-center gap-3 w-full h-full">
                                                            <div className="w-5 h-5 flex items-center justify-center shrink-0">
                                                                <item.icon
                                                                    className={`h-4 w-4 transition-colors ${
                                                                        isActive(item.href)
                                                                            ? "text-primary"
                                                                            : "text-muted-foreground/50 group-hover/item:text-foreground"
                                                                    }`}
                                                                />
                                                            </div>
                                                            <span className={`text-sm font-semibold truncate ${isActive(item.href) ? "font-bold" : ""}`}>
                                                                {t(item.titleKey)}
                                                            </span>
                                                            {isActive(item.href) && (
                                                                <div className="ms-auto w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                                                            )}
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
                            <Collapsible defaultOpen className="group/collapsible">
                                <SidebarGroup className="px-0 py-1">
                                    <CollapsibleTrigger asChild>
                                        <button className="flex items-center justify-between w-full px-3 py-2 mb-1 rounded-lg hover:bg-muted/50 transition-colors group">
                                            <span className="text-[10px] font-black uppercase tracking-[0.12em] text-muted-foreground/50 group-hover:text-muted-foreground/70 transition-colors">
                                                {t("Administration")}
                                            </span>
                                            <ChevronDown className="h-3 w-3 text-muted-foreground/40 transition-transform duration-200 group-data-[state=closed]/collapsible:rotate-[-90deg]" />
                                        </button>
                                    </CollapsibleTrigger>
                                    <CollapsibleContent>
                                        <SidebarGroupContent>
                                            <SidebarMenu className="gap-0.5">
                                                {adminItems.map((item) => (
                                                    <SidebarMenuItem key={item.href}>
                                                        <SidebarMenuButton
                                                            asChild
                                                            isActive={isActive(item.href)}
                                                            className={`h-9 px-3 rounded-lg transition-all duration-150 group/item ${
                                                                isActive(item.href)
                                                                    ? "bg-primary/10 text-primary"
                                                                    : "hover:bg-muted/60 text-muted-foreground hover:text-foreground"
                                                            }`}
                                                        >
                                                            <Link href={item.href} className="flex items-center gap-3 w-full h-full">
                                                                <div className="w-4 h-4 flex items-center justify-center shrink-0">
                                                                    <item.icon
                                                                        className={`h-3.5 w-3.5 transition-colors ${
                                                                            isActive(item.href)
                                                                                ? "text-primary"
                                                                                : "text-muted-foreground/40 group-hover/item:text-foreground"
                                                                        }`}
                                                                    />
                                                                </div>
                                                                <span className={`text-xs font-semibold truncate ${isActive(item.href) ? "font-bold" : ""}`}>
                                                                    {t(item.titleKey)}
                                                                </span>
                                                                {isActive(item.href) && (
                                                                    <div className="ms-auto w-1 h-1 rounded-full bg-primary shrink-0" />
                                                                )}
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

            {/* Footer */}
            <SidebarFooter className="px-4 pb-4 pt-2 space-y-2 relative z-10">
                {/* Earn Rewards */}
                <Button
                    variant="ghost"
                    className="w-full justify-start h-auto py-2.5 px-3 rounded-xl border border-border/50 bg-muted/30 hover:bg-muted/60 hover:border-border transition-all group"
                    size="sm"
                    onClick={() => setShareDialogOpen(true)}
                >
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center me-3 group-hover:bg-primary/20 group-hover:scale-110 transition-all shrink-0">
                        <Gift className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex flex-col items-start min-w-0">
                        <span className="font-bold text-sm tracking-tight text-foreground">
                            {t("Earn Rewards")}
                        </span>
                        <span className="text-[10px] font-medium text-muted-foreground/60">
                            {t("Refer Friends")}
                        </span>
                    </div>
                </Button>

                <ShareDialog open={shareDialogOpen} onOpenChange={setShareDialogOpen} />

                {/* Upgrade CTA */}
                {hasUpgradablePlans && (
                    <Button
                        asChild
                        className="w-full justify-start h-auto py-2.5 px-3 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-md shadow-primary/25 hover:shadow-lg hover:shadow-primary/35 hover:scale-[1.02] active:scale-[0.98] transition-all overflow-hidden"
                        size="sm"
                    >
                        <Link href="/billing/plans">
                            <div className="h-8 w-8 rounded-lg bg-white/20 flex items-center justify-center me-3 shrink-0">
                                <Sparkles className="h-4 w-4" />
                            </div>
                            <div className="flex flex-col items-start min-w-0">
                                <span className="font-black text-sm tracking-tight">
                                    {t("Elite Access")}
                                </span>
                                <span className="text-[10px] font-bold opacity-75 uppercase tracking-widest">
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
