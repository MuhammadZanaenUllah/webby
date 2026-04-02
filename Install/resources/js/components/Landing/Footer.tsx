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
        <footer className="bg-neutral-950 text-neutral-400 border-t border-neutral-900">
            <div className="w-full px-4 sm:px-6 lg:px-8 py-16 lg:py-20">
                <div className="flex flex-col items-center text-center space-y-8">
                    {/* Logo & Tagline */}
                    <div className="flex flex-col items-center space-y-4">
                        <div className="flex-shrink-0 transition-transform hover:scale-105 active:scale-95 grayscale invert brightness-0">
                            <ApplicationLogo showText size="lg" />
                        </div>
                        <p className="max-w-md text-sm leading-relaxed text-neutral-500">
                            {t('Build websites from your ideas in minutes. Professional website builder with no coding required.')}
                        </p>
                    </div>

                    {/* Links */}
                    <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-4">
                        {footerLinks.map((link) => (
                            <Link
                                key={link.label}
                                href={link.href}
                                className="text-xs font-semibold uppercase tracking-widest hover:text-primary transition-colors"
                            >
                                {link.label}
                            </Link>
                        ))}
                    </div>

                    {/* Copyright */}
                    <div className="pt-8 border-t border-neutral-900 w-full">
                        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-neutral-600">
                            &copy; {currentYear} Webby. {t('All Rights Reserved.')}
                        </p>
                    </div>
                </div>
            </div>
        </footer>
    );
}
