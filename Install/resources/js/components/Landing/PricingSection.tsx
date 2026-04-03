import { Link } from "@inertiajs/react";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, X, Star, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/contexts/LanguageContext";

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
    billing_period: "monthly" | "yearly" | "lifetime";
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

type TranslationFn = (
    key: string,
    replacements?: Record<string, string | number>,
) => string;

function formatCredits(credits: number, t: TranslationFn): string {
    if (credits === -1) return t("Unlimited");
    if (credits >= 1_000_000) return `${(credits / 1_000_000).toFixed(0)}M`;
    if (credits >= 1_000) return `${(credits / 1_000).toFixed(0)}K`;
    return credits.toString();
}

function formatCurrency(amount: string | number): string {
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: num % 1 === 0 ? 0 : 2,
    }).format(num);
}

function PlanCard({ plan, t }: { plan: Plan; t: TranslationFn }) {
    const billingPeriodLabels: Record<string, string> = {
        monthly: t("/mo"),
        yearly: t("/yr"),
        lifetime: "",
    };

    const getProjectsLabel = () => {
        if (plan.max_projects === null) {
            return t("Unlimited projects");
        }
        if (plan.max_projects === 1) {
            return t(":count project", { count: 1 });
        }
        return t(":count projects", { count: plan.max_projects });
    };

    const discount =
        plan.slug === "free"
            ? 0
            : plan.is_popular
              ? 47
              : plan.slug === "enterprise"
                ? 52
                : 40;
    const oldPriceNum = parseFloat(plan.price) / (1 - discount / 100);

    return (
        <div className="relative group perspective-[1000px] mt-12 mb-12">
            <Card
                className={cn(
                    "flex flex-col relative transition-all duration-700 bg-primary/5 backdrop-blur-md border border-primary/10 shadow-2xl rounded-[3rem] overflow-visible group-hover:shadow-[0_60px_120px_-30px_rgba(0,0,0,0.5)] group-hover:-translate-y-4 will-change-transform translate-z-0",
                    plan.is_popular
                        ? "ring-2 ring-primary scale-105 z-20"
                        : "z-10",
                )}
            >
                {/* Image Top Tab Style Redesign */}
                {plan.is_popular && (
                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-48 h-12 bg-[#00dfab] rounded-t-3xl flex items-center justify-center gap-2 shadow-2xl z-20 overflow-visible before:content-[''] before:absolute before:-bottom-1 before:-left-8 before:h-8 before:w-8 before:bg-[radial-gradient(circle_at_0_0,transparent_70%,#00dfab_72%)] after:content-[''] after:absolute after:-bottom-1 after:-right-8 after:h-8 after:w-8 after:bg-[radial-gradient(circle_at_100%_0,transparent_70%,#00dfab_72%)]">
                        <Star className="h-3.5 w-3.5 fill-white text-white" />
                        <span className="text-[10px] font-black uppercase tracking-[0.25em] text-white whitespace-nowrap">
                            {t("Elite Choice")}
                        </span>
                    </div>
                )}

                <CardHeader className="text-start pt-16 pb-8 px-10 relative overflow-visible">
                    {/* STANDARD Label (from Image) */}
                    <div className="mb-4">
                        <span className="inline-block px-3 py-1 bg-primary/10 text-primary text-[10px] font-black uppercase tracking-[0.3em] rounded-sm">
                            {plan.slug === "free"
                                ? t("Kickstart")
                                : plan.slug === "pro"
                                  ? t("Standard")
                                  : plan.is_popular
                                    ? t("Best Value")
                                    : t("Enterprise")}
                        </span>
                    </div>

                    <CardTitle className="text-5xl font-black tracking-tighter text-foreground mb-8">
                        {plan.slug === "free"
                            ? t("Starter")
                            : plan.slug === "pro"
                              ? t("Pro")
                              : plan.slug === "enterprise"
                                ? t("Agency")
                                : plan.name}
                    </CardTitle>

                    {plan.slug !== "free" && (
                        <div className="flex items-center gap-3 mb-8">
                            <div className="inline-flex items-center px-3 py-1.5 rounded-full border border-[#00dfab]/50 bg-[#00dfab]/10 text-[#00dfab] text-[10px] font-black uppercase tracking-tight">
                                {t("Save :percent%", { percent: discount })}
                            </div>
                            <span className="text-xs text-muted-foreground line-through font-bold opacity-80">
                                {formatCurrency(oldPriceNum)}
                            </span>
                        </div>
                    )}

                    <div className="flex flex-col items-start">
                        <div className="flex items-baseline gap-1">
                            <span className="text-6xl font-black tracking-tighter text-foreground">
                                {formatCurrency(plan.price)}
                            </span>
                            <span className="text-sm text-foreground/70 font-bold uppercase tracking-widest ms-2">
                                {plan.slug === "free"
                                    ? billingPeriodLabels[plan.billing_period]
                                    : t("/yr")}
                            </span>
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="px-10 py-8">
                    <div className="space-y-8">
                        <div className="space-y-4">
                            <Button
                                className={cn(
                                    "w-full h-16 rounded-[2rem] font-black text-lg tracking-tight transition-all duration-200 active:scale-95 shadow-2xl",
                                    plan.is_popular
                                        ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-primary/20"
                                        : "bg-muted text-foreground hover:bg-muted/80 shadow-black/10",
                                )}
                                asChild
                            >
                                <Link href={`/billing/plans?plan=${plan.id}`}>
                                    {t("Get Started")}
                                </Link>
                            </Button>
                            {plan.slug !== "free" && (
                                <p className="text-[10px] text-muted-foreground text-center font-bold uppercase tracking-widest px-1">
                                    {t("Limited time offer")}
                                </p>
                            )}
                        </div>

                        <ul className="space-y-4 pt-10 border-t border-primary/10">
                            {[
                                { name: getProjectsLabel(), included: true },
                                {
                                    name: t(":credits AI Credits", {
                                        credits: formatCredits(
                                            plan.monthly_build_credits,
                                            t,
                                        ),
                                    }),
                                    included: true,
                                },
                                ...(plan.allow_user_ai_api_key
                                    ? [
                                          {
                                              name: t("Custom AI Engines"),
                                              included: true,
                                          },
                                      ]
                                    : []),
                                ...plan.features.slice(0, 6),
                            ].map((feature, index) => (
                                <li
                                    key={index}
                                    className="flex items-center justify-between text-xs font-bold tracking-tight"
                                >
                                    <div className="flex items-center gap-4">
                                        <div
                                            className={cn(
                                                "h-6 w-6 rounded-full flex items-center justify-center transition-colors shadow-sm",
                                                feature.included
                                                    ? "bg-[#00dfab]/10"
                                                    : "bg-white/5",
                                            )}
                                        >
                                            <Check
                                                className={cn(
                                                    "h-3.5 w-3.5 stroke-[4]",
                                                    feature.included
                                                        ? "text-[#00dfab]"
                                                        : "text-neutral-700",
                                                )}
                                            />
                                        </div>
                                        <span
                                            className={cn(
                                                "text-sm tracking-tight transition-colors",
                                                feature.included
                                                    ? "text-neutral-200 font-bold"
                                                    : "text-neutral-600 font-medium",
                                            )}
                                        >
                                            {feature.name}
                                        </span>
                                    </div>
                                    {feature.included && (
                                        <Info className="h-4 w-4 text-white/20 shrink-0 cursor-help hover:text-[#00dfab] transition-colors duration-200" />
                                    )}
                                </li>
                            ))}
                        </ul>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

export function PricingSection({
    plans,
    content,
    settings: _settings,
}: PricingSectionProps) {
    const { t } = useTranslation();

    if (plans.length === 0) return null;

    // Get content with defaults - DB content takes priority
    const title =
        (content?.title as string) || t("Simple, transparent pricing");
    const subtitle =
        (content?.subtitle as string) ||
        t(
            "Choose the plan that fits your needs. All plans include access to our AI-powered website builder.",
        );

    return (
        <section
            id="pricing"
            className="py-32 lg:py-64 bg-background relative overflow-hidden"
        >
            {/* Ambient Background Ornament */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-6xl h-full bg-[radial-gradient(circle_at_center,rgba(var(--primary-rgb),0.05)_0%,transparent_70%)] pointer-events-none" />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                <div className="text-center mb-32 animate-fade-in">
                    <div className="text-[#00dfab] text-[10px] font-black uppercase tracking-[0.5em] mb-6">
                        [ Network_Valuation.v4 ]
                    </div>
                    <h2 className="text-5xl md:text-8xl font-black tracking-tighter mb-8 text-foreground leading-[0.9]">
                        {title}
                    </h2>
                    <p className="text-lg text-muted-foreground max-w-2xl mx-auto font-medium">
                        {subtitle}
                    </p>
                </div>

                <div
                    className={cn(
                        "grid gap-12 mx-auto items-stretch mt-12",
                        plans.length === 1 && "max-w-md grid-cols-1",
                        plans.length === 2 &&
                            "max-w-4xl grid-cols-1 md:grid-cols-2",
                        plans.length === 3 &&
                            "max-w-6xl grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
                        plans.length >= 4 &&
                            "max-w-7xl grid-cols-1 md:grid-cols-2 lg:grid-cols-4",
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
