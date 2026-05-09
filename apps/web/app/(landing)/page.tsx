import Link from "next/link";
import { GhostButton, PrimaryButton } from "@/components/Button";
import {
  IconArrow,
  IconGlobe,
  IconMic,
  IconPlay,
  IconShield,
} from "@/components/icons";
import { Logo } from "@/components/Logo";
import { HeroWorkspaceMock } from "./HeroWorkspaceMock";

const FEATURES = [
  {
    icon: <IconMic size={20} />,
    title: "Real-Time Voice",
    sub: "Powered by Gemini Live",
    body: "Speak naturally. Nexus hears you, asks clarifying questions, and starts coding before you finish your sentence.",
  },
  {
    icon: <IconShield size={20} />,
    title: "Secure Code Execution",
    sub: "Powered by Daytona",
    body: "Every session spawns an isolated sandbox. Your code runs in a real Linux environment — never on your machine.",
  },
  {
    icon: <IconGlobe size={20} />,
    title: "Instant Live Preview",
    sub: "Daytona signed URLs",
    body: "The moment Nexus saves a file, your app is online — with a public preview URL you can share with anyone.",
  },
] as const;

const SPONSORS = [
  "Gemini Live",
  "Tavus Phoenix-4",
  "Cursor SDK",
  "Daytona",
  "Convex",
] as const;

