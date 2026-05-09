import { TERM_LINES } from "./data";

/**
 * Static Insights tab — markdown-style explanation on top, xterm-styled
 * <pre> mock on bottom. Phase 2 wires this to Convex events + real xterm.js.
 */
export function Insights() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
      }}
    >
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "24px 28px",
          minHeight: 0,
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            fontSize: 11,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: "var(--accent-purple)",
            marginBottom: 14,
            fontWeight: 500,
          }}
        >
          <span className="status-dot thinking" />
          Nexus is thinking
        </div>
        <h3
          style={{
            fontSize: 20,
            fontWeight: 600,
            margin: "0 0 14px",
            letterSpacing: "-0.01em",
          }}
        >
          I created a React Todo app with a typed API layer.
        </h3>
        <div
          style={{
            color: "var(--text-secondary)",
            fontSize: 14.5,
            lineHeight: 1.65,
            maxWidth: 720,
          }}
        >
          <p style={{ marginTop: 0 }}>Here's what I just shipped:</p>
          <ul style={{ paddingLeft: 18, margin: "0 0 12px" }}>
            <li>
              <span style={{ color: "var(--text-primary)" }}>TodoList.tsx</span>{" "}
              — the main view, fetches from{" "}
              <span className="mono" style={{ color: "var(--accent-cyan)" }}>
                /api/todos
              </span>{" "}
              on mount and keeps state in{" "}
              <span className="mono" style={{ color: "var(--accent-cyan)" }}>
                useState
              </span>
              .
            </li>
            <li>
              <span style={{ color: "var(--text-primary)" }}>TodoItem.tsx</span>{" "}
              — presentational, supports inline edit and a strikethrough
              animation.
            </li>
            <li>
              <span style={{ color: "var(--text-primary)" }}>AddTodo.tsx</span>{" "}
              — controlled input with optimistic insert.
            </li>
          </ul>
          <p>
            I deployed it to your Daytona sandbox at{" "}
            <span className="mono" style={{ color: "var(--accent-cyan)" }}>
              preview-7f3a-ax21.daytona.dev
            </span>
            . Want me to add a backend with persistence next? I'd recommend
            Convex.
          </p>
        </div>
      </div>

      <div
        style={{
          height: "40%",
          minHeight: 180,
          borderTop: "1px solid var(--border-subtle)",
          background: "#000",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            height: 30,
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "0 14px",
            borderBottom: "1px solid var(--border-subtle)",
            fontSize: 11,
            color: "var(--text-tertiary)",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            flexShrink: 0,
          }}
        >
          <span style={{ color: "var(--text-secondary)", fontWeight: 500 }}>
            Terminal
          </span>
          <span
            className="mono"
            style={{
              textTransform: "none",
              letterSpacing: 0,
              color: "var(--text-tertiary)",
            }}
          >
            daytona@7f3a-ax21:~/app$
          </span>
        </div>
        <pre
          style={{
            flex: 1,
            margin: 0,
            overflowY: "auto",
            padding: "10px 0",
            background: "#000",
          }}
        >
          {TERM_LINES.map((line, i) => (
            <div key={i} className="term-line">
              {line.kind === "cmd" ? (
                <span className="term-prompt">$</span>
              ) : null}
              <span
                className={
                  line.kind === "out"
                    ? "term-out"
                    : line.kind === "err"
                      ? "term-err"
                      : line.kind === "cmd"
                        ? "mono"
                        : "term-meta"
                }
                style={
                  line.kind === "cmd"
                    ? { color: "var(--text-primary)" }
                    : undefined
                }
              >
                {line.text}
              </span>
            </div>
          ))}
        </pre>
      </div>
    </div>
  );
}
