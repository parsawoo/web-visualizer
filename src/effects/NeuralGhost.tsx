import { useEffect, useRef } from 'react';
import Topbar from '../components/Topbar';
import { usePageChrome } from '../lib/usePageChrome';
import { init } from './engines/neuralGhost';

export default function NeuralGhost() {
  usePageChrome('studio', { '--accent': 'var(--grad-ghost)', '--accent-solid': '#19e3ff' });
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => init(rootRef.current!), []);

  return (
    <div ref={rootRef} className="page studio-page">
      <Topbar title={['Neural', 'Ghost']} />
      <div id="workspace">
        <div className="panel">
          <div className="panel-label">1 · Source</div>
          <div id="sourceContainer"><video id="sourceVideo" controls playsInline></video></div>
        </div>
        <div className="panel">
          <div className="panel-label render">2 · Ghost Render</div>
          <div id="renderArea">
            <canvas id="webglCanvas"></canvas>
            <div id="statusOverlay">
              <div className="spinner" id="loadingSpinner" style={{ display: 'none' }}></div>
              <div id="statusText">영상과 음악을 올린 뒤<br /><span className="hl">[SUMMON GHOST]</span>로 분석을 시작하세요.</div>
              <div className="progress-bar-container" id="progressContainer"><div id="progressBar"></div></div>
            </div>
          </div>
        </div>
      </div>

      <div className="ui-panel">
        <div className="top-controls">
          <div className="control-group"><label className="ctl">AI Cutout · 누끼</label>
            <select id="uiCutout" defaultValue="1">
              <option value="1">ON · 인물만</option>
              <option value="0">OFF · 배경 유지</option>
            </select>
          </div>
          <div className="control-group"><label className="ctl">Glitch Power</label><input type="range" id="uiGlitch" min="0" max="5" step="0.1" defaultValue="2.0" /></div>
          <div className="control-group"><label className="ctl">React Style</label>
            <select id="uiReactMode" defaultValue="0">
              <option value="0">Brightness · 명도</option>
              <option value="1">Color Shift · 사이버톤</option>
              <option value="2">1-Bit Dither · 흑백</option>
              <option value="3">4-Bit Dither · 게임보이</option>
              <option value="4">8-Bit Gray · 레트로</option>
              <option value="5">Pixel Break · 모자이크</option>
              <option value="6">Flash Invert · 섬광반전</option>
              <option value="7">Zoom Blur · 공간흡수</option>
            </select>
          </div>
          <div className="control-group"><label className="ctl">EQ Signal</label><canvas id="audioVisualizer" width="150" height="42"></canvas></div>
        </div>
        <div className="bottom-controls">
          <div className="control-group"><label className="ctl">1 · Video (MP4)</label><input type="file" id="visualUpload" accept="video/*" /></div>
          <div className="control-group"><label className="ctl">2 · Audio (MP3/WAV)</label><input type="file" id="audioUpload" accept="audio/*" /></div>
          <button className="btn" id="btnReset">Reset</button>
          <button className="btn primary" id="btnMake" disabled>3 · Summon Ghost</button>
          <button className="btn go" id="btnPlay" disabled>Play</button>
          <button className="btn rec" id="btnRecord" disabled>● Export</button>
        </div>
      </div>
    </div>
  );
}
