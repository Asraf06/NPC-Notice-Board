import ScrollReveal from "./ScrollReveal";
import ScrambleText from "./ScrambleText";

const steps = [
  { num: "01", title: "SIGN IN", desc: "Use your Google account. One tap, you're in." },
  { num: "02", title: "JOIN YOUR CLASS", desc: "Select your department & semester. Your CR manages the rest." },
  { num: "03", title: "STAY UPDATED", desc: "Notices, routine, materials — all in real-time. Zero effort." },
];

const HowItWorksSection = () => (
  <section className="py-24 px-6 border-t-2 border-foreground/10">
    <div className="container mx-auto">
      <ScrollReveal>
        <div className="section-label">HOW IT WORKS</div>
        <h2 className="text-3xl md:text-5xl font-black uppercase mb-16">
          <ScrambleText text="From Login to Latest Notice in 3 Steps" />
        </h2>
      </ScrollReveal>

      <div className="grid md:grid-cols-3 gap-8">
        {steps.map((s, i) => (
          <ScrollReveal key={s.num} delay={i * 0.15}>
            <div className="neo-card p-8 relative overflow-hidden group hover:border-primary">
              <span className="absolute -top-4 -right-2 text-[8rem] font-black pointer-events-none leading-none select-none howto-bg-number">
                {s.num}
              </span>
              <span className="font-mono-neo text-primary text-xs">{s.num}</span>
              <h3 className="font-black text-xl uppercase mt-3 mb-2">{s.title}</h3>
              <p className="font-mono text-xs text-muted-foreground">{s.desc}</p>
              {i < 2 && (
                <div className="hidden md:block absolute top-1/2 -right-4 w-8 h-0.5 bg-foreground/20" />
              )}
            </div>
          </ScrollReveal>
        ))}
      </div>
    </div>
  </section>
);

export default HowItWorksSection;
