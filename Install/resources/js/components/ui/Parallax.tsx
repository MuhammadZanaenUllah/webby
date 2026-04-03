import React, { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface ParallaxProps {
    children?: React.ReactNode;
    speed?: number; // 0.1 is slow, 0.5 is fast. Negative values reverse direction.
    direction?: 'vertical' | 'horizontal';
    className?: string;
    disabled?: boolean;
}

export function Parallax({
    children,
    speed = 0.1,
    direction = 'vertical',
    className,
    disabled = false,
}: ParallaxProps) {
    const targetRef = useRef<HTMLDivElement>(null);
    const [offset, setOffset] = useState(0);
    const [isVisible, setIsVisible] = useState(false);
    const [reducedMotion, setReducedMotion] = useState(false);
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        // Check for mobile
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);

        // Check for reduced motion preference
        const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        setReducedMotion(mediaQuery.matches);

        const handleChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
        mediaQuery.addEventListener('change', handleChange);
        return () => {
            mediaQuery.removeEventListener('change', handleChange);
            window.removeEventListener('resize', checkMobile);
        };
    }, []);

    useEffect(() => {
        if (disabled || reducedMotion || isMobile) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                setIsVisible(entry.isIntersecting);
            },
            { threshold: 0 }
        );

        if (targetRef.current) {
            observer.observe(targetRef.current);
        }

        return () => {
            if (targetRef.current) {
                // eslint-disable-next-line react-hooks/exhaustive-deps
                observer.unobserve(targetRef.current);
            }
        };
    }, [disabled, reducedMotion]);

    useEffect(() => {
        if (disabled || reducedMotion || isMobile || !isVisible) return;

        let ticking = false;

        const handleScroll = () => {
            if (!ticking) {
                window.requestAnimationFrame(() => {
                    if (targetRef.current) {
                        const target = targetRef.current;
                        const scrollY = window.scrollY;
                        const viewportHeight = window.innerHeight;
                        
                        // Calculate element position relative to viewport without reflow
                        // We use offsetTop because it's cheaper. For nested positioning, we might need more logic
                        // but for most landing page sections, offsetTop works well.
                        const elementTop = target.offsetTop;
                        const elementCenter = elementTop + target.offsetHeight / 2;
                        const viewportCenter = scrollY + viewportHeight / 2;
                        const delta = elementCenter - viewportCenter;
                        
                        setOffset(delta * speed * 3); 
                    }
                    ticking = false;
                });
                ticking = true;
            }
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        handleScroll();

        return () => window.removeEventListener('scroll', handleScroll);
    }, [disabled, reducedMotion, isMobile, isVisible, speed]);

    const transform = direction === 'vertical' 
        ? `translate3d(0, ${offset}px, 0)` 
        : `translate3d(${offset}px, 0, 0)`;

    return (
        <div
            ref={targetRef}
            className={cn('will-change-transform transition-none', className)}
            style={{
                transform: disabled || reducedMotion || isMobile ? 'none' : transform,
            }}
        >
            {children}
        </div>
    );
}
