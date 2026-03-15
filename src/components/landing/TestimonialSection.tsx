import ScrollReveal from "./ScrollReveal";

const TestimonialSection = () => (
  <section className="py-24 px-6 border-t-2 border-foreground/10">
    <div className="container mx-auto max-w-2xl">
      <ScrollReveal>
        <blockquote className="border-l-4 border-primary pl-6 py-4 neo-shadow bg-card">
          <p className="text-xl md:text-2xl font-black uppercase leading-snug mb-4">
            "Finally, no more WhatsApp group spam for class updates."
          </p>
          <footer className="font-mono text-xs text-muted-foreground uppercase tracking-wider">
            — A Student
          </footer>
        </blockquote>
      </ScrollReveal>
    </div>
  </section>
);

export default TestimonialSection;
