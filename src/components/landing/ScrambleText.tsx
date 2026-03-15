import { useEffect, useRef, useState } from "react";
import { useInView } from "framer-motion";
import React from "react";

const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%";

interface ScrambleTextProps {
  text: string;
  className?: string;
  as?: React.ElementType;
}

const ScrambleText = ({ text, className = "", as: Tag = "span" }: ScrambleTextProps) => {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });
  const [display, setDisplay] = useState(text);
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (!inView || hasAnimated.current) return;
    hasAnimated.current = true;

    let iteration = 0;
    const interval = setInterval(() => {
      setDisplay(
        text
          .split("")
          .map((char, i) => {
            if (char === " ") return " ";
            if (i < iteration) return text[i];
            return chars[Math.floor(Math.random() * chars.length)];
          })
          .join("")
      );
      iteration += 1 / 2;
      if (iteration >= text.length) {
        setDisplay(text);
        clearInterval(interval);
      }
    }, 30);

    return () => clearInterval(interval);
  }, [inView, text]);

  return (
    // @ts-ignore
    <Tag ref={ref} className={className}>
      {display}
    </Tag>
  );
};

export default ScrambleText;
