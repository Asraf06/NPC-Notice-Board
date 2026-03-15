import { Megaphone, Calendar, MessageSquare, BookOpen, Users, Bell } from "lucide-react";
import ScrollReveal from "./ScrollReveal";
import TiltCard from "./TiltCard";
import ScrambleText from "./ScrambleText";

const features = [
  { icon: Megaphone, title: "REAL-TIME NOTICES", desc: "Get instant class updates from your CR. Never miss an announcement." },
  { icon: Calendar, title: "CLASS ROUTINE", desc: "View your full weekly schedule in a beautiful grid. Auto-highlights today." },
  { icon: MessageSquare, title: "PRIVATE CHAT", desc: "Message classmates directly. Share images, reply to messages, customize themes." },
  { icon: BookOpen, title: "STUDY MATERIALS", desc: "Access PDFs, notes & documents uploaded by your CR. Download anything." },
  { icon: Users, title: "FRIEND SYSTEM", desc: "Add classmates, share notices, see who's online." },
  { icon: Bell, title: "PUSH NOTIFICATIONS", desc: "Get notified instantly on your phone when a new notice drops." },
];

const FeaturesSection = () => (
  <section id="features" className="py-24 px-6">
    <div className="container mx-auto">
      <ScrollReveal>
        <div className="section-label">FEATURES</div>
        <h2 className="text-4xl md:text-5xl font-black uppercase mb-16">
          <ScrambleText text="Everything Your Class Needs" />
        </h2>
      </ScrollReveal>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch">
        {features.map((f, i) => (
          <ScrollReveal key={f.title} delay={i * 0.1}>
            <TiltCard>
              <div className="neo-card p-6 h-full group hover:border-primary cursor-default">
                <f.icon
                  size={28}
                  className="text-primary mb-4 transition-transform duration-300 group-hover:scale-110"
                />
                <h3 className="font-mono-neo text-sm mb-2">{f.title}</h3>
                <p className="font-mono text-xs text-muted-foreground leading-relaxed">
                  {f.desc}
                </p>
              </div>
            </TiltCard>
          </ScrollReveal>
        ))}
      </div>
    </div>
  </section>
);

export default FeaturesSection;
