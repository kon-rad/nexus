/* App shell — routes between Landing / Workspace / Profile */

const TWEAKS = /*EDITMODE-BEGIN*/{
  "accent": "cyan-purple",
  "leftPanelWidth": 32,
  "fontPair": "inter-jetbrains",
  "ambientBg": true
}/*EDITMODE-END*/;

const ACCENT_PALETTES = {
  'cyan-purple': { cyan: '#00E5FF', purple: '#B026FF' },
  'mint-orange': { cyan: '#5AF7B0', purple: '#FF8A3D' },
  'azure-rose':  { cyan: '#5B8DFF', purple: '#FF4D8B' },
  'lime-violet': { cyan: '#C7FF3D', purple: '#9C5BFF' },
};

const FONT_PAIRS = {
  'inter-jetbrains':  { ui: 'Inter',           mono: 'JetBrains Mono' },
  'geist-jetbrains':  { ui: 'Geist',           mono: 'JetBrains Mono' },
  'space-mono':       { ui: 'Space Grotesk',   mono: 'Space Mono' },
};

const App = () => {
  const [route, setRoute] = React.useState('landing');
  const [tweaks, setTweak] = useTweaks(TWEAKS);
  const [leftWidth, setLeftWidth] = React.useState(tweaks.leftPanelWidth);

  // Apply accent palette to CSS vars
  React.useEffect(() => {
    const p = ACCENT_PALETTES[tweaks.accent] || ACCENT_PALETTES['cyan-purple'];
    document.documentElement.style.setProperty('--accent-cyan', p.cyan);
    document.documentElement.style.setProperty('--accent-purple', p.purple);
    // soft variants
    const hexA = (hex, a) => {
      const r = parseInt(hex.slice(1,3),16);
      const g = parseInt(hex.slice(3,5),16);
      const b = parseInt(hex.slice(5,7),16);
      return `rgba(${r},${g},${b},${a})`;
    };
    document.documentElement.style.setProperty('--accent-cyan-soft', hexA(p.cyan, 0.18));
    document.documentElement.style.setProperty('--accent-purple-soft', hexA(p.purple, 0.18));
  }, [tweaks.accent]);

  React.useEffect(() => {
    const f = FONT_PAIRS[tweaks.fontPair] || FONT_PAIRS['inter-jetbrains'];
    document.body.style.fontFamily = `'${f.ui}', system-ui, sans-serif`;
    document.documentElement.style.setProperty('--mono-stack', `'${f.mono}', monospace`);
    // also update mono class via sheet override
    let sheet = document.getElementById('__font-override');
    if (!sheet) {
      sheet = document.createElement('style');
      sheet.id = '__font-override';
      document.head.appendChild(sheet);
    }
    sheet.textContent = `.mono, code, pre, .code-line, .term-line { font-family: '${f.mono}', monospace !important; }`;
  }, [tweaks.fontPair]);

  React.useEffect(() => {
    setLeftWidth(tweaks.leftPanelWidth);
  }, [tweaks.leftPanelWidth]);

  return (
    <div style={{ height: '100%', position: 'relative' }}>
      {route === 'landing' && (
        <Landing onEnter={() => setRoute('workspace')}/>
      )}
      {route === 'workspace' && (
        <Workspace
          leftWidth={leftWidth}
          setLeftWidth={(w) => { setLeftWidth(w); }}
          onNavProfile={() => setRoute('profile')}
          onLeave={() => setRoute('landing')}/>
      )}
      {route === 'profile' && (
        <Profile onBack={() => setRoute('workspace')}/>
      )}

      {/* Hidden floating route switcher (always visible) */}
      <div style={{
        position: 'fixed', bottom: 16, left: 16, zIndex: 100,
        display: 'flex', gap: 4, padding: 4,
      }} className="glass-pill">
        {[
          { id: 'landing',   label: 'Landing' },
          { id: 'workspace', label: 'Workspace' },
          { id: 'profile',   label: 'Profile' },
        ].map(r => (
          <button key={r.id} onClick={() => setRoute(r.id)} style={{
            padding: '6px 12px', fontSize: 11.5, fontWeight: 500,
            borderRadius: 999, letterSpacing: '0.02em',
            background: route === r.id ? 'rgba(0,229,255,0.15)' : 'transparent',
            color: route === r.id ? 'var(--accent-cyan)' : 'var(--text-secondary)',
            border: route === r.id ? '1px solid rgba(0,229,255,0.4)' : '1px solid transparent',
            boxShadow: route === r.id ? '0 0 14px -4px rgba(0,229,255,0.5)' : 'none',
            cursor: 'pointer', transition: 'all 180ms',
          }}>{r.label}</button>
        ))}
      </div>

      {/* Tweaks panel */}
      <TweaksPanel>
        <TweakSection title="Theme">
          <TweakColor
            label="Accent palette"
            value={tweaks.accent}
            options={[
              ['#00E5FF','#B026FF'],
              ['#5AF7B0','#FF8A3D'],
              ['#5B8DFF','#FF4D8B'],
              ['#C7FF3D','#9C5BFF'],
            ]}
            onChange={(v) => {
              // map array back to id
              const id = v[0] === '#5AF7B0' ? 'mint-orange' :
                         v[0] === '#5B8DFF' ? 'azure-rose' :
                         v[0] === '#C7FF3D' ? 'lime-violet' : 'cyan-purple';
              setTweak('accent', id);
            }}
          />
          <TweakSelect label="Font pair" value={tweaks.fontPair}
            options={[
              { value: 'inter-jetbrains', label: 'Inter + JetBrains' },
              { value: 'geist-jetbrains', label: 'Geist + JetBrains' },
              { value: 'space-mono',      label: 'Space Grotesk + Space Mono' },
            ]}
            onChange={(v) => setTweak('fontPair', v)}/>
        </TweakSection>
        <TweakSection title="Workspace">
          <TweakSlider label="Avatar panel width" min={20} max={50} step={1}
            value={tweaks.leftPanelWidth}
            onChange={(v) => setTweak('leftPanelWidth', v)}
            unit="%"/>
        </TweakSection>
      </TweaksPanel>
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App/>);
