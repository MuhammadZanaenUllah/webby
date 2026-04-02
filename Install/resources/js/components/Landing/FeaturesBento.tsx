import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getTranslatedFeatures, getIconComponent } from './data';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/contexts/LanguageContext';
import { Parallax } from '@/components/ui/Parallax';

interface FeatureItem {
    title: string;
    description: string;
    icon: string;
    size?: 'large' | 'medium' | 'small';
    image_url?: string | null;
}

interface FeaturesBentoProps {
    content?: Record<string, unknown>;
    items?: FeatureItem[];
    settings?: Record<string, unknown>;
}

export function FeaturesBento({ content, items, settings: _settings }: FeaturesBentoProps = {}) {
    const { t } = useTranslation();

    // Use database items if provided, otherwise fall back to translated defaults
    const features = items?.length
        ? items.map((item, index) => ({
              id: index + 1,
              title: item.title,
              description: item.description,
              icon: getIconComponent(item.icon),
              size: item.size || 'small',
              image_url: item.image_url || null,
          }))
        : getTranslatedFeatures(t);

    // Get content with defaults - DB content takes priority
    const title = (content?.title as string) || t('Everything you need to build');
    const subtitle = (content?.subtitle as string) || t("From idea to deployment, we've got you covered with powerful features designed for modern development.");
    return (
        <section id="features" className="py-24 lg:py-32 relative overflow-hidden">
            <Parallax 
                className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-transparent pointer-events-none" 
                speed={-0.05}
            />
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Section Header */}
                <div className="text-center mb-20 relative z-10">
                    <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-6">
                        {title}
                    </h2>
                    <p className="text-lg text-muted-foreground/90 max-w-2xl mx-auto leading-relaxed">
                        {subtitle}
                    </p>
                </div>

                {/* Bento Grid - Asymmetrical Layout */}
                <div className="grid grid-cols-1 md:grid-cols-6 lg:grid-cols-12 gap-6 lg:gap-8 relative z-10">
                    {features.map((feature, index) => {
                        const Icon = feature.icon;
                        // Custom asymmetrical span logic
                        const getSpanClass = (idx: number) => {
                            if (idx === 0) return 'md:col-span-6 lg:col-span-8 lg:row-span-2'; // Main large feature
                            if (idx === 1) return 'md:col-span-3 lg:col-span-4'; // Medium
                            if (idx === 2) return 'md:col-span-3 lg:col-span-4'; // Medium
                            if (idx === 3) return 'md:col-span-6 lg:col-span-6'; // Wide
                            if (idx === 4) return 'md:col-span-3 lg:col-span-3'; // Small
                            if (idx === 5) return 'md:col-span-3 lg:col-span-3'; // Small
                            return 'md:col-span-3 lg:col-span-4';
                        };

                        return (
                            <Card
                                key={feature.id}
                                className={cn(
                                    'group relative overflow-hidden transition-all duration-700 hover:-translate-y-2 border-primary/10 rounded-[2.5rem] bg-card/60 backdrop-blur-lg hover:bg-card hover:border-primary/30 shadow-xl hover:shadow-[0_40px_80px_-15px_rgba(var(--primary-rgb),0.15)]',
                                    getSpanClass(index)
                                )}
                            >
                                <CardHeader className="p-10">
                                    <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-8 group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-500 group-hover:scale-110 group-hover:rotate-6">
                                        <Icon className="w-6 h-6 shrink-0" />
                                    </div>
                                    <CardTitle className={cn(
                                        "text-xl font-bold tracking-tight mb-4 transition-colors",
                                        index === 0 && "text-3xl"
                                    )}>
                                        {feature.title}
                                    </CardTitle>
                                    <CardDescription className={cn(
                                        "text-sm font-medium leading-relaxed text-muted-foreground/80",
                                        index === 0 && "text-lg"
                                    )}>
                                        {feature.description}
                                    </CardDescription>
                                </CardHeader>
                                {/* Interactive Ornament for large cards */}
                                {index === 0 && (
                                    <Parallax 
                                        className="absolute -bottom-10 -right-10 w-64 h-64 bg-primary/5 rounded-full blur-3xl group-hover:bg-primary/10 transition-all duration-1000" 
                                        speed={0.1}
                                    />
                                )}
                            </Card>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
