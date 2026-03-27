import { useForm, router } from '@inertiajs/react';
import { FormEventHandler, useRef, useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { Save, Upload, Loader2, X, CheckCircle, XCircle, Eye, EyeOff, Bug, ChevronsUpDown, Check } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useTranslation } from '@/contexts/LanguageContext';
import type { GeneralSettings, ColorTheme, SettingsLanguage } from './types';

interface Props {
    settings: GeneralSettings;
    languages: SettingsLanguage[];
}

const TIMEZONES = [
    // UTC
    { value: 'UTC', label: 'UTC', offset: '+00:00' },

    // Americas
    { value: 'America/New_York', label: 'New York (Eastern)', offset: '-05:00' },
    { value: 'America/Chicago', label: 'Chicago (Central)', offset: '-06:00' },
    { value: 'America/Denver', label: 'Denver (Mountain)', offset: '-07:00' },
    { value: 'America/Los_Angeles', label: 'Los Angeles (Pacific)', offset: '-08:00' },
    { value: 'America/Phoenix', label: 'Phoenix (Arizona)', offset: '-07:00' },
    { value: 'America/Anchorage', label: 'Anchorage (Alaska)', offset: '-09:00' },
    { value: 'America/Toronto', label: 'Toronto', offset: '-05:00' },
    { value: 'America/Vancouver', label: 'Vancouver', offset: '-08:00' },
    { value: 'America/Winnipeg', label: 'Winnipeg', offset: '-06:00' },
    { value: 'America/Edmonton', label: 'Edmonton', offset: '-07:00' },
    { value: 'America/Halifax', label: 'Halifax', offset: '-04:00' },
    { value: 'America/St_Johns', label: "St. John's (Newfoundland)", offset: '-03:30' },
    { value: 'America/Regina', label: 'Regina (Saskatchewan)', offset: '-06:00' },
    { value: 'America/Mexico_City', label: 'Mexico City', offset: '-06:00' },
    { value: 'America/Guatemala', label: 'Guatemala', offset: '-06:00' },
    { value: 'America/Panama', label: 'Panama', offset: '-05:00' },
    { value: 'America/Havana', label: 'Havana', offset: '-05:00' },
    { value: 'America/Jamaica', label: 'Jamaica', offset: '-05:00' },
    { value: 'America/Santo_Domingo', label: 'Santo Domingo', offset: '-04:00' },
    { value: 'America/Bogota', label: 'Bogotá', offset: '-05:00' },
    { value: 'America/Lima', label: 'Lima', offset: '-05:00' },
    { value: 'America/Guayaquil', label: 'Guayaquil', offset: '-05:00' },
    { value: 'America/Caracas', label: 'Caracas', offset: '-04:00' },
    { value: 'America/La_Paz', label: 'La Paz', offset: '-04:00' },
    { value: 'America/Asuncion', label: 'Asunción', offset: '-04:00' },
    { value: 'America/Santiago', label: 'Santiago', offset: '-04:00' },
    { value: 'America/Sao_Paulo', label: 'São Paulo', offset: '-03:00' },
    { value: 'America/Argentina/Buenos_Aires', label: 'Buenos Aires', offset: '-03:00' },
    { value: 'America/Montevideo', label: 'Montevideo', offset: '-03:00' },
    { value: 'America/Cayenne', label: 'Cayenne', offset: '-03:00' },
    { value: 'America/Paramaribo', label: 'Paramaribo', offset: '-03:00' },

    // Europe
    { value: 'Atlantic/Reykjavik', label: 'Reykjavik', offset: '+00:00' },
    { value: 'Europe/London', label: 'London (GMT)', offset: '+00:00' },
    { value: 'Europe/Dublin', label: 'Dublin', offset: '+00:00' },
    { value: 'Europe/Lisbon', label: 'Lisbon', offset: '+00:00' },
    { value: 'Europe/Paris', label: 'Paris (CET)', offset: '+01:00' },
    { value: 'Europe/Berlin', label: 'Berlin', offset: '+01:00' },
    { value: 'Europe/Madrid', label: 'Madrid', offset: '+01:00' },
    { value: 'Europe/Rome', label: 'Rome', offset: '+01:00' },
    { value: 'Europe/Amsterdam', label: 'Amsterdam', offset: '+01:00' },
    { value: 'Europe/Brussels', label: 'Brussels', offset: '+01:00' },
    { value: 'Europe/Vienna', label: 'Vienna', offset: '+01:00' },
    { value: 'Europe/Zurich', label: 'Zurich', offset: '+01:00' },
    { value: 'Europe/Stockholm', label: 'Stockholm', offset: '+01:00' },
    { value: 'Europe/Oslo', label: 'Oslo', offset: '+01:00' },
    { value: 'Europe/Copenhagen', label: 'Copenhagen', offset: '+01:00' },
    { value: 'Europe/Warsaw', label: 'Warsaw', offset: '+01:00' },
    { value: 'Europe/Prague', label: 'Prague', offset: '+01:00' },
    { value: 'Europe/Budapest', label: 'Budapest', offset: '+01:00' },
    { value: 'Europe/Belgrade', label: 'Belgrade', offset: '+01:00' },
    { value: 'Europe/Sarajevo', label: 'Sarajevo', offset: '+01:00' },
    { value: 'Europe/Luxembourg', label: 'Luxembourg', offset: '+01:00' },
    { value: 'Europe/Malta', label: 'Malta', offset: '+01:00' },
    { value: 'Europe/Helsinki', label: 'Helsinki', offset: '+02:00' },
    { value: 'Europe/Athens', label: 'Athens', offset: '+02:00' },
    { value: 'Europe/Bucharest', label: 'Bucharest', offset: '+02:00' },
    { value: 'Europe/Kyiv', label: 'Kyiv', offset: '+02:00' },
    { value: 'Europe/Tallinn', label: 'Tallinn', offset: '+02:00' },
    { value: 'Europe/Riga', label: 'Riga', offset: '+02:00' },
    { value: 'Europe/Vilnius', label: 'Vilnius', offset: '+02:00' },
    { value: 'Europe/Chisinau', label: 'Chișinău', offset: '+02:00' },
    { value: 'Europe/Kaliningrad', label: 'Kaliningrad', offset: '+02:00' },
    { value: 'Europe/Istanbul', label: 'Istanbul', offset: '+03:00' },
    { value: 'Europe/Moscow', label: 'Moscow', offset: '+03:00' },
    { value: 'Europe/Minsk', label: 'Minsk', offset: '+03:00' },
    { value: 'Europe/Samara', label: 'Samara', offset: '+04:00' },

    // Asia
    { value: 'Asia/Jerusalem', label: 'Jerusalem', offset: '+02:00' },
    { value: 'Asia/Beirut', label: 'Beirut', offset: '+02:00' },
    { value: 'Asia/Amman', label: 'Amman', offset: '+03:00' },
    { value: 'Asia/Riyadh', label: 'Riyadh', offset: '+03:00' },
    { value: 'Asia/Kuwait', label: 'Kuwait', offset: '+03:00' },
    { value: 'Asia/Baghdad', label: 'Baghdad', offset: '+03:00' },
    { value: 'Asia/Tehran', label: 'Tehran', offset: '+03:30' },
    { value: 'Asia/Dubai', label: 'Dubai', offset: '+04:00' },
    { value: 'Asia/Muscat', label: 'Muscat', offset: '+04:00' },
    { value: 'Asia/Baku', label: 'Baku', offset: '+04:00' },
    { value: 'Asia/Tbilisi', label: 'Tbilisi', offset: '+04:00' },
    { value: 'Asia/Yerevan', label: 'Yerevan', offset: '+04:00' },
    { value: 'Asia/Karachi', label: 'Karachi', offset: '+05:00' },
    { value: 'Asia/Tashkent', label: 'Tashkent', offset: '+05:00' },
    { value: 'Asia/Yekaterinburg', label: 'Yekaterinburg', offset: '+05:00' },
    { value: 'Asia/Kolkata', label: 'Mumbai / New Delhi', offset: '+05:30' },
    { value: 'Asia/Colombo', label: 'Colombo', offset: '+05:30' },
    { value: 'Asia/Kathmandu', label: 'Kathmandu', offset: '+05:45' },
    { value: 'Asia/Dhaka', label: 'Dhaka', offset: '+06:00' },
    { value: 'Asia/Almaty', label: 'Almaty', offset: '+06:00' },
    { value: 'Asia/Yangon', label: 'Yangon', offset: '+06:30' },
    { value: 'Asia/Bangkok', label: 'Bangkok', offset: '+07:00' },
    { value: 'Asia/Jakarta', label: 'Jakarta', offset: '+07:00' },
    { value: 'Asia/Ho_Chi_Minh', label: 'Ho Chi Minh City', offset: '+07:00' },
    { value: 'Asia/Phnom_Penh', label: 'Phnom Penh', offset: '+07:00' },
    { value: 'Asia/Novosibirsk', label: 'Novosibirsk', offset: '+07:00' },
    { value: 'Asia/Shanghai', label: 'Shanghai (CST)', offset: '+08:00' },
    { value: 'Asia/Hong_Kong', label: 'Hong Kong', offset: '+08:00' },
    { value: 'Asia/Singapore', label: 'Singapore', offset: '+08:00' },
    { value: 'Asia/Kuala_Lumpur', label: 'Kuala Lumpur', offset: '+08:00' },
    { value: 'Asia/Taipei', label: 'Taipei', offset: '+08:00' },
    { value: 'Asia/Manila', label: 'Manila', offset: '+08:00' },
    { value: 'Asia/Makassar', label: 'Makassar', offset: '+08:00' },
    { value: 'Asia/Tokyo', label: 'Tokyo (JST)', offset: '+09:00' },
    { value: 'Asia/Seoul', label: 'Seoul', offset: '+09:00' },
    { value: 'Asia/Vladivostok', label: 'Vladivostok', offset: '+10:00' },

    // Australia
    { value: 'Australia/Perth', label: 'Perth', offset: '+08:00' },
    { value: 'Australia/Darwin', label: 'Darwin', offset: '+09:30' },
    { value: 'Australia/Adelaide', label: 'Adelaide', offset: '+09:30' },
    { value: 'Australia/Brisbane', label: 'Brisbane', offset: '+10:00' },
    { value: 'Australia/Sydney', label: 'Sydney (AEST)', offset: '+10:00' },
    { value: 'Australia/Melbourne', label: 'Melbourne', offset: '+10:00' },
    { value: 'Australia/Hobart', label: 'Hobart', offset: '+10:00' },

    // Pacific
    { value: 'Pacific/Port_Moresby', label: 'Port Moresby', offset: '+10:00' },
    { value: 'Pacific/Guam', label: 'Guam', offset: '+10:00' },
    { value: 'Pacific/Noumea', label: 'Noumea', offset: '+11:00' },
    { value: 'Pacific/Auckland', label: 'Auckland (NZST)', offset: '+12:00' },
    { value: 'Pacific/Fiji', label: 'Fiji', offset: '+12:00' },
    { value: 'Pacific/Tongatapu', label: 'Tongatapu', offset: '+13:00' },
    { value: 'Pacific/Honolulu', label: 'Honolulu (Hawaii)', offset: '-10:00' },
    { value: 'Pacific/Tahiti', label: 'Tahiti', offset: '-10:00' },
    { value: 'Pacific/Midway', label: 'Midway', offset: '-11:00' },

    // Africa
    { value: 'Africa/Abidjan', label: 'Abidjan', offset: '+00:00' },
    { value: 'Africa/Dakar', label: 'Dakar', offset: '+00:00' },
    { value: 'Africa/Accra', label: 'Accra', offset: '+00:00' },
    { value: 'Africa/Casablanca', label: 'Casablanca', offset: '+01:00' },
    { value: 'Africa/Lagos', label: 'Lagos', offset: '+01:00' },
    { value: 'Africa/Algiers', label: 'Algiers', offset: '+01:00' },
    { value: 'Africa/Tunis', label: 'Tunis', offset: '+01:00' },
    { value: 'Africa/Luanda', label: 'Luanda', offset: '+01:00' },
    { value: 'Africa/Kinshasa', label: 'Kinshasa', offset: '+01:00' },
    { value: 'Africa/Windhoek', label: 'Windhoek', offset: '+02:00' },
    { value: 'Africa/Tripoli', label: 'Tripoli', offset: '+02:00' },
    { value: 'Africa/Cairo', label: 'Cairo', offset: '+02:00' },
    { value: 'Africa/Johannesburg', label: 'Johannesburg', offset: '+02:00' },
    { value: 'Africa/Maputo', label: 'Maputo', offset: '+02:00' },
    { value: 'Africa/Khartoum', label: 'Khartoum', offset: '+02:00' },
    { value: 'Africa/Kampala', label: 'Kampala', offset: '+03:00' },
    { value: 'Africa/Nairobi', label: 'Nairobi', offset: '+03:00' },
    { value: 'Africa/Dar_es_Salaam', label: 'Dar es Salaam', offset: '+03:00' },
    { value: 'Africa/Addis_Ababa', label: 'Addis Ababa', offset: '+03:00' },

    // Atlantic / Indian Ocean
    { value: 'Atlantic/Azores', label: 'Azores', offset: '-01:00' },
    { value: 'Atlantic/Cape_Verde', label: 'Cape Verde', offset: '-01:00' },
    { value: 'Indian/Maldives', label: 'Maldives', offset: '+05:00' },
    { value: 'Indian/Mauritius', label: 'Mauritius', offset: '+04:00' },
    { value: 'Indian/Reunion', label: 'Réunion', offset: '+04:00' },
    { value: 'Indian/Mahe', label: 'Seychelles', offset: '+04:00' },
];

