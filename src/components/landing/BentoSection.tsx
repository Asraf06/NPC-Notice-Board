import { Smartphone, Wifi, Lock, Moon } from "lucide-react";
import ScrollReveal from "./ScrollReveal";
import ScrambleText from "./ScrambleText";

const BentoSection = () => (
  <section className="py-24 px-6 border-t-2 border-foreground/10">
    <div className="container mx-auto">
      <ScrollReveal>
        <div className="section-label">EXPERIENCE</div>
        <h2 className="text-3xl md:text-5xl font-black uppercase mb-16">
          <ScrambleText text="A Premium App Experience — In Your Browser" />
        </h2>
      </ScrollReveal>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Large card */}
        <ScrollReveal className="col-span-2 row-span-2">
          <div className="neo-card p-8 h-full group hover:border-primary flex flex-col justify-between">
            <Moon size={32} className="text-primary mb-6" />
            <div>
              <h3 className="font-mono-neo text-sm mb-2">DARK MODE + LIGHT MODE</h3>
              <p className="font-mono text-xs text-muted-foreground">
                Beautiful in every shade. Switch seamlessly.
              </p>
            </div>
            <div className="mt-6 flex h-20 overflow-hidden neo-border">
              <div className="flex-1" style={{ backgroundColor: "#F1F1F1" }} />
              <div className="flex-1" style={{ backgroundColor: "#000000" }} />
            </div>
          </div>
        </ScrollReveal>

        {/* Medium cards */}
        <ScrollReveal delay={0.1}>
          <div className="neo-card p-6 h-full group hover:border-primary">
            <Smartphone size={24} className="text-primary mb-3" />
            <h3 className="font-mono-neo text-xs mb-1">INSTALL AS APP</h3>
            <p className="font-mono text-[10px] text-muted-foreground">
              Add to home screen for a native feel. Works offline.
            </p>
          </div>
        </ScrollReveal>

        <ScrollReveal delay={0.15}>
          <div className="neo-card p-6 h-full group hover:border-primary">
            <Smartphone size={24} className="text-primary mb-3" />
            <h3 className="font-mono-neo text-xs mb-1">MOBILE FIRST</h3>
            <p className="font-mono text-[10px] text-muted-foreground">
              Designed for phones. Works beautifully on desktop too.
            </p>
          </div>
        </ScrollReveal>

        {/* Small cards */}
        <ScrollReveal delay={0.2}>
          <div className="neo-card p-6 h-full group hover:border-primary">
            <div className="flex items-center gap-2 mb-2">
              <Wifi size={18} className="text-primary" />
              <div className="w-2 h-2 rounded-full animate-pulse-dot" style={{ background: "hsl(142 71% 45%)" }} />
            </div>
            <h3 className="font-mono-neo text-xs">REAL-TIME SYNC</h3>
          </div>
        </ScrollReveal>

        <ScrollReveal delay={0.25}>
          <div className="neo-card p-6 h-full group hover:border-primary">
            <Lock size={18} className="text-primary mb-2" />
            <h3 className="font-mono-neo text-xs">SECURE</h3>
          </div>
        </ScrollReveal>
      </div>
    </div>
  </section>
);

export default BentoSection;
