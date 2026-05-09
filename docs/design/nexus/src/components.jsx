/* Shared Nexus components */

const Logo = ({ size = 22 }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="nx-grad" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#00E5FF" />
          <stop offset="1" stopColor="#B026FF" />
        </linearGradient>
      </defs>
      <path d="M4 4 L4 20 M4 4 L20 20 M20 4 L20 20" stroke="url(#nx-grad)" strokeWidth="2.2" strokeLinecap="round"/>
    </svg>
    <span style={{
      fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em',
      fontFamily: 'Inter'
    }}>Nexus</span>
  </div>
);

const StatusBadge = ({ state = 'listening' }) => {
  const labels = { listening: 'Listening', thinking: 'Thinking', speaking: 'Speaking' };
  return (
    <div className="glass-pill" style={{
      display: 'inline-flex', alignItems: 'center', gap: 8,
      padding: '6px 12px', fontSize: 12, fontWeight: 500,
      letterSpacing: '0.01em',
    }}>
      <span className={`status-dot ${state}`} />
      <span style={{ color: 'var(--text-primary)' }}>{labels[state]}</span>
    </div>
  );
};

/* Avatar presence — abstract orb with state-driven glow.
   This is a placeholder for the live Tavus video feed. */
const AvatarPresence = ({ state = 'speaking', label = true }) => {
  return (
    <div className="presence-stage" data-state={state}>
      <div className="presence-glow" />
      <div className="presence-orb" />
      <div className="presence-grain" />
      {/* tiny "REC" / live indicator */}
      <div style={{
        position: 'absolute', top: 16, right: 16,
        display: 'inline-flex', alignItems: 'center', gap: 6,
        fontSize: 10.5, letterSpacing: '0.14em', color: 'rgba(255,255,255,0.55)',
        fontFamily: 'JetBrains Mono', textTransform: 'uppercase'
      }}>
        <span style={{
          width: 6, height: 6, borderRadius: 999,
          background: '#FF4444', boxShadow: '0 0 8px #FF4444',
          animation: 'pulse-cyan 1.6s ease-in-out infinite'
        }}/>
        live
      </div>
    </div>
  );
};

/* Audio waveform that animates */
const Waveform = ({ active = true, bars = 14 }) => {
  const [tick, setTick] = React.useState(0);
  React.useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setTick(t => t + 1), 110);
    return () => clearInterval(id);
  }, [active]);
  const heights = React.useMemo(() => {
    return Array.from({ length: bars }).map((_, i) => {
      const seed = (Math.sin(tick * 0.7 + i * 1.3) + Math.cos(tick * 0.4 + i * 0.7)) * 0.5 + 0.5;
      const min = active ? 0.2 : 0.15;
      return min + seed * (active ? 0.8 : 0.05);
    });
  }, [tick, bars, active]);
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 3, height: 18,
    }}>
      {heights.map((h, i) => (
        <div key={i} style={{
          width: 2, height: `${h * 100}%`,
          background: active ? 'var(--accent-cyan)' : 'var(--text-tertiary)',
          borderRadius: 1,
          boxShadow: active ? '0 0 6px var(--accent-cyan)' : 'none',
          transition: 'height 110ms ease'
        }}/>
      ))}
    </div>
  );
};

/* Avatar pill (video controls) */
const AvatarControls = ({ muted, onToggleMute, onEnd, state }) => (
  <div className="glass-pill" style={{
    display: 'inline-flex', alignItems: 'center', gap: 4,
    padding: '8px 8px',
  }}>
    <button className="btn-icon" onClick={onToggleMute}
      title={muted ? 'Unmute' : 'Mute'}
      style={{ width: 36, height: 36, borderRadius: 999,
        color: muted ? 'var(--text-danger)' : 'var(--text-primary)' }}>
      {muted ? <IconMicOff size={16}/> : <IconMic size={16}/>}
    </button>
    <div style={{
      padding: '0 12px', display: 'flex', alignItems: 'center',
      borderLeft: '1px solid var(--border-subtle)',
      borderRight: '1px solid var(--border-subtle)',
      height: 24, color: 'var(--accent-cyan)'
    }}>
      <Waveform active={!muted && state !== 'thinking'} />
    </div>
    <button className="btn-icon"
      title="End session"
      onClick={onEnd}
      style={{
        width: 36, height: 36, borderRadius: 999,
        background: 'rgba(255,68,68,0.12)',
        color: '#FF6666',
        border: '1px solid rgba(255,68,68,0.3)'
      }}>
      <IconPhone size={15} style={{ transform: 'rotate(135deg)' }}/>
    </button>
  </div>
);

/* User avatar circle */
const UserAvatar = ({ initials = 'AK', src, size = 32, ring = false, onClick }) => (
  <button onClick={onClick} className="user-avatar" style={{
    width: size, height: size, borderRadius: '50%',
    background: 'linear-gradient(135deg, #2a2a2e, #18181b)',
    color: 'var(--text-primary)',
    fontSize: size * 0.36, fontWeight: 600,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    border: ring ? '2px solid rgba(0,229,255,0.6)' : '1px solid var(--border-subtle)',
    boxShadow: ring ? '0 0 14px -2px rgba(0,229,255,0.5)' : 'none',
    backgroundImage: src ? `url(${src})` : undefined,
    backgroundSize: 'cover', backgroundPosition: 'center',
    cursor: onClick ? 'pointer' : 'default',
    transition: 'box-shadow 200ms, border-color 200ms',
    flexShrink: 0,
  }}>
    {!src && initials}
  </button>
);

/* Section divider with label */
const SectionDivider = ({ label }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 12, margin: '40px 0 20px',
  }}>
    <div style={{
      fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase',
      color: 'var(--text-tertiary)', fontWeight: 500,
    }}>{label}</div>
    <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }}/>
  </div>
);

Object.assign(window, {
  Logo, StatusBadge, AvatarPresence, Waveform, AvatarControls,
  UserAvatar, SectionDivider,
});