export default function LandingPage() {
  return (
    <div
      className="page-fade-enter"
      style={{
        minHeight: "100vh",
        background: "var(--bg-canvas)",
        position: "relative",
      }}
    >
      {/* Ambient backgrounds */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background: `
            radial-gradient(50% 40% at 80% 10%, rgba(176,38,255,0.18), transparent 60%),
            radial-gradient(40% 35% at 20% 30%, rgba(0,229,255,0.18), transparent 60%),
            radial-gradient(60% 60% at 50% 100%, rgba(0,229,255,0.08), transparent 60%)
          `,
        }}
      />
      <div
        aria-hidden
        className="bg-grid"
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          opacity: 0.5,
        }}
      />

      {/* Top nav */}
      <nav
        className="glass"
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          height: 64,
          display: "flex",
          alignItems: "center",
          padding: "0 32px",
          gap: 32,
        }}
      >
        <Logo />
        <div
          style={{
            display: "flex",
            gap: 22,
            marginLeft: 24,
            fontSize: 13,
            color: "var(--text-secondary)",
          }}
        >
          <a href="#product" style={{ color: "inherit", textDecoration: "none" }}>
            Product
          </a>
          <a href="#features" style={{ color: "inherit", textDecoration: "none" }}>
            Features
          </a>
          <a href="#pricing" style={{ color: "inherit", textDecoration: "none" }}>
            Pricing
          </a>
          <a href="#docs" style={{ color: "inherit", textDecoration: "none" }}>
            Docs
          </a>
        </div>
        <div style={{ flex: 1 }} />
        <GhostButton>Sign in</GhostButton>
        <Link href="/workspace" style={{ textDecoration: "none" }}>
          <PrimaryButton>Open Nexus</PrimaryButton>
        </Link>
      </nav>

      {/* HERO */}
      <section
        style={{
          position: "relative",
          padding: "80px 64px 60px",
          maxWidth: 1320,
          margin: "0 auto",
        }}
        className="hero-section"
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.05fr 1fr",
            gap: 56,
            alignItems: "center",
          }}
          className="hero-grid"
        >
          <div>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
                padding: "6px 12px",
                borderRadius: 999,
                border: "1px solid var(--border-subtle)",
                background: "rgba(255, 255, 255, 0.02)",
                fontSize: 12,
                color: "var(--text-secondary)",
                marginBottom: 28,
              }}
            >
              <span
                className="status-dot speaking"
                style={{ width: 6, height: 6 }}
              />
              <span>Now in private beta — request access</span>
            </div>

            <h1
              style={{
                fontSize: "clamp(48px, 5.6vw, 76px)",
                lineHeight: 1.02,
                fontWeight: 700,
                letterSpacing: "-0.035em",
                margin: "0 0 24px",
                textWrap: "balance",
              }}
            >
              Your AI Co-Founder
              <br />
              is{" "}
              <span
                style={{
                  background:
                    "linear-gradient(95deg, var(--accent-cyan) 0%, var(--accent-purple) 100%)",
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  color: "transparent",
                  position: "relative",
                }}
              >
                Online.
              </span>
            </h1>

            <p
              style={{
                fontSize: 18,
                lineHeight: 1.55,
                color: "var(--text-secondary)",
                maxWidth: 540,
                margin: "0 0 36px",
                textWrap: "pretty",
              }}
            >
              Talk to Nexus. Watch it write, run, and ship full-stack apps in
              real time.
            </p>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Link href="/workspace" style={{ textDecoration: "none" }}>
                <PrimaryButton size="lg">
                  Start Building — Free
                  <IconArrow size={14} />
                </PrimaryButton>
              </Link>
              <GhostButton size="lg">
                <IconPlay size={12} /> Watch Demo
              </GhostButton>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 18,
                marginTop: 36,
                color: "var(--text-tertiary)",
                fontSize: 12,
                flexWrap: "wrap",
              }}
            >
              <span>No credit card</span>
              <span
                style={{
                  width: 3,
                  height: 3,
                  background: "currentColor",
                  borderRadius: 999,
                }}
              />
              <span>500 minutes free</span>
              <span
                style={{
                  width: 3,
                  height: 3,
                  background: "currentColor",
                  borderRadius: 999,
                }}
              />
              <span>Bring your own keys</span>
            </div>
          </div>

          {/* Workspace mock */}
          <div
            className="hero-mock"
            style={{
              transform: "perspective(1600px) rotateY(-7deg) rotateX(3deg)",
              transformOrigin: "center",
            }}
          >
            <HeroWorkspaceMock />
          </div>
        </div>
      </section>

      {/* Sponsor strip */}
      <section
        style={{
          padding: "40px 64px",
          borderTop: "1px solid var(--border-subtle)",
          borderBottom: "1px solid var(--border-subtle)",
          background: "rgba(0, 0, 0, 0.3)",
        }}
      >
        <div
          style={{
            maxWidth: 1320,
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            gap: 32,
            flexWrap: "wrap",
            justifyContent: "center",
            color: "var(--text-tertiary)",
          }}
        >
          <span
            style={{
              fontSize: 11,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              fontWeight: 500,
            }}
          >
            Powered by
          </span>
          {SPONSORS.map((s) => (
            <span
              key={s}
              className="mono"
              style={{
                fontSize: 13,
                color: "var(--text-secondary)",
                opacity: 0.85,
                fontWeight: 500,
              }}
            >
              {s}
            </span>
          ))}
        </div>
      </section>

      {/* Features */}
      <section
        id="features"
        style={{
          padding: "120px 64px 80px",
          maxWidth: 1320,
          margin: "0 auto",
          position: "relative",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 64 }}>
          <div
            style={{
              fontSize: 11,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "var(--accent-cyan)",
              fontWeight: 500,
              marginBottom: 14,
            }}
          >
            The stack
          </div>
          <h2
            style={{
              fontSize: "clamp(32px, 3.2vw, 44px)",
              fontWeight: 600,
              letterSpacing: "-0.02em",
              margin: 0,
            }}
          >
            Everything that makes Nexus feel alive.
          </h2>
        </div>

        <div
          className="features-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 20,
          }}
        >
          {FEATURES.map((f) => (
            <div
              key={f.title}
              style={{
                padding: 28,
                background: "var(--bg-surface)",
                border: "1px solid var(--border-subtle)",
                borderRadius: 14,
                position: "relative",
                overflow: "hidden",
                minHeight: 220,
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: "rgba(0, 229, 255, 0.08)",
                  border: "1px solid rgba(0, 229, 255, 0.25)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--accent-cyan)",
                  marginBottom: 20,
                  boxShadow: "0 0 24px -6px rgba(0, 229, 255, 0.4)",
                }}
              >
                {f.icon}
              </div>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 600,
                  marginBottom: 4,
                  letterSpacing: "-0.01em",
                }}
              >
                {f.title}
              </div>
              <div
                className="mono"
                style={{
                  fontSize: 11,
                  color: "var(--text-tertiary)",
                  marginBottom: 14,
                  letterSpacing: "0.04em",
                }}
              >
                {f.sub}
              </div>
              <div
                style={{
                  fontSize: 14,
                  color: "var(--text-secondary)",
                  lineHeight: 1.55,
                }}
              >
                {f.body}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section style={{ padding: "40px 64px 120px" }}>
        <div
          style={{
            maxWidth: 1100,
            margin: "0 auto",
            padding: "80px 64px",
            borderRadius: 24,
            border: "1px solid var(--border-subtle)",
            background: `
              radial-gradient(60% 80% at 50% 110%, rgba(0,229,255,0.18), transparent 60%),
              radial-gradient(60% 80% at 50% -10%, rgba(176,38,255,0.18), transparent 60%),
              #0d0d0e
            `,
            textAlign: "center",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <h2
            style={{
              fontSize: "clamp(36px, 4vw, 56px)",
              fontWeight: 700,
              letterSpacing: "-0.03em",
              margin: "0 0 16px",
              textWrap: "balance",
            }}
          >
            Stop typing. Start shipping.
          </h2>
          <p
            style={{
              fontSize: 17,
              color: "var(--text-secondary)",
              margin: "0 0 36px",
            }}
          >
            Your first sandbox spins up in under 4 seconds.
          </p>
          <Link href="/workspace" style={{ textDecoration: "none" }}>
            <PrimaryButton size="lg">
              Open Nexus <IconArrow size={14} />
            </PrimaryButton>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer
        style={{
          padding: "40px 64px",
          borderTop: "1px solid var(--border-subtle)",
          display: "flex",
          alignItems: "center",
          gap: 24,
          color: "var(--text-tertiary)",
          fontSize: 12,
          flexWrap: "wrap",
        }}
      >
        <Logo size={18} />
        <span style={{ marginLeft: "auto" }}>
          © 2026 Nexus Labs · Built in San Francisco
        </span>
      </footer>
    </div>
  );
}
