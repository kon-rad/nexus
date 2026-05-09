"use client";

/**
 * Auth-aware nav element for the workspace top bar.
 *
 * - When signed out: shows a "Sign in with Google" pill that calls
 *   `useAuthActions().signIn("google")` and bounces the user through the
 *   Convex Auth OAuth flow.
 * - When signed in: shows the user's Google avatar + initials, with a click
 *   target that opens a tiny menu (Profile + Sign out).
 *
 * Replaces the old hardcoded ProfileAvatar in the workspace nav so the same
 * slot reflects real session state.
 */

import { useAuthActions } from "@convex-dev/auth/react";
import { Authenticated, Unauthenticated, useQuery } from "convex/react";
import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { api } from "../../../convex/_generated/api";
import { ProfileAvatar } from "./ProfileAvatar";

type CurrentUser = {
  _id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
};

export function SignInPill(): JSX.Element {
  return (
    <>
      <Unauthenticated>
        <GoogleSignInButton />
      </Unauthenticated>
      <Authenticated>
        <SignedInMenu />
      </Authenticated>
    </>
  );
}

function GoogleSignInButton(): JSX.Element {
  const { signIn } = useAuthActions();
  const [pending, setPending] = useState(false);

  const onClick = async () => {
    if (pending) return;
    setPending(true);
    try {
      await signIn("google", { redirectTo: "/workspace" });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("[auth] google signIn failed:", e);
      setPending(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void onClick()}
      disabled={pending}
      title="Sign in with Google"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        height: 32,
        padding: "0 12px",
        borderRadius: 999,
        border: "1px solid var(--border-subtle)",
        background: "rgba(255,255,255,0.04)",
        color: "var(--text-primary)",
        fontSize: 12.5,
        fontWeight: 500,
        cursor: pending ? "default" : "pointer",
        opacity: pending ? 0.6 : 1,
        transition: "background 160ms, border-color 160ms",
      }}
      onMouseEnter={(e) => {
        if (pending) return;
        e.currentTarget.style.background = "rgba(0, 229, 255, 0.08)";
        e.currentTarget.style.borderColor = "rgba(0, 229, 255, 0.4)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "rgba(255,255,255,0.04)";
        e.currentTarget.style.borderColor = "var(--border-subtle)";
      }}
    >
      <GoogleGlyph />
      <span>{pending ? "Connecting…" : "Sign in"}</span>
    </button>
  );
}

function SignedInMenu(): JSX.Element {
  const me = useQuery(api.users.me) as CurrentUser | null | undefined;
  const { signOut } = useAuthActions();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // Close the menu on outside click.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const initials = deriveInitials(me?.name ?? me?.email ?? "");
  const photo = me?.image ?? undefined;

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={me?.email ?? "Account"}
        aria-haspopup="menu"
        aria-expanded={open}
        style={{
          background: "transparent",
          border: "none",
          padding: 0,
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
        }}
      >
        <ProfileAvatar
          initials={initials}
          src={photo}
          size={32}
          ring={open}
          asChild
        />
      </button>
      {open ? (
        <div
          role="menu"
          style={menuStyle}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={menuHeaderStyle}>
            <div style={{ fontSize: 12, fontWeight: 600 }}>
              {me?.name ?? "Signed in"}
            </div>
            {me?.email ? (
              <div
                className="mono"
                style={{ fontSize: 10.5, color: "var(--text-tertiary)" }}
              >
                {me.email}
              </div>
            ) : null}
          </div>
          <Link href="/profile" style={menuItemStyle} onClick={() => setOpen(false)}>
            Open profile
          </Link>
          <button
            type="button"
            style={{ ...menuItemStyle, color: "var(--text-danger)" }}
            onClick={() => {
              setOpen(false);
              void signOut();
            }}
          >
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}

function deriveInitials(s: string): string {
  const trimmed = s.trim();
  if (!trimmed) return "AK";
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
  }
  return trimmed.slice(0, 2).toUpperCase();
}

function GoogleGlyph(): JSX.Element {
  // Inline SVG so we don't ship an extra asset. Standard Google "G" mark.
  return (
    <svg width="14" height="14" viewBox="0 0 18 18" aria-hidden focusable="false">
      <path
        fill="#EA4335"
        d="M9 3.48c1.69 0 2.84.73 3.5 1.34l2.55-2.49C13.46.86 11.43 0 9 0 5.48 0 2.44 2.02.96 4.96l2.96 2.3C4.66 5.28 6.66 3.48 9 3.48z"
      />
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.74-.06-1.28-.19-1.84H9v3.34h4.96c-.1.83-.64 2.08-1.84 2.92l2.83 2.2c1.69-1.56 2.69-3.86 2.69-6.62z"
      />
      <path
        fill="#FBBC05"
        d="M3.92 10.74A5.5 5.5 0 0 1 3.62 9c0-.6.1-1.18.28-1.74L.96 4.96A8.99 8.99 0 0 0 0 9c0 1.45.35 2.83.96 4.04l2.96-2.3z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.83-2.2c-.76.53-1.78.9-3.13.9-2.34 0-4.34-1.8-5.06-4.28L.96 13.04C2.44 15.98 5.48 18 9 18z"
      />
    </svg>
  );
}

const menuStyle: CSSProperties = {
  position: "absolute",
  top: "calc(100% + 8px)",
  right: 0,
  minWidth: 220,
  padding: 6,
  borderRadius: 12,
  background: "rgba(18,18,18,0.95)",
  backdropFilter: "blur(12px)",
  border: "1px solid var(--border-subtle)",
  boxShadow: "0 12px 32px rgba(0,0,0,0.45)",
  zIndex: 20,
};

const menuHeaderStyle: CSSProperties = {
  padding: "8px 10px 10px",
  borderBottom: "1px solid var(--border-subtle)",
  marginBottom: 4,
};

const menuItemStyle: CSSProperties = {
  display: "block",
  padding: "8px 10px",
  width: "100%",
  textAlign: "left" as const,
  background: "transparent",
  border: "none",
  borderRadius: 8,
  color: "var(--text-primary)",
  fontSize: 12.5,
  cursor: "pointer",
  textDecoration: "none",
};
