"use client";

import type { CSSProperties } from "react";

type ProfileAvatarProps = {
  initials?: string;
  src?: string;
  size?: number;
  ring?: boolean;
  onClick?: () => void;
  title?: string;
  /** When true, renders a non-interactive <span> instead of a <button>. Useful when wrapped in a <Link>. */
  asChild?: boolean;
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
  asChild = false,
}: ProfileAvatarProps) {
  const style: CSSProperties = {
    width: size,
    height: size,
    borderRadius: "50%",
    background:
      "linear-gradient(135deg, var(--avatar-grad-top), var(--avatar-grad-bottom))",
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
    cursor: asChild || onClick ? "pointer" : "default",
    transition: "box-shadow 200ms, border-color 200ms",
    flexShrink: 0,
  };
  const className = `user-avatar ${ring ? "user-avatar--ring" : ""}`.trim();

  if (asChild) {
    return (
      <span
        className={className}
        style={style}
        title={title}
        aria-label={title ?? `Profile avatar ${initials}`}
      >
        {!src && initials}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={className}
      style={style}
      title={title}
      aria-label={title ?? `Profile avatar ${initials}`}
    >
      {!src && initials}
    </button>
  );
}
