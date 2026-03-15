import ScrollReveal from "./ScrollReveal";
import ScrambleText from "./ScrambleText";
import Link from "next/link";

const CTASection = () => (
  <section className="py-32 px-6 border-t-2 border-foreground/10 grid-bg">
    <div className="container mx-auto text-center max-w-3xl">
      <ScrollReveal>
        <h2 className="text-4xl md:text-6xl lg:text-7xl font-black uppercase leading-[0.95] mb-6">
          <ScrambleText text="STOP MISSING CLASS UPDATES." />
        </h2>
        <p className="font-mono text-sm text-muted-foreground mb-10 max-w-lg mx-auto">
          Join your classmates on NPC Notice Board. It's free, it's fast, it's built for you.
        </p>
        <Link href="/login" className="neo-btn-primary inline-block">
          OPEN NOTICE BOARD →
        </Link>
        <p className="font-mono text-[10px] text-muted-foreground mt-6 tracking-wider uppercase">
          No download required. Works in any browser.
        </p>
      </ScrollReveal>
    </div>
  </section>
);

export default CTASection;
