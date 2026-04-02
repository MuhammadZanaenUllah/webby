import { Link } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, X, Star, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/contexts/LanguageContext';

interface PlanFeature {
    name: string;
    included: boolean;
}

interface Plan {
    id: number;
    name: string;
    slug: string;
    description: string | null;
    price: string;
    billing_period: 'monthly' | 'yearly' | 'lifetime';
    features: PlanFeature[];
    is_popular: boolean;
    max_projects: number | null;
    monthly_build_credits: number;
    allow_user_ai_api_key: boolean;
    // Subdomain settings
    enable_subdomains?: boolean;
    max_subdomains_per_user?: number | null;
    allow_private_visibility?: boolean;
    // Custom domain settings
    enable_custom_domains?: boolean;
    max_custom_domains_per_user?: number | null;
}

interface PricingSectionProps {
    plans: Plan[];
    content?: Record<string, unknown>;
    settings?: Record<string, unknown>;
}

type TranslationFn = (key: string, replacements?: Record<string, string | number>) => string;

function formatCredits(credits: number, t: TranslationFn): string {
    if (credits === -1) return t('Unlimited');
    if (credits >= 1_000_000) return `${(credits / 1_000_000).toFixed(0)}M`;
    if (credits >= 1_000) return `${(credits / 1_000).toFixed(0)}K`;
    return credits.toString();
}

function formatCurrency(amount: string | number): string {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: num % 1 === 0 ? 0 : 2,
    }).format(num);
}

