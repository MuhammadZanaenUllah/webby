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

    const isCollapsed = state === "collapsed" || state === "icon";

    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const recentProjects = props.recentProjects;
    const hasUpgradablePlans = props.hasUpgradablePlans;

    const [shareDialogOpen, setShareDialogOpen] = useState(false);

    // ✅ Controlled collapsibles
    const [workspaceOpen, setWorkspaceOpen] = useState(true);
    const [adminOpen, setAdminOpen] = useState(true);
    const [recentOpen, setRecentOpen] = useState(() => {
        if (typeof window !== "undefined") {
            return localStorage.getItem(RECENT_COLLAPSED_KEY) !== "closed";
        }
        return true;
    });

    // Persist recent state
    useEffect(() => {
        localStorage.setItem(
            RECENT_COLLAPSED_KEY,
            recentOpen ? "open" : "closed",
        );
    }, [recentOpen]);

    // ✅ Sync with sidebar collapse
    useEffect(() => {
        if (isCollapsed) {
            setWorkspaceOpen(false);
            setAdminOpen(false);
            setRecentOpen(false);
        } else {
            setWorkspaceOpen(true);
        }
    }, [isCollapsed]);

    // Scroll restore
    useLayoutEffect(() => {
        const scrollArea = scrollAreaRef.current;
        if (!scrollArea) return;

        const viewport = scrollArea.querySelector(
            '[data-slot="scroll-area-viewport"]',
        ) as HTMLElement;
        if (!viewport) return;

        const saved = sessionStorage.getItem(SCROLL_POSITION_KEY);
        if (saved) viewport.scrollTop = parseInt(saved, 10);

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

    return <></>;
}
