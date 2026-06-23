/* ============================================================
   exporter.js — record a canvas (+ audio) and download as
   WEBM (fast, native) or MP4 (compatible, transcoded with
   ffmpeg.wasm single-thread — works on static hosting / GH Pages).
   ============================================================ */

/* ---------- shared export audio graph (create-once per element) ---------- */
let _expAudioCtx = null;
function expAudioCtx() {
  if (!_expAudioCtx) _expAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return _expAudioCtx;
}
function audioTrackFor(audioEl) {
  if (!audioEl) return null;
  if (!audioEl.__expGraph) {
    const ctx = expAudioCtx();
    const src = ctx.createMediaElementSource(audioEl);
    const dest = ctx.createMediaStreamDestination();
    src.connect(dest);
    src.connect(ctx.destination); // keep audible
    audioEl.__expGraph = { ctx, dest };
  }
  const g = audioEl.__expGraph;
  if (g.ctx.state === 'suspended') g.ctx.resume();
  const tracks = g.dest.stream.getAudioTracks();
  return tracks[0] || null;
}

function pickWebmMime() {
  const c = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp8',
    'video/webm',
  ];
  for (const m of c) if (window.MediaRecorder && MediaRecorder.isTypeSupported(m)) return m;
  return 'video/webm';
}

function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/* ---------- ffmpeg.wasm (lazy) ---------- */
let _ffmpeg = null;
let _ffmpegLoading = null;
let _ffmpegProgress = null;

function injectScript(src) {
  return new Promise((resolve, reject) => {
    if ([...document.scripts].some(s => s.src === src)) return resolve();
    const s = document.createElement('script');
    s.src = src; s.onload = () => resolve(); s.onerror = () => reject(new Error('load fail ' + src));
    document.head.appendChild(s);
  });
}

async function getFFmpeg(onStatus) {
  if (_ffmpeg) return _ffmpeg;
  if (_ffmpegLoading) return _ffmpegLoading;
  _ffmpegLoading = (async () => {
    onStatus && onStatus('변환 엔진 불러오는 중…', 'first run · ~25MB', true);
    await injectScript('https://unpkg.com/@ffmpeg/ffmpeg@0.11.6/dist/ffmpeg.min.js');
    const { createFFmpeg } = window.FFmpeg;
    const ff = createFFmpeg({
      log: false,
      corePath: 'https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js',
      progress: ({ ratio }) => { if (_ffmpegProgress) _ffmpegProgress(ratio); },
    });
    await ff.load();
    _ffmpeg = ff;
    return ff;
  })();
  return _ffmpegLoading;
}

async function transcodeToMp4(webmBlob, onStatus) {
  const { fetchFile } = window.FFmpeg;
  const ff = await getFFmpeg(onStatus);
  _ffmpegProgress = (r) => {
    const pct = r > 0 && r <= 1 ? Math.round(r * 100) : null;
    onStatus && onStatus('MP4로 변환 중…', pct === null ? '인코딩' : `${pct}%`, true);
  };
  onStatus && onStatus('MP4로 변환 중…', '0%', true);
  ff.FS('writeFile', 'in.webm', await fetchFile(webmBlob));
  await ff.run(
    '-i', 'in.webm',
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '192k',
    'out.mp4'
  );
  const data = ff.FS('readFile', 'out.mp4');
  try { ff.FS('unlink', 'in.webm'); ff.FS('unlink', 'out.mp4'); } catch (e) {}
  _ffmpegProgress = null;
  return new Blob([data.buffer], { type: 'video/mp4' });
}

/* ---------- Toast ---------- */
function ensureToast() {
  let t = document.getElementById('exportToast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'exportToast';
    t.innerHTML = `<div class="spinner dot"></div><div><div class="msg"></div><div class="sub"></div></div>`;
    document.body.appendChild(t);
  }
  return t;
}
function toast(msg, sub, spinning) {
  const t = ensureToast();
  t.querySelector('.msg').textContent = msg || '';
  t.querySelector('.sub').textContent = sub || '';
  t.querySelector('.dot').style.display = spinning ? 'block' : 'none';
  t.classList.add('show');
}
function hideToast(delay = 0) {
  const t = ensureToast();
  setTimeout(() => t.classList.remove('show'), delay);
}

/* ============================================================
   MediaExporter
   ============================================================ */
export class MediaExporter {
  /**
   * @param {object} o
   *  getCanvas() -> HTMLCanvasElement      (the canvas to record; may be a merge canvas)
   *  getAudioElement() -> HTMLAudioElement (optional; audio track source)
   *  baseName  string
   *  fps       number
   *  bitrate   number (video bits/s)
   */
  constructor({ getCanvas, getAudioElement, baseName = 'WebVisualizer', fps = 30, bitrate = 16000000 }) {
    this.getCanvas = getCanvas;
    this.getAudioElement = getAudioElement || (() => null);
    this.baseName = baseName;
    this.fps = fps;
    this.bitrate = bitrate;
    this.format = 'mp4';
    this.recording = false;
    this._chunks = [];
    this._recorder = null;
  }

  setFormat(f) { this.format = f === 'webm' ? 'webm' : 'mp4'; }

  /** Wire up a .switch element with two buttons (data-fmt="webm"/"mp4"). */
  bindToggle(switchEl) {
    if (!switchEl) return;
    const btns = switchEl.querySelectorAll('button');
    const sync = () => btns.forEach(b => b.classList.toggle('on', b.dataset.fmt === this.format));
    btns.forEach(b => b.addEventListener('click', () => { this.setFormat(b.dataset.fmt); sync(); }));
    sync();
  }

  start() {
    if (this.recording) return false;
    const canvas = this.getCanvas();
    if (!canvas) return false;

    const stream = canvas.captureStream(this.fps);
    const track = audioTrackFor(this.getAudioElement());
    if (track) stream.addTrack(track);

    this._chunks = [];
    const mimeType = pickWebmMime();
    let opts = { mimeType, videoBitsPerSecond: this.bitrate };
    try {
      this._recorder = new MediaRecorder(stream, opts);
    } catch (e) {
      this._recorder = new MediaRecorder(stream);
    }
    this._recorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) this._chunks.push(e.data); };
    this._recorder.onstop = () => this._finalize();
    this._recorder.start();
    this.recording = true;
    return true;
  }

  stop() {
    if (!this.recording || !this._recorder) return;
    this.recording = false;
    try { this._recorder.stop(); } catch (e) {}
  }

  async _finalize() {
    const webm = new Blob(this._chunks, { type: 'video/webm' });
    this._chunks = [];
    if (this.format === 'webm') {
      downloadBlob(webm, `${this.baseName}.webm`);
      toast('WEBM 저장 완료', `${(webm.size / 1048576).toFixed(1)} MB`, false);
      hideToast(2600);
      return;
    }
    // mp4
    try {
      const mp4 = await transcodeToMp4(webm, toast);
      downloadBlob(mp4, `${this.baseName}.mp4`);
      toast('MP4 저장 완료', `${(mp4.size / 1048576).toFixed(1)} MB`, false);
      hideToast(2800);
    } catch (err) {
      console.error(err);
      // fall back: hand them the webm so the take isn't lost
      downloadBlob(webm, `${this.baseName}.webm`);
      toast('MP4 변환 실패 — WEBM으로 저장했어요', '콘솔 로그를 확인하세요', false);
      hideToast(4200);
    }
  }
}

export { toast as exportToast, hideToast as hideExportToast };