const DATE_FORMATS = [
    { value: 'Y-m-d', label: '2024-01-15' },
    { value: 'd/m/Y', label: '15/01/2024' },
    { value: 'm/d/Y', label: '01/15/2024' },
    { value: 'F j, Y', label: 'January 15, 2024' },
    { value: 'M j, Y', label: 'Jan 15, 2024' },
];

// Import CURRENCIES from lib/currency for the dropdown
import { CURRENCIES } from '@/lib/currency';

const THEME_DEFINITIONS = [
    { value: 'light', labelKey: 'Light' },
    { value: 'dark', labelKey: 'Dark' },
    { value: 'system', labelKey: 'System' },
];

const COLOR_THEME_DEFINITIONS: { value: ColorTheme; labelKey: string; color: string; darkColor: string }[] = [
    { value: 'neutral', labelKey: 'Neutral', color: 'hsl(0 0% 9%)', darkColor: 'hsl(0 0% 98%)' },
    { value: 'blue', labelKey: 'Blue', color: 'hsl(221.2 83.2% 53.3%)', darkColor: 'hsl(217.2 91.2% 59.8%)' },
    { value: 'green', labelKey: 'Green', color: 'hsl(142.1 76.2% 36.3%)', darkColor: 'hsl(142.1 70.6% 45.3%)' },
    { value: 'orange', labelKey: 'Orange', color: 'hsl(24.6 95% 53.1%)', darkColor: 'hsl(20.5 90.2% 48.2%)' },
    { value: 'red', labelKey: 'Red', color: 'hsl(0 72.2% 50.6%)', darkColor: 'hsl(0 72.2% 50.6%)' },
    { value: 'rose', labelKey: 'Rose', color: 'hsl(346.8 77.2% 49.8%)', darkColor: 'hsl(346.8 77.2% 49.8%)' },
    { value: 'violet', labelKey: 'Violet', color: 'hsl(262.1 83.3% 57.8%)', darkColor: 'hsl(263.4 70% 50.4%)' },
    { value: 'yellow', labelKey: 'Yellow', color: 'hsl(47.9 95.8% 53.1%)', darkColor: 'hsl(47.9 95.8% 53.1%)' },
];

