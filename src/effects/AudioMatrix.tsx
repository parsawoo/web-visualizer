import { useEffect, useRef } from 'react';
import Topbar from '../components/Topbar';
import { usePageChrome } from '../lib/usePageChrome';
import { init } from './engines/audioMatrix';

export default function AudioMatrix() {
  usePageChrome('studio', { '--accent': 'var(--grad-matrix)', '--accent-solid': '#a855f7' });
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => init(rootRef.current!), []);

  return (
    <div ref={rootRef} className="page studio-page">
      <Topbar title={['Audio', 'Matrix']} />
      <div id="workspace">
        <div className="panel">
          <div className="panel-label">1 · Source</div>
          <div id="sourceContainer">
            <video id="sourceVideo" controls playsInline></video>
            <img id="sourceImage" alt="" />
          </div>
        </div>
        <div className="panel">
          <div className="panel-label render">2 · Matrix Render</div>
          <div id="renderArea">
            <canvas id="webglCanvas"></canvas>
            <div id="statusOverlay">
              <div className="spinner" id="loadingSpinner" style={{ display: 'none' }}></div>
              <div id="statusText">영상과 음악을 올린 뒤<br /><span className="hl">[MAKE MATRIX]</span>로 오디오를 분석하세요.</div>
              <div className="progress-bar-container" id="progressContainer"><div id="progressBar"></div></div>
            </div>
          </div>
        </div>
      </div>

      <div className="ui-panel">
        <div className="top-controls">
          <div className="control-group"><label className="ctl">Resolution</label>
            <select id="uiResolution" defaultValue="256">
              <option value="128">Low · 16k</option>
              <option value="256">Mid · 65k</option>
              <option value="384">High · 147k</option>
            </select>
          </div>
          <div className="control-group"><label className="ctl">Audio React</label><input type="range" id="uiSensitivity" min="0" max="5" step="0.1" defaultValue="1.5" /></div>
          <div className="control-group"><label className="ctl">Z-Explosion</label><input type="range" id="uiDispersion" min="0" max="10" step="0.1" defaultValue="2.0" /></div>
          <div className="control-group"><label className="ctl">Particle Size</label><input type="range" id="uiPointSize" min="1" max="10" step="0.5" defaultValue="3.0" /></div>
          <div className="control-group"><label className="ctl">React Style</label>
            <select id="uiReactMode" defaultValue="0">
              <option value="0">Brightness · 명도</option>
              <option value="1">Color Shift · 톤</option>
            </select>
          </div>
          <div className="control-group"><label className="ctl">Color Mode</label>
            <select id="uiColorMode" defaultValue="0">
              <option value="0">Original</option>
              <option value="1">Neon Matrix</option>
              <option value="2">Cyberpunk</option>
              <option value="3">Golden Heat</option>
            </select>
          </div>
          <div className="control-group"><label className="ctl">Baked EQ</label><canvas id="audioVisualizer" width="150" height="42"></canvas></div>
          <div className="realtime-hint">※ 재생 중 슬라이더를 움직이면 실시간으로 반영됩니다.</div>
        </div>
        <div className="bottom-controls">
          <div className="control-group"><label className="ctl">1 · Visual (MP4/IMG)</label><input type="file" id="visualUpload" accept="video/*,image/*" /></div>
          <div className="control-group"><label className="ctl">2 · Audio (MP3/WAV)</label><input type="file" id="audioUpload" accept="audio/*" /></div>
          <button className="btn primary" id="btnMake" disabled>3 · Make Matrix</button>
          <button className="btn go" id="btnPlay" disabled>Play</button>
          <button className="btn rec" id="btnRecord" disabled>● Export</button>
        </div>
      </div>
    </div>
  );
}
