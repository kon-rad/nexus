import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: "var(--bg-canvas)",
        surface: "var(--bg-surface)",
        elevated: "var(--bg-elevated)",
        deep: "var(--bg-deep)",
        "border-subtle": "var(--border-subtle)",
        "border-strong": "var(--border-strong)",
        "accent-cyan": "var(--accent-cyan)",
        "accent-purple": "var(--accent-purple)",
        "text-primary": "var(--text-primary)",
        "text-secondary": "var(--text-secondary)",
        "text-tertiary": "var(--text-tertiary)",
        "text-danger": "var(--text-danger)",
        "text-success": "var(--text-success)",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "-apple-system", "sans-serif"],
        mono: ["var(--font-jetbrains-mono)", "JetBrains Mono", "Fira Code", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
