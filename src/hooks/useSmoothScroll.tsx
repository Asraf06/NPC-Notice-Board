import { useEffect, useRef } from 'react';

interface SmoothScrollOptions {
    orientation?: 'vertical' | 'horizontal';
    gestureOrientation?: 'vertical' | 'horizontal' | 'both';
}

export function useSmoothScroll(ref: React.RefObject<HTMLElement | null>, options?: SmoothScrollOptions) {
    useEffect(() => {
        let scrollInstance: any;

        if (typeof window !== 'undefined' && ref.current) {
            import('locomotive-scroll').then((module) => {
                const LocomotiveScroll = module.default || module;
                // Initialize Locomotive Scroll on the specific wrapper
                scrollInstance = new (LocomotiveScroll as any)({
                    // Locomotive v5 uses Lenis options for wrapper scrolling
                    lenisOptions: {
                        wrapper: ref.current, // The element that has overflow-y-auto
                        content: ref.current?.firstElementChild, // The direct child containing all content
                        lerp: 0.1, // Smoothness intensity
                        duration: 1.2,
                        orientation: options?.orientation || 'vertical',
                        gestureOrientation: options?.gestureOrientation || 'vertical',
                        smoothWheel: true,
                        smoothTouch: false, // Leave native touch scrolling intact
                        wheelMultiplier: 1,
                        touchMultiplier: 2,
                    }
                });
            });
        }

        return () => {
            if (scrollInstance) scrollInstance.destroy();
        };
    }, [ref, options]);
}
