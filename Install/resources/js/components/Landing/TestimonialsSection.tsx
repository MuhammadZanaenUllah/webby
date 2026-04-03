import { useCallback, useEffect, useMemo, useState } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import Autoplay from 'embla-carousel-autoplay';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Star, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/contexts/LanguageContext';
import { getTranslatedTestimonials, type TestimonialItem } from './data';
import { Parallax } from '@/components/ui/Parallax';
import { cn } from '@/lib/utils';

interface TestimonialsSectionProps {
    content?: Record<string, unknown>;
    items?: TestimonialItem[];
    settings?: Record<string, unknown>;
}

function StarRating({ rating }: { rating: number }) {
    return (
        <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map((star) => (
                <Star
                    key={star}
                    className={`h-4 w-4 ${
                        star <= rating
                            ? 'fill-yellow-400 text-yellow-400'
                            : 'fill-muted text-muted'
                    }`}
                />
            ))}
        </div>
    );
}

function getInitials(name: string): string {
    return name
        .split(' ')
        .map((word) => word[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
}

export function TestimonialsSection({ content, items, settings: _settings }: TestimonialsSectionProps = {}) {
    const { t } = useTranslation();

    // Use database items if provided, otherwise fall back to translated defaults
    const testimonials = items?.length ? items : getTranslatedTestimonials(t);

    // Get content with defaults - DB content takes priority
    const title = (content?.title as string) || t('What our users say');
    const subtitle = (content?.subtitle as string) || t('Join thousands of satisfied developers and teams who have transformed their workflow.');

    return (
        <section id="testimonials" className="py-32 lg:py-64 bg-[#0a0a0a] relative overflow-hidden">
            {/* Top HUD Line */}
            <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
            
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                {/* Section Header */}
                <div className="text-center mb-32 animate-fade-in">
                    <div className="text-primary text-[10px] font-black uppercase tracking-[0.5em] mb-6">
                        [ User_Intelligence.v4 ]
                    </div>
                    <h2 className="text-5xl md:text-8xl font-black tracking-tighter mb-8 text-white leading-[0.9]">
                        {title}
                    </h2>
                    <p className="text-lg text-neutral-500 max-w-2xl mx-auto font-medium">
                        {subtitle}
                    </p>
                </div>

                {/* Floating Mesh of Testimonials */}
                <div className="relative h-[1200px] md:h-[800px] w-full mt-24">
                    {/* Background Noise/Mesh */}
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(var(--primary-rgb),0.02)_0%,transparent_70%)]" />

                    {testimonials.map((testimonial, index) => {
                        // Deterministic but "random" looking positions
                        const positions = [
                            { top: '0%', left: '0%', speed: 0.1, rotate: -2 },
                            { top: '10%', left: '60%', speed: -0.08, rotate: 3 },
                            { top: '40%', left: '10%', speed: 0.12, rotate: 1 },
                            { top: '50%', left: '70%', speed: -0.1, rotate: -3 },
                            { top: '75%', left: '30%', speed: 0.05, rotate: 2 },
                            { top: '85%', left: '75%', speed: -0.05, rotate: -1 },
                        ];
                        const pos = positions[index % positions.length];

                        return (
                            <div
                                key={index}
                                className="absolute w-[320px] md:w-[380px] group will-change-transform"
                                style={{ 
                                    top: pos.top, 
                                    left: pos.left,
                                    transform: `rotate(${pos.rotate}deg) translateZ(0)`,
                                }}
                            >
                                <Parallax speed={pos.speed}>
                                    <div className="p-8 rounded-[2.5rem] border border-white/5 bg-white/[0.02] backdrop-blur-xl transition-all duration-700 group-hover:border-primary/40 group-hover:bg-white/[0.05] group-hover:-translate-y-4 shadow-2xl overflow-hidden relative">
                                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-100 transition-opacity">
                                            <Star className="h-4 w-4 fill-primary text-primary" />
                                        </div>
                                        
                                        <blockquote className="text-lg font-bold tracking-tight text-white mb-10 leading-relaxed italic relative z-10">
                                            "{testimonial.quote}"
                                        </blockquote>

                                        <div className="flex items-center gap-4 pt-8 border-t border-white/5 relative z-10">
                                            <Avatar className="h-12 w-12 rounded-2xl border border-white/10">
                                                {testimonial.avatar && (
                                                    <AvatarImage src={testimonial.avatar} alt={testimonial.author} className="object-cover" />
                                                )}
                                                <AvatarFallback className="bg-primary text-primary-foreground font-black text-xs">
                                                    {getInitials(testimonial.author)}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div>
                                                <div className="font-black text-white text-sm tracking-tight">{testimonial.author}</div>
                                                <div className="text-[9px] font-black uppercase tracking-[0.2em] text-primary/70">{testimonial.role}</div>
                                            </div>
                                        </div>
                                        
                                        {/* HUD Accent */}
                                        <div className="absolute bottom-4 right-8 text-[8px] font-mono font-black text-white/5 uppercase tracking-[0.3em] group-hover:text-primary/20 transition-colors">
                                            Ref_ID: {index + 2048}
                                        </div>
                                    </div>
                                </Parallax>
                            </div>
                        );
                    })}
                </div>
            </div>
            {/* Bottom HUD Line */}
            <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
        </section>
    );
}
