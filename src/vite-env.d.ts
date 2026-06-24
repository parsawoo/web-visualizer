/// <reference types="vite/client" />

// Globals injected at runtime via CDN <script> tags (MediaPipe / TF.js / ffmpeg.wasm)
declare const SelfieSegmentation: any;
declare const Holistic: any;
declare const cocoSsd: any;

interface Window {
  FFmpeg?: any;
  SelfieSegmentation?: any;
  Holistic?: any;
  cocoSsd?: any;
}
