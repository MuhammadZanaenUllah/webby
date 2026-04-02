import { Head, Link } from "@inertiajs/react";
import { useTranslation } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { PageProps } from "@/types";
import ApplicationLogo from "@/components/ApplicationLogo";
import { GradientBackground } from "@/components/Dashboard/GradientBackground";
import { ArrowRight, Sparkles } from "lucide-react";

export default function Welcome({
    auth,
}: PageProps<{ canLogin: boolean; canRegister: boolean }>) {
    const { t } = useTranslation();

    return (
        <div className="min-h-screen bg-background relative overflow-hidden flex flex-col items-center justify-center p-6">
            <Head title={t("Welcome")} />
            <GradientBackground />

            {/* Premium Splash Card */}
            <div className="relative z-10 w-full max-w-md bg-card/60 backdrop-blur-3xl border border-primary/10 rounded-[3rem] p-10 shadow-2xl text-center transform transition-all duration-700 hover:scale-[1.02]">
                <div className="flex justify-center mb-10 scale-125">
                    <ApplicationLogo showText size="lg" />
                </div>

                <div className="space-y-4 mb-10">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/5 border border-primary/10 text-xs font-bold text-primary uppercase tracking-widest animate-pulse">
                        <Sparkles className="h-3 w-3" />
                        {t("Craft Your Future")}
                    </div>
                    <h1 className="text-3xl font-extrabold tracking-tight font-heading bg-clip-text text-transparent bg-gradient-to-b from-foreground to-foreground/60 leading-tight">
                        {t("Welcome to the Next Era of Web Building")}
                    </h1>
                </div>

                <div className="flex flex-col gap-4">
                    {auth.user ? (
                        <Button asChild className="h-14 rounded-2xl text-lg font-bold shadow-xl shadow-primary/20 hover:scale-[1.05] active:scale-95 transition-all">
                            <Link href="/create" className="flex items-center">
                                {t("Enter Dashboard")}
                                <ArrowRight className="ms-2 h-5 w-5" />
                            </Link>
                        </Button>
                    ) : (
                        <>
                            <Button asChild className="h-14 rounded-2xl text-lg font-bold shadow-xl shadow-primary/20 hover:scale-[1.05] active:scale-95 transition-all">
                                <Link href="/register">
                                    {t("Get Started")}
                                </Link>
                            </Button>
                            <Button asChild variant="ghost" className="h-12 rounded-2xl font-semibold opacity-70 hover:opacity-100 transition-all">
                                <Link href="/login">
                                    {t("Log in to your account")}
                                </Link>
                            </Button>
                        </>
                    )}
                </div>

                <div className="mt-10 pt-8 border-t border-primary/5">
                    <p className="text-[10px] text-muted-foreground/50 uppercase font-bold tracking-widest">
                        Powered by Websouls Engine
                    </p>
                </div>
            </div>

            {/* Decorative Glow elements */}
            <div className="absolute top-1/4 -left-1/4 w-1/2 h-1/2 bg-primary/10 blur-[120px] rounded-full" />
            <div className="absolute bottom-1/4 -right-1/4 w-1/2 h-1/2 bg-amber-500/5 blur-[120px] rounded-full" />
        </div>
    );
}
