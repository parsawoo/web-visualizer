import { useEffect, useRef } from 'react';
import Topbar from '../components/Topbar';
import { usePageChrome } from '../lib/usePageChrome';
import { init } from './engines/cyberTracker';

export default function CyberTracker() {
  usePageChrome('studio', { '--accent': 'var(--grad-cyber)', '--accent-solid': '#ff2d6b' });
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => init(rootRef.current!), []);

  return (
    <div ref={rootRef} className="page studio-page">
      <div id="mainLoader" style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '1rem', justifyContent: 'center', alignItems: 'center', background: 'var(--bg-0)' }}>
        <div className="spinner"></div>
        <div style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.18em', color: 'var(--accent-solid)' }}>INITIALIZING DUAL AI ENGINE…</div>
      </div>

      <Topbar title={['Cyber', 'Tracker']} />
      <div id="workspace">
        <div className="panel">
          <div className="panel-label">1 · Source</div>
          <div id="sourceContainer"><video id="sourceVideo" muted playsInline></video></div>
        </div>
        <div className="panel">
          <div className="panel-label render">2 · AI Render</div>
          <div id="renderArea">
            <canvas id="webglCanvas"></canvas>
            <canvas id="hudCanvas"></canvas>
            <div id="statusOverlay">
              <div id="statusText">영상을 올리고 (선택) 음악을 더한 뒤<br /><span className="hl">[ANALYZE]</span>로 추적을 시작하세요.</div>
              <div className="progress-bar-container" id="progressContainer"><div id="progressBar"></div></div>
            </div>
          </div>
        </div>
      </div>

      <div className="ui-panel">
        <div className="top-controls">
          <div className="control-group"><label className="ctl">Box Style</label>
            <select id="uiBoxStyle" defaultValue="label">
              <option value="scope">Scope Bracket</option>
              <option value="label">Label Info</option>
              <option value="glow">Neon Glow</option>
              <option value="basic">Basic</option>
            </select>
          </div>
          <div className="control-group"><label className="ctl">Effect (Shader)</label>
            <select id="uiEffect" defaultValue="9">
              <option value="0">None</option>
              <option value="2">Cyber Pixel</option>
              <option value="4">Target Zoom</option>
              <option value="8">Retro Dither (Color)</option>
              <option value="9">Classic B&W Dither</option>
            </select>
          </div>
          <div className="control-group"><label className="ctl">Effect Int</label><input type="range" id="uiIntensity" min="0.1" max="2.0" step="0.1" defaultValue="1.0" /></div>
          <div className="control-group"><label className="ctl">Audio React</label><input type="range" id="uiAudioReact" min="0" max="2.0" step="0.1" defaultValue="1.0" /></div>
          <div className="control-group"><label className="ctl">Max Objects</label><input type="range" id="uiObjects" min="5" max="50" step="1" defaultValue="20" /></div>
          <div className="control-group"><label className="ctl">AI Sensitivity</label><input type="range" id="uiSensitivity" min="0.01" max="0.5" step="0.01" defaultValue="0.1" /></div>
          <div className="control-group"><label className="ctl">Face Detail</label><input type="range" id="uiNodes" min="0" max="10" step="1" defaultValue="4" /></div>
          <div className="control-group"><label className="ctl">Line Style</label>
            <select id="uiLineStyle" defaultValue="curved">
              <option value="solid">Solid</option>
              <option value="dashed">Dashed</option>
              <option value="curved">Curved</option>
            </select>
          </div>
          <div className="control-group"><label className="ctl">Web Density</label><input type="range" id="uiLineDensity" min="0" max="0.6" step="0.01" defaultValue="0.3" /></div>
          <div className="control-group"><label className="ctl">Color</label>
            <select id="uiColor" defaultValue="#ff2d6b">
              <option value="#ffffff">Pure White</option>
              <option value="#19e3ff">Neon Cyan</option>
              <option value="#ff2d6b">Laser Pink</option>
              <option value="#ffb03d">Amber</option>
            </select>
          </div>
          <div className="control-group"><label className="ctl">EQ Signal</label><canvas id="audioVisualizer" width="150" height="42"></canvas></div>
        </div>
        <div className="bottom-controls">
          <div className="control-group"><label className="ctl">1 · Video (MP4)</label><input type="file" id="imageUpload" accept="video/*" /></div>
          <div className="control-group"><label className="ctl">2 · Audio (옵션)</label><input type="file" id="audioUpload" accept="audio/*" /></div>
          <button className="btn" id="btnReset">Reset</button>
          <button className="btn primary" id="btnAnalyze" disabled>3 · Analyze</button>
          <button className="btn go" id="btnPlay" disabled>Play</button>
          <button className="btn rec" id="btnRecord">● Export</button>
        </div>
      </div>
    </div>
  );
}
