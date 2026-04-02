import { useTranslation } from '@/contexts/LanguageContext';

const defaultCompanies = [
    { name: 'TechFlow', initial: 'T', color: 'bg-blue-500' },
    { name: 'BuildCorp', initial: 'B', color: 'bg-green-500' },
    { name: 'DataSync', initial: 'D', color: 'bg-purple-500' },
    { name: 'CloudBase', initial: 'C', color: 'bg-orange-500' },
    { name: 'DevStack', initial: 'S', color: 'bg-pink-500' },
];

interface LogoItem {
    name: string;
    initial: string;
    color: string;
    image_url?: string | null;
}

interface TrustedByProps {
    content?: Record<string, unknown>;
    items?: LogoItem[];
    settings?: Record<string, unknown>;
}

function CompanyBadge({ company }: { company: LogoItem }) {
    return (
        <div className="flex items-center gap-2 grayscale opacity-50 hover:grayscale-0 hover:opacity-100 transition-all duration-300 shrink-0 cursor-default group">
            {company.image_url ? (
                <img
                    src={company.image_url}
                    alt={company.name}
                    className="h-5 sm:h-7 w-auto max-w-[100px] sm:max-w-[120px] object-contain"
                />
            ) : (
                <>
                    <div className={`h-6 w-6 sm:h-8 sm:w-8 rounded-lg ${company.color} flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow`}>
                        <span className="text-white text-[10px] sm:text-xs font-bold leading-none">
                            {company.initial}
                        </span>
                    </div>
                    <span className="font-semibold text-sm sm:text-base tracking-tight whitespace-nowrap text-foreground/80 group-hover:text-foreground">
                        {company.name}
                    </span>
                </>
            )}
        </div>
    );
}

export function TrustedBy({ content, items, settings: _settings }: TrustedByProps = {}) {
    const { t, isRtl } = useTranslation();

    // Use database items if provided, otherwise fall back to static data
    const companies = items?.length ? items : defaultCompanies;

    // Get content with defaults - DB content takes priority
    const title = (content?.title as string) || t('Trusted by teams at');

    return (
        <div className="text-center">
            <p className="text-xs sm:text-sm text-muted-foreground mb-3 sm:mb-4">
                {title}
            </p>

            {/* Mobile: Marquee */}
            <div className="sm:hidden overflow-hidden">
                <div className={`flex gap-8 ${isRtl ? 'animate-marquee-rtl-slow' : 'animate-marquee-slow'}`}>
                    {[...companies, ...companies].map((company, index) => (
                        <CompanyBadge key={`${company.name}-${index}`} company={company} />
                    ))}
                </div>
            </div>

            {/* Desktop: Static flex */}
            <div className="hidden sm:flex flex-wrap items-center justify-center gap-8 md:gap-10 lg:gap-12">
                {companies.map((company) => (
                    <CompanyBadge key={company.name} company={company} />
                ))}
            </div>
        </div>
    );
}
