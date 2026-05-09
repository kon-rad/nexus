/* Profile / Settings page — Nexus */

const Row = ({ label, sub, children }) => (
  <div style={{
    display: 'grid', gridTemplateColumns: '240px 1fr',
    gap: 32, padding: '18px 0', alignItems: 'flex-start',
  }}>
    <div>
      <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{label}</div>
      {sub && <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)',
        marginTop: 4, lineHeight: 1.5 }}>{sub}</div>}
    </div>
    <div>{children}</div>
  </div>
);

const Profile = ({ onBack }) => {
  const [voiceId, setVoiceId] = React.useState('aiden');
  const [terminalLg, setTerminalLg] = React.useState(true);
  const [thinkingGlow, setThinkingGlow] = React.useState(true);
  const [ghToken, setGhToken] = React.useState('');
  const [oaiKey, setOaiKey] = React.useState('');

  return (
    <div style={{
      height: '100%', overflow: 'auto',
      background: 'var(--bg-canvas)', position: 'relative',
    }} className="page-fade-enter">
      {/* ambient */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: `
          radial-gradient(50% 30% at 50% -10%, rgba(0,229,255,0.08), transparent 60%)
        `,
      }}/>

      {/* Top nav */}
      <nav className="glass" style={{
        position: 'sticky', top: 0, zIndex: 50,
        height: 56, display: 'flex', alignItems: 'center',
        padding: '0 24px', gap: 16,
      }}>
        <button className="btn btn-ghost" onClick={onBack} style={{ padding: '8px 14px' }}>
          <IconArrow size={12} style={{ transform: 'rotate(180deg)' }}/>
          Back to workspace
        </button>
        <div style={{ flex: 1 }}/>
        <Logo />
      </nav>

      <div style={{
        maxWidth: 800, margin: '0 auto', padding: '60px 32px 120px',
        position: 'relative',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 24, marginBottom: 40,
        }}>
          <UserAvatar initials="AK" size={72} ring/>
          <div>
            <div style={{ fontSize: 11, color: 'var(--accent-cyan)',
              letterSpacing: '0.18em', textTransform: 'uppercase',
              fontWeight: 500, marginBottom: 6,
            }}>Account</div>
            <h1 style={{
              fontSize: 30, fontWeight: 600, margin: 0,
              letterSpacing: '-0.02em',
            }}>Alex Kim</h1>
            <div style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 2 }}>
              alex@kim.dev
            </div>
          </div>
          <div style={{ flex: 1 }}/>
          <div className="glass-pill" style={{
            padding: '8px 14px', fontSize: 12,
            display: 'inline-flex', alignItems: 'center', gap: 8,
            border: '1px solid rgba(0,229,255,0.4)',
            background: 'rgba(0,229,255,0.06)',
            boxShadow: '0 0 24px -8px rgba(0,229,255,0.5)',
          }}>
            <IconBolt size={12} style={{ color: 'var(--accent-cyan)' }}/>
            <span style={{ fontWeight: 500 }}>Nexus Pro</span>
          </div>
        </div>

        {/* Account section */}
        <SectionDivider label="Account" />

        {/* Usage card */}
        <div style={{
          background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
          borderRadius: 14, padding: 0, overflow: 'hidden', marginBottom: 18,
        }}>
          <div style={{
            padding: '18px 22px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex', alignItems: 'center',
          }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 500 }}>Usage this month</div>
              <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)', marginTop: 2 }}>
                Renews May 31
              </div>
            </div>
            <div style={{ flex: 1 }}/>
            <a style={{ fontSize: 13, color: 'var(--accent-cyan)', textDecoration: 'none' }}>
              Manage subscription →
            </a>
          </div>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
          }}>
            {[
              { k: 'Voice minutes', v: '218', max: '500', pct: 0.43 },
              { k: 'Sandboxes created', v: '37', max: '∞' },
              { k: 'Code exports', v: '12' },
            ].map((m, i) => (
              <div key={i} style={{
                padding: '20px 22px',
                borderRight: i < 2 ? '1px solid var(--border-subtle)' : 'none',
              }}>
                <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)',
                  letterSpacing: '0.12em', textTransform: 'uppercase',
                  fontWeight: 500, marginBottom: 10,
                }}>{m.k}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.02em' }}>{m.v}</span>
                  {m.max && <span style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>/ {m.max}</span>}
                </div>
                {m.pct !== undefined && (
                  <div style={{
                    height: 4, borderRadius: 999, background: '#27272A',
                    marginTop: 12, overflow: 'hidden',
                  }}>
                    <div style={{
                      width: `${m.pct * 100}%`, height: '100%',
                      background: 'linear-gradient(90deg, #00E5FF, #B026FF)',
                      borderRadius: 999,
                      boxShadow: '0 0 8px rgba(0,229,255,0.5)',
                    }}/>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Integrations */}
        <SectionDivider label="Integrations" />
        <div>
          <Row label="GitHub token" sub="Used when exporting code as a private repo. Stored encrypted.">
            <input className="field mono" type="password"
              value={ghToken} onChange={e => setGhToken(e.target.value)}
              placeholder="ghp_•••••••••••••••••" />
          </Row>
          <div style={{ height: 1, background: 'var(--border-subtle)' }}/>
          <Row label="Custom OpenAI key" sub="Bring your own. Bypasses Nexus token quotas for code generation.">
            <input className="field mono" type="password"
              value={oaiKey} onChange={e => setOaiKey(e.target.value)}
              placeholder="sk-•••••••••••••••••••••••••••••••••••" />
          </Row>
        </div>

        {/* Preferences */}
        <SectionDivider label="Preferences" />
        <Row label="Avatar voice" sub="The persona Nexus speaks with during sessions.">
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {[
              { id: 'aiden', name: 'Aiden', desc: 'Calm, measured' },
              { id: 'nova',  name: 'Nova',  desc: 'Warm, energetic' },
              { id: 'kai',   name: 'Kai',   desc: 'Crisp, direct' },
            ].map(v => (
              <button key={v.id} onClick={() => setVoiceId(v.id)} style={{
                padding: '12px 16px', borderRadius: 12, textAlign: 'left',
                background: voiceId === v.id ? 'rgba(0,229,255,0.06)' : 'var(--bg-surface)',
                border: '1px solid ' + (voiceId === v.id ? 'rgba(0,229,255,0.55)' : 'var(--border-subtle)'),
                boxShadow: voiceId === v.id ? '0 0 0 3px rgba(0,229,255,0.08), 0 0 24px -8px rgba(0,229,255,0.5)' : 'none',
                color: 'var(--text-primary)', cursor: 'pointer', minWidth: 140,
                transition: 'all 200ms',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: 999,
                    background: voiceId === v.id ? 'var(--accent-cyan)' : 'var(--border-strong)',
                    boxShadow: voiceId === v.id ? '0 0 8px var(--accent-cyan)' : 'none',
                  }}/>
                  <span style={{ fontWeight: 500, fontSize: 14 }}>{v.name}</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>
                  {v.desc}
                </div>
              </button>
            ))}
          </div>
        </Row>
        <div style={{ height: 1, background: 'var(--border-subtle)' }}/>
        <Row label="Larger terminal font" sub="Bumps xterm.js to 15px for readability on 4K displays.">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className={`toggle ${terminalLg ? 'on' : ''}`}
              onClick={() => setTerminalLg(t => !t)}/>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              {terminalLg ? 'Enabled' : 'Default size'}
            </span>
          </div>
        </Row>
        <div style={{ height: 1, background: 'var(--border-subtle)' }}/>
        <Row label="Thinking-state glow" sub="Animate the avatar's purple halo while it's planning.">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className={`toggle ${thinkingGlow ? 'on' : ''}`}
              onClick={() => setThinkingGlow(t => !t)}/>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              {thinkingGlow ? 'Enabled' : 'Disabled'}
            </span>
          </div>
        </Row>

        {/* Danger Zone */}
        <SectionDivider label="Danger Zone" />
        <div style={{
          padding: 22, borderRadius: 14,
          border: '1px solid rgba(255,68,68,0.3)',
          background: 'rgba(255,68,68,0.03)',
          display: 'flex', alignItems: 'center', gap: 24,
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>
              Delete account
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 4 }}>
              Permanently deletes your sessions, sandboxes, and integrations.
              This cannot be undone.
            </div>
          </div>
          <button className="btn" style={{
            border: '1px solid rgba(255,68,68,0.5)',
            color: '#FF6666',
            background: 'transparent',
          }}>Delete account</button>
        </div>
      </div>
    </div>
  );
};

window.Profile = Profile;
