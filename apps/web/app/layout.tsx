import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { ConvexClientProvider } from "@/components/ConvexClientProvider";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Nexus — Your AI Co-Founder is Online",
  description:
    "Talk to Nexus. Watch it write, run, and ship full-stack apps in real time.",
};

// Theme color matches --bg-canvas. Kept inline because Next's metadata API
// must be statically analyzable and cannot read CSS variables at build time.
const THEME_BG_CANVAS = "#0A0A0A" as const;

export const viewport: Viewport = {
  themeColor: THEME_BG_CANVAS,
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body>
        <ConvexClientProvider>{children}</ConvexClientProvider>
      </body>
    </html>
  );
}
