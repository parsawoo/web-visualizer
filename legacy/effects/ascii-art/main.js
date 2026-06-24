import { decodeAudioFile, bakeAudio } from '../../assets/js/lib/audio-bake.js';
import { MediaExporter } from '../../assets/js/lib/exporter.js';

const $ = (id) => document.getElementById(id);
const canvas = $('webglCanvas');
const ctx = canvas.getContext('2d');
const sourceVideo = $('sourceVideo'), sourceImage = $('sourceImage');
const btnMake = $('btnMake'), btnPlay = $('btnPlay'), btnRecord = $('btnRecord'), btnFrame = $('btnFrame');
const statusOverlay = $('statusOverlay'), statusText = $('statusText'), loadingSpinner = $('loadingSpinner');
const progressContainer = $('progressContainer'), progressBar = $('progressBar');
const uiCell = $('uiCell'), uiAmount = $('uiAmount'), uiReact = $('uiReact'), uiBand = $('uiBand');
const uiColor = $('uiColor'), uiCharset = $('uiCharset'), uiBg = $('uiBg');
const visCanvas = $('audioVisualizer'), visCtx = visCanvas.getContext('2d');

const FPS = 30;
const MAXW = 1280;
const RAMPS = {
  standard: ' .:-=+*#%@',
  detailed: ' .\'`^",:;Il!i~+_-?][}{1)(|/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$',
  blocks: ' ░▒▓█',
};

// offscreen canvases
const sampleCanvas = document.createElement('canvas');
const sampleCtx = sampleCanvas.getContext('2d', { willReadFrequently: true });
const layer = document.createElement('canvas');
const layerCtx = layer.getContext('2d');

let currentSource = null, isVideoMode = false;
let visualFileUrl = null, rawAudioFile = null;
let renderAudio = null, bands = [];
let isPlaying = false;
let RW = 0, RH = 0;            // render resolution
let asciiAmount = 0;          // smoothed dissolve 0..1
let smBass = 0, smMid = 0, smTreble = 0;

const exporter = new MediaExporter({
  getCanvas: () => canvas,
  getAudioElement: () => renderAudio,
  baseName: 'AsciiArt',
  fps: FPS,
});
exporter.bindToggle($('fmtSwitch'));

/* ---------- sizing ---------- */
function computeRenderSize() {
  const sw = isVideoMode ? (currentSource.videoWidth || sourceVideo.videoWidth) : currentSource.naturalWidth;
  const sh = isVideoMode ? (currentSource.videoHeight || sourceVideo.videoHeight) : currentSource.naturalHeight;
  if (!sw || !sh) return false;
  const s = Math.min(1, MAXW / Math.max(sw, sh));
  RW = Math.round(sw * s); RH = Math.round(sh * s);
  canvas.width = RW; canvas.height = RH;
  layer.width = RW; layer.height = RH;
  fitCss();
  return true;
}
function fitCss() {
  if (!RW) return;
  const box = $('renderArea').getBoundingClientRect();
  const aspect = RW / RH;
  let w = box.width, h = box.height;
  if (w / h > aspect) w = h * aspect; else h = w / aspect;
  canvas.style.width = Math.floor(w) + 'px';
  canvas.style.height = Math.floor(h) + 'px';
}
window.addEventListener('resize', fitCss);

/* ---------- uploads ---------- */
$('visualUpload').onchange = (e) => {
  const file = e.target.files[0]; if (!file) return;
  visualFileUrl = URL.createObjectURL(file);
  sourceVideo.style.display = 'none'; sourceImage.style.display = 'none';
  if (file.type.startsWith('video/')) {
    isVideoMode = true;
    sourceVideo.src = visualFileUrl; sourceVideo.loop = true; sourceVideo.muted = true; sourceVideo.style.display = 'block';
    sourceVideo.onloadeddata = () => {
      currentSource = sourceVideo;
      sourceVideo.play().then(() => { sourceVideo.pause(); sourceVideo.currentTime = 0.01; }).catch(() => {});
      computeRenderSize(); checkReady();
    };
  } else {
    isVideoMode = false;
    sourceImage.src = visualFileUrl; sourceImage.style.display = 'block';
    sourceImage.onload = () => { currentSource = sourceImage; computeRenderSize(); checkReady(); };
  }
};
$('audioUpload').onchange = (e) => { rawAudioFile = e.target.files[0]; checkReady(); };

