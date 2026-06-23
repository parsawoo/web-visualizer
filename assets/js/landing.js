/* ============================================================
   Landing — intro reveal, 3D carousel, mini previews
   ============================================================ */

const EFFECTS = [
  {
    id: 'audio-matrix', num: 'EFFECT 01', a: ['Audio', 'Matrix'],
    accent: 'var(--grad-matrix)',
    tag: '영상 픽셀이 음악에 맞춰 파티클로 분산·폭발하는 비주얼라이저.',
    pills: ['MP4 IN/OUT', 'MUSIC', 'WEBGL'], draw: drawMatrix,
  },
  {
    id: 'neural-ghost', num: 'EFFECT 02', a: ['Neural', 'Ghost'],
    accent: 'var(--grad-ghost)',
    tag: 'AI 인물 누끼 + 비트에 반응하는 글리치·디더·섬광 효과.',
    pills: ['MP4 IN/OUT', 'MUSIC', 'AI CUTOUT'], draw: drawGhost,
  },
  {
    id: 'cyber-tracker', num: 'EFFECT 03', a: ['Cyber', 'Tracker'],
    accent: 'var(--grad-cyber)',
    tag: '객체·얼굴을 추적하는 HUD가 사운드에 맞춰 맥동하는 트래커.',
    pills: ['MP4 IN/OUT', 'MUSIC', 'TRACKING'], draw: drawCyber,
  },
];

const track = document.getElementById('track');
const dotsWrap = document.getElementById('dots');
const N = EFFECTS.length;
let active = 0;
let locked = false;

