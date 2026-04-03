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
        <section id="features" className="py-32 lg:py-48 bg-background relative overflow-hidden transition-colors duration-300">
            {/* Top Border HUD Line */}
            <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
            
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                {/* Section Header */}
                <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-12 mb-24 animate-fade-in">
                    <div className="max-w-3xl">
                        <div className="text-primary text-[10px] font-black uppercase tracking-[0.5em] mb-6">
                            [ Core_Features.v4 ]
                        </div>
                        <h2 className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tighter mb-8 text-foreground leading-[0.9]">
                            {title}
                        </h2>
                    </div>
                    <p className="text-lg text-muted-foreground max-w-md leading-relaxed font-medium lg:mb-4">
                        {subtitle}
                    </p>
                </div>

                {/* Staggered Spotlight Grid */}
                <div className="grid grid-cols-1 md:grid-cols-6 lg:grid-cols-12 gap-8">
                    {features.map((feature, index) => {
                        const Icon = feature.icon;
                        const getSpanClass = (idx: number) => {
                            if (idx === 0) return 'md:col-span-6 lg:col-span-7 lg:row-span-2'; 
                            if (idx === 1) return 'md:col-span-3 lg:col-span-5'; 
                            if (idx === 2) return 'md:col-span-3 lg:col-span-5'; 
                            if (idx === 3) return 'md:col-span-6 lg:col-span-12'; 
                            return 'md:col-span-3 lg:col-span-6';
                        };

                        return (
                            <div
                                key={feature.id}
                                className={cn(
                                    'group relative rounded-[2.5rem] p-10 border border-primary/10 bg-primary/5 backdrop-blur-md transition-all duration-700 hover:border-primary/50 hover:bg-primary/10 hover:-translate-y-2 overflow-hidden spotlight-card translate-z-0 will-change-transform',
                                    getSpanClass(index)
                                )}
                            >
                                {/* Active Spotlight Glow */}
                                <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                                
                                {/* HUD Corner Accents */}
                                <div className="absolute top-6 right-6 flex gap-1 opacity-20 group-hover:opacity-100 transition-opacity">
                                    <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                                    <div className="w-1.5 h-1.5 rounded-full bg-primary/40" />
                                </div>

                                <div className="relative z-10 flex flex-col h-full">
                                    <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/10 flex items-center justify-center mb-10 group-hover:bg-primary group-hover:text-primary-foreground group-hover:rotate-12 transition-all duration-700">
                                        <Icon className="w-6 h-6" />
                                    </div>
                                    
                                    <h3 className={cn(
                                        "font-black tracking-tight mb-6 text-foreground group-hover:text-primary transition-colors",
                                        index === 0 ? "text-4xl lg:text-5xl" : "text-2xl lg:text-3xl"
                                    )}>
                                        {feature.title}
                                    </h3>
                                    
                                    <p className={cn(
                                        "font-medium leading-relaxed text-muted-foreground group-hover:text-foreground transition-colors",
                                        index === 0 ? "text-lg lg:text-xl" : "text-base"
                                    )}>
                                        {feature.description}
                                    </p>

                                    {/* HUD Decoration Strip */}
                                    <div className="mt-12 pt-8 border-t border-primary/10 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-all duration-1000 translate-y-4 group-hover:translate-y-0">
                                        <div className="text-[9px] font-black uppercase tracking-[0.4em] text-primary/60">
                                            Module.Active
                                        </div>
                                        <div className="h-1 w-24 bg-primary/10 rounded-full overflow-hidden">
                                            <div className="h-full w-2/3 bg-primary animate-pulse" />
                                        </div>
                                    </div>
                                </div>
                                
                                {/* Background Ornament for large cards */}
                                {index === 0 && (
                                    <div className="absolute -bottom-24 -right-24 w-80 h-80 bg-primary/5 rounded-full blur-[100px] group-hover:bg-primary/10 transition-all duration-1000" />
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
            {/* Horizontal HUD Line */}
            <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
        </section>
    );
}
