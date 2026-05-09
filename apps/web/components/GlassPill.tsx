import type { CSSProperties, ReactNode } from "react";

type GlassPillProps = {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
};

/**
 * Glassmorphic pill — rgba(18,18,18,0.7) fill + blur(12px) + 1px subtle border,
 * 9999px border-radius. See globals.css `.glass-pill`.
 */
export function GlassPill({ children, className, style }: GlassPillProps) {
  return (
    <div className={`glass-pill ${className ?? ""}`.trim()} style={style}>
      {children}
    </div>
  );
}
