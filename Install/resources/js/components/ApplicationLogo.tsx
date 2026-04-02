import { usePage } from '@inertiajs/react';
import { HTMLAttributes, useState, useEffect } from 'react';
import { PageProps, ColorTheme } from '@/types';
import { Paintbrush } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

interface ApplicationLogoProps extends HTMLAttributes<HTMLDivElement> {
    showText?: boolean;
    size?: 'sm' | 'md' | 'lg';
}

// Theme color mappings for the default logo icon (Aligned to Websouls Brand)
const brandColors = {
    gradient: 'from-[#00F5AE] via-[#00E5A2] to-[#00D596]',
    shadow: 'shadow-[#00F5AE]/30',
    shadowDark: 'dark:shadow-[#00F5AE]/20',
    hoverShadow: 'group-hover:shadow-[#00F5AE]/50',
    hoverShadowDark: 'dark:group-hover:shadow-[#00F5AE]/30',
    textGradient: 'from-[#00F5AE] to-[#00A575]',
    textGradientDark: 'dark:from-[#00F5AE] dark:to-[#00D596]',
};

const themeColors: Record<ColorTheme, typeof brandColors> = {
    neutral: brandColors,
    blue: brandColors,
    green: brandColors,
    orange: brandColors,
    red: brandColors,
    rose: brandColors,
    violet: brandColors,
    yellow: brandColors,
};

export default function ApplicationLogo({
    className,
    showText = false,
    size = 'md',
    ...props
}: ApplicationLogoProps) {
    const { appSettings } = usePage<PageProps>().props;
    const { resolvedTheme } = useTheme();

    // Listen for color theme preview changes from settings page
    const [previewTheme, setPreviewTheme] = useState<ColorTheme | null>(null);

    useEffect(() => {
        const handlePreview = (e: CustomEvent<ColorTheme | null>) => {
            setPreviewTheme(e.detail);
        };

        window.addEventListener('colorThemePreview', handlePreview as EventListener);
        return () => window.removeEventListener('colorThemePreview', handlePreview as EventListener);
    }, []);

    // Determine which logo to use based on theme
    const logoUrl = resolvedTheme === 'dark' && appSettings?.site_logo_dark
        ? `/storage/${appSettings.site_logo_dark}`
        : appSettings?.site_logo
            ? `/storage/${appSettings.site_logo}`
            : null;

    const containerSizeClasses = {
        sm: 'w-8 h-8',
        md: 'w-10 h-10',
        lg: 'w-11 h-11',
    };

    const imageSizeClasses = {
        sm: 'h-8 w-auto',
        md: 'h-10 w-auto',
        lg: 'h-14 w-auto',
    };

    const iconSizeClasses = {
        sm: 'w-5 h-5',
        md: 'w-6 h-6',
        lg: 'w-7 h-7',
    };

    const textSizeClasses = {
        sm: 'text-lg',
        md: 'text-xl',
        lg: 'text-2xl',
    };

    const dotSizeClasses = {
        sm: 'w-2 h-2',
        md: 'w-2.5 h-2.5',
        lg: 'w-3 h-3',
    };

    const siteName = appSettings?.site_name || 'App';
    const siteTagline = appSettings?.site_tagline || 'Build websites with AI';
    // Use preview theme if available (from settings page), otherwise use saved setting
    const colorTheme = previewTheme || appSettings?.color_theme || 'neutral';
    const colors = themeColors[colorTheme];

    // If logo exists, show image (uses dark logo when in dark mode if available)
    if (logoUrl) {
        return (
            <div className={`flex items-center ${className || ''}`} {...props}>
                <img
                    src={logoUrl}
                    alt={siteName}
                    className={`${imageSizeClasses[size]} object-contain`}
                />
            </div>
        );
    }

    // Fallback to styled icon logo (matching appy style)
    return (
        <div className={`flex items-center gap-3 ${className || ''}`} {...props}>
            <div className="relative group">
                <div className={`${containerSizeClasses[size]} bg-gradient-to-br ${colors.gradient} rounded-2xl flex items-center justify-center shadow-lg ${colors.shadow} ${colors.shadowDark} ${colors.hoverShadow} ${colors.hoverShadowDark} transition-all duration-300 group-hover:scale-105`}>
                    <Paintbrush className={`${iconSizeClasses[size]} text-white`} />
                </div>
                <div className={`absolute -top-0.5 -right-0.5 ${dotSizeClasses[size]} bg-green-500 rounded-full border-2 border-background`} />
            </div>
            {showText && (
                <div>
                    <span className={`font-bold bg-gradient-to-r ${colors.textGradient} ${colors.textGradientDark} bg-clip-text text-transparent ${textSizeClasses[size]}`}>
                        {siteName}
                    </span>
                    {siteTagline && (size === 'lg' || size === 'md') && (
                        <p className="text-[10px] font-medium text-muted-foreground">{siteTagline}</p>
                    )}
                </div>
            )}
        </div>
    );
}
