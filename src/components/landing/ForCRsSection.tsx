import { ImagePlus, GripVertical, FileUp, ShieldCheck, Link2, Send } from "lucide-react";
import ScrollReveal from "./ScrollReveal";
import ScrambleText from "./ScrambleText";

const crFeatures = [
  { icon: ImagePlus, text: "Post notices with images, links & tags" },
  { icon: GripVertical, text: "Edit the class routine with a drag-and-drop editor" },
  { icon: FileUp, text: "Upload study materials (PDFs, docs, images)" },
  { icon: ShieldCheck, text: "Manage who can register with Board Roll control" },
];

const ForCRsSection = () => (
  <section className="py-24 px-6 border-t-2 border-foreground/10">
    <div className="container mx-auto grid lg:grid-cols-2 gap-16 items-center">
      <div>
        <ScrollReveal>
          <div className="section-label">FOR CRs</div>
          <h2 className="text-3xl md:text-5xl font-black uppercase mb-4">
            <ScrambleText text="Built for Class Representatives" />
          </h2>
          <p className="font-mono text-sm text-muted-foreground mb-10">
            If you're the CR, you have superpowers.
          </p>
        </ScrollReveal>

        <div className="space-y-4">
          {crFeatures.map((f, i) => (
            <ScrollReveal key={f.text} delay={i * 0.1}>
              <div className="neo-card p-5 flex items-center gap-4 group hover:border-primary">
                <f.icon size={20} className="text-primary shrink-0" />
                <span className="font-mono text-xs">{f.text}</span>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>

      <ScrollReveal delay={0.2} className="hidden lg:block">
        <div className="neo-border-thick neo-shadow-purple p-6 bg-secondary">
          <div className="flex items-center justify-between mb-6">
            <div className="font-mono-neo text-[10px] text-primary uppercase tracking-[0.2em]">NEW NOTICE</div>
            <div className="flex gap-2">
              <div className="w-2 h-2 rounded-full bg-red-500/50" />
              <div className="w-2 h-2 rounded-full bg-yellow-500/50" />
              <div className="w-2 h-2 rounded-full bg-green-500/50" />
            </div>
          </div>
          
          <div className="neo-border bg-background p-4 mb-4 min-h-[120px]">
            <div className="font-mono text-xs text-muted-foreground mb-4">
              <span className="text-primary italic">#Announcement</span>
              <br /><br />
              Hey everyone! Tomorrow's first class has been moved to Room 402. Prepare your assignments! 📝
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex gap-3">
              <div className="p-2 neo-border hover:bg-primary/10 transition-colors">
                <ImagePlus size={16} className="text-primary" />
              </div>
              <div className="p-2 neo-border hover:bg-primary/10 transition-colors">
                <Link2 size={16} className="text-primary" />
              </div>
            </div>
            
            <div className="bg-primary text-primary-foreground px-4 py-2 font-black text-xs uppercase flex items-center gap-2 neo-border-thin shadow-[2px_2px_0px_0px_rgba(255,255,255,1)]">
              POST TO CLASS
              <Send size={12} />
            </div>
          </div>
        </div>
      </ScrollReveal>
    </div>
  </section>
);

export default ForCRsSection;