export default function GeneralSettingsTab({ settings, languages }: Props) {
    const { t } = useTranslation();

    // Translate theme labels
    const THEMES = THEME_DEFINITIONS.map(theme => ({
        ...theme,
        label: t(theme.labelKey),
    }));

    const COLOR_THEMES = COLOR_THEME_DEFINITIONS.map(theme => ({
        ...theme,
        label: t(theme.labelKey),
    }));
    const logoInputRef = useRef<HTMLInputElement>(null);
    const logoDarkInputRef = useRef<HTMLInputElement>(null);
    const faviconInputRef = useRef<HTMLInputElement>(null);
    const [uploadingLogo, setUploadingLogo] = useState(false);
    const [uploadingLogoDark, setUploadingLogoDark] = useState(false);
    const [uploadingFavicon, setUploadingFavicon] = useState(false);
    const [showPurchaseCode, setShowPurchaseCode] = useState(false);
    const [timezoneOpen, setTimezoneOpen] = useState(false);
    const [timezoneSearch, setTimezoneSearch] = useState('');

    // Gateway compatibility state
    interface GatewayCompatibility {
        compatible: Array<{ slug: string; name: string }>;
        incompatible: Array<{ slug: string; name: string; supported: string[] }>;
    }
    const [compatibility, setCompatibility] = useState<GatewayCompatibility | null>(null);
    const [loadingCompatibility, setLoadingCompatibility] = useState(false);

    const { data, setData, put, processing, errors } = useForm({
        site_name: settings.site_name || '',
        site_description: settings.site_description || '',
        site_tagline: settings.site_tagline || '',
        default_theme: settings.default_theme || 'system',
        color_theme: settings.color_theme || 'neutral',
        default_locale: settings.default_locale || 'en',
        timezone: settings.timezone || 'UTC',
        date_format: settings.date_format || 'Y-m-d',
        landing_page_enabled: settings.landing_page_enabled ?? true,
        default_currency: settings.default_currency || 'USD',
        sentry_enabled: settings.sentry_enabled ?? false,
        purchase_code: '',
    });

    // Apply color theme to document in real-time for instant preview
    // Store original theme to restore on unmount if not saved
    const originalTheme = useRef(settings.color_theme || 'neutral');

    useEffect(() => {
        if (data.color_theme) {
            document.documentElement.setAttribute('data-theme', data.color_theme);
            // Dispatch event for components like ApplicationLogo to update
            window.dispatchEvent(new CustomEvent('colorThemePreview', { detail: data.color_theme }));
        }
    }, [data.color_theme]);

    // Restore original theme on unmount (if user navigates away without saving)
    useEffect(() => {
        const themeToRestore = originalTheme.current;
        return () => {
            document.documentElement.setAttribute('data-theme', themeToRestore);
            window.dispatchEvent(new CustomEvent('colorThemePreview', { detail: null }));
        };
    }, []);

    // Fetch gateway compatibility when currency changes
    useEffect(() => {
        if (data.default_currency) {
            // eslint-disable-next-line react-hooks/set-state-in-effect -- loading flag before async fetch
            setLoadingCompatibility(true);
            fetch(route('admin.settings.currency-compatibility', data.default_currency))
                .then((res) => res.json())
                .then((result: GatewayCompatibility) => {
                    setCompatibility(result);
                    setLoadingCompatibility(false);
                })
                .catch(() => setLoadingCompatibility(false));
        }
    }, [data.default_currency]);

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        put(route('admin.settings.general'), {
            preserveScroll: true,
            onSuccess: () => toast.success(t('General settings updated')),
            onError: () => toast.error(t('Failed to update settings')),
        });
    };

    const handleFileUpload = (type: 'logo' | 'logo_dark' | 'favicon', file: File) => {
        const setUploading = type === 'logo' ? setUploadingLogo : type === 'logo_dark' ? setUploadingLogoDark : setUploadingFavicon;
        setUploading(true);

        router.post(
            route('admin.settings.branding'),
            { type, file },
            {
                forceFormData: true,
                preserveScroll: true,
                onSuccess: () => {
                    toast.success(t('Uploaded successfully'));
                    setUploading(false);
                },
                onError: () => {
                    toast.error(t('Failed to upload'));
                    setUploading(false);
                },
            }
        );
    };

    const handleDeleteBranding = (type: 'logo' | 'logo_dark' | 'favicon') => {
        router.delete(route('admin.settings.branding.delete'), {
            data: { type },
            preserveScroll: true,
            onSuccess: () => toast.success(t('Removed')),
            onError: () => toast.error(t('Failed to remove')),
        });
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>{t('General Settings')}</CardTitle>
                <CardDescription>{t('Configure basic site settings and branding')}</CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={submit} className="space-y-8">
                    {/* Site Identity */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-medium">{t('Site Identity')}</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="site_name">{t('Site Name')}</Label>
                                <Input
                                    id="site_name"
                                    value={data.site_name}
                                    onChange={(e) => setData('site_name', e.target.value)}
                                />
                                {errors.site_name && <p className="text-sm text-destructive">{errors.site_name}</p>}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="site_tagline">{t('Tagline')}</Label>
                                <Input
                                    id="site_tagline"
                                    value={data.site_tagline}
                                    onChange={(e) => setData('site_tagline', e.target.value)}
                                    placeholder={t('A short tagline for your site')}
                                />
                                {errors.site_tagline && <p className="text-sm text-destructive">{errors.site_tagline}</p>}
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="site_description">{t('Site Description')}</Label>
                            <Textarea
                                id="site_description"
                                value={data.site_description}
                                onChange={(e) => setData('site_description', e.target.value)}
                                rows={3}
                                placeholder={t('Describe what your site is about')}
                            />
                            {errors.site_description && <p className="text-sm text-destructive">{errors.site_description}</p>}
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <Label htmlFor="purchase_code">{t('Purchase Code')}</Label>
                                {settings.purchase_code_configured && (
                                    <Badge variant="success" className="text-xs">
                                        {t('Configured')}
                                    </Badge>
                                )}
                            </div>
                            <div className="relative">
                                <Input
                                    id="purchase_code"
                                    type={showPurchaseCode ? 'text' : 'password'}
                                    value={data.purchase_code}
                                    onChange={(e) => setData('purchase_code', e.target.value)}
                                    placeholder={settings.purchase_code_configured ? t('Leave blank to keep existing') : 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'}
                                />
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="absolute end-0 top-0 h-full px-3"
                                    onClick={() => setShowPurchaseCode(!showPurchaseCode)}
                                >
                                    {showPurchaseCode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </Button>
                            </div>
                            <p className="text-xs text-muted-foreground">{t('Your Envato/CodeCanyon purchase code')}</p>
                            {errors.purchase_code && <p className="text-sm text-destructive">{errors.purchase_code}</p>}
                        </div>
                    </div>

                    <Separator />

                    {/* Branding */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-medium">{t('Branding')}</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* Logo */}
                            <div className="space-y-2">
                                <Label>{t('Logo (Light)')}</Label>
                                <div className="flex flex-col gap-2">
                                    {settings.site_logo && (
                                        <div className="relative inline-block">
                                            <img
                                                src={`/storage/${settings.site_logo}`}
                                                alt="Logo"
                                                className="h-12 w-auto object-contain border rounded p-1"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => handleDeleteBranding('logo')}
                                                className="absolute -top-2 -end-2 bg-destructive text-destructive-foreground rounded-full p-1 hover:bg-destructive/90"
                                            >
                                                <X className="h-3 w-3" />
                                            </button>
                                        </div>
                                    )}
                                    <input
                                        ref={logoInputRef}
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) handleFileUpload('logo', file);
                                            e.target.value = '';
                                        }}
                                    />
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        disabled={uploadingLogo}
                                        onClick={() => logoInputRef.current?.click()}
                                    >
                                        {uploadingLogo ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : <Upload className="h-4 w-4 me-2" />}
                                        {t('Upload')}
                                    </Button>
                                </div>
                            </div>

                            {/* Logo Dark */}
                            <div className="space-y-2">
                                <Label>{t('Logo (Dark)')}</Label>
                                <div className="flex flex-col gap-2">
                                    {settings.site_logo_dark && (
                                        <div className="relative inline-block">
                                            <img
                                                src={`/storage/${settings.site_logo_dark}`}
                                                alt="Logo Dark"
                                                className="h-12 w-auto object-contain border rounded p-1 bg-slate-800"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => handleDeleteBranding('logo_dark')}
                                                className="absolute -top-2 -end-2 bg-destructive text-destructive-foreground rounded-full p-1 hover:bg-destructive/90"
                                            >
                                                <X className="h-3 w-3" />
                                            </button>
                                        </div>
                                    )}
                                    <input
                                        ref={logoDarkInputRef}
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) handleFileUpload('logo_dark', file);
                                            e.target.value = '';
                                        }}
                                    />
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        disabled={uploadingLogoDark}
                                        onClick={() => logoDarkInputRef.current?.click()}
                                    >
                                        {uploadingLogoDark ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : <Upload className="h-4 w-4 me-2" />}
                                        {t('Upload')}
                                    </Button>
                                </div>
                            </div>

                            {/* Favicon */}
                            <div className="space-y-2">
                                <Label>{t('Favicon')}</Label>
                                <div className="flex flex-col gap-2">
                                    {settings.site_favicon && (
                                        <div className="relative inline-block">
                                            <img
                                                src={`/storage/${settings.site_favicon}`}
                                                alt="Favicon"
                                                className="h-8 w-8 object-contain border rounded p-1"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => handleDeleteBranding('favicon')}
                                                className="absolute -top-2 -end-2 bg-destructive text-destructive-foreground rounded-full p-1 hover:bg-destructive/90"
                                            >
                                                <X className="h-3 w-3" />
                                            </button>
                                        </div>
                                    )}
                                    <input
                                        ref={faviconInputRef}
                                        type="file"
                                        accept="image/*,.ico"
                                        className="hidden"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) handleFileUpload('favicon', file);
                                            e.target.value = '';
                                        }}
                                    />
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        disabled={uploadingFavicon}
                                        onClick={() => faviconInputRef.current?.click()}
                                    >
                                        {uploadingFavicon ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : <Upload className="h-4 w-4 me-2" />}
                                        {t('Upload')}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <Separator />

                    {/* Preferences */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-medium">{t('Preferences')}</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="default_theme">{t('Default Theme')}</Label>
                                <Select value={data.default_theme} onValueChange={(value) => setData('default_theme', value as 'light' | 'dark' | 'system')}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {THEMES.map((theme) => (
                                            <SelectItem key={theme.value} value={theme.value}>
                                                {theme.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>{t('Color Theme')}</Label>
                                <div className="grid grid-cols-4 gap-2">
                                    {COLOR_THEMES.map((theme) => (
                                        <button
                                            key={theme.value}
                                            type="button"
                                            onClick={() => setData('color_theme', theme.value)}
                                            className={`
                                                flex flex-col items-center gap-1.5 p-2 rounded-lg border-2 transition-all
                                                ${data.color_theme === theme.value
                                                    ? 'border-primary bg-accent'
                                                    : 'border-transparent hover:border-muted-foreground/20 hover:bg-accent/50'
                                                }
                                            `}
                                        >
                                            <div
                                                className="w-8 h-8 rounded-full border-2 border-border shadow-sm"
                                                style={{ backgroundColor: theme.color }}
                                            />
                                            <span className="text-xs font-medium">{theme.label}</span>
                                        </button>
                                    ))}
                                </div>
                                {errors.color_theme && <p className="text-sm text-destructive">{errors.color_theme}</p>}
                            </div>
                        </div>

                        {/* Language, Timezone, Date Format in 3 columns */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="default_locale">{t('Language')}</Label>
                                <Select value={data.default_locale} onValueChange={(value) => setData('default_locale', value)}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {languages.map((language) => (
                                            <SelectItem key={language.code} value={language.code}>
                                                {language.native_name} ({language.name})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="timezone">{t('Timezone')}</Label>
                                <Popover open={timezoneOpen} onOpenChange={setTimezoneOpen}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            role="combobox"
                                            aria-expanded={timezoneOpen}
                                            className="w-full justify-between font-normal"
                                        >
                                            <span className="truncate">
                                                {TIMEZONES.find((tz) => tz.value === data.timezone)?.label ?? t('Select timezone')}
                                                {' '}
                                                <span className="text-muted-foreground">
                                                    ({TIMEZONES.find((tz) => tz.value === data.timezone)?.offset ?? ''})
                                                </span>
                                            </span>
                                            <ChevronsUpDown className="ms-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                                        <div className="p-2 border-b">
                                            <Input
                                                autoFocus
                                                placeholder={t('Search timezone...')}
                                                value={timezoneSearch}
                                                onChange={(e) => setTimezoneSearch(e.target.value)}
                                                className="h-8"
                                            />
                                        </div>
                                        <div className="max-h-[300px] overflow-y-auto p-1">
                                            {(() => {
                                                const search = timezoneSearch.toLowerCase();
                                                const filtered = TIMEZONES.filter(
                                                    (tz) =>
                                                        tz.label.toLowerCase().includes(search) ||
                                                        tz.value.toLowerCase().includes(search) ||
                                                        tz.offset.includes(timezoneSearch)
                                                );
                                                if (filtered.length === 0) {
                                                    return (
                                                        <p className="text-sm text-muted-foreground text-center py-4">
                                                            {t('No timezone found')}
                                                        </p>
                                                    );
                                                }
                                                return filtered.map((tz) => (
                                                    <button
                                                        key={tz.value}
                                                        type="button"
                                                        className={`w-full flex items-center gap-2 text-start px-2 py-1.5 text-sm rounded-sm cursor-pointer hover:bg-accent ${
                                                            data.timezone === tz.value ? 'bg-accent font-medium' : ''
                                                        }`}
                                                        onClick={() => {
                                                            setData('timezone', tz.value);
                                                            setTimezoneOpen(false);
                                                            setTimezoneSearch('');
                                                        }}
                                                    >
                                                        <Check
                                                            className={`h-4 w-4 shrink-0 ${
                                                                data.timezone === tz.value ? 'opacity-100' : 'opacity-0'
                                                            }`}
                                                        />
                                                        <span className="truncate">{tz.label}</span>
                                                        <span className="ms-auto text-muted-foreground text-xs shrink-0">{tz.offset}</span>
                                                    </button>
                                                ));
                                            })()}
                                        </div>
                                    </PopoverContent>
                                </Popover>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="date_format">{t('Date Format')}</Label>
                                <Select value={data.date_format} onValueChange={(value) => setData('date_format', value)}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {DATE_FORMATS.map((fmt) => (
                                            <SelectItem key={fmt.value} value={fmt.value}>
                                                {fmt.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="default_currency">{t('Default Currency')}</Label>
                            <Select value={data.default_currency} onValueChange={(value) => setData('default_currency', value)}>
                                <SelectTrigger>
                                    <SelectValue placeholder={t('Select currency')} />
                                </SelectTrigger>
                                <SelectContent className="max-h-[300px]">
                                    {CURRENCIES.map((currency) => (
                                        <SelectItem key={currency.value} value={currency.value}>
                                            {currency.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">{t('Currency used for all plans and transactions')}</p>
                            {errors.default_currency && <p className="text-sm text-destructive">{errors.default_currency}</p>}

                            {/* Gateway Compatibility Check */}
                            {loadingCompatibility ? (
                                <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    {t('Checking gateway compatibility...')}
                                </div>
                            ) : (
                                compatibility &&
                                (compatibility.compatible.length > 0 || compatibility.incompatible.length > 0) && (
                                    <div className="mt-3 rounded-lg border p-3 space-y-2">
                                        <p className="text-sm font-medium">{t('Payment Gateway Compatibility')}</p>

                                        {compatibility.compatible.map((gw) => (
                                            <div key={gw.slug} className="flex items-center gap-2 text-sm">
                                                <CheckCircle className="h-4 w-4 text-success shrink-0" />
                                                <span>{gw.name}</span>
                                                <span className="text-muted-foreground">
                                                    - {t('Supports')} {data.default_currency}
                                                </span>
                                            </div>
                                        ))}

                                        {compatibility.incompatible.map((gw) => (
                                            <div key={gw.slug} className="flex items-start gap-2 text-sm">
                                                <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                                                <div>
                                                    <span className="font-medium">{gw.name}</span>
                                                    <span className="text-destructive">
                                                        {' '}
                                                        - {t('Does NOT support')} {data.default_currency}
                                                    </span>
                                                    <p className="text-xs text-muted-foreground">
                                                        {t('Supports')}: {gw.supported.slice(0, 8).join(', ')}
                                                        {gw.supported.length > 8 && '...'}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}

                                        {compatibility.incompatible.length > 0 && (
                                            <p className="text-xs text-warning pt-2 border-t">
                                                {t('{count} gateway(s) will be hidden from checkout', {
                                                    count: compatibility.incompatible.length,
                                                })}
                                            </p>
                                        )}
                                    </div>
                                )
                            )}
                        </div>

                        <div className="flex items-center justify-between p-4 border rounded-lg">
                            <div className="space-y-0.5">
                                <Label>{t('Landing Page')}</Label>
                                <p className="text-sm text-muted-foreground">{t('Enable the public landing page for visitors')}</p>
                            </div>
                            <Switch
                                checked={data.landing_page_enabled}
                                onCheckedChange={(checked) => setData('landing_page_enabled', checked)}
                            />
                        </div>

                        <div className="flex items-center justify-between p-4 border rounded-lg">
                            <div className="space-y-0.5">
                                <Label className="flex items-center gap-2">
                                    <Bug className="h-4 w-4" />
                                    {t('Error Reporting')}
                                </Label>
                                <p className="text-sm text-muted-foreground">{t('Automatically report application errors for analysis')}</p>
                            </div>
                            <Switch
                                checked={data.sentry_enabled}
                                onCheckedChange={(checked) => setData('sentry_enabled', checked)}
                            />
                        </div>
                    </div>

                    {/* Submit */}
                    <div className="flex items-center gap-4">
                        <Button type="submit" disabled={processing}>
                            {processing ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : <Save className="h-4 w-4 me-2" />}
                            {t('Save Changes')}
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}
