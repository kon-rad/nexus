type LogoProps = {
  size?: number;
};

export function Logo({ size = 22 }: LogoProps) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <defs>
          <linearGradient
            id="nx-grad"
            x1="0"
            y1="0"
            x2="24"
            y2="24"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0" stopColor="var(--accent-cyan)" />
            <stop offset="1" stopColor="var(--accent-purple)" />
          </linearGradient>
        </defs>
        <path
          d="M4 4 L4 20 M4 4 L20 20 M20 4 L20 20"
          stroke="url(#nx-grad)"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
      </svg>
      <span
        style={{
          fontSize: 15,
          fontWeight: 600,
          letterSpacing: "-0.01em",
        }}
      >
        Nexus
      </span>
    </div>
  );
}
