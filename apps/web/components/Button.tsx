import type { ButtonHTMLAttributes, ReactNode } from "react";

type Size = "md" | "lg";

type CommonProps = {
  size?: Size;
  children: ReactNode;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "size">;

export function PrimaryButton({
  size = "md",
  children,
  className,
  ...rest
}: CommonProps) {
  const cls = ["btn", "btn-primary", size === "lg" ? "lg" : "", className ?? ""]
    .filter(Boolean)
    .join(" ");
  return (
    <button {...rest} className={cls}>
      {children}
    </button>
  );
}

export function GhostButton({
  size = "md",
  children,
  className,
  ...rest
}: CommonProps) {
  const cls = ["btn", "btn-ghost", size === "lg" ? "lg" : "", className ?? ""]
    .filter(Boolean)
    .join(" ");
  return (
    <button {...rest} className={cls}>
      {children}
    </button>
  );
}
