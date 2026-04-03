import { useState } from 'react';
import { ChevronRight, Terminal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/contexts/LanguageContext';
import { getTranslatedFAQs } from './data';

interface FAQItem {
    question: string;
    answer: string;
}

interface FAQSectionProps {
    content?: Record<string, unknown>;
    items?: FAQItem[];
    settings?: Record<string, unknown>;
}

export function FAQSection({ content, items, settings: _settings }: FAQSectionProps = {}) {
    const { t } = useTranslation();
    const [activeIndex, setActiveIndex] = useState<number>(0);

    // Use database items if provided, otherwise fall back to translated defaults
    const faqs = items?.length ? items : getTranslatedFAQs(t);

    // Get content with defaults - DB content takes priority
    const title = (content?.title as string) || t('Frequently asked questions');
    const subtitle = (content?.subtitle as string) || t('Have a different question? Reach out to our support team.');

    return (
        <section id="faq" className="py-32 lg:py-48 bg-background relative overflow-hidden transition-colors duration-300">
            {/* Top HUD Line */}
            <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
            
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                <div className="flex flex-col lg:flex-row gap-24 items-start">
                    {/* Left: Questions List (60%) */}
                    <div className="w-full lg:w-[60%]">
                        <div className="mb-20 animate-fade-in">
                            <div className="text-primary text-[10px] font-black uppercase tracking-[0.5em] mb-6">
                                [ System_Inquiry.v4 ]
                            </div>
                            <h2 className="text-5xl md:text-7xl font-black tracking-tighter mb-8 text-foreground leading-[0.9]">
                                {title}
                            </h2>
                            <p className="text-lg text-muted-foreground max-w-xl font-medium">
                                {subtitle}
                            </p>
                        </div>

                        <div className="space-y-4">
                            {faqs.map((faq, index) => (
                                <button
                                    key={index}
                                    onClick={() => setActiveIndex(index)}
                                    className={cn(
                                        "w-full text-left p-8 rounded-3xl border transition-all duration-200 group flex items-center justify-between overflow-hidden relative",
                                        activeIndex === index 
                                            ? "border-primary bg-primary/5 shadow-[0_0_50px_rgba(var(--primary-rgb),0.1)]" 
                                            : "border-primary/10 hover:border-primary/30 bg-primary/5"
                                    )}
                                >
                                    <div className="flex items-center gap-6 relative z-10">
                                        <div className={cn(
                                            "w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-200 font-mono text-xs font-black",
                                            activeIndex === index ? "bg-primary text-primary-foreground" : "bg-primary/5 text-muted-foreground group-hover:bg-primary/10"
                                        )}>
                                            0{index + 1}
                                        </div>
                                        <span className={cn(
                                            "text-xl font-black tracking-tight transition-colors",
                                            activeIndex === index ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"
                                        )}>
                                            {faq.question}
                                        </span>
                                    </div>
                                    <ChevronRight className={cn(
                                        "h-6 w-6 transition-all duration-200 relative z-10",
                                        activeIndex === index ? "text-primary translate-x-0" : "text-muted-foreground/40 group-hover:translate-x-2"
                                    )} />
                                    
                                    {activeIndex === index && (
                                        <div className="absolute left-0 top-0 h-full w-1 bg-primary" />
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Right: Active Briefing (40%) */}
                    <div className="w-full lg:w-[40%] sticky top-32 translate-z-0">
                        <div className="relative p-10 rounded-[3rem] border border-primary/10 bg-primary/5 backdrop-blur-md overflow-hidden min-h-[500px] flex flex-col translate-z-0 will-change-transform">
                            {/* HUD Ornaments */}
                            <div className="absolute top-10 left-10 right-10 flex justify-between items-center pb-8 border-b border-primary/10">
                                <div className="flex items-center gap-3">
                                    <Terminal className="w-4 h-4 text-primary" />
                                    <span className="text-[10px] font-mono font-black uppercase tracking-[0.3em] text-muted-foreground">Briefing.Output</span>
                                </div>
                                <div className="flex gap-1.5">
                                    <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                                    <div className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-pulse animation-delay-2000" />
                                </div>
                            </div>

                            <div className="mt-24 relative z-10 flex-grow">
                                <div className="text-[10px] font-mono font-black text-primary/70 mb-8 flex gap-4 uppercase tracking-[0.2em]">
                                    <span>id: FAQ_M0{activeIndex + 1}</span>
                                    <span>status: confirmed</span>
                                </div>
                                
                                <h4 className="text-3xl font-black tracking-tight text-foreground mb-8 leading-tight">
                                    {faqs[activeIndex].question}
                                </h4>
                                
                                <p className="text-lg text-muted-foreground font-medium leading-[1.8]">
                                    {faqs[activeIndex].answer}
                                </p>
                            </div>

                            {/* Bottom HUD Decoration */}
                            <div className="mt-auto pt-10 border-t border-primary/10">
                                <div className="grid grid-cols-3 gap-2 opacity-20">
                                    {[...Array(6)].map((_, i) => (
                                        <div key={i} className="h-1 bg-primary/10 rounded-full" />
                                    ))}
                                </div>
                            </div>

                            {/* Background Glow */}
                            <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-primary/5 rounded-full blur-[100px]" />
                        </div>
                    </div>
                </div>
            </div>
            {/* Bottom HUD Line */}
            <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
        </section>
    );
}
