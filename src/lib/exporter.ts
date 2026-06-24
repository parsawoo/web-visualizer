/* Record a canvas (+ audio) → download as WEBM (native) or MP4 (ffmpeg.wasm transcode). */

/* ---------- shared export audio graph (create-once per element) ---------- */
let _expAudioCtx: AudioContext | null = null;
function expAudioCtx() {
  if (!_expAudioCtx) _expAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  return _expAudioCtx;
}
function audioTrackFor(audioEl: HTMLAudioElement | null): MediaStreamTrack | null {
  if (!audioEl) return null;
  const el = audioEl as any;
  if (!el.__expGraph) {
    const ctx = expAudioCtx();
    const src = ctx.createMediaElementSource(audioEl);
    const dest = ctx.createMediaStreamDestination();
    src.connect(dest);
    src.connect(ctx.destination);
    el.__expGraph = { ctx, dest };
  }
  const g = el.__expGraph;
  if (g.ctx.state === 'suspended') g.ctx.resume();
  return g.dest.stream.getAudioTracks()[0] || null;
}

function pickWebmMime(): string {
  const c = [
    'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp9',
    'video/webm;codecs=vp8,opus', 'video/webm;codecs=vp8', 'video/webm',
  ];
  for (const m of c) if (window.MediaRecorder && MediaRecorder.isTypeSupported(m)) return m;
  return 'video/webm';
}

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/* ---------- ffmpeg.wasm (lazy, single-thread → works on static hosting) ---------- */
let _ffmpeg: any = null;
let _ffmpegLoading: Promise<any> | null = null;
let _ffmpegProgress: ((r: number) => void) | null = null;

function injectScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if ([...document.scripts].some((s) => s.src === src)) return resolve();
    const s = document.createElement('script');
    s.src = src; s.onload = () => resolve(); s.onerror = () => reject(new Error('load fail ' + src));
    document.head.appendChild(s);
  });
}

async function getFFmpeg(onStatus: ToastFn): Promise<any> {
  if (_ffmpeg) return _ffmpeg;
  if (_ffmpegLoading) return _ffmpegLoading;
  _ffmpegLoading = (async () => {
    onStatus('변환 엔진 불러오는 중…', 'first run · ~25MB', true);
    await injectScript('https://unpkg.com/@ffmpeg/ffmpeg@0.11.6/dist/ffmpeg.min.js');
    const { createFFmpeg } = (window as any).FFmpeg;
    const ff = createFFmpeg({
      log: false,
      corePath: 'https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js',
      progress: ({ ratio }: { ratio: number }) => { if (_ffmpegProgress) _ffmpegProgress(ratio); },
    });
    await ff.load();
    _ffmpeg = ff;
    return ff;
  })();
  return _ffmpegLoading;
}

async function transcodeToMp4(webmBlob: Blob, onStatus: ToastFn): Promise<Blob> {
  const { fetchFile } = (window as any).FFmpeg;
  const ff = await getFFmpeg(onStatus);
  _ffmpegProgress = (r: number) => {
    const pct = r > 0 && r <= 1 ? Math.round(r * 100) : null;
    onStatus('MP4로 변환 중…', pct === null ? '인코딩' : `${pct}%`, true);
  };
  onStatus('MP4로 변환 중…', '0%', true);
  ff.FS('writeFile', 'in.webm', await fetchFile(webmBlob));
  await ff.run(
    '-i', 'in.webm',
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '192k', 'out.mp4'
  );
  const data = ff.FS('readFile', 'out.mp4');
  try { ff.FS('unlink', 'in.webm'); ff.FS('unlink', 'out.mp4'); } catch { /* noop */ }
  _ffmpegProgress = null;
  return new Blob([data.buffer], { type: 'video/mp4' });
}

/* ---------- toast ---------- */
type ToastFn = (msg: string, sub?: string, spinning?: boolean) => void;
function ensureToast(): HTMLElement {
  let t = document.getElementById('exportToast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'exportToast';
    t.innerHTML = `<div class="spinner dot"></div><div><div class="msg"></div><div class="sub"></div></div>`;
    document.body.appendChild(t);
  }
  return t;
}
const toast: ToastFn = (msg, sub, spinning) => {
  const t = ensureToast();
  (t.querySelector('.msg') as HTMLElement).textContent = msg || '';
  (t.querySelector('.sub') as HTMLElement).textContent = sub || '';
  (t.querySelector('.dot') as HTMLElement).style.display = spinning ? 'block' : 'none';
  t.classList.add('show');
};
function hideToast(delay = 0) {
  const t = ensureToast();
  setTimeout(() => t.classList.remove('show'), delay);
}

/* ---------- MediaExporter ---------- */
interface ExporterOpts {
  getCanvas: () => HTMLCanvasElement | null;
  getAudioElement?: () => HTMLAudioElement | null;
  baseName?: string;
  fps?: number;
  bitrate?: number;
}

export class MediaExporter {
  getCanvas: () => HTMLCanvasElement | null;
  getAudioElement: () => HTMLAudioElement | null;
  baseName: string;
  fps: number;
  bitrate: number;
  format: 'webm' | 'mp4' = 'mp4';
  recording = false;
  private _chunks: Blob[] = [];
  private _recorder: MediaRecorder | null = null;

  constructor(o: ExporterOpts) {
    this.getCanvas = o.getCanvas;
    this.getAudioElement = o.getAudioElement || (() => null);
    this.baseName = o.baseName || 'WebVisualizer';
    this.fps = o.fps || 30;
    this.bitrate = o.bitrate || 16000000;
  }

  setFormat(f: string) { this.format = f === 'webm' ? 'webm' : 'mp4'; }

  bindToggle(switchEl: Element | null) {
    if (!switchEl) return;
    const btns = switchEl.querySelectorAll('button');
    const sync = () => btns.forEach((b) => b.classList.toggle('on', (b as HTMLElement).dataset.fmt === this.format));
    btns.forEach((b) => b.addEventListener('click', () => { this.setFormat((b as HTMLElement).dataset.fmt!); sync(); }));
    sync();
  }

  start(): boolean {
    if (this.recording) return false;
    const canvas = this.getCanvas();
    if (!canvas) return false;
    const stream = (canvas as any).captureStream(this.fps) as MediaStream;
    const track = audioTrackFor(this.getAudioElement());
    if (track) stream.addTrack(track);
    this._chunks = [];
    try {
      this._recorder = new MediaRecorder(stream, { mimeType: pickWebmMime(), videoBitsPerSecond: this.bitrate });
    } catch {
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
    try { this._recorder.stop(); } catch { /* noop */ }
  }

  private async _finalize() {
    const webm = new Blob(this._chunks, { type: 'video/webm' });
    this._chunks = [];
    if (this.format === 'webm') {
      downloadBlob(webm, `${this.baseName}.webm`);
      toast('WEBM 저장 완료', `${(webm.size / 1048576).toFixed(1)} MB`, false);
      hideToast(2600);
      return;
    }
    try {
      const mp4 = await transcodeToMp4(webm, toast);
      downloadBlob(mp4, `${this.baseName}.mp4`);
      toast('MP4 저장 완료', `${(mp4.size / 1048576).toFixed(1)} MB`, false);
      hideToast(2800);
    } catch (err) {
      console.error(err);
      downloadBlob(webm, `${this.baseName}.webm`);
      toast('MP4 변환 실패 — WEBM으로 저장했어요', '콘솔 로그를 확인하세요', false);
      hideToast(4200);
    }
  }
}