/* ---------- Build cards ---------- */
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
      <div class="pills">${fx.pills.map(p => `<span class="pill">${p}</span>`).join('')}</div>
    </div>`;
  el.addEventListener('click', () => {
    if (i === active) enter(fx.id);
    else go(i);
  });
  track.appendChild(el);

  const dot = document.createElement('button');
  dot.addEventListener('click', () => go(i));
  dotsWrap.appendChild(dot);

  const canvas = el.querySelector('canvas');
  return { el, dot, canvas, ctx: canvas.getContext('2d'), draw: fx.draw };
});

function enter(id) { window.location.href = `./effects/${id}/index.html`; }

function wrapOffset(d) {
  // nearest signed offset on a ring of N
  let o = d % N;
  if (o > N / 2) o -= N;
  if (o < -N / 2) o += N;
  return o;
}

function layout() {
  cards.forEach((c, i) => {
    const off = wrapOffset(i - active);
    const abs = Math.abs(off);
    const x = off * 256;
    const ry = -off * 36;
    const z = -abs * 200;
    const scale = 1 - abs * 0.13;
    const op = abs > 1.5 ? 0 : 1 - abs * 0.22;
    c.el.style.transform =
      `translateX(${x}px) translateZ(${z}px) rotateY(${ry}deg) scale(${scale})`;
    c.el.style.opacity = op;
    c.el.style.zIndex = String(100 - Math.round(abs * 10));
    c.el.classList.toggle('is-active', off === 0);
    c.el.style.pointerEvents = abs > 1.5 ? 'none' : 'auto';
    c.dot.classList.toggle('on', off === 0);
  });
}

function go(i) {
  active = ((i % N) + N) % N;
  layout();
  locked = true;
  setTimeout(() => (locked = false), 380);
}
function step(dir) { if (!locked) go(active + dir); }

/* ---------- Input: wheel ---------- */
let wheelAcc = 0;
window.addEventListener('wheel', (e) => {
  if (intro && !intro.classList.contains('gone')) return;
  e.preventDefault();
  wheelAcc += e.deltaY;
  if (Math.abs(wheelAcc) > 60) {
    step(wheelAcc > 0 ? 1 : -1);
    wheelAcc = 0;
  }
}, { passive: false });

/* ---------- Input: drag ---------- */
let dragX = null, dragged = 0;
const carousel = document.getElementById('carousel');
carousel.addEventListener('pointerdown', (e) => { dragX = e.clientX; dragged = 0; });
window.addEventListener('pointermove', (e) => {
  if (dragX === null) return;
  dragged = e.clientX - dragX;
});
window.addEventListener('pointerup', () => {
  if (dragX === null) return;
  if (Math.abs(dragged) > 70) step(dragged < 0 ? 1 : -1);
  dragX = null; dragged = 0;
});

/* ---------- Input: keyboard ---------- */
window.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowRight') step(1);
  else if (e.key === 'ArrowLeft') step(-1);
  else if (e.key === 'Enter') enter(EFFECTS[active].id);
});

/* ---------- Intro sequence ---------- */
const intro = document.getElementById('intro');
const stage = document.getElementById('stage');
layout();
setTimeout(() => stage.classList.add('show'), 2200);
setTimeout(() => intro.classList.add('gone'), 2600);

/* ============================================================
   Mini preview animations
   ============================================================ */
function fitCanvas(c) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const r = c.canvas.getBoundingClientRect();
  const w = Math.max(2, r.width), h = Math.max(2, r.height);
  if (c.canvas.width !== Math.round(w * dpr) || c.canvas.height !== Math.round(h * dpr)) {
    c.canvas.width = Math.round(w * dpr);
    c.canvas.height = Math.round(h * dpr);
  }
  c.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { w, h };
}

function beat(t, speed = 2.0) { return Math.pow(Math.max(0, Math.sin(t * speed)), 8); }

function drawMatrix(ctx, w, h, t) {
  ctx.clearRect(0, 0, w, h);
  const b = beat(t, 2.4);
  const cols = 18, rows = 13;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const px = (x + 0.5) / cols * w;
      const py = (y + 0.5) / rows * h;
      const n = Math.sin(x * 0.7 + y * 0.5 + t * 2);
      const disp = (b * 14 + 2) * n;
      const r = 1.2 + b * 2.0 + Math.abs(n) * 1.2;
      const hue = 280 - (x / cols) * 60;
      ctx.fillStyle = `hsla(${hue},90%,${55 + b * 20}%,${0.5 + Math.abs(n) * 0.4})`;
      ctx.beginPath();
      ctx.arc(px + disp * 0.4, py - disp, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawGhost(ctx, w, h, t) {
  ctx.clearRect(0, 0, w, h);
  const b = beat(t, 1.8);
  // silhouette
  ctx.save();
  const cx = w / 2, cy = h * 0.62;
  ctx.fillStyle = `rgba(25,227,255,${0.18 + b * 0.25})`;
  ctx.beginPath();
  ctx.ellipse(cx, cy, w * 0.22, h * 0.34, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = `rgba(0,255,178,${0.22 + b * 0.3})`;
  ctx.beginPath();
  ctx.arc(cx, cy - h * 0.28, w * 0.13, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // glitch slices
  const slices = 7;
  for (let i = 0; i < slices; i++) {
    const sy = (i / slices) * h + ((t * 30) % (h / slices));
    const sh = h / slices * 0.5;
    const shift = (Math.sin(i * 9.1 + t * 6) ) * (b * 24 + 3);
    ctx.fillStyle = i % 2 ? 'rgba(255,45,149,0.20)' : 'rgba(25,227,255,0.20)';
    ctx.fillRect(shift, sy, w, sh);
  }
  // scanlines
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1);
}

function drawCyber(ctx, w, h, t) {
  ctx.clearRect(0, 0, w, h);
  const b = beat(t, 2.2);
  const nodes = [
    { x: 0.28 + Math.sin(t * 0.9) * 0.06, y: 0.34 + Math.cos(t * 0.7) * 0.05, s: 0.18 },
    { x: 0.68 + Math.sin(t * 1.1 + 2) * 0.05, y: 0.40 + Math.cos(t) * 0.05, s: 0.22 },
    { x: 0.50 + Math.sin(t * 0.6 + 1) * 0.05, y: 0.70 + Math.cos(t * 1.3) * 0.04, s: 0.15 },
  ];
  const pts = nodes.map(n => ({ x: n.x * w, y: n.y * h, bw: n.s * w, bh: n.s * h * 1.2 }));
  // connections
  ctx.strokeStyle = `rgba(255,176,61,${0.25 + b * 0.4})`;
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 5]);
  for (let i = 0; i < pts.length; i++)
    for (let j = i + 1; j < pts.length; j++) {
      ctx.beginPath(); ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(pts[j].x, pts[j].y); ctx.stroke();
    }
  ctx.setLineDash([]);
  // scope brackets
  pts.forEach((p, i) => {
    const pad = (b * 6);
    const x = p.x - p.bw / 2 - pad, y = p.y - p.bh / 2 - pad;
    const bw = p.bw + pad * 2, bh = p.bh + pad * 2;
    const L = Math.min(bw, bh) * 0.28;
    ctx.strokeStyle = i === 1 ? `rgba(255,45,107,${0.7 + b * 0.3})` : `rgba(255,176,61,${0.6 + b * 0.3})`;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(x, y + L); ctx.lineTo(x, y); ctx.lineTo(x + L, y);
    ctx.moveTo(x + bw - L, y); ctx.lineTo(x + bw, y); ctx.lineTo(x + bw, y + L);
    ctx.moveTo(x, y + bh - L); ctx.lineTo(x, y + bh); ctx.lineTo(x + L, y + bh);
    ctx.moveTo(x + bw - L, y + bh); ctx.lineTo(x + bw, y + bh); ctx.lineTo(x + bw, y + bh - L);
    ctx.stroke();
  });
}

let start = null;
function loop(ts) {
  if (start === null) start = ts;
  const t = (ts - start) * 0.001;
  cards.forEach((c) => {
    const { w, h } = fitCanvas(c);
    c.draw(c.ctx, w, h, t);
  });
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
