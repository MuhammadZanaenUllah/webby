import { Head, Link, router, usePage } from '@inertiajs/react';
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
        <div className="group relative">
            <Link href={isTrash ? '#' : `/project/${project.id}`} className={isTrash ? 'pointer-events-none' : 'block'}>
                <div className="aspect-[4/3] rounded-[1.5rem] border border-primary/5 bg-card/50 backdrop-blur-sm overflow-hidden mb-4 shadow-xl shadow-primary/5 group-hover:shadow-2xl group-hover:shadow-primary/10 group-hover:-translate-y-1 transition-all duration-500">
                    {thumbnailUrl ? (
                        <div className="relative w-full h-full overflow-hidden">
                            <img
                                src={thumbnailUrl}
                                alt={project.name}
                                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                        </div>
                    ) : (
                        <div className="w-full h-full flex items-center justify-center bg-muted/30 relative">
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,var(--primary)_0%,transparent_70%)] opacity-[0.03]" />
                            <Folder className="h-14 w-14 text-primary/20 transition-transform duration-500 group-hover:scale-110 group-hover:text-primary/30" />
                        </div>
                    )}
                </div>
            </Link>

            {/* Actions dropdown */}
            <TableActionMenu>
                <TableActionMenuTrigger className="absolute top-2 end-2 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 hover:bg-background h-8 w-8 p-0" />
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

            {/* Star indicator */}
            {project.is_starred && !isTrash && (
                <Star className="absolute top-2 start-2 h-4 w-4 text-yellow-500 fill-yellow-500" />
            )}

            <div>
                <h3 className="font-heading font-semibold truncate group-hover:text-primary transition-colors text-base tracking-tight">
                    {project.name}
                </h3>
                <p className="text-sm text-muted-foreground">
                    {isTrash && project.deleted_at
                        ? t('Deleted :time', { time: formatEditedTime(project.deleted_at).replace(t('Edited '), '') })
                        : formatEditedTime(project.updated_at)}
                </p>
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
                    <SidebarInset className="m-2 md:m-4 lg:m-6 xl:m-8 rounded-3xl md:rounded-[2.5rem] lg:rounded-[3rem] bg-card/40 backdrop-blur-3xl border border-primary/5 shadow-2xl overflow-hidden transition-all duration-500">
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
                                    <div className="prose prose-sm dark:prose-invert mb-8">
                                        <h1 className="text-3xl font-bold text-foreground tracking-tight font-heading">
                                            {t('My Projects')}
                                        </h1>
                                        <p className="text-muted-foreground mt-2">
                                            {t('Manage and organize all your creative work')}
                                        </p>
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
                                            <div className="col-span-full text-center py-12">
                                                <p className="text-muted-foreground">
                                                    {getEmptyMessage()}
                                                </p>
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
