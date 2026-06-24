import { useEffect, useRef } from 'react';
import Topbar from '../components/Topbar';
import { usePageChrome } from '../lib/usePageChrome';
import { init } from './engines/asciiArt';

export default function AsciiArt() {
  usePageChrome('studio', { '--accent': 'var(--grad-ascii)', '--accent-solid': '#b6ff3d' });
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => init(rootRef.current!), []);

  return (
    <div ref={rootRef} className="page studio-page">
      <Topbar title={['Ascii', 'Art']} />
      <div id="workspace">
        <div className="panel">
          <div className="panel-label">1 · Source</div>
          <div id="sourceContainer">
            <video id="sourceVideo" muted playsInline></video>
            <img id="sourceImage" alt="" />
          </div>
        </div>
        <div className="panel">
          <div className="panel-label render">2 · ASCII Render</div>
          <div id="renderArea">
            <canvas id="webglCanvas"></canvas>
            <div id="statusOverlay">
              <div className="spinner" id="loadingSpinner" style={{ display: 'none' }}></div>
              <div id="statusText">영상/이미지와 음악을 올린 뒤<br /><span className="hl">[BUILD ASCII]</span>로 분석을 시작하세요.</div>
              <div className="progress-bar-container" id="progressContainer"><div id="progressBar"></div></div>
            </div>
          </div>
        </div>
      </div>

      <div className="ui-panel">
        <div className="top-controls">
          <div className="control-group"><label className="ctl">Cell Size · 밀도</label><input type="range" id="uiCell" min="5" max="22" step="1" defaultValue="10" /></div>
          <div className="control-group"><label className="ctl">ASCII Amount · 기본</label><input type="range" id="uiAmount" min="0" max="1" step="0.05" defaultValue="0.15" /></div>
          <div className="control-group"><label className="ctl">Audio React</label><input type="range" id="uiReact" min="0" max="2" step="0.1" defaultValue="1.2" /></div>
          <div className="control-group"><label className="ctl">React Band</label>
            <select id="uiBand" defaultValue="both">
              <option value="both">Both · 음량+고음</option>
              <option value="volume">Volume · 음량</option>
              <option value="treble">Treble · 고음</option>
            </select>
          </div>
          <div className="control-group"><label className="ctl">Color Mode</label>
            <select id="uiColor" defaultValue="green">
              <option value="green">Matrix Green</option>
              <option value="color">Original Color</option>
              <option value="mono">Mono</option>
              <option value="amber">Amber</option>
            </select>
          </div>
          <div className="control-group"><label className="ctl">Char Set</label>
            <select id="uiCharset" defaultValue="standard">
              <option value="standard">Standard</option>
              <option value="detailed">Detailed</option>
              <option value="blocks">Blocks</option>
            </select>
          </div>
          <div className="control-group"><label className="ctl">Background</label>
            <select id="uiBg" defaultValue="black">
              <option value="black">Black</option>
              <option value="original">Original</option>
              <option value="white">White</option>
            </select>
          </div>
          <div className="control-group"><label className="ctl">EQ Signal</label><canvas id="audioVisualizer" width="150" height="42"></canvas></div>
          <div className="realtime-hint">※ 음량·고음이 클수록 완전 ASCII로 디졸브 · 슬라이더는 재생 중 실시간 반영</div>
        </div>
        <div className="bottom-controls">
          <div className="control-group"><label className="ctl">1 · Visual (MP4/IMG)</label><input type="file" id="visualUpload" accept="video/*,image/*" /></div>
          <div className="control-group"><label className="ctl">2 · Audio (MP3/WAV)</label><input type="file" id="audioUpload" accept="audio/*" /></div>
          <button className="btn primary" id="btnMake" disabled>3 · Build ASCII</button>
          <button className="btn go" id="btnPlay" disabled>Play</button>
          <button className="btn" id="btnFrame" disabled>Frame ↓</button>
          <button className="btn rec" id="btnRecord" disabled>● Export</button>
        </div>
      </div>
    </div>
  );
}
