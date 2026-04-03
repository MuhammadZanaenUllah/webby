import { useState, useEffect, useMemo } from "react";
import { Link } from "@inertiajs/react";
import { Menu, X, Globe, Box, CreditCard, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageSelector } from "@/components/LanguageSelector";
import ApplicationLogo from "@/components/ApplicationLogo";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/contexts/LanguageContext";

interface NavbarProps {
    auth: {
        user: { id: number; name: string; email: string } | null;
    };
    canLogin: boolean;
    canRegister: boolean;
    enabledSectionTypes?: string[];
}

const handleSmoothScroll = (
    e: React.MouseEvent<HTMLAnchorElement>,
    href: string,
) => {
    e.preventDefault();
    const targetId = href.replace("#", "");
    const element = document.getElementById(targetId);
    if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
};

export function Navbar({
    auth,
    canLogin,
    canRegister,
    enabledSectionTypes = [],
}: NavbarProps) {
    const { t } = useTranslation();
    const [scrolled, setScrolled] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    // Map section types to their nav links
    const allNavLinks = useMemo(
        () => [
            {
                label: t("Features"),
                href: "#features",
                isAnchor: true,
                sectionType: "features",
                icon: Layers,
            },
            {
                label: t("Pricing"),
                href: "#pricing",
                isAnchor: true,
                sectionType: "pricing",
                icon: CreditCard,
            },
            {
                label: t("Use Cases"),
                href: "#use-cases",
                isAnchor: true,
                sectionType: "use_cases",
                icon: Box,
            },
        ],
        [t],
    );

    // Filter nav links based on enabled sections
    const navLinks = useMemo(() => {
        // If no sections provided (backwards compatibility), show all links
        if (enabledSectionTypes.length === 0) {
            return allNavLinks;
        }
        return allNavLinks.filter((link) =>
            enabledSectionTypes.includes(link.sectionType),
        );
    }, [allNavLinks, enabledSectionTypes]);

    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 50);
        };

        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    return (
        <>
            {/* Top Bar HUD (Logo & Actions) */}
            <header className="fixed top-0 left-0 w-full z-[100] pointer-events-none">
                <div className="max-w-[1800px] mx-auto px-8 py-8 flex justify-between items-start">
                    {/* Top Left: Logo */}
                    <div className="pointer-events-auto">
                        <Link href="/" className="transition-transform hover:scale-105 inline-block">
                            <ApplicationLogo showText size="lg" />
                        </Link>
                    </div>

                    {/* Top Right: Global Actions */}
                    <div className="flex items-center gap-4 pointer-events-auto bg-background/40 backdrop-blur-md px-6 py-2 rounded-2xl border border-primary/10 shadow-2xl">
                        <LanguageSelector />
                        <ThemeToggle />
                        {!auth.user && canLogin && (
                            <Link href="/login" className="text-xs font-black uppercase tracking-[0.2em] text-foreground/50 hover:text-primary transition-colors px-4">
                                {t("Login")}
                            </Link>
                        )}
                        {auth.user ? (
                            <Button asChild className="rounded-xl px-6 bg-primary text-primary-foreground font-black uppercase text-[10px] tracking-widest h-11">
                                <Link href="/create">{t("Dashboard")}</Link>
                            </Button>
                        ) : (
                            canRegister && (
                                <Button asChild className="rounded-xl px-6 bg-primary text-primary-foreground font-black uppercase text-[10px] tracking-widest h-11">
                                    <Link href="/register">{t("Get Started")}</Link>
                                </Button>
                            )
                        )}
                    </div>
                </div>
            </header>

            {/* Side HUD Navigation (Vertical Bar) */}
            <aside className="fixed left-8 top-1/2 -translate-y-1/2 z-[90] hidden xl:flex flex-col gap-8 items-center py-10 px-4 rounded-full border border-primary/10 bg-background/40 backdrop-blur-md shadow-2xl translate-z-0 will-change-transform">
                <div className="absolute inset-0 bg-primary/5 blur-2xl rounded-full" />
                {navLinks.map((link) => {
                    const Icon = link.icon;
                    return (
                        <a
                            key={link.label}
                            href={link.href}
                            onClick={(e) => handleSmoothScroll(e, link.href)}
                            className="group relative p-4 rounded-2xl hover:bg-primary/10 transition-all duration-200"
                            title={link.label}
                        >
                             <Icon className="h-6 w-6 text-foreground/40 group-hover:text-primary transition-colors" />
                            {/* Tooltip Label */}
                            <span className="absolute left-full ml-6 px-4 py-2 rounded-xl bg-background/80 border border-primary/10 backdrop-blur-md text-[10px] font-black uppercase tracking-[0.3em] text-foreground opacity-0 group-hover:opacity-100 translate-x-[-10px] group-hover:translate-x-0 transition-all pointer-events-none whitespace-nowrap">
                                {link.label}
                            </span>
                        </a>
                    );
                })}
            </aside>

            {/* Mobile Menu HUD */}
            <div className="fixed bottom-8 right-8 z-[100] md:hidden">
                <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                    <SheetTrigger asChild>
                        <Button variant="default" size="icon" className="h-16 w-16 rounded-full shadow-2xl bg-primary shadow-primary/20">
                            <Menu className="h-8 w-8" />
                        </Button>
                    </SheetTrigger>
                    <SheetContent side="bottom" className="h-[70vh] rounded-t-[3rem] border-t border-primary/10 bg-background backdrop-blur-md">
                        <div className="flex flex-col gap-12 mt-12 px-6">
                            <div className="flex flex-col gap-6">
                                {navLinks.map((link) => {
                                    const Icon = link.icon;
                                    return (
                                        <a
                                            key={link.label}
                                            href={link.href}
                                            onClick={(e) => {
                                                handleSmoothScroll(e, link.href);
                                                setMobileMenuOpen(false);
                                            }}
                                            className="flex items-center gap-6 p-6 rounded-3xl bg-primary/5 border border-primary/10 text-xl font-bold hover:bg-primary/20 transition-all"
                                        >
                                            <Icon className="h-8 w-8 text-primary" />
                                            {link.label}
                                        </a>
                                    );
                                })}
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <Button asChild variant="outline" className="h-16 rounded-3xl border-primary/10">
                                    <Link href="/login" onClick={() => setMobileMenuOpen(false)}>{t("Login")}</Link>
                                </Button>
                                <Button asChild className="h-16 rounded-3xl bg-primary">
                                    <Link href="/register" onClick={() => setMobileMenuOpen(false)}>{t("Register")}</Link>
                                </Button>
                            </div>
                        </div>
                    </SheetContent>
                </Sheet>
            </div>
        </>
    );
}
