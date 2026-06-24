import type { NavigateFunction } from 'react-router-dom';

interface FX {
  id: string; num: string; a: [string, string]; accent: string;
  tag: string; pills: string[]; draw: (ctx: CanvasRenderingContext2D, w: number, h: number, t: number) => void;
}

let introPlayed = false;

export function initLanding(root: HTMLElement, navigate: NavigateFunction): () => void {
  const EFFECTS: FX[] = [
    { id: 'audio-matrix', num: 'EFFECT 01', a: ['Audio', 'Matrix'], accent: 'var(--grad-matrix)', tag: '영상 픽셀이 음악에 맞춰 파티클로 분산·폭발하는 비주얼라이저.', pills: ['MP4 IN/OUT', 'MUSIC', 'WEBGL'], draw: drawMatrix },
    { id: 'neural-ghost', num: 'EFFECT 02', a: ['Neural', 'Ghost'], accent: 'var(--grad-ghost)', tag: 'AI 인물 누끼 + 비트에 반응하는 글리치·디더·섬광 효과.', pills: ['MP4 IN/OUT', 'MUSIC', 'AI CUTOUT'], draw: drawGhost },
    { id: 'cyber-tracker', num: 'EFFECT 03', a: ['Cyber', 'Tracker'], accent: 'var(--grad-cyber)', tag: '객체·얼굴을 추적하는 HUD가 사운드에 맞춰 맥동하는 트래커.', pills: ['MP4 IN/OUT', 'MUSIC', 'TRACKING'], draw: drawCyber },
    { id: 'ascii-art', num: 'EFFECT 04', a: ['Ascii', 'Art'], accent: 'var(--grad-ascii)', tag: '음량·고음이 커질수록 영상이 완전 ASCII로 디졸브되는 효과.', pills: ['MP4 IN/OUT', 'MUSIC', 'DISSOLVE'], draw: drawAscii },
  ];

  const track = root.querySelector('#track') as HTMLElement;
  const dotsWrap = root.querySelector('#dots') as HTMLElement;
  const carousel = root.querySelector('#carousel') as HTMLElement;
  const intro = root.querySelector('#intro') as HTMLElement;
  const stage = root.querySelector('#stage') as HTMLElement;
  const N = EFFECTS.length;
  let active = 0, locked = false;

  const cards = EFFECTS.map((fx, i) => {
    const el = document.createElement('div');
    el.className = 'card';
    el.style.setProperty('--accent', fx.accent);
    el.innerHTML = `
      <div class="accent-bar"></div>
      <div class="thumb"><canvas></canvas></div>
      <div class="enter-hint">Enter ↵</div>
      <div class="meta">
        <div class="num">${fx.num}</div>
        <div class="name">${fx.a[0]} <span class="accent-text">${fx.a[1]}</span></div>
        <div class="tag">${fx.tag}</div>
        <div class="pills">${fx.pills.map((p) => `<span class="pill">${p}</span>`).join('')}</div>
      </div>`;
    el.addEventListener('click', () => { if (i === active) enter(fx.id); else go(i); });
    track.appendChild(el);

    const dot = document.createElement('button');
    dot.addEventListener('click', () => go(i));
    dotsWrap.appendChild(dot);

    const canvas = el.querySelector('canvas') as HTMLCanvasElement;
    return { el, dot, canvas, ctx: canvas.getContext('2d')!, draw: fx.draw };
  });

  function enter(id: string) { navigate(`/effects/${id}`); }
  function wrapOffset(d: number) { let o = d % N; if (o > N / 2) o -= N; if (o < -N / 2) o += N; return o; }
  function layout() {
    cards.forEach((c, i) => {
      const off = wrapOffset(i - active);
      const abs = Math.abs(off);
      const x = off * 256, ry = -off * 36, z = -abs * 200;
      const scale = 1 - abs * 0.13, op = abs > 1.5 ? 0 : 1 - abs * 0.22;
      c.el.style.transform = `translateX(${x}px) translateZ(${z}px) rotateY(${ry}deg) scale(${scale})`;
      c.el.style.opacity = String(op);
      c.el.style.zIndex = String(100 - Math.round(abs * 10));
      c.el.classList.toggle('is-active', off === 0);
      c.el.style.pointerEvents = abs > 1.5 ? 'none' : 'auto';
      c.dot.classList.toggle('on', off === 0);
    });
  }
  function go(i: number) { active = ((i % N) + N) % N; layout(); locked = true; setTimeout(() => (locked = false), 380); }
  function step(dir: number) { if (!locked) go(active + dir); }

  /* wheel */
  let wheelAcc = 0;
  const onWheel = (e: WheelEvent) => {
    if (intro && !intro.classList.contains('gone')) return;
    e.preventDefault();
    wheelAcc += e.deltaY;
    if (Math.abs(wheelAcc) > 60) { step(wheelAcc > 0 ? 1 : -1); wheelAcc = 0; }
  };
  window.addEventListener('wheel', onWheel, { passive: false });

  /* drag */
  let dragX: number | null = null, dragged = 0;
  const onDown = (e: PointerEvent) => { dragX = e.clientX; dragged = 0; };
  const onMove = (e: PointerEvent) => { if (dragX === null) return; dragged = e.clientX - dragX; };
  const onUp = () => { if (dragX === null) return; if (Math.abs(dragged) > 70) step(dragged < 0 ? 1 : -1); dragX = null; dragged = 0; };
  carousel.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);

  /* keyboard */
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight') step(1);
    else if (e.key === 'ArrowLeft') step(-1);
    else if (e.key === 'Enter') enter(EFFECTS[active].id);
  };
  window.addEventListener('keydown', onKey);

  /* intro */
  layout();
  let t1 = 0, t2 = 0;
  if (introPlayed) { intro.classList.add('gone'); stage.classList.add('show'); }
  else {
    introPlayed = true;
    t1 = window.setTimeout(() => stage.classList.add('show'), 2200);
    t2 = window.setTimeout(() => intro.classList.add('gone'), 2600);
  }

  /* preview loop */
  let raf = 0, start: number | null = null;
  function loop(ts: number) {
    if (start === null) start = ts;
    const t = (ts - start) * 0.001;
    cards.forEach((c) => { const { w, h } = fitCanvas(c.canvas); c.draw(c.ctx, w, h, t); });
    raf = requestAnimationFrame(loop);
  }
  raf = requestAnimationFrame(loop);

  return () => {
    cancelAnimationFrame(raf);
    clearTimeout(t1); clearTimeout(t2);
    window.removeEventListener('wheel', onWheel);
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    carousel.removeEventListener('pointerdown', onDown);
  };
}

