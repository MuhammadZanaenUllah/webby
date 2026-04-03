import { Head, Link, router } from '@inertiajs/react';
import { cn } from '@/lib/utils';
import { useState, useRef, useCallback } from 'react';
import { useTranslation } from '@/contexts/LanguageContext';
import { TooltipProvider } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { GradientBackground } from '@/components/Dashboard/GradientBackground';
import { Project, ProjectsPageProps, ProjectSort } from '@/types';
import {
    Search,
    LogOut,
    Folder,
    LayoutGrid,
    List,
    Maximize2,
    Trash2,
    RotateCcw,
    ChevronLeft,
    ChevronRight,
    User as UserIcon,
    ExternalLink,
    ShieldAlert,
} from 'lucide-react';

type ViewMode = 'grid' | 'list' | 'large';

interface AdminProjectCardProps {
    project: Project & { user: { name: string; email: string; avatar: string | null } };
    isTrash?: boolean;
    onDelete?: (id: string) => void;
    onRestore?: (id: string) => void;
    onPermanentDelete?: (id: string) => void;
}

function AdminProjectCard({
    project,
    isTrash = false,
    onDelete,
    onRestore,
    onPermanentDelete,
}: AdminProjectCardProps) {
    const { t } = useTranslation();

    return (
        <div className="group relative flex flex-col h-full bg-foreground/5 border border-primary/10 rounded-[2.5rem] overflow-hidden transition-all duration-500 hover:border-primary/20 hover:bg-foreground/10">
            <div className="aspect-[16/10] overflow-hidden relative">
                {project.thumbnail ? (
                    <img
                        src={project.thumbnail.startsWith('http') ? project.thumbnail : `/storage/${project.thumbnail}`}
                        alt={project.name}
                        className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-all duration-1000 group-hover:scale-110"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center bg-foreground/5">
                        <Folder className="h-12 w-12 text-foreground/20 group-hover:text-primary/20 transition-colors" />
                    </div>
                )}
                
                {/* Admin Status HUD */}
                <div className="absolute top-6 left-6 flex items-center gap-2 px-3 py-1 rounded-full border border-primary/10 bg-background/80 backdrop-blur-md">
                    <div className={cn("w-1.5 h-1.5 rounded-full", project.build_status === 'completed' ? "bg-primary" : "bg-neutral-500")} />
                    <span className="text-[8px] font-black uppercase tracking-[0.2em] text-foreground/80">{project.build_status}</span>
                </div>

                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-60 group-hover:opacity-90 transition-opacity" />
                
                {/* User Info */}
                <div className="absolute bottom-6 left-6 right-6 flex items-center gap-3">
                    <Avatar className="h-8 w-8 border border-primary/20 shadow-lg">
                        <AvatarImage src={project.user?.avatar || undefined} />
                        <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-bold">
                            {project.user?.name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-bold text-foreground truncate">{project.user?.name}</p>
                        <p className="text-[8px] text-foreground/60 truncate uppercase tracking-widest">{project.user?.email}</p>
                    </div>
                </div>
            </div>

            <div className="p-6">
                <h3 className="text-sm font-black truncate text-foreground group-hover:text-primary transition-colors tracking-tight mb-4">
                    {project.name}
                </h3>
                
                <div className="flex items-center justify-between gap-2">
                    <div className="text-[9px] font-mono font-black text-foreground/40 uppercase tracking-[0.3em]">
                        ID_{project.id.slice(0, 8)}
                    </div>
                    
                    <div className="flex items-center gap-2">
                        <TableActionMenu>
                            <TableActionMenuTrigger className="h-8 w-8 bg-foreground/5 hover:bg-primary/20" />
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
                                        <TableActionMenuItem onClick={() => router.visit(`/project/${project.id}`)}>
                                            <ExternalLink className="h-4 w-4 me-2" />
                                            {t('View Project')}
                                        </TableActionMenuItem>
                                        <TableActionMenuSeparator />
                                        <TableActionMenuItem
                                            onClick={() => onDelete?.(project.id)}
                                            variant="destructive"
                                        >
                                            <Trash2 className="h-4 w-4 me-2" />
                                            {t('Move to trash')}
                                        </TableActionMenuItem>
                                    </>
                                )}
                            </TableActionMenuContent>
                        </TableActionMenu>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function AdminProjectsIndex({ auth, projects, counts, activeTab, filters }: ProjectsPageProps) {
    const user = auth.user!;
    const { t } = useTranslation();

    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [projectToDelete, setProjectToDelete] = useState<string | null>(null);
    const [searchValue, setSearchValue] = useState(filters.search || '');
    const searchTimeout = useRef<NodeJS.Timeout | null>(null);
    const [viewMode, setViewMode] = useState<ViewMode>('grid');

    const handleFilterChange = useCallback((newFilters: { search?: string; sort?: ProjectSort }) => {
        const params: Record<string, string> = {};
        if (activeTab === 'trash') params.tab = 'trash';
        
        const searchVal = newFilters.search !== undefined ? newFilters.search : filters.search;
        if (searchVal) params.search = searchVal;

        const sortVal = newFilters.sort !== undefined ? newFilters.sort : filters.sort;
        if (sortVal) params.sort = sortVal;

        router.get('/admin/projects', params, { preserveState: true, preserveScroll: true });
    }, [activeTab, filters]);

    const handleSearchChange = (value: string) => {
        setSearchValue(value);
        if (searchTimeout.current) clearTimeout(searchTimeout.current);
        searchTimeout.current = setTimeout(() => {
            handleFilterChange({ search: value });
        }, 300);
    };

    const handleTabChange = (tab: string) => {
        router.visit(`/admin/projects${tab === 'trash' ? '?tab=trash' : ''}`);
    };

    const handleSortChange = (sort: ProjectSort) => {
        handleFilterChange({ sort });
    };

    const handlePageChange = (page: number) => {
        const params: Record<string, string | number> = { page };
        if (activeTab === 'trash') params.tab = 'trash';
        if (filters.search) params.search = filters.search;
        if (filters.sort) params.sort = filters.sort;

        router.get('/admin/projects', params, { preserveState: true, preserveScroll: true });
    };

    const handleDelete = (id: string) => {
        router.delete(`/admin/projects/${id}`, {
            onSuccess: () => toast.success(t('Project moved to trash')),
        });
    };

    const handleRestore = (id: string) => {
        router.post(`/admin/projects/${id}/restore`, {}, {
            onSuccess: () => toast.success(t('Project restored')),
        });
    };

    const handlePermanentDelete = (id: string) => {
        setProjectToDelete(id);
        setDeleteDialogOpen(true);
    };

    const confirmPermanentDelete = () => {
        if (projectToDelete) {
            router.delete(`/admin/projects/${projectToDelete}/force-delete`, {
                onSuccess: () => toast.success(t('Project permanently deleted')),
            });
        }
        setDeleteDialogOpen(false);
    };

    return (
        <div className="flex min-h-screen bg-background relative overflow-hidden">
            <Head title={t('Global Projects')} />
            <GradientBackground />

            <TooltipProvider>
                <SidebarProvider defaultOpen={true}>
                    <AppSidebar user={user} />
                    <SidebarInset className="m-0 md:m-4 lg:m-6 rounded-none md:rounded-[3rem] bg-background border border-primary/10 shadow-2xl overflow-hidden">
                        <div className="flex flex-col h-full">
                            <header className="sticky top-0 z-40 flex h-[70px] items-center justify-between border-b border-primary/5 bg-background/20 backdrop-blur-md px-6 md:px-10">
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20">
                                        <ShieldAlert className="h-3 w-3 text-primary animate-pulse" />
                                        <span className="text-[10px] font-black uppercase tracking-widest text-primary">{t('Admin Mode')}</span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3">
                                    <LanguageSelector />
                                    <ThemeToggle />
                                    <div className="h-4 w-px bg-primary/10 mx-1" />
                                    <Avatar className="h-9 w-9 border-2 border-primary/10">
                                        <AvatarImage src={user.avatar || undefined} />
                                        <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                                            {user.name.charAt(0).toUpperCase()}
                                        </AvatarFallback>
                                    </Avatar>
                                </div>
                            </header>

                            <main className="p-4 md:p-6 lg:p-8">
                                <div className="max-w-7xl mx-auto">
                                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
                                        <div className="prose prose-sm dark:prose-invert">
                                            <h1 className="text-4xl font-black text-foreground tracking-tighter mb-0">
                                                {t('Global Projects')}
                                            </h1>
                                            <p className="text-muted-foreground/70 text-lg font-medium mt-1">
                                                {t('System-wide oversight for all user creative work')}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Stats Overview */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-12">
                                        <div className="p-8 rounded-[2.5rem] border border-primary/10 bg-foreground/5 relative overflow-hidden group">
                                            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground mb-2">{t('Total System Projects')}</p>
                                            <p className="text-5xl font-black text-foreground tracking-tighter">{counts.all}</p>
                                            <Folder className="absolute top-6 right-6 h-10 w-10 text-foreground/20" />
                                        </div>
                                        <div className="p-8 rounded-[2.5rem] border border-primary/10 bg-foreground/5 relative overflow-hidden group">
                                            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground mb-2">{t('Trashed Projects')}</p>
                                            <p className="text-5xl font-black text-destructive/70 tracking-tighter">{counts.trash}</p>
                                            <Trash2 className="absolute top-6 right-6 h-10 w-10 text-foreground/20" />
                                        </div>
                                    </div>

                                    <Tabs value={activeTab} onValueChange={handleTabChange} className="mb-6">
                                        <TabsList>
                                            <TabsTrigger value="all">{t('Active Projects')}</TabsTrigger>
                                            <TabsTrigger value="trash">{t('Trash Central')}</TabsTrigger>
                                        </TabsList>
                                    </Tabs>

                                    <div className="flex flex-wrap items-center gap-3 mb-6">
                                        <div className="relative w-full sm:w-auto sm:min-w-[400px]">
                                            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                            <Input
                                                placeholder={t('Search by project name, user name, or email...')}
                                                className="ps-9 bg-background/50"
                                                value={searchValue}
                                                onChange={(e) => handleSearchChange(e.target.value)}
                                            />
                                        </div>

                                        <Select value={filters.sort} onValueChange={handleSortChange}>
                                            <SelectTrigger className="w-[180px] bg-background/50">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="last-edited">{t('Recently Updated')}</SelectItem>
                                                <SelectItem value="name">{t('Project Name')}</SelectItem>
                                                <SelectItem value="created">{t('Creation Date')}</SelectItem>
                                            </SelectContent>
                                        </Select>

                                        <div className="flex-1" />

                                        <div className="flex items-center border rounded-xl bg-background/50 p-1">
                                            <Button variant="ghost" size="icon" className={cn("h-8 w-8", viewMode === 'grid' && "bg-primary/10 text-primary")} onClick={() => setViewMode('grid')}>
                                                <LayoutGrid className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className={cn("h-8 w-8", viewMode === 'list' && "bg-primary/10 text-primary")} onClick={() => setViewMode('list')}>
                                                <List className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>

                                    <div className={cn("grid gap-6", viewMode === 'grid' ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" : "grid-cols-1")}>
                                        {projects.data.map((project: any) => (
                                            <AdminProjectCard
                                                key={project.id}
                                                project={project}
                                                isTrash={activeTab === 'trash'}
                                                onDelete={handleDelete}
                                                onRestore={handleRestore}
                                                onPermanentDelete={handlePermanentDelete}
                                            />
                                        ))}

                                        {projects.data.length === 0 && (
                                            <div className="col-span-full py-20 text-center rounded-[3rem] border border-dashed border-primary/10 bg-foreground/5">
                                                <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-foreground/5 border border-primary/10 mb-6">
                                                    <Folder className="h-8 w-8 text-foreground/40" />
                                                </div>
                                                <p className="text-foreground/60 font-bold uppercase tracking-widest">{t('No system matches found')}</p>
                                            </div>
                                        )}
                                    </div>

                                    {projects.last_page > 1 && (
                                        <div className="flex items-center justify-center gap-2 mt-12 pb-10">
                                            <Button variant="outline" size="sm" onClick={() => handlePageChange(projects.current_page - 1)} disabled={projects.current_page === 1}>
                                                <ChevronLeft className="h-4 w-4 mr-2" /> {t('Prev')}
                                            </Button>
                                            <span className="text-[10px] font-black uppercase tracking-widest text-foreground/60 px-6">
                                                {t('Registry :current of :total', { current: projects.current_page, total: projects.last_page })}
                                            </span>
                                            <Button variant="outline" size="sm" onClick={() => handlePageChange(projects.current_page + 1)} disabled={projects.current_page === projects.last_page}>
                                                {t('Next')} <ChevronRight className="h-4 w-4 ml-2" />
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </main>
                        </div>
                    </SidebarInset>
                </SidebarProvider>
            </TooltipProvider>

            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent className="border-primary/10 bg-background backdrop-blur-3xl rounded-[2.5rem]">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-2xl font-black tracking-tighter">{t('SYSTEM PURGE')}</AlertDialogTitle>
                        <AlertDialogDescription className="text-foreground/60 font-medium">
                            {t('Administrator confirmation required. This project will be permanently erased from the system registry. This cannot be undone.')}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="mt-8 gap-4">
                        <AlertDialogCancel className="rounded-full px-8 py-6 h-auto">{t('Cancel')}</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmPermanentDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-full px-8 py-6 h-auto font-black uppercase tracking-widest text-[10px]">
                            {t('Execute Purge')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
