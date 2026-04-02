import { Link } from '@inertiajs/react';
import { PropsWithChildren } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import ApplicationLogo from '@/components/ApplicationLogo';
import { GradientBackground } from '@/components/Dashboard/GradientBackground';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LanguageSelector } from '@/components/LanguageSelector';
import { Toaster } from '@/components/ui/sonner';

export default function Guest({ children }: PropsWithChildren) {
    return (
        <div className="relative min-h-screen bg-background flex flex-col items-center justify-center p-4">
            <GradientBackground />

            {/* Language and Theme Toggle */}
            <div className="absolute top-4 end-4 z-50 flex items-center gap-2">
                <LanguageSelector />
                <ThemeToggle />
            </div>

            <div className="relative z-10 w-full max-w-md">
                {/* Logo */}
                <Link href="/" className="flex items-center justify-center mb-10 transition-transform hover:scale-[1.03]">
                    <ApplicationLogo showText size="lg" />
                </Link>

                {/* Card */}
                <div className="bg-card/70 backdrop-blur-xl border border-primary/5 rounded-[2rem] shadow-2xl shadow-primary/5 p-8 relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-50 pointer-events-none" />
                    {children}
                </div>
            </div>

            <Toaster />
        </div>
    );
}
