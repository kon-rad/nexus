type SectionDividerProps = {
  label: string;
};

export function SectionDivider({ label }: SectionDividerProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        margin: "40px 0 20px",
      }}
    >
      <div
        style={{
          fontSize: 11,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "var(--text-tertiary)",
          fontWeight: 500,
        }}
      >
        {label}
      </div>
      <div
        style={{
          flex: 1,
          height: 1,
          background: "var(--border-subtle)",
        }}
      />
    </div>
  );
}
