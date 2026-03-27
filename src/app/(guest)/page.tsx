'use client';

import { useEffect, useRef, useState } from "react";
import LocomotiveScroll from "locomotive-scroll";
import "locomotive-scroll/dist/locomotive-scroll.css";
import dynamic from "next/dynamic";
import { Capacitor } from '@capacitor/core';

// Dynamic imports for sections to speed up TTI (Time to Interactive)
const HeroSection = dynamic(() => import("@/components/landing/HeroSection"));
const FeaturesSection = dynamic(() => import("@/components/landing/FeaturesSection"), { ssr: false });
const HowItWorksSection = dynamic(() => import("@/components/landing/HowItWorksSection"), { ssr: false });
const BentoSection = dynamic(() => import("@/components/landing/BentoSection"), { ssr: false });
const ForCRsSection = dynamic(() => import("@/components/landing/ForCRsSection"), { ssr: false });
const TestimonialSection = dynamic(() => import("@/components/landing/TestimonialSection"), { ssr: false });
const CTASection = dynamic(() => import("@/components/landing/CTASection"), { ssr: false });
const Footer = dynamic(() => import("@/components/landing/Footer"), { ssr: false });
const CursorTrail = dynamic(() => import("@/components/landing/CursorTrail"), { ssr: false });
const BackToTop = dynamic(() => import("@/components/landing/BackToTop"), { ssr: false });
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

export default function LandingPage() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { authStep, user } = useAuth();
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);
  
  // Synchronously detect PWA/Native on client initialization
  const [isPWA, setIsPWA] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(display-mode: standalone)').matches 
        || (window.navigator as any).standalone
        || Capacitor.isNativePlatform();
    }
    return false;
  });

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (isClient) {
      if (isPWA) {
        // PWA user: always skip landing page
        if (authStep === 'authenticated') {
          router.push('/notices');
        } else {
          router.push('/login');
        }
      } else if (authStep === 'authenticated') {
        // Browser user: only skip if logged in
        router.push('/notices');
      }
    }
  }, [isClient, isPWA, authStep, router]);

  useEffect(() => {
    // Only init locomotive scroll if we haven't redirected and DOM is ready
    if (!scrollRef.current || authStep === 'authenticated' || !isClient) return;

    let scroll: any;
    try {
        scroll = new LocomotiveScroll({
            lenisOptions: {
                lerp: 0.1,
                duration: 1.2,
                smoothWheel: true,
            }
        });
    } catch (e) {
        console.error("LocomotiveScroll init error:", e);
    }

    return () => {
      if (scroll) scroll.destroy();
    };
  }, [authStep, isClient]);

  // If PWA or authenticated, don't show landing page content
  if (isClient && (isPWA || authStep === 'authenticated')) return <div className="min-h-screen bg-black" />;

  return (
    <div
      ref={scrollRef}
      data-scroll-container
      className="min-h-screen grid-bg"
      suppressHydrationWarning
    >
      <CursorTrail />
      <BackToTop />
      <div data-scroll-section suppressHydrationWarning>
        <HeroSection />
        <FeaturesSection />
        <HowItWorksSection />
        <BentoSection />
        <ForCRsSection />
        <TestimonialSection />
        <CTASection />
        <Footer />
      </div>
    </div>
  );
}
