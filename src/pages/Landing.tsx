import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePageChrome } from '../lib/usePageChrome';
import { initLanding } from './landingCarousel';

export default function Landing() {
  usePageChrome('landing');
  const rootRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  useEffect(() => initLanding(rootRef.current!, navigate), []);

  return (
    <div ref={rootRef} className="page landing-page">
      <div id="intro">
        <h1 className="intro-title">
          <span className="grad-text">Web</span><span className="dash">-</span><span className="grad-text">Visualizer</span>
        </h1>
        <div className="intro-sub">audio reactive · vfx studio</div>
      </div>

      <div id="stage">
        <div className="brand-mini grad-text">Web-Visualizer</div>
        <div id="carousel"><div id="track"></div></div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.1rem' }}>
          <div id="dots"></div>
          <div className="stage-hint">
            <span className="wheel-ico"></span>
            휠 · 드래그 · ← → 로 카드 선택 &nbsp;·&nbsp; 클릭하여 입장
          </div>
        </div>
      </div>
    </div>
  );
}
