import { Head, Link, router, usePage } from '@inertiajs/react';
import { cn } from '@/lib/utils';
import { useState, useRef, useEffect, useCallback } from 'react';
import { usePageLoading } from '@/hooks/usePageLoading';
import { useTranslation } from '@/contexts/LanguageContext';
import { ProjectsSkeleton } from './ProjectsSkeleton';
import { TooltipProvider } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    TableActionMenu,
    TableActionMenuTrigger,
    TableActionMenuContent,
    TableActionMenuItem,
    TableActionMenuSeparator,
} from '@/components/ui/table-action-menu';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { AppSidebar } from '@/components/Sidebar/AppSidebar';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LanguageSelector } from '@/components/LanguageSelector';
import { NotificationBell } from '@/components/Notifications/NotificationBell';
import { GlobalCredits } from '@/components/Header/GlobalCredits';
import { useNotifications } from '@/hooks/useNotifications';
import { GradientBackground } from '@/components/Dashboard/GradientBackground';
import { useUserChannel } from '@/hooks/useUserChannel';
import { Project, ProjectsPageProps, ProjectSort, ProjectVisibility, PageProps } from '@/types';
import type { UserCredits, UserNotification, ProjectStatusEvent } from '@/types/notifications';
import type { BroadcastConfig } from '@/hooks/useBuilderPusher';
import {
    Search,
    LogOut,
    Folder,
    LayoutGrid,
    List,
    Maximize2,
    Star,
    StarOff,
    Copy,
    Trash2,
    RotateCcw,
    ChevronLeft,
    ChevronRight,
    Sparkles,
} from 'lucide-react';

type ViewMode = 'grid' | 'list' | 'large';

interface ProjectCardProps {
    project: Project;
    isTrash?: boolean;
    thumbnailUrl?: string | null;
    onToggleStar?: (id: string) => void;
    onDuplicate?: (id: string) => void;
    onDelete?: (project: Project) => void;
    onRestore?: (id: string) => void;
    onPermanentDelete?: (id: string) => void;
}