function checkReady() {
  if (visualFileUrl && rawAudioFile) {
    btnMake.disabled = false;
    statusText.innerHTML = "소스 확인 완료!<br><span class='hl'>[BUILD ASCII]</span>를 눌러 오디오를 베이킹하세요.";
  }
}

/* ---------- make ---------- */
btnMake.onclick = async () => {
  btnMake.disabled = true;
  loadingSpinner.style.display = 'block';
  statusText.textContent = "오디오 분석(베이킹) 중…";
  progressContainer.style.display = 'block'; progressBar.style.width = '0%';
  try {
    const audioBuffer = await decodeAudioFile(rawAudioFile);
    bands = await bakeAudio(audioBuffer, { fps: FPS, mode: 'bands', onProgress: (r) => progressBar.style.width = `${r * 100}%` });
    if (renderAudio) renderAudio.pause();
    renderAudio = new Audio(URL.createObjectURL(rawAudioFile));
    renderAudio.addEventListener('ended', onEnded);
    computeRenderSize();
    progressContainer.style.display = 'none';
    loadingSpinner.style.display = 'none';
    statusOverlay.style.display = 'none';
    btnPlay.disabled = false; btnRecord.disabled = false; btnFrame.disabled = false;
    btnMake.textContent = "ASCII Ready";
  } catch (err) {
    console.error(err);
    statusText.textContent = "오디오 분석에 실패했습니다.";
    btnMake.disabled = false; loadingSpinner.style.display = 'none';
  }
};

/* ---------- playback ---------- */
btnPlay.onclick = () => {
  if (!renderAudio || bands.length === 0) return;
  if (isPlaying) pause(); else play();
};
function play() {
  if (renderAudio.currentTime >= renderAudio.duration - 0.1) renderAudio.currentTime = 0;
  renderAudio.play();
  if (isVideoMode) sourceVideo.play();
  isPlaying = true; btnPlay.textContent = "Pause"; btnPlay.classList.add('playing');
}
function pause() {
  renderAudio.pause();
  if (isVideoMode) sourceVideo.pause();
  isPlaying = false; btnPlay.textContent = "Play"; btnPlay.classList.remove('playing');
}
function onEnded() {
  pause();
  if (exporter.recording) { exporter.stop(); resetRecordBtn(); }
}

/* ---------- render ---------- */
function charColor(r, g, b, lume, mode, whiteBg, glow) {
  let R, G, B;
  if (mode === 'color') { R = r; G = g; B = b; }
  else if (mode === 'green') { R = lume * 0.15; G = lume; B = lume * 0.45; }
  else if (mode === 'amber') { R = lume; G = lume * 0.62; B = lume * 0.12; }
  else { const v = whiteBg ? 255 - lume : lume; R = G = B = v; }
  R = Math.min(255, R * glow); G = Math.min(255, G * glow); B = Math.min(255, B * glow);
  return `rgb(${R | 0},${G | 0},${B | 0})`;
}