/* ---------- mini preview helpers ---------- */
function fitCanvas(canvas: HTMLCanvasElement) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const r = canvas.getBoundingClientRect();
  const w = Math.max(2, r.width), h = Math.max(2, r.height);
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
  }
  canvas.getContext('2d')!.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { w, h };
}
function beat(t: number, speed = 2.0) { return Math.pow(Math.max(0, Math.sin(t * speed)), 8); }

function drawMatrix(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  ctx.clearRect(0, 0, w, h);
  const b = beat(t, 2.4), cols = 18, rows = 13;
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const px = (x + 0.5) / cols * w, py = (y + 0.5) / rows * h;
    const n = Math.sin(x * 0.7 + y * 0.5 + t * 2);
    const disp = (b * 14 + 2) * n, r = 1.2 + b * 2.0 + Math.abs(n) * 1.2, hue = 280 - (x / cols) * 60;
    ctx.fillStyle = `hsla(${hue},90%,${55 + b * 20}%,${0.5 + Math.abs(n) * 0.4})`;
    ctx.beginPath(); ctx.arc(px + disp * 0.4, py - disp, r, 0, Math.PI * 2); ctx.fill();
  }
}
function drawGhost(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  ctx.clearRect(0, 0, w, h);
  const b = beat(t, 1.8), cx = w / 2, cy = h * 0.62;
  ctx.fillStyle = `rgba(25,227,255,${0.18 + b * 0.25})`;
  ctx.beginPath(); ctx.ellipse(cx, cy, w * 0.22, h * 0.34, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = `rgba(0,255,178,${0.22 + b * 0.3})`;
  ctx.beginPath(); ctx.arc(cx, cy - h * 0.28, w * 0.13, 0, Math.PI * 2); ctx.fill();
  const slices = 7;
  for (let i = 0; i < slices; i++) {
    const sy = (i / slices) * h + ((t * 30) % (h / slices)), sh = h / slices * 0.5;
    const shift = Math.sin(i * 9.1 + t * 6) * (b * 24 + 3);
    ctx.fillStyle = i % 2 ? 'rgba(255,45,149,0.20)' : 'rgba(25,227,255,0.20)';
    ctx.fillRect(shift, sy, w, sh);
  }
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1);
}
function drawCyber(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  ctx.clearRect(0, 0, w, h);
  const b = beat(t, 2.2);
  const nodes = [
    { x: 0.28 + Math.sin(t * 0.9) * 0.06, y: 0.34 + Math.cos(t * 0.7) * 0.05, s: 0.18 },
    { x: 0.68 + Math.sin(t * 1.1 + 2) * 0.05, y: 0.40 + Math.cos(t) * 0.05, s: 0.22 },
    { x: 0.50 + Math.sin(t * 0.6 + 1) * 0.05, y: 0.70 + Math.cos(t * 1.3) * 0.04, s: 0.15 },
  ];
  const pts = nodes.map((n) => ({ x: n.x * w, y: n.y * h, bw: n.s * w, bh: n.s * h * 1.2 }));
  ctx.strokeStyle = `rgba(255,176,61,${0.25 + b * 0.4})`; ctx.lineWidth = 1; ctx.setLineDash([3, 5]);
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) { ctx.beginPath(); ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(pts[j].x, pts[j].y); ctx.stroke(); }
  ctx.setLineDash([]);
  pts.forEach((p, i) => {
    const pad = b * 6, x = p.x - p.bw / 2 - pad, y = p.y - p.bh / 2 - pad, bw = p.bw + pad * 2, bh = p.bh + pad * 2, L = Math.min(bw, bh) * 0.28;
    ctx.strokeStyle = i === 1 ? `rgba(255,45,107,${0.7 + b * 0.3})` : `rgba(255,176,61,${0.6 + b * 0.3})`;
    ctx.lineWidth = 1.4; ctx.beginPath();
    ctx.moveTo(x, y + L); ctx.lineTo(x, y); ctx.lineTo(x + L, y);
    ctx.moveTo(x + bw - L, y); ctx.lineTo(x + bw, y); ctx.lineTo(x + bw, y + L);
    ctx.moveTo(x, y + bh - L); ctx.lineTo(x, y + bh); ctx.lineTo(x + L, y + bh);
    ctx.moveTo(x + bw - L, y + bh); ctx.lineTo(x + bw, y + bh); ctx.lineTo(x + bw, y + bh - L);
    ctx.stroke();
  });
}
function drawAscii(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  ctx.clearRect(0, 0, w, h);
  const b = beat(t, 2.0), ramp = ' .:-=+*#%@', cell = 11;
  ctx.font = `${cell}px 'Space Mono', monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const cx = w / 2, cy = h * 0.5;
  for (let y = 0; y < h; y += cell) for (let x = 0; x < w; x += cell) {
    const d = Math.hypot(x - cx, y - cy) / (w * 0.55);
    let br = 0.5 + 0.5 * Math.sin(d * 7 - t * 2.2); br *= (0.55 + 0.45 * b);
    const idx = Math.max(0, Math.min(ramp.length - 1, Math.floor(br * (ramp.length - 1))));
    const ch = ramp[idx]; if (ch === ' ') continue;
    const mix = x / w;
    const r = Math.round((182 * (1 - mix) + 25 * mix) * br);
    const g = Math.round((255 * (1 - mix) + 227 * mix) * (0.55 + 0.45 * br));
    const bl = Math.round((61 * (1 - mix) + 255 * mix) * br);
    ctx.fillStyle = `rgba(${r},${g},${bl},${0.45 + 0.5 * b})`;
    ctx.fillText(ch, x + cell / 2, y + cell / 2);
  }
}
