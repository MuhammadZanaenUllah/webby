import React from 'react';
import { cn } from '@/lib/utils';

interface CircuitLinesProps {
    className?: string;
    direction?: 'down' | 'right';
}

export function CircuitLines({ className, direction = 'down' }: CircuitLinesProps) {
    return (
        <div className={cn("absolute pointer-events-none opacity-20", className)}>
            <svg
                width={direction === 'down' ? "40" : "200"}
                height={direction === 'down' ? "200" : "40"}
                viewBox={direction === 'down' ? "0 0 40 200" : "0 0 200 40"}
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
            >
                {direction === 'down' ? (
                    <>
                        <path d="M20 0V200" stroke="var(--primary)" strokeWidth="1" strokeDasharray="4 4" />
                        <circle cx="20" cy="0" r="3" fill="var(--primary)" />
                        <circle cx="20" cy="200" r="3" fill="var(--primary)" />
                        {/* Animated pulse */}
                        <circle cx="20" cy="0" r="2" fill="var(--primary)">
                            <animate
                                attributeName="cy"
                                from="0"
                                to="200"
                                dur="3s"
                                repeatCount="indefinite"
                            />
                            <animate
                                attributeName="opacity"
                                values="0;1;0"
                                dur="3s"
                                repeatCount="indefinite"
                            />
                        </circle>
                    </>
                ) : (
                    <>
                        <path d="M0 20H200" stroke="var(--primary)" strokeWidth="1" strokeDasharray="4 4" />
                        <circle cx="0" cy="20" r="3" fill="var(--primary)" />
                        <circle cx="200" cy="20" r="3" fill="var(--primary)" />
                        {/* Animated pulse */}
                        <circle cx="0" cy="20" r="2" fill="var(--primary)">
                            <animate
                                attributeName="cx"
                                from="0"
                                to="200"
                                dur="4s"
                                repeatCount="indefinite"
                            />
                            <animate
                                attributeName="opacity"
                                values="0;1;0"
                                dur="4s"
                                repeatCount="indefinite"
                            />
                        </circle>
                    </>
                )}
            </svg>
        </div>
    );
}
