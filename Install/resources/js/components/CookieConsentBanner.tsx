import { useState, useEffect, useMemo } from 'react';
import { usePage, router } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { PageProps } from '@/types';
import { X } from 'lucide-react';

interface ConsentPreferences {
    essential: boolean;
    analytics: boolean;
    marketing: boolean;
    functional: boolean;
}

const CONSENT_STORAGE_KEY = 'cookie_consent';
const CONSENT_VERSION = '1.0';

function getStoredConsent(): { preferences: ConsentPreferences; hasValidConsent: boolean } {
    const defaultPreferences: ConsentPreferences = {
        essential: true,
        analytics: false,
        marketing: false,
        functional: false,
    };

    if (typeof window === 'undefined') {
        return { preferences: defaultPreferences, hasValidConsent: false };
    }

    try {
        const storedConsent = localStorage.getItem(CONSENT_STORAGE_KEY);
        if (storedConsent) {
            const parsed = JSON.parse(storedConsent);
            if (parsed.version === CONSENT_VERSION) {
                return { preferences: parsed.preferences, hasValidConsent: true };
            }
        }
    } catch {
        // Invalid stored consent
    }

    return { preferences: defaultPreferences, hasValidConsent: false };
}

export default function CookieConsentBanner() {
    const { appSettings, auth } = usePage<PageProps>().props;

    const initialState = useMemo(() => getStoredConsent(), []);
    const [showBanner, setShowBanner] = useState(false);
    const [showPreferences, setShowPreferences] = useState(false);
    const [preferences, setPreferences] = useState<ConsentPreferences>(initialState.preferences);

    useEffect(() => {
        // Only show if cookie consent is enabled and no valid consent exists
        if (!appSettings.cookie_consent_enabled || initialState.hasValidConsent) {
            return;
        }

        // Show banner after a short delay for better UX
        const timer = setTimeout(() => setShowBanner(true), 1000);
        return () => clearTimeout(timer);
    }, [appSettings.cookie_consent_enabled, initialState.hasValidConsent]);

    const saveConsent = (prefs: ConsentPreferences) => {
        const consentData = {
            version: CONSENT_VERSION,
            preferences: prefs,
            timestamp: new Date().toISOString(),
        };

        // Save to localStorage
        localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(consentData));

        // If user is logged in, also save to database
        if (auth.user) {
            router.post(
                route('cookie-consent.store'),
                {
                    analytics: prefs.analytics,
                    marketing: prefs.marketing,
                    functional: prefs.functional,
                },
                {
                    preserveScroll: true,
                    preserveState: true,
                }
            );
        }

        setShowBanner(false);
        setShowPreferences(false);
    };

    const handleAcceptAll = () => {
        const allAccepted: ConsentPreferences = {
            essential: true,
            analytics: true,
            marketing: true,
            functional: true,
        };
        setPreferences(allAccepted);
        saveConsent(allAccepted);
    };

    const handleAcceptEssential = () => {
        const essentialOnly: ConsentPreferences = {
            essential: true,
            analytics: false,
            marketing: false,
            functional: false,
        };
        setPreferences(essentialOnly);
        saveConsent(essentialOnly);
    };

    const handleSavePreferences = () => {
        saveConsent(preferences);
    };

    if (!showBanner) {
        return null;
    }

    return (
        <div className="fixed bottom-0 left-0 right-0 z-50">
            {showPreferences ? (
                <Card className="mx-4 sm:mx-auto max-w-2xl mb-4 bg-[#0a0a0a]/90 backdrop-blur-xl border border-primary/10 shadow-[0_0_50px_rgba(0,0,0,0.5)] rounded-[2.5rem] overflow-hidden translate-z-0">
                    <CardHeader className="border-b border-white/5">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-white font-black uppercase tracking-[0.2em] text-sm">Cookie Preferences</CardTitle>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setShowPreferences(false)}
                                className="h-8 w-8 -mr-2 text-white/40 hover:text-white hover:bg-white/10 rounded-full transition-all duration-200"
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4 -mt-2">
                        <div className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5">
                            <div className="space-y-0.5">
                                <Label className="text-sm font-bold text-white">Essential Cookies</Label>
                                <p className="text-xs text-white/50">
                                    Required for the website to function properly.
                                </p>
                            </div>
                            <Switch checked disabled className="data-[state=checked]:bg-primary" />
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label className="text-sm font-medium">Analytics Cookies</Label>
                                <p className="text-xs text-muted-foreground">
                                    Help us understand how visitors interact with our website.
                                </p>
                            </div>
                            <Switch
                                checked={preferences.analytics}
                                onCheckedChange={(checked) =>
                                    setPreferences((prev) => ({ ...prev, analytics: checked }))
                                }
                            />
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label className="text-sm font-medium">Marketing Cookies</Label>
                                <p className="text-xs text-muted-foreground">
                                    Used to deliver personalized advertisements.
                                </p>
                            </div>
                            <Switch
                                checked={preferences.marketing}
                                onCheckedChange={(checked) =>
                                    setPreferences((prev) => ({ ...prev, marketing: checked }))
                                }
                            />
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label className="text-sm font-medium">Functional Cookies</Label>
                                <p className="text-xs text-muted-foreground">
                                    Enable enhanced functionality and personalization.
                                </p>
                            </div>
                            <Switch
                                checked={preferences.functional}
                                onCheckedChange={(checked) =>
                                    setPreferences((prev) => ({ ...prev, functional: checked }))
                                }
                            />
                        </div>

                        <div className="flex justify-end gap-3 pt-6 border-t border-white/5">
                            <Button variant="outline" onClick={handleAcceptEssential} className="rounded-xl border-white/10 hover:bg-white/5 text-xs font-bold uppercase tracking-widest transition-all duration-200">
                                Essential Only
                            </Button>
                            <Button onClick={handleSavePreferences} className="rounded-xl bg-primary text-primary-foreground text-xs font-bold uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all duration-200">
                                Save Preferences
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <div className="bg-[#0a0a0a]/80 backdrop-blur-xl border-t border-white/10 shadow-2xl translate-z-0">
                    <div className="px-4 sm:px-6 lg:px-8 py-4">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 max-w-7xl mx-auto">
                            <div className="flex-1 min-w-0">
                                <h3 className="font-black text-white leading-none tracking-tight mb-2 uppercase text-xs tracking-[0.2em] text-primary">
                                    Privacy.Protocol_Active
                                </h3>
                                <p className="text-sm text-white/70 font-medium leading-relaxed">
                                    We use cookies to enhance your browsing experience, serve
                                    personalized content, and analyze our traffic. By clicking
                                    "Accept All", you consent to our use of cookies.
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-3 shrink-0">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setShowPreferences(true)}
                                    className="rounded-xl border-white/10 hover:bg-white/5 text-[10px] font-black uppercase tracking-widest transition-all duration-200"
                                >
                                    Manage
                                </Button>
                                <Button variant="outline" size="sm" onClick={handleAcceptEssential} className="rounded-xl border-white/10 hover:bg-white/5 text-[10px] font-black uppercase tracking-widest transition-all duration-200">
                                    Essential Only
                                </Button>
                                <Button size="sm" onClick={handleAcceptAll} className="rounded-xl bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-widest hover:scale-[1.05] active:scale-95 transition-all duration-200 shadow-lg shadow-primary/20">
                                    Accept All
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
