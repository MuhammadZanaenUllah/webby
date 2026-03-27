import { FormEventHandler, useState } from 'react';
import { useForm } from '@inertiajs/react';
import { useTranslation } from '@/contexts/LanguageContext';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Save, Loader2, AlertTriangle, Download } from 'lucide-react';
import { toast } from 'sonner';
import type { PromptsSettings } from './types';

interface Props {
    settings: PromptsSettings;
}

export default function PromptsSettingsTab({ settings }: Props) {
    const { t } = useTranslation();
    const [loadingDefaults, setLoadingDefaults] = useState(false);
    const { data, setData, put, processing, errors } = useForm({
        builder_system_prompt: settings.builder_system_prompt || '',
        builder_compact_prompt: settings.builder_compact_prompt || '',
    });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        put(route('admin.settings.prompts'), {
            preserveScroll: true,
            onSuccess: () => toast.success(t('Prompt settings updated')),
            onError: () => toast.error(t('Failed to update settings')),
        });
    };

    const loadDefaults = async (field: 'builder_system_prompt' | 'builder_compact_prompt') => {
        setLoadingDefaults(true);
        try {
            const response = await fetch(route('admin.settings.default-prompts'));
            const json = await response.json();
            if (response.ok) {
                const key = field === 'builder_system_prompt' ? 'system_prompt' : 'compact_prompt';
                setData(field, json[key] || '');
                toast.success(t('Default prompt loaded'));
            } else {
                toast.error(json.error || t('Failed to load defaults'));
            }
        } catch {
            toast.error(t('Failed to connect to builder'));
        }
        setLoadingDefaults(false);
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>{t('AI System Prompts')}</CardTitle>
                <CardDescription>{t('Customize the system prompts sent to the AI builder agent')}</CardDescription>
            </CardHeader>
            <CardContent>
                <Alert variant="destructive" className="mb-6">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                        {t('Editing the system prompt can significantly impact AI behavior. Only modify if you understand the prompt structure. Leave empty to use the built-in defaults.')}
                    </AlertDescription>
                </Alert>

                <form onSubmit={submit} className="space-y-6">
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label>{t('System Prompt (Full)')}</Label>
                            <Button
                                type="button" variant="outline" size="sm"
                                disabled={loadingDefaults}
                                onClick={() => loadDefaults('builder_system_prompt')}
                            >
                                <Download className="h-3 w-3 me-1" />
                                {t('Load Default')}
                            </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {t('Used for premium AI models. Use {{PROJECT_NAME}} as a placeholder. Leave empty for default.')}
                        </p>
                        <Textarea
                            value={data.builder_system_prompt}
                            onChange={(e) => setData('builder_system_prompt', e.target.value)}
                            rows={20}
                            className="font-mono text-xs"
                            placeholder={t('Leave empty to use built-in default prompt...')}
                        />
                        {errors.builder_system_prompt && (
                            <p className="text-sm text-destructive">{errors.builder_system_prompt}</p>
                        )}
                    </div>

                    <Separator />

                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label>{t('System Prompt (Compact)')}</Label>
                            <Button
                                type="button" variant="outline" size="sm"
                                disabled={loadingDefaults}
                                onClick={() => loadDefaults('builder_compact_prompt')}
                            >
                                <Download className="h-3 w-3 me-1" />
                                {t('Load Default')}
                            </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {t('Used for standard-tier AI models (shorter). Use {{PROJECT_NAME}} as a placeholder. Leave empty for default.')}
                        </p>
                        <Textarea
                            value={data.builder_compact_prompt}
                            onChange={(e) => setData('builder_compact_prompt', e.target.value)}
                            rows={12}
                            className="font-mono text-xs"
                            placeholder={t('Leave empty to use built-in default compact prompt...')}
                        />
                        {errors.builder_compact_prompt && (
                            <p className="text-sm text-destructive">{errors.builder_compact_prompt}</p>
                        )}
                    </div>

                    <Button type="submit" disabled={processing}>
                        {processing ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : <Save className="h-4 w-4 me-2" />}
                        {t('Save Changes')}
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
}