function PlanCard({ plan, t }: { plan: Plan; t: TranslationFn }) {
    const billingPeriodLabels: Record<string, string> = {
        monthly: t('/month'),
        yearly: t('/year'),
        lifetime: '',
    };

    const getProjectsLabel = () => {
        if (plan.max_projects === null) {
            return t('Unlimited projects');
        }
        if (plan.max_projects === 1) {
            return t(':count project', { count: 1 });
        }
        return t(':count projects', { count: plan.max_projects });
    };

    const getSubdomainsLabel = () => {
        if (plan.max_subdomains_per_user === null) {
            return t('Unlimited custom subdomains');
        }
        if (plan.max_subdomains_per_user === 1) {
            return t('1 custom subdomain');
        }
        return t(':count custom subdomains', { count: plan.max_subdomains_per_user ?? 0 });
    };

    const discount = plan.slug === 'free' ? 0 : plan.is_popular ? 47 : (plan.slug === 'enterprise' ? 52 : 40);
    const oldPriceNum = parseFloat(plan.price) / (1 - discount / 100);

    return (
        <Card
            className={cn(
                'flex flex-col relative transition-all duration-500 hover:shadow-2xl hover:-translate-y-2 border-primary/10 rounded-[2.5rem] bg-card group',
                plan.is_popular ? 'ring-2 ring-primary bg-emerald-50/20 dark:bg-emerald-900/5 shadow-2xl scale-105 z-10' : 'shadow-xl'
            )}
        >
            {plan.is_popular && (
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-primary rounded-t-[2.5rem]" />
            )}
            {plan.is_popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-20">
                    <Badge className="flex items-center gap-1.5 bg-primary text-primary-foreground px-5 py-2 rounded-full text-[10px] font-black tracking-widest uppercase border-0 shadow-lg whitespace-nowrap">
                        <Star className="h-3 w-3 fill-current" />
                        {t('Most Popular')}
                    </Badge>
                </div>
            )}
            <CardHeader className={cn('text-start pt-10 pb-4 px-10')}>
                <div className="space-y-1 mb-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">
                        {plan.slug === 'free' ? t('Starter') : plan.slug === 'pro' ? t('Grow') : plan.is_popular ? t('Recommended') : t('Powerful')}
                    </p>
                    <CardTitle className="text-3xl font-bold tracking-tight">
                        {plan.slug === 'free' ? t('Startup') : plan.slug === 'pro' ? t('Grow') : plan.slug === 'enterprise' ? t('Business') : plan.name}
                    </CardTitle>
                </div>
                
                {plan.slug !== 'free' && (
                    <div className="flex items-center gap-3 mb-4">
                        <div className="inline-flex items-center px-2 py-1 rounded-md bg-[#e2ff3d] border border-black/5 text-black text-[10px] font-black uppercase tracking-tighter">
                            {t('Save :percent%', { percent: discount })}
                        </div>
                        <span className="text-xs text-muted-foreground line-through opacity-50 font-medium">
                            {formatCurrency(oldPriceNum)}
                        </span>
                    </div>
                )}

                <div className="flex flex-col items-start mt-2">
                    <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-black tracking-tighter">{formatCurrency(plan.price)}</span>
                        <span className="text-sm text-muted-foreground font-medium opacity-70">
                            {plan.slug === 'free' ? billingPeriodLabels[plan.billing_period] : t('/yr')}
                        </span>
                    </div>
                </div>
            </CardHeader>
            
            <CardContent className="flex-1 px-10 py-6">
                <div className="space-y-6">
                    <div className="space-y-3">
                        <Button className="w-full h-11 rounded-xl font-black text-sm transition-all active:scale-95 shadow-md hover:shadow-xl shadow-primary/10 bg-slate-900 hover:bg-slate-800 text-white" asChild>
                            <Link href="/billing/plans">{t('Get Started')}</Link>
                        </Button>
                        {plan.slug !== 'free' && (
                            <p className="text-[10px] text-muted-foreground/70 text-start font-medium px-1">
                                {formatCurrency(oldPriceNum)}{t('/yr when you renew')}
                            </p>
                        )}
                    </div>
                    
                    <ul className="space-y-3.5 pt-6 border-t border-primary/5">
                        <li className="flex items-center justify-between text-[11px] font-bold">
                            <div className="flex items-center gap-2.5">
                                <Check className="h-3.5 w-3.5 text-foreground shrink-0 stroke-[3]" />
                                {getProjectsLabel()}
                            </div>
                        </li>
                        <li className="flex items-center justify-between text-[11px] font-bold">
                            <div className="flex items-center gap-2.5">
                                <Check className="h-3.5 w-3.5 text-foreground shrink-0 stroke-[3]" />
                                {t(':credits AI Credits', { credits: formatCredits(plan.monthly_build_credits, t) })}
                            </div>
                            <Info className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0 cursor-help" />
                        </li>
                        {plan.allow_user_ai_api_key && (
                            <li className="flex items-center justify-between text-[11px] font-bold">
                                <div className="flex items-center gap-2.5">
                                    <Check className="h-3.5 w-3.5 text-foreground shrink-0 stroke-[3]" />
                                    {t('Bring your own AI keys')}
                                </div>
                                <Info className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0 cursor-help" />
                            </li>
                        )}
                        {plan.features.slice(0, 10).map((feature, index) => (
                            <li key={index} className="flex items-center justify-between text-[11px] font-bold">
                                <div className="flex items-center gap-2.5">
                                    <Check className={cn("h-3.5 w-3.5 text-foreground shrink-0 stroke-[3]", !feature.included && "opacity-20")} />
                                    <span className={cn(!feature.included && 'text-muted-foreground/40 font-medium')}>
                                        {feature.name}
                                    </span>
                                </div>
                                {feature.included && <Info className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0 cursor-help" />}
                            </li>
                        ))}
                    </ul>
                </div>
            </CardContent>
        </Card>
    );
}

export function PricingSection({ plans, content, settings: _settings }: PricingSectionProps) {
    const { t } = useTranslation();

    if (plans.length === 0) return null;

    // Get content with defaults - DB content takes priority
    const title = (content?.title as string) || t('Simple, transparent pricing');
    const subtitle = (content?.subtitle as string) || t('Choose the plan that fits your needs. All plans include access to our AI-powered website builder.');

    return (
        <section id="pricing" className="py-24 lg:py-32 bg-background relative overflow-hidden">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-96 bg-primary/5 blur-[120px] rounded-full pointer-events-none" />
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center mb-20 relative z-10">
                    <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-6">
                        {title}
                    </h2>
                    <p className="text-lg text-muted-foreground/90 max-w-2xl mx-auto leading-relaxed">
                        {subtitle}
                    </p>
                </div>

                <div
                    className={cn(
                        'grid gap-8 mx-auto',
                        plans.length === 1 && 'max-w-md grid-cols-1',
                        plans.length === 2 && 'max-w-3xl grid-cols-1 md:grid-cols-2',
                        plans.length === 3 && 'max-w-6xl grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
                        plans.length >= 4 && 'max-w-7xl grid-cols-1 md:grid-cols-2 lg:grid-cols-4'
                    )}
                >
                    {plans.map((plan) => (
                        <PlanCard key={plan.id} plan={plan} t={t} />
                    ))}
                </div>
            </div>
        </section>
    );
}
