import { useLayoutEffect, useRef, useState, useEffect } from "react";
import { Link, usePage } from "@inertiajs/react";
import {
    Sidebar,
    SidebarContent,
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
    FolderOpen, File, Database, LayoutTemplate, ChevronDown,
    LayoutDashboard, Users, CreditCard, Crown, Receipt, Package,
    Puzzle, Globe, Clock, Settings, Sparkles, Bot, Cpu,
    Paintbrush, Gift, Layout, Pin,
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
            return localStorage.getItem(RECENT_COLLAPSED_KEY) !== "closed";
        }
        return true;
    });

    useEffect(() => {
        localStorage.setItem(RECENT_COLLAPSED_KEY, recentOpen ? "open" : "closed");
    }, [recentOpen]);

    useLayoutEffect(() => {
        const scrollArea = scrollAreaRef.current;
        if (!scrollArea) return;
        const viewport = scrollArea.querySelector('[data-slot="scroll-area-viewport"]') as HTMLElement;
        if (!viewport) return;
        const saved = sessionStorage.getItem(SCROLL_POSITION_KEY);
        if (saved) viewport.scrollTop = parseInt(saved, 10);
        const onScroll = () => sessionStorage.setItem(SCROLL_POSITION_KEY, viewport.scrollTop.toString());
        viewport.addEventListener("scroll", onScroll);
        return () => viewport.removeEventListener("scroll", onScroll);
    }, []);

    const projectItems = [
        { titleKey: "All Projects", href: "/projects", icon: FolderOpen },
        { titleKey: "File Manager", href: "/file-manager", icon: File },
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

    // Reusable nav item component
    const NavItem = ({ href, icon: Icon, label, compact = false }: {
        href: string; icon: React.ElementType; label: string; compact?: boolean;
    }) => {
        const active = isActive(href);
        return (
            <SidebarMenuItem className="px-1.5">
                <SidebarMenuButton
                    asChild
                    isActive={active}
                    className={`
                        ${compact ? "h-8" : "h-11"} px-3 rounded-2xl transition-all duration-200
                        ${active
                            ? "bg-primary/10 text-primary shadow-sm"
                            : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                        }
                    `}
                >
                    <Link href={href} className="flex items-center gap-3 w-full">
                        <Icon className={`shrink-0 ${compact ? "h-3.5 w-3.5" : "h-4.5 w-4.5"} ${active ? "text-primary" : "text-muted-foreground/50"}`} />
                        <span className={`${compact ? "text-[11px]" : "text-sm"} font-bold tracking-tight truncate ${active ? "text-primary" : ""}`}>
                            {label}
                        </span>
                        {active && <div className="ms-auto w-1.5 h-1.5 rounded-full bg-primary shadow-sm shadow-primary/40 shrink-0" />}
                    </Link>
                </SidebarMenuButton>
            </SidebarMenuItem>
        );
    };

    const SectionHeader = ({ label, children }: { label: string; children?: React.ReactNode }) => (
        <div className="flex items-center justify-between px-4 mb-2 mt-6">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/30">
                {label}
            </span>
            {children}
        </div>
    );

    return (
        <Sidebar
            variant="floating"
            collapsible="none"
            className="border-none bg-transparent"
        >
            {/* Logo */}
            <SidebarHeader className="h-20 px-6 flex-row items-center shrink-0">
                <Link href="/create" className="flex items-center w-full hover:opacity-80 transition-opacity">
                    <ApplicationLogo showText={false} size="lg" />
                </Link>
            </SidebarHeader>

            <SidebarContent className="!overflow-hidden flex-1 px-2 py-0">
                <div ref={scrollAreaRef} className="h-full">
                    <ScrollArea
                        className="h-full [&_[data-slot=scroll-area-scrollbar]]:opacity-0 [&_[data-slot=scroll-area-scrollbar]]:transition-opacity hover:[&_[data-slot=scroll-area-scrollbar]]:opacity-100"
                        type="always"
                    >
                        {/* Launch AI */}
                        <div className="px-2 pt-2 pb-4">
                            <Link
                                href="/create"
                                className="flex items-center gap-3 w-full h-12 px-4 rounded-2xl bg-primary text-primary-foreground font-bold text-sm shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/35 hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-300"
                            >
                                <div className="h-8 w-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                                    <Pin className="h-4 w-4" />
                                </div>
                                <span className="font-black tracking-tight">{t("Launch AI")}</span>
                            </Link>
                        </div>

                        {/* Workspace */}
                        <Collapsible defaultOpen className="group/ws">
                            <CollapsibleTrigger asChild>
                                <button className="w-full">
                                    <SectionHeader label={t("Workspace")}>
                                        <ChevronDown className="h-3 w-3 text-muted-foreground/40 transition-transform duration-200 group-data-[state=closed]/ws:rotate-[-90deg]" />
                                    </SectionHeader>
                                </button>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                                <SidebarMenu className="gap-0.5 px-1">
                                    {/* Recent projects */}
                                    {recentProjects && recentProjects.length > 0 && (
                                        <Collapsible open={recentOpen} onOpenChange={setRecentOpen} className="group/recent">
                                            <SidebarMenuItem>
                                                <CollapsibleTrigger asChild>
                                                    <SidebarMenuButton className="h-9 px-3 rounded-lg text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors">
                                                        <Clock className="h-4 w-4 shrink-0 text-muted-foreground/60" />
                                                        <span className="text-sm font-medium flex-1 text-start">{t("Recent")}</span>
                                                        <ChevronDown className={`h-3 w-3 text-muted-foreground/40 transition-transform duration-200 ${recentOpen ? "" : "-rotate-90"}`} />
                                                    </SidebarMenuButton>
                                                </CollapsibleTrigger>
                                                <CollapsibleContent>
                                                    <div className="ms-7 my-1 border-s-2 border-primary/10 ps-2 space-y-0.5">
                                                        {recentProjects.map((p) => (
                                                            <Link
                                                                key={p.id}
                                                                href={`/project/${p.id}`}
                                                                title={p.name}
                                                                className="flex items-center h-7 px-2 text-xs font-medium text-muted-foreground/60 hover:text-primary hover:bg-primary/5 rounded-md transition-colors truncate"
                                                            >
                                                                {p.name.length > 26 ? p.name.slice(0, 26) + "…" : p.name}
                                                            </Link>
                                                        ))}
                                                    </div>
                                                </CollapsibleContent>
                                            </SidebarMenuItem>
                                        </Collapsible>
                                    )}
                                    {projectItems.map((item) => (
                                        <NavItem key={item.href} href={item.href} icon={item.icon} label={t(item.titleKey)} />
                                    ))}
                                </SidebarMenu>
                            </CollapsibleContent>
                        </Collapsible>

                        {/* Administration */}
                        {user.role === "admin" && (
                            <Collapsible defaultOpen className="group/adm">
                                <CollapsibleTrigger asChild>
                                    <button className="w-full">
                                        <SectionHeader label={t("Administration")}>
                                            <ChevronDown className="h-3 w-3 text-muted-foreground/40 transition-transform duration-200 group-data-[state=closed]/adm:rotate-[-90deg]" />
                                        </SectionHeader>
                                    </button>
                                </CollapsibleTrigger>
                                <CollapsibleContent>
                                    <SidebarMenu className="gap-0.5 px-1">
                                        {adminItems.map((item) => (
                                            <NavItem key={item.href} href={item.href} icon={item.icon} label={t(item.titleKey)} compact />
                                        ))}
                                    </SidebarMenu>
                                </CollapsibleContent>
                            </Collapsible>
                        )}

                        {/* Bottom padding */}
                        <div className="h-4" />
                    </ScrollArea>
                </div>
            </SidebarContent>

            {/* Footer */}
            <SidebarFooter className="px-3 pb-3 pt-2 space-y-1.5 border-t border-border/40">
                <Button
                    variant="ghost"
                    className="w-full justify-start h-10 px-3 rounded-xl border border-border/50 bg-muted/20 hover:bg-muted/50 transition-all group"
                    size="sm"
                    onClick={() => setShareDialogOpen(true)}
                >
                    <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center me-2.5 group-hover:bg-primary/15 transition-colors shrink-0">
                        <Gift className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <div className="flex flex-col items-start">
                        <span className="font-semibold text-xs text-foreground">{t("Earn Rewards")}</span>
                        <span className="text-[10px] text-muted-foreground/60">{t("Refer Friends")}</span>
                    </div>
                </Button>

                <ShareDialog open={shareDialogOpen} onOpenChange={setShareDialogOpen} />

                {hasUpgradablePlans && (
                    <Button
                        asChild
                        className="w-full justify-start h-10 px-3 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-md shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                        size="sm"
                    >
                        <Link href="/billing/plans">
                            <div className="h-7 w-7 rounded-lg bg-white/20 flex items-center justify-center me-2.5 shrink-0">
                                <Sparkles className="h-3.5 w-3.5" />
                            </div>
                            <div className="flex flex-col items-start">
                                <span className="font-black text-xs">{t("Elite Access")}</span>
                                <span className="text-[10px] opacity-75 uppercase tracking-widest">{t("Upgrade Now")}</span>
                            </div>
                        </Link>
                    </Button>
                )}
            </SidebarFooter>
        </Sidebar>
    );
}