function ProjectCard({
    project,
    isTrash = false,
    thumbnailUrl,
    onToggleStar,
    onDuplicate,
    onDelete,
    onRestore,
    onPermanentDelete,
}: ProjectCardProps) {
    const { t } = useTranslation();

    const formatEditedTime = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays <= 0) return t('Edited today');
        if (diffDays === 1) return t('Edited yesterday');
        return t('Edited :days days ago', { days: diffDays });
    };

    return (
        <div className="group relative flex flex-col h-full will-change-transform translate-z-0">
            <Link href={isTrash ? '#' : `/project/${project.id}`} className={isTrash ? 'pointer-events-none flex-1' : 'block flex-1'}>
                <div className="aspect-[16/10] rounded-[2.5rem] border border-primary/10 bg-foreground/5 backdrop-blur-xl overflow-hidden mb-6 transition-all duration-700 ease-out relative group-hover:border-primary/40 group-hover:bg-foreground/10 group-hover:-translate-y-2 shadow-2xl">
                    {thumbnailUrl ? (
                        <div className="relative w-full h-full overflow-hidden">
                            <img
                                src={thumbnailUrl}
                                alt={project.name}
                                className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110 opacity-60 group-hover:opacity-100"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                        </div>
                    ) : (
                        <div className="w-full h-full flex items-center justify-center bg-foreground/5 relative">
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,var(--primary)_0%,transparent_70%)] opacity-[0.02] group-hover:opacity-[0.05] transition-opacity" />
                            <Folder className="h-16 w-16 text-foreground/20 transition-all duration-700 group-hover:scale-110 group-hover:text-primary/20 group-hover:rotate-6" />
                        </div>
                    )}
                    
                    {/* HUD Ornaments */}
                    <div className="absolute top-6 left-6 flex items-center gap-2 px-3 py-1 rounded-full border border-primary/10 bg-background/80 backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className={cn("w-1.5 h-1.5 rounded-full animate-pulse", project.build_status === 'completed' ? "bg-primary" : "bg-neutral-500")} />
                        <span className="text-[8px] font-black uppercase tracking-[0.2em] text-foreground/80">{project.build_status}</span>
                    </div>

                    <div className="absolute bottom-6 left-6 right-6 flex items-center justify-between opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-500 z-20">
                        <div className="text-[9px] font-mono font-black text-foreground/60 uppercase tracking-[0.3em]">
                            Ref_P.{project.id.slice(0, 8)}
                        </div>
                        <Button size="sm" className="rounded-full bg-foreground text-background hover:bg-primary hover:text-primary-foreground transition-all font-black text-[10px] uppercase tracking-widest px-4 py-1 h-8 shadow-2xl">
                            {t('Access System')}
                        </Button>
                    </div>
                </div>
            </Link>

            {/* Actions dropdown */}
            <TableActionMenu>
                <TableActionMenuTrigger className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-all duration-500 bg-foreground/5 hover:bg-primary hover:text-foreground backdrop-blur-md h-10 w-10 p-0 rounded-2xl border border-primary/20 shadow-xl z-30" />
                <TableActionMenuContent>
                    {isTrash ? (
                        <>
                            <TableActionMenuItem onClick={() => onRestore?.(project.id)}>
                                <RotateCcw className="h-4 w-4 me-2" />
                                {t('Restore')}
                            </TableActionMenuItem>
                            <TableActionMenuItem
                                onClick={() => onPermanentDelete?.(project.id)}
                                variant="destructive"
                            >
                                <Trash2 className="h-4 w-4 me-2" />
                                {t('Delete permanently')}
                            </TableActionMenuItem>
                        </>
                    ) : (
                        <>
                            <TableActionMenuItem onClick={() => onToggleStar?.(project.id)}>
                                {project.is_starred ? (
                                    <>
                                        <StarOff className="h-4 w-4 me-2" />
                                        {t('Remove from favorites')}
                                    </>
                                ) : (
                                    <>
                                        <Star className="h-4 w-4 me-2" />
                                        {t('Add to favorites')}
                                    </>
                                )}
                            </TableActionMenuItem>
                            <TableActionMenuItem onClick={() => onDuplicate?.(project.id)}>
                                <Copy className="h-4 w-4 me-2" />
                                {t('Duplicate')}
                            </TableActionMenuItem>
                            <TableActionMenuSeparator />
                            <TableActionMenuItem
                                onClick={() => onDelete?.(project)}
                                variant="destructive"
                            >
                                <Trash2 className="h-4 w-4 me-2" />
                                {t('Move to trash')}
                            </TableActionMenuItem>
                        </>
                    )}
                </TableActionMenuContent>
            </TableActionMenu>

            <div className="px-2">
                <h3 className="text-lg font-black truncate text-foreground group-hover:text-primary transition-colors tracking-tight mb-2">
                    {project.name}
                </h3>
                <div className="flex items-center gap-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-600">
                        {isTrash && project.deleted_at
                            ? t('Deleted :time', { time: formatEditedTime(project.deleted_at).replace(t('Edited '), '') })
                            : formatEditedTime(project.updated_at)}
                    </p>
                </div>
            </div>
        </div>
    );
}

