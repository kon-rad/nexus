"use client";

import type { CSSProperties } from "react";

type ProfileAvatarProps = {
  initials?: string;
  src?: string;
  size?: number;
  ring?: boolean;
  onClick?: () => void;
  title?: string;
};

/**
 * 40px (default 32) circle with cyan ring on hover. Initials fallback.
 * See `.user-avatar` hover style in globals.css.
 */
export function ProfileAvatar({
  initials = "AK",
  src,
  size = 32,
  ring = false,
  onClick,
  title,
}: ProfileAvatarProps) {
  const style: CSSProperties = {
    width: size,
    height: size,
    borderRadius: "50%",
    background: "linear-gradient(135deg, #2a2a2e, #18181b)",
    color: "var(--text-primary)",
    fontSize: Math.round(size * 0.36),
    fontWeight: 600,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    border: ring
      ? "2px solid rgba(0, 229, 255, 0.6)"
      : "1px solid var(--border-subtle)",
    boxShadow: ring ? "0 0 14px -2px rgba(0, 229, 255, 0.5)" : "none",
    backgroundImage: src ? `url(${src})` : undefined,
    backgroundSize: "cover",
    backgroundPosition: "center",
    cursor: onClick ? "pointer" : "default",
    transition: "box-shadow 200ms, border-color 200ms",
    flexShrink: 0,
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={`user-avatar ${ring ? "user-avatar--ring" : ""}`.trim()}
      style={style}
      title={title}
      aria-label={title ?? `Profile avatar ${initials}`}
    >
      {!src && initials}
    </button>
  );
}