function renderFrame() {
  if (!currentSource || !RW) return;
  const cell = parseInt(uiCell.value);
  const cols = Math.max(1, Math.floor(RW / cell));
  const rows = Math.max(1, Math.floor(RH / cell));
  if (sampleCanvas.width !== cols || sampleCanvas.height !== rows) { sampleCanvas.width = cols; sampleCanvas.height = rows; }

  // sample source down to one pixel per cell
  try { sampleCtx.drawImage(currentSource, 0, 0, cols, rows); } catch (e) { return; }
  const data = sampleCtx.getImageData(0, 0, cols, rows).data;

  const ramp = RAMPS[uiCharset.value] || RAMPS.standard;
  const rampMax = ramp.length - 1;
  const mode = uiColor.value, bgMode = uiBg.value, whiteBg = bgMode === 'white';
  const treblePulse = smTreble, bassGlow = 1 + Math.min(1.2, smBass) * 0.5;

  // ascii layer
  layerCtx.clearRect(0, 0, RW, RH);
  if (bgMode === 'black') { layerCtx.fillStyle = '#050505'; layerCtx.fillRect(0, 0, RW, RH); }
  else if (whiteBg) { layerCtx.fillStyle = '#ffffff'; layerCtx.fillRect(0, 0, RW, RH); }
  layerCtx.font = `${cell}px 'Space Mono', monospace`;
  layerCtx.textAlign = 'center';
  layerCtx.textBaseline = 'middle';

  const jitter = treblePulse * cell * 0.6;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = (y * cols + x) * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const lume = r * 0.299 + g * 0.587 + b * 0.114;
      let idx = whiteBg ? Math.round(((255 - lume) / 255) * rampMax) : Math.round((lume / 255) * rampMax);
      const ch = ramp[idx] || ' ';
      if (ch === ' ') continue;
      layerCtx.fillStyle = charColor(r, g, b, lume, mode, whiteBg, bassGlow);
      const ox = jitter ? (Math.random() - 0.5) * jitter : 0;
      const oy = jitter ? (Math.random() - 0.5) * jitter : 0;
      layerCtx.fillText(ch, x * cell + cell / 2 + ox, y * cell + cell / 2 + oy);
    }
  }

  // composite: original base, then ascii layer at dissolve amount
  ctx.clearRect(0, 0, RW, RH);
  try { ctx.drawImage(currentSource, 0, 0, RW, RH); } catch (e) {}
  ctx.globalAlpha = asciiAmount;
  ctx.drawImage(layer, 0, 0);
  ctx.globalAlpha = 1;
}

function animate() {
  requestAnimationFrame(animate);

  // audio → bands
  let bass = 0, mid = 0, treble = 0;
  if (isPlaying && renderAudio && bands.length) {
    const f = Math.floor(renderAudio.currentTime * FPS);
    if (f < bands.length) { const d = bands[f]; bass = d.bass; mid = d.mid; treble = d.treble; }
  }
  smBass += (bass - smBass) * 0.3;
  smMid += (mid - smMid) * 0.3;
  smTreble += (treble - smTreble) * 0.3;

  // dissolve target from chosen band(s)
  const band = uiBand.value;
  const level = band === 'volume' ? smMid : band === 'treble' ? smTreble : (smMid * 0.6 + smTreble * 0.7);
  const base = parseFloat(uiAmount.value), react = parseFloat(uiReact.value);
  const target = Math.max(0, Math.min(1, base + react * level));
  asciiAmount += (target - asciiAmount) * 0.3;

  // EQ meter
  visCtx.clearRect(0, 0, visCanvas.width, visCanvas.height);
  if (bands.length) {
    visCtx.fillStyle = '#b6ff3d'; visCtx.fillRect(12, visCanvas.height - smBass * 20, 28, smBass * 20);
    visCtx.fillStyle = '#19e3ff'; visCtx.fillRect(60, visCanvas.height - smMid * 20, 28, smMid * 20);
    visCtx.fillStyle = '#ff2d95'; visCtx.fillRect(108, visCanvas.height - smTreble * 20, 28, smTreble * 20);
  }

  renderFrame();
}
requestAnimationFrame(animate);

/* ---------- frame snapshot ---------- */
btnFrame.onclick = () => {
  if (!RW) return;
  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = 'AsciiArt_frame.png'; a.click();
};

/* ---------- record ---------- */
btnRecord.onclick = () => {
  if (bands.length === 0) return;
  if (exporter.recording) { exporter.stop(); resetRecordBtn(); return; }
  renderAudio.currentTime = 0;
  if (isVideoMode) sourceVideo.currentTime = 0;
  if (!isPlaying) play();
  if (exporter.start()) { btnRecord.classList.add('recording'); btnRecord.textContent = "■ Stop"; }
};
function resetRecordBtn() { btnRecord.classList.remove('recording'); btnRecord.textContent = "● Export"; }
