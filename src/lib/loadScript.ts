const loaded = new Set<string>();

/** Inject a CDN <script> once and resolve when ready (for MediaPipe / TF.js). */
export function loadScript(src: string): Promise<void> {
  if (loaded.has(src)) return Promise.resolve();
  const existing = [...document.scripts].some((s) => s.src === src);
  if (existing) { loaded.add(src); return Promise.resolve(); }
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.crossOrigin = 'anonymous';
    s.onload = () => { loaded.add(src); resolve(); };
    s.onerror = () => reject(new Error('script load failed: ' + src));
    document.head.appendChild(s);
  });
}