export default function ProjectsIndex({ auth, projects, counts, activeTab, filters, baseDomain }: ProjectsPageProps) {
    const user = auth.user!;
    const { isLoading } = usePageLoading();
    const { t } = useTranslation();

    // Get shared props for real-time features
    const { broadcastConfig, userCredits, unreadNotificationCount } = usePage<PageProps & {
        broadcastConfig: BroadcastConfig | null;
        userCredits: UserCredits | null;
        unreadNotificationCount: number;
    }>().props;

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

    // Real-time project status updates
    const [projectStatuses, setProjectStatuses] = useState<Record<string, Project['build_status']>>({});

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
        onProjectStatus: (status: ProjectStatusEvent) => {
            setProjectStatuses(prev => ({
                ...prev,
                [status.project_id]: status.build_status as Project['build_status'],
            }));
        },
    });

    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [projectToDelete, setProjectToDelete] = useState<string | null>(null);
    const [trashDialogOpen, setTrashDialogOpen] = useState(false);
    const [projectToTrash, setProjectToTrash] = useState<string | null>(null);
    const [projectToTrashInfo, setProjectToTrashInfo] = useState<{
        subdomain: string | null;
        customDomain: string | null;
    } | null>(null);
    const [searchValue, setSearchValue] = useState(filters.search || '');
    const searchTimeout = useRef<NodeJS.Timeout | null>(null);
    const [viewMode, setViewMode] = useState<ViewMode>(() => {
        if (typeof window !== 'undefined') {
            return (localStorage.getItem('projects-view') as ViewMode) || 'grid';
        }
        return 'grid';
    });

    // Persist view mode to localStorage
    useEffect(() => {
        localStorage.setItem('projects-view', viewMode);
    }, [viewMode]);

    // Helper function to get thumbnail URL with cache busting
    const getThumbnailUrl = useCallback((project: Project): string | null => {
        if (!project.thumbnail) return null;
        // Cache buster based on updated_at
        const cacheBuster = project.updated_at ? `?v=${new Date(project.updated_at).getTime()}` : '';
        // If already a full URL, return as-is
        if (project.thumbnail.startsWith('http')) {
            return project.thumbnail + cacheBuster;
        }
        if (project.thumbnail.startsWith('/storage/')) {
            return project.thumbnail + cacheBuster;
        }
        // Prepend /storage/ for local storage paths
        return `/storage/${project.thumbnail}${cacheBuster}`;
    }, []);

    // Handle filter changes with URL navigation
    const handleFilterChange = useCallback((newFilters: Partial<{ search?: string; sort?: ProjectSort; visibility?: ProjectVisibility | null }>) => {
        const url = activeTab === 'trash' ? '/projects/trash' : '/projects';
        const params: Record<string, string> = {};

        // Preserve tab for non-trash
        if (activeTab !== 'trash' && activeTab !== 'all') {
            params.tab = activeTab;
        }

        // Build search param
        const searchVal = newFilters.search !== undefined ? newFilters.search : filters.search;
        if (searchVal) params.search = searchVal;

        // Build sort param
        const sortVal = newFilters.sort !== undefined ? newFilters.sort : filters.sort;
        if (sortVal && sortVal !== 'last-edited') params.sort = sortVal;

        // Build visibility param (not for trash)
        if (activeTab !== 'trash') {
            const visibilityVal = newFilters.visibility !== undefined ? newFilters.visibility : filters.visibility;
            if (visibilityVal) params.visibility = visibilityVal;
        }

        router.get(url, params, { preserveState: true, preserveScroll: true });
    }, [activeTab, filters]);

    // Debounced search handler
    const handleSearchChange = (value: string) => {
        setSearchValue(value);

        if (searchTimeout.current) {
            clearTimeout(searchTimeout.current);
        }

        searchTimeout.current = setTimeout(() => {
            handleFilterChange({ search: value });
        }, 300);
    };

    const handleTabChange = (tab: string) => {
        if (tab === 'trash') {
            router.visit('/projects/trash');
        } else {
            router.visit(`/projects?tab=${tab}`);
        }
    };

    const handleSortChange = (sort: ProjectSort) => {
        handleFilterChange({ sort });
    };

    const handleVisibilityChange = (visibility: string) => {
        handleFilterChange({ visibility: visibility === 'any' ? null : visibility as ProjectVisibility });
    };

    const handlePageChange = (page: number) => {
        const url = activeTab === 'trash' ? '/projects/trash' : '/projects';
        const params: Record<string, string | number> = { page };

        if (activeTab !== 'trash' && activeTab !== 'all') {
            params.tab = activeTab;
        }
        if (filters.search) params.search = filters.search;
        if (filters.sort && filters.sort !== 'last-edited') params.sort = filters.sort;
        if (filters.visibility && activeTab !== 'trash') params.visibility = filters.visibility;

        router.get(url, params, { preserveState: true, preserveScroll: true });
    };

    const handleToggleStar = (id: string) => {
        router.post(`/projects/${id}/toggle-star`, {}, {
            preserveScroll: true,
            onSuccess: () => toast.success(t('Project updated')),
            onError: () => toast.error(t('Failed to update project')),
        });
    };

    const handleDuplicate = (id: string) => {
        router.post(`/projects/${id}/duplicate`, {}, {
            onSuccess: () => toast.success(t('Project duplicated')),
            onError: () => toast.error(t('Failed to duplicate project')),
        });
    };

    const handleDelete = (project: Project) => {
        // Check if project has published domains
        if (project.subdomain || project.custom_domain) {
            setProjectToTrash(project.id);
            setProjectToTrashInfo({
                subdomain: project.subdomain ?? null,
                customDomain: project.custom_domain ?? null,
            });
            setTrashDialogOpen(true);
        } else {
            // No published domains, delete directly
            performDelete(project.id);
        }
    };

    const performDelete = (id: string) => {
        router.delete(`/projects/${id}`, {
            preserveScroll: true,
            onSuccess: () => {
                toast.success(t('Project moved to trash'));
                setTrashDialogOpen(false);
                setProjectToTrash(null);
                setProjectToTrashInfo(null);
            },
            onError: () => toast.error(t('Failed to delete project')),
        });
    };

    const handleRestore = (id: string) => {
        router.post(`/projects/${id}/restore`, {}, {
            onSuccess: () => toast.success(t('Project restored')),
            onError: () => toast.error(t('Failed to restore project')),
        });
    };

    const handlePermanentDelete = (id: string) => {
        setProjectToDelete(id);
        setDeleteDialogOpen(true);
    };

    const confirmPermanentDelete = () => {
        if (projectToDelete) {
            router.delete(`/projects/${projectToDelete}/force-delete`, {
                onSuccess: () => toast.success(t('Project permanently deleted')),
                onError: () => toast.error(t('Failed to delete project')),
            });
        }
        setDeleteDialogOpen(false);
        setProjectToDelete(null);
    };

    const getEmptyMessage = () => {
        if (filters.search) {
            return t('No projects match your search.');
        }
        switch (activeTab) {
            case 'favorites':
                return t('No favorite projects yet. Star a project to add it here.');
            case 'trash':
                return t('Trash is empty.');
            default:
                return t('No projects yet. Create your first project from the dashboard!');
        }
    };

    // Grid classes based on view mode
    const getGridClasses = () => {
        switch (viewMode) {
            case 'large':
                return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';
            case 'list':
                return 'grid-cols-1';
            default: // grid
                return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';
        }
    };

    return (
        <div className="flex min-h-screen bg-background relative overflow-hidden">
            <Head title={t('My Projects')} />
            <GradientBackground />

            <TooltipProvider>
                <SidebarProvider defaultOpen={true}>
                    <AppSidebar user={user} />
                    <SidebarInset className="m-0 md:m-4 lg:m-6 rounded-none md:rounded-[3rem] bg-background border border-primary/10 shadow-2xl overflow-hidden transition-all duration-500 will-change-transform translate-z-0">
                        <div className="flex flex-col h-full">
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

                            {/* Main Content */}
                            <main className="p-4 md:p-6 lg:p-8">
                                {isLoading ? (
                                    <ProjectsSkeleton />
                                ) : (
                                <div className="max-w-7xl mx-auto">
                                    {/* Page Header */}
                                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10 animate-fade-in">
                                        <div className="prose prose-sm dark:prose-invert">
                                            <h1 className="text-4xl font-black text-foreground tracking-tighter font-heading mb-0">
                                                {t('My Projects')}
                                            </h1>
                                            <p className="text-muted-foreground/70 text-lg font-medium mt-1">
                                                {t('Manage and organize all your creative work')}
                                            </p>
                                        </div>
                                        
                                        <Button asChild className="rounded-full px-8 h-12 font-bold shadow-xl shadow-primary/20 hover:scale-105 transition-transform">
                                            <Link href="/create">
                                                {t('Create New Project')}
                                            </Link>
                                        </Button>
                                    </div>

                                    {/* Stats Overview */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-12 animate-fade-in animation-delay-2000">
                                        <div className="p-8 rounded-[2.5rem] border border-primary/10 bg-foreground/5 backdrop-blur-xl relative overflow-hidden group hover:border-primary/20 transition-all duration-500 hover:shadow-[0_0_50px_rgba(var(--primary-rgb),0.05)]">
                                            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground mb-2 relative z-10">{t('Total Projects')}</p>
                                            <p className="text-5xl font-black text-foreground tracking-tighter relative z-10">{counts.all}</p>
                                            <div className="absolute top-6 right-6 p-3 rounded-2xl bg-foreground/5 border border-primary/10 opacity-40 group-hover:opacity-100 group-hover:text-primary transition-all duration-500">
                                                <Folder className="h-5 w-5" />
                                            </div>
                                            <div className="absolute -bottom-6 -right-6 h-24 w-24 bg-primary/5 blur-3xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </div>

                                        <div className="p-8 rounded-[2.5rem] border border-primary/10 bg-foreground/5 backdrop-blur-xl relative overflow-hidden group hover:border-primary/20 transition-all duration-500 hover:shadow-[0_0_50px_rgba(var(--primary-rgb),0.05)]">
                                            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground mb-2 relative z-10">{t('Favorites')}</p>
                                            <div className="flex items-center gap-3 relative z-10">
                                                <p className="text-5xl font-black text-primary tracking-tighter drop-shadow-[0_0_15px_rgba(var(--primary-rgb),0.3)]">{counts.favorites}</p>
                                                <div className="h-6 w-[1px] bg-foreground/10" />
                                                <span className="text-[10px] font-bold text-foreground/60 uppercase tracking-widest">{t('Starred')}</span>
                                            </div>
                                            <div className="absolute top-6 right-6 p-3 rounded-2xl bg-foreground/5 border border-primary/10 opacity-40 group-hover:opacity-100 group-hover:text-primary transition-all duration-500">
                                                <Star className="h-5 w-5 fill-primary/20" />
                                            </div>
                                        </div>

                                        {credits && (
                                            <>
                                                <div className="p-8 rounded-[2.5rem] border border-primary/10 bg-foreground/5 backdrop-blur-xl relative overflow-hidden group hover:border-primary/20 transition-all duration-500 hover:shadow-[0_0_50px_rgba(var(--primary-rgb),0.05)]">
                                                    <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground mb-2 relative z-10">{t('AI Credits')}</p>
                                                    <p className="text-5xl font-black text-foreground tracking-tighter relative z-10">
                                                        {credits.isUnlimited ? '∞' : credits.remaining.toLocaleString()}
                                                    </p>
                                                    <div className="absolute top-6 right-6 p-3 rounded-2xl bg-foreground/5 border border-primary/10 opacity-40 group-hover:opacity-100 group-hover:text-primary transition-all duration-500">
                                                        <Sparkles className="h-5 w-5" />
                                                    </div>
                                                </div>

                                                <div className="p-8 rounded-[2.5rem] border border-primary/10 bg-foreground/5 backdrop-blur-xl relative overflow-hidden group hover:border-primary/20 transition-all duration-500 hover:shadow-[0_0_50px_rgba(var(--primary-rgb),0.05)]">
                                                    <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground mb-2 relative z-10">{t('System Capacity')}</p>
                                                    <div className="flex items-center gap-4 relative z-10">
                                                        <p className="text-5xl font-black text-foreground tracking-tighter">
                                                            {credits.isUnlimited ? '∞' : Math.round(( (credits.monthlyLimit - credits.remaining) / credits.monthlyLimit) * 100)}%
                                                        </p>
                                                        <div className="flex-1 h-2 bg-foreground/5 rounded-full overflow-hidden max-w-[80px]">
                                                            <div 
                                                                className="h-full bg-primary" 
                                                                style={{ width: `${credits.isUnlimited ? 0 : Math.round(( (credits.monthlyLimit - credits.remaining) / credits.monthlyLimit) * 100)}%` }} 
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    {/* Tabs */}
                                    <Tabs value={activeTab} onValueChange={handleTabChange} className="mb-6">
                                        <TabsList>
                                            <TabsTrigger value="all">
                                                {t('All Projects')}
                                                {counts.all > 0 && (
                                                    <span className="ms-2 text-xs bg-muted-foreground/20 px-1.5 py-0.5 rounded">
                                                        {counts.all}
                                                    </span>
                                                )}
                                            </TabsTrigger>
                                            <TabsTrigger value="favorites">
                                                <Star className="h-4 w-4 me-1" />
                                                {t('Favorites')}
                                                {counts.favorites > 0 && (
                                                    <span className="ms-2 text-xs bg-muted-foreground/20 px-1.5 py-0.5 rounded">
                                                        {counts.favorites}
                                                    </span>
                                                )}
                                            </TabsTrigger>
                                            <TabsTrigger value="trash">
                                                <Trash2 className="h-4 w-4 me-1" />
                                                {t('Trash')}
                                                {counts.trash > 0 && (
                                                    <span className="ms-2 text-xs bg-muted-foreground/20 px-1.5 py-0.5 rounded">
                                                        {counts.trash}
                                                    </span>
                                                )}
                                            </TabsTrigger>
                                        </TabsList>
                                    </Tabs>

                                    {/* Filter Bar */}
                                    <div className="flex flex-wrap items-center gap-3 mb-6">
                                        {/* Search */}
                                        <div className="relative w-full sm:w-auto sm:min-w-[280px]">
                                            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                            <Input
                                                placeholder={t('Search projects...')}
                                                className="ps-9 bg-background"
                                                value={searchValue}
                                                onChange={(e) => handleSearchChange(e.target.value)}
                                            />
                                        </div>

                                        {/* Sort Dropdown */}
                                        <Select value={filters.sort} onValueChange={handleSortChange}>
                                            <SelectTrigger className="w-[140px] bg-background">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="last-edited">{t('Last edited')}</SelectItem>
                                                <SelectItem value="name">{t('Name')}</SelectItem>
                                                <SelectItem value="created">{t('Created')}</SelectItem>
                                            </SelectContent>
                                        </Select>

                                        {/* Visibility Dropdown - hidden in trash */}
                                        {activeTab !== 'trash' && (
                                            <Select
                                                value={filters.visibility || 'any'}
                                                onValueChange={handleVisibilityChange}
                                            >
                                                <SelectTrigger className="w-[140px] bg-background">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="any">{t('Any visibility')}</SelectItem>
                                                    <SelectItem value="public">{t('Public')}</SelectItem>
                                                    <SelectItem value="private">{t('Private')}</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        )}

                                        {/* Spacer */}
                                        <div className="flex-1" />

                                        {/* View Toggle */}
                                        <div className="flex items-center border rounded-lg bg-background">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className={`h-9 w-9 rounded-e-none ${viewMode === 'large' ? 'bg-muted' : ''}`}
                                                onClick={() => setViewMode('large')}
                                            >
                                                <Maximize2 className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className={`h-9 w-9 rounded-none ${viewMode === 'grid' ? 'bg-muted' : ''}`}
                                                onClick={() => setViewMode('grid')}
                                            >
                                                <LayoutGrid className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className={`h-9 w-9 rounded-s-none ${viewMode === 'list' ? 'bg-muted' : ''}`}
                                                onClick={() => setViewMode('list')}
                                            >
                                                <List className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Trash notice */}
                                    {activeTab === 'trash' && (
                                        <div className="mb-6 p-4 bg-muted rounded-lg">
                                            <p className="text-sm text-muted-foreground">
                                                {t('Items in trash will be automatically deleted after 30 days.')}
                                            </p>
                                        </div>
                                    )}

                                    {/* Projects Grid */}
                                    <div className={`grid ${getGridClasses()} gap-6`}>
                                        {/* Project Cards */}
                                        {projects.data.map((project) => (
                                            <ProjectCard
                                                key={project.id}
                                                project={{
                                                    ...project,
                                                    build_status: projectStatuses[project.id] || project.build_status,
                                                }}
                                                isTrash={activeTab === 'trash'}
                                                thumbnailUrl={getThumbnailUrl(project)}
                                                onToggleStar={handleToggleStar}
                                                onDuplicate={handleDuplicate}
                                                onDelete={handleDelete}
                                                onRestore={handleRestore}
                                                onPermanentDelete={handlePermanentDelete}
                                            />
                                        ))}

                                        {/* Empty state */}
                                        {projects.data.length === 0 && (
                                            <div className="col-span-full py-32 flex flex-col items-center justify-center rounded-[3rem] border border-dashed border-primary/10 bg-foreground/5 animate-pulse-slow">
                                                <div className="relative mb-8">
                                                    <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full" />
                                                    <div className="relative h-24 w-24 rounded-full border border-primary/20 bg-background/80 backdrop-blur-3xl flex items-center justify-center">
                                                        <Folder className="h-10 w-10 text-foreground/20 group-hover:text-primary transition-colors" />
                                                    </div>
                                                </div>
                                                <h3 className="text-xl font-black text-foreground/90 uppercase tracking-[0.4em] mb-3">
                                                    {t('System Buffer Empty')}
                                                </h3>
                                                <p className="text-muted-foreground/60 max-w-xs text-center text-sm font-medium leading-relaxed">
                                                    {getEmptyMessage()}
                                                </p>
                                                <div className="mt-10 flex items-center gap-4 text-[10px] font-black uppercase tracking-[0.2em] text-foreground/40">
                                                    <div className="h-px w-8 bg-foreground/5" />
                                                    <span>Waiting for project initialization</span>
                                                    <div className="h-px w-8 bg-foreground/5" />
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Pagination */}
                                    {projects.last_page > 1 && (
                                        <div className="flex items-center justify-center gap-2 mt-8">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handlePageChange(projects.current_page - 1)}
                                                disabled={projects.current_page === 1}
                                            >
                                                <ChevronLeft className="h-4 w-4 me-1" />
                                                {t('Previous')}
                                            </Button>
                                            <span className="text-sm text-muted-foreground px-4">
                                                {t('Page :current of :total', { current: projects.current_page, total: projects.last_page })}
                                            </span>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handlePageChange(projects.current_page + 1)}
                                                disabled={projects.current_page === projects.last_page}
                                            >
                                                {t('Next')}
                                                <ChevronRight className="h-4 w-4 ms-1" />
                                            </Button>
                                        </div>
                                    )}
                                </div>
                                )}
                            </main>
                        </div>
                    </SidebarInset>
                </SidebarProvider>
            </TooltipProvider>

            {/* Permanent delete confirmation dialog */}
            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('Delete permanently?')}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {t('This action cannot be undone. This project will be permanently deleted.')}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{t('Cancel')}</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmPermanentDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            {t('Delete permanently')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Trash warning dialog for published projects */}
            <AlertDialog open={trashDialogOpen} onOpenChange={setTrashDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('Move to Trash?')}</AlertDialogTitle>
                        <AlertDialogDescription asChild>
                            <div className="space-y-2">
                                <p>{t('This project is currently published and accessible at:')}</p>
                                <ul className="list-disc list-inside space-y-1">
                                    {projectToTrashInfo?.subdomain && baseDomain && (
                                        <li><code className="text-xs bg-muted px-1 py-0.5 rounded">{projectToTrashInfo.subdomain}.{baseDomain}</code></li>
                                    )}
                                    {projectToTrashInfo?.customDomain && (
                                        <li><code className="text-xs bg-muted px-1 py-0.5 rounded">{projectToTrashInfo.customDomain}</code></li>
                                    )}
                                </ul>
                                <p className="text-destructive font-medium">
                                    {t('Moving to trash will make these URLs inaccessible.')}
                                </p>
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{t('Cancel')}</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => projectToTrash && performDelete(projectToTrash)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {t('Move to Trash')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <Toaster />
        </div>
    );
}
