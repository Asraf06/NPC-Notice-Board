import { motion } from "framer-motion";
import ScrambleText from "./ScrambleText";
import Link from "next/link";
import Image from "next/image";

const badges = ["✦ 100% FREE", "✦ NO DOWNLOAD", "✦ PWA READY", "✦ REAL-TIME"];

const HeroSection = () => {
  return (
    <section className="relative min-h-screen flex items-center grid-bg overflow-hidden" suppressHydrationWarning>
      <div className="container mx-auto px-6 py-20 grid lg:grid-cols-2 gap-12 items-center" suppressHydrationWarning>
        <div className="space-y-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          >
            <h1 className="text-5xl sm:text-6xl lg:text-7xl xl:text-8xl font-black uppercase leading-[0.9] tracking-tight">
              <ScrambleText text="YOUR CLASS." className="block" />
              <ScrambleText text="YOUR NOTICES." className="block" />
              <span className="block text-primary">
                <ScrambleText text="ONE BOARD." />
              </span>
            </h1>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.6 }}
            className="font-mono text-sm text-muted-foreground tracking-wider uppercase max-w-md"
          >
            The all-in-one digital notice board built for NPC polytechnic students
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.6 }}
            className="flex flex-wrap gap-4"
          >
            <Link href="/login" className="neo-btn-primary">
              OPEN NOTICE BOARD →
            </Link>
            <a href="#features" className="neo-btn-secondary">
              SEE FEATURES ↓
            </a>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1, duration: 0.6 }}
            className="flex flex-wrap gap-4 pt-4"
          >
            {badges.map((badge) => (
              <span
                key={badge}
                className="font-mono-neo text-[10px] text-muted-foreground tracking-[0.2em]"
              >
                {badge}
              </span>
            ))}
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, x: 60 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="relative hidden lg:block"
        >
          <div className="neo-border-thick neo-shadow-purple p-2 bg-secondary">
            <div className="flex items-center gap-2 px-3 py-2 border-b-2 border-foreground">
              {/* Traffic light colors hardcoded to ensure they always show up correctly */}
              <div className="w-3 h-3 rounded-full" style={{ background: "hsl(0 84.2% 60.2%)" }} />
              <div className="w-3 h-3 rounded-full" style={{ background: "hsl(45 93% 47%)" }} />
              <div className="w-3 h-3 rounded-full" style={{ background: "hsl(142 71% 45%)" }} />
              <span className="ml-2 font-mono text-xs text-muted-foreground">
                npcnoticeboard.vercel.app
              </span>
            </div>
            <Image
              src="/assets/app-mockup.png"
              alt="NPC Notice Board App Interface"
              className="w-full h-auto"
              width={800}
              height={500}
              priority
            />
          </div>
          {/* Floating decoration */}
          <div className="absolute -top-4 -right-4 w-20 h-20 border-2 border-primary opacity-20" />
          <div className="absolute -bottom-4 -left-4 w-16 h-16 bg-primary opacity-10" />
        </motion.div>
      </div>

      {/* Diagonal stripe accent */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-foreground opacity-10" />
    </section>
  );
};

export default HeroSection;

