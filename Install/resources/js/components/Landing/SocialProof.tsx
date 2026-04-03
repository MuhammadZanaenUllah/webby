import { useTranslation } from '@/contexts/LanguageContext';

interface SocialProofProps {
    statistics: {
        usersCount: number;
        projectsCount: number;
    };
    content?: Record<string, unknown>;
}

function formatCount(count: number): string {
    if (count < 100) {
        return '100+';
    }
    if (count >= 1_000_000) {
        return `${(count / 1_000_000).toFixed(1).replace(/\.0$/, '')}M+`;
    }
    if (count >= 1_000) {
        return `${(count / 1_000).toFixed(1).replace(/\.0$/, '')}K+`;
    }
    return `${count.toLocaleString()}+`;
}

export function SocialProof({ statistics, content }: SocialProofProps) {
    const { t } = useTranslation();

    // Extract content with defaults - DB content takes priority
    const usersLabel = (content?.users_label as string) || t('Happy Users');
    const projectsLabel = (content?.projects_label as string) || t('Projects Created');
    const uptimeLabel = (content?.uptime_label as string) || t('Availability');
    const uptimeValue = (content?.uptime_value as string) || t('High');

    const stats = [
        { value: formatCount(statistics.projectsCount), label: projectsLabel },
        { value: formatCount(statistics.usersCount), label: usersLabel },
        { value: uptimeValue, label: uptimeLabel },
    ];

    return (
        <section className="py-32 lg:py-48 bg-background relative overflow-hidden text-foreground transition-colors duration-300">
            <div className="absolute inset-0 bg-primary/2 pointer-events-none" />
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                {/* Stats */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-16 sm:gap-24">
                    {stats.map((stat, index) => (
                        <div key={stat.label} className="text-center group relative">
                            {/* Decorative Glow */}
                            <div className="absolute inset-0 bg-primary/10 blur-[100px] rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
                            
                            <div className="relative z-10">
                                <div className="text-6xl md:text-8xl font-black tracking-tighter mb-8 transition-all duration-1000 group-hover:scale-110 group-hover:text-primary">
                                    {stat.value}
                                </div>
                                <div className="text-[10px] md:text-[12px] font-black uppercase tracking-[0.5em] text-muted-foreground/40 mt-6 group-hover:text-primary/60 transition-all duration-300">
                                    {stat.label}
                                </div>
                                
                                {/* Divider - only for sm view and between items */}
                                {index < stats.length - 1 && (
                                    <div className="hidden sm:block absolute top-1/2 -right-12 w-px h-20 bg-primary/10 -translate-y-1/2" />
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            {/* Horizontal Line Ornaments */}
            <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
            <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
        </section>
    );
}
