import { useMemo } from 'react';
import { Link } from '@inertiajs/react';
import ApplicationLogo from '@/components/ApplicationLogo';
import { useTranslation } from '@/contexts/LanguageContext';

export function Footer() {
    const { t } = useTranslation();
    const currentYear = new Date().getFullYear();

    const footerLinks = useMemo(() => [
        { label: t('Privacy Policy'), href: '/privacy' },
        { label: t('Terms of Service'), href: '/terms' },
        { label: t('Cookie Policy'), href: '/cookies' },
    ], [t]);

    return (
        <footer className="bg-neutral-950 text-neutral-400 border-t border-primary/5 relative overflow-hidden">
            {/* Subtle Gradient Glow */}
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-64 bg-primary/5 blur-[100px] rounded-full pointer-events-none" />

            <div className="w-full px-4 sm:px-6 lg:px-8 py-20 lg:py-32 relative z-10">
                <div className="flex flex-col items-center text-center space-y-12">
                    {/* Logo & Tagline */}
                    <div className="flex flex-col items-center space-y-6">
                        <div className="flex-shrink-0 transition-all duration-500 hover:scale-105 hover:brightness-125 active:scale-95 grayscale invert brightness-0 opacity-80">
                            <ApplicationLogo showText size="lg" />
                        </div>
                        <p className="max-w-xl text-base font-medium leading-relaxed text-neutral-500/80">
                            {t('The next generation of website building. Professional grade, AI-powered, and designed for the elite.')}
                        </p>
                    </div>

                    {/* Links */}
                    <div className="flex flex-wrap items-center justify-center gap-x-16 gap-y-6">
                        {footerLinks.map((link) => (
                            <Link
                                key={link.label}
                                href={link.href}
                                className="text-[10px] font-black uppercase tracking-[0.3em] hover:text-primary transition-all duration-300 hover:tracking-[0.4em]"
                            >
                                {link.label}
                            </Link>
                        ))}
                    </div>

                    {/* Social/Status Mini Bar */}
                    <div className="flex items-center gap-6 pt-12 border-t border-neutral-900/50 w-full justify-center">
                        <div className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-primary animate-pulse shadow-[0_0_10px_rgba(var(--primary-rgb),0.5)]" />
                            <span className="text-[9px] font-black uppercase tracking-widest text-neutral-600">{t('All Systems Operational')}</span>
                        </div>
                    </div>

                    {/* Copyright */}
                    <div className="w-full">
                        <p className="text-[9px] font-black uppercase tracking-[0.4em] text-neutral-700">
                            &copy; {currentYear} Webby. {t('Engineered for Excellence.')}
                        </p>
                    </div>
                </div>
            </div>
        </footer>
    );
}
