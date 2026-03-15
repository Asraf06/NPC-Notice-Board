import Link from "next/link";

const Footer = () => (
  <footer className="border-t-2 border-foreground/10 py-8 px-6">
    <div className="container mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
      <div className="font-mono-neo text-xs">
        NPC NOTICE BOARD <span className="text-muted-foreground">© 2025</span>
      </div>
      <div className="flex gap-6 font-mono text-xs text-muted-foreground">
        <Link href="/login" className="hover:text-foreground transition-colors">Notice Board</Link>
        <a href="https://github.com/Asraf06" target="_blank" className="hover:text-foreground transition-colors">GitHub</a>
        <span>Made with ♥ by Asraful</span>
      </div>
    </div>
  </footer>
);

export default Footer;
