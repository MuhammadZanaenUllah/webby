import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getTranslatedPersonas, getIconComponent } from './data';
import { useTranslation } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

interface PersonaItem {
    title: string;
    description: string;
    icon: string;
}

interface UseCasesProps {
    content?: Record<string, unknown>;
    items?: PersonaItem[];
    settings?: Record<string, unknown>;
}

export function UseCases({ content, items, settings: _settings }: UseCasesProps = {}) {
    const { t } = useTranslation();

    // Use database items if provided, otherwise fall back to translated defaults
    const personas = items?.length
        ? items.map((item, index) => ({
              id: `persona-${index}`,
              title: item.title,
              description: item.description,
              icon: getIconComponent(item.icon),
          }))
        : getTranslatedPersonas(t);

    // Get content with defaults - DB content takes priority
    const title = (content?.title as string) || t('Built for everyone');
    const subtitle = (content?.subtitle as string) || t("Whether you're a developer, designer, or entrepreneur, our platform helps you build faster and smarter.");

    return (
        <section id="use-cases" className="py-24 lg:py-32 bg-[#0a0a0a] relative overflow-hidden">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-96 bg-primary/5 blur-[120px] rounded-full pointer-events-none" />
            
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                {/* Section Header */}
                <div className="text-center mb-20 animate-fade-in">
                    <h2 className="text-4xl md:text-5xl lg:text-7xl font-black tracking-tighter mb-8 bg-clip-text text-transparent bg-gradient-to-b from-foreground to-foreground/50 uppercase">
                        {title}
                    </h2>
                    <p className="text-lg md:text-xl text-muted-foreground/70 max-w-2xl mx-auto leading-relaxed font-medium">
                        {subtitle}
                    </p>
                </div>

                {/* Persona Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                    {personas.map((persona) => {
                        const Icon = persona.icon;
                        return (
                            <Card
                                key={persona.id}
                                className="group relative border-primary/20 glass-morphism rounded-[2.5rem] p-4 transition-all duration-700 hover:-translate-y-4 hover:shadow-[0_40px_80px_-20px_rgba(var(--primary-rgb),0.2)] overflow-hidden"
                            >
                                <CardHeader className="pb-4 text-center">
                                    <div className="w-20 h-20 rounded-[1.5rem] bg-primary/10 flex items-center justify-center mx-auto mb-8 group-hover:bg-primary group-hover:scale-110 group-hover:rotate-6 transition-all duration-300 shadow-lg shadow-primary/5">
                                        <Icon className="w-10 h-10 text-primary group-hover:text-primary-foreground transition-colors" />
                                    </div>
                                    <CardTitle className="text-2xl font-black tracking-tighter mb-2">
                                        {persona.title}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="text-center">
                                    <CardDescription className="text-sm font-semibold text-muted-foreground/80 leading-relaxed uppercase tracking-widest text-[10px]">
                                        {persona.description}
                                    </CardDescription>
                                </CardContent>
                                {/* Subtle Bottom Glow */}
                                <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-primary/10 blur-[50px] opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                            </Card>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
