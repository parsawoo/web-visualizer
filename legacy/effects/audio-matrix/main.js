import * as THREE from 'https://cdn.skypack.dev/three@0.136.0';
import { decodeAudioFile, bakeAudio } from '../../assets/js/lib/audio-bake.js';
import { MediaExporter } from '../../assets/js/lib/exporter.js';

const $ = (id) => document.getElementById(id);
const webglCanvas = $('webglCanvas');
const sourceVideo = $('sourceVideo');
const sourceImage = $('sourceImage');
const btnMake = $('btnMake'), btnPlay = $('btnPlay'), btnRecord = $('btnRecord');
const statusOverlay = $('statusOverlay'), statusText = $('statusText'), loadingSpinner = $('loadingSpinner');
const progressContainer = $('progressContainer'), progressBar = $('progressBar');
const uiResolution = $('uiResolution'), uiSensitivity = $('uiSensitivity'), uiDispersion = $('uiDispersion');
const uiPointSize = $('uiPointSize'), uiColorMode = $('uiColorMode'), uiReactMode = $('uiReactMode');
const visCanvas = $('audioVisualizer'), visCtx = visCanvas.getContext('2d');

const FPS = 30;
let renderer, scene, camera, particleSystem, geometry, material, sourceTex = null;
let renderVideo = null, renderImage = null, isVideoMode = false;
let renderAudio = null, bakedAudioData = [];
let isPlaying = false;
let visualFileUrl = null, rawAudioFile = null;

/* ---------- exporter ---------- */
const exporter = new MediaExporter({
  getCanvas: () => webglCanvas,
  getAudioElement: () => renderAudio,
  baseName: 'AudioMatrix',
  fps: FPS,
});
exporter.bindToggle($('fmtSwitch'));

/* ---------- aspect ---------- */
function syncCameraAspect() {
  if (!camera || !renderer) return;
  let origW = 16, origH = 9;
  if (isVideoMode && renderVideo && renderVideo.videoWidth) { origW = renderVideo.videoWidth; origH = renderVideo.videoHeight; }
  else if (!isVideoMode && renderImage && renderImage.width) { origW = renderImage.width; origH = renderImage.height; }
  else if (isVideoMode && sourceVideo.videoWidth) { origW = sourceVideo.videoWidth; origH = sourceVideo.videoHeight; }
  else if (!isVideoMode && sourceImage.naturalWidth) { origW = sourceImage.naturalWidth; origH = sourceImage.naturalHeight; }

  const mediaAspect = origW / origH;
  const box = $('renderArea').getBoundingClientRect();
  let w = box.width, h = box.height;
  if (w / h > mediaAspect) w = h * mediaAspect; else h = w / mediaAspect;
  w = Math.floor(w); h = Math.floor(h);

  renderer.setSize(origW, origH, false);
  webglCanvas.style.width = w + 'px';
  webglCanvas.style.height = h + 'px';
  camera.aspect = mediaAspect;
  camera.updateProjectionMatrix();
}

/* ---------- uploads ---------- */
$('visualUpload').onchange = (e) => {
  const file = e.target.files[0];
  if (!file) return;
  visualFileUrl = URL.createObjectURL(file);
  sourceVideo.style.display = 'none';
  sourceImage.style.display = 'none';
  if (file.type.startsWith('video/')) {
    isVideoMode = true;
    sourceVideo.src = visualFileUrl; sourceVideo.style.display = 'block';
    sourceVideo.onloadeddata = () => { syncCameraAspect(); checkReady(); };
  } else {
    isVideoMode = false;
    sourceImage.src = visualFileUrl; sourceImage.style.display = 'block';
    sourceImage.onload = () => { syncCameraAspect(); checkReady(); };
  }
};
$('audioUpload').onchange = (e) => { rawAudioFile = e.target.files[0]; checkReady(); };

function checkReady() {
  if (visualFileUrl && rawAudioFile) {
    btnMake.disabled = false;
    statusText.innerHTML = "소스 확인 완료!<br><span class='hl'>[MAKE MATRIX]</span>를 눌러 오디오를 베이킹하세요.";
  }
}

/* ---------- bake + build ---------- */
btnMake.onclick = async () => {
  btnMake.disabled = true;
  loadingSpinner.style.display = 'block';
  statusText.innerHTML = "오디오 PCM 디코딩 중…<br>(길이에 따라 수 초 소요)";
  progressContainer.style.display = 'block'; progressBar.style.width = '0%';
  try {
    const audioBuffer = await decodeAudioFile(rawAudioFile);
    statusText.textContent = "주파수 대역(Bass/Mid/Treble) 굽는 중…";
    bakedAudioData = await bakeAudio(audioBuffer, {
      fps: FPS, mode: 'bands',
      onProgress: (r) => { progressBar.style.width = `${r * 100}%`; },
    });
    statusText.textContent = "텍스처를 파티클로 변환 중…";
    if (renderAudio) renderAudio.pause();
    renderAudio = new Audio(URL.createObjectURL(rawAudioFile));
    renderAudio.addEventListener('ended', onEnded);
    await setupRenderTexture();
    progressContainer.style.display = 'none';
    loadingSpinner.style.display = 'none';
    statusOverlay.style.display = 'none';
    btnPlay.disabled = false; btnRecord.disabled = false;
    btnMake.textContent = "Matrix Ready";
  } catch (err) {
    console.error(err);
    statusText.textContent = "오디오 분석에 실패했습니다.";
    btnMake.disabled = false;
  }
};

function setupRenderTexture() {
  return new Promise((resolve) => {
    if (isVideoMode) {
      renderVideo = document.createElement('video');
      renderVideo.src = visualFileUrl; renderVideo.crossOrigin = 'anonymous';
      renderVideo.loop = true; renderVideo.muted = true; renderVideo.playsInline = true;
      renderVideo.onloadeddata = () => {
        sourceTex = new THREE.VideoTexture(renderVideo);
        sourceTex.minFilter = THREE.LinearFilter; sourceTex.magFilter = THREE.LinearFilter;
        syncCameraAspect();
        buildParticleSystem(renderVideo.videoWidth, renderVideo.videoHeight);
        resolve();
      };
      renderVideo.play().then(() => { renderVideo.pause(); renderVideo.currentTime = 0.01; }).catch(() => {});
    } else {
      renderImage = new Image();
      renderImage.src = visualFileUrl;
      renderImage.onload = () => {
        sourceTex = new THREE.Texture(renderImage); sourceTex.needsUpdate = true;
        syncCameraAspect();
        buildParticleSystem(renderImage.width, renderImage.height);
        resolve();
      };
    }
  });
}

function buildParticleSystem(origW, origH) {
  if (particleSystem) scene.remove(particleSystem);
  const aspect = origW / origH;
  const res = parseInt(uiResolution.value);
  const w = res, h = Math.floor(res / aspect);

  geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(w * h * 3);
  const uvs = new Float32Array(w * h * 2);
  let idx = 0, uvIdx = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    positions[idx++] = (x / w - 0.5) * 16.0 * aspect;
    positions[idx++] = (y / h - 0.5) * 16.0;
    positions[idx++] = 0;
    uvs[uvIdx++] = x / w; uvs[uvIdx++] = y / h;
  }
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));

  material = new THREE.ShaderMaterial({
    uniforms: {
      tDiffuse: { value: sourceTex },
      uAudio: { value: new THREE.Vector3(0, 0, 0) },
      uTime: { value: 0.0 },
      uSensitivity: { value: 1.5 }, uDispersion: { value: 2.0 }, uPointSize: { value: 3.0 },
      uColorMode: { value: 0 }, uReactMode: { value: 0 },
    },
    vertexShader: `
      varying vec3 vColor;
      uniform sampler2D tDiffuse; uniform vec3 uAudio; uniform float uTime;
      uniform float uSensitivity; uniform float uDispersion; uniform float uPointSize;
      float rand(vec2 co){ return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453); }
      void main() {
        vec4 texColor = texture2D(tDiffuse, uv);
        vColor = texColor.rgb;
        float lum = dot(texColor.rgb, vec3(0.299,0.587,0.114));
        vec3 pos = position;
        float bass = uAudio.x, mid = uAudio.y, treble = uAudio.z;
        float zForce = lum * bass * uDispersion * 2.5;
        float n = rand(uv + uTime * 0.1);
        pos.z += zForce * (n * 0.4 + 0.6);
        gl_PointSize = uPointSize + (mid * uSensitivity * 3.0 * lum);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }`,
    fragmentShader: `
      varying vec3 vColor; uniform int uColorMode; uniform int uReactMode; uniform vec3 uAudio;
      void main() {
        vec2 cc = 2.0 * gl_PointCoord - 1.0;
        if (dot(cc, cc) > 1.0) discard;
        float lum = dot(vColor, vec3(0.299,0.587,0.114));
        vec3 baseColor = vColor;
        float bass = uAudio.x, mid = uAudio.y, treble = uAudio.z;
        if (uColorMode == 1) baseColor = mix(vec3(0.0,0.1,0.05), vec3(0.1,1.0,0.5), lum*1.5);
        else if (uColorMode == 2) baseColor = mix(vec3(0.8,0.0,0.5), vec3(0.0,1.0,0.8), lum);
        else if (uColorMode == 3) baseColor = mix(vec3(0.5,0.0,0.0), vec3(1.0,0.8,0.2), lum*1.2);
        vec3 finalColor = baseColor;
        if (uReactMode == 0) {
          float e = (bass*0.6)+(mid*0.3)+(treble*0.1);
          float b = clamp(0.8 + e*1.8, 0.4, 2.2);
          finalColor *= b; finalColor += vec3(treble*0.25);
          finalColor = clamp(finalColor, 0.05, 0.95);
        } else {
          if (uColorMode == 0) { vec3 t = vec3(bass*0.8, mid*0.5+treble*0.2, bass*0.2+mid*0.8+treble*0.5); finalColor = mix(baseColor, baseColor+t, clamp(bass+mid,0.0,1.0)); }
          else if (uColorMode == 1) finalColor = baseColor + vec3(bass*0.4, mid*0.5, treble*0.8)*lum;
          else if (uColorMode == 2) finalColor = baseColor + vec3(bass*0.8, treble*0.5, mid*0.8)*lum;
          else finalColor = baseColor + vec3(bass*0.6+mid*0.4, mid*0.5+treble*0.5, treble*0.8)*lum;
          finalColor = clamp(finalColor, 0.0, 1.0);
        }
        gl_FragColor = vec4(finalColor, lum + 0.3 + (bass*0.1));
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  particleSystem = new THREE.Points(geometry, material);
  scene.add(particleSystem);
}

/* ---------- GL ---------- */
function initGL() {
  renderer = new THREE.WebGLRenderer({ canvas: webglCanvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  const box = $('renderArea').getBoundingClientRect();
  renderer.setSize(box.width, box.height);
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(45, box.width / box.height, 0.1, 100);
  camera.position.z = 18;
  requestAnimationFrame(animate);
}
initGL();
window.addEventListener('resize', syncCameraAspect);

/* ---------- playback ---------- */
btnPlay.onclick = () => {
  if (!renderAudio || bakedAudioData.length === 0) return;
  if (isPlaying) pause(); else play();
};
function play() {
  renderAudio.play();
  if (isVideoMode && renderVideo) renderVideo.play();
  isPlaying = true; btnPlay.textContent = "Pause"; btnPlay.classList.add('playing');
}
function pause() {
  renderAudio.pause();
  if (isVideoMode && renderVideo) renderVideo.pause();
  isPlaying = false; btnPlay.textContent = "Play"; btnPlay.classList.remove('playing');
}
function onEnded() {
  pause();
  if (exporter.recording) { exporter.stop(); resetRecordBtn(); }
}

function animate(time) {
  requestAnimationFrame(animate);
  let avgBass = 0, avgMid = 0, avgTreble = 0;
  if (isPlaying && renderAudio) {
    const f = Math.floor(renderAudio.currentTime * FPS);
    if (f < bakedAudioData.length) { const d = bakedAudioData[f]; avgBass = d.bass; avgMid = d.mid; avgTreble = d.treble; }
    visCtx.clearRect(0, 0, visCanvas.width, visCanvas.height);
    visCtx.fillStyle = '#a855f7'; visCtx.fillRect(12, visCanvas.height - avgBass * 20, 28, avgBass * 20);
    visCtx.fillStyle = '#00ffcc'; visCtx.fillRect(60, visCanvas.height - avgMid * 20, 28, avgMid * 20);
    visCtx.fillStyle = '#ff2d6b'; visCtx.fillRect(108, visCanvas.height - avgTreble * 20, 28, avgTreble * 20);
  } else {
    visCtx.clearRect(0, 0, visCanvas.width, visCanvas.height);
  }
  if (material) {
    material.uniforms.uTime.value = time * 0.001;
    material.uniforms.uSensitivity.value = parseFloat(uiSensitivity.value);
    material.uniforms.uDispersion.value = parseFloat(uiDispersion.value);
    material.uniforms.uPointSize.value = parseFloat(uiPointSize.value);
    material.uniforms.uColorMode.value = parseInt(uiColorMode.value);
    material.uniforms.uReactMode.value = parseInt(uiReactMode.value);
    material.uniforms.uAudio.value.x += (avgBass - material.uniforms.uAudio.value.x) * 0.2;
    material.uniforms.uAudio.value.y += (avgMid - material.uniforms.uAudio.value.y) * 0.2;
    material.uniforms.uAudio.value.z += (avgTreble - material.uniforms.uAudio.value.z) * 0.2;
  }
  if (sourceTex && isVideoMode && renderVideo && renderVideo.readyState >= 2) sourceTex.needsUpdate = true;
  renderer.render(scene, camera);
}

/* ---------- record ---------- */
btnRecord.onclick = () => {
  if (bakedAudioData.length === 0) return;
  if (exporter.recording) { exporter.stop(); resetRecordBtn(); return; }
  renderAudio.currentTime = 0;
  if (isVideoMode && renderVideo) renderVideo.currentTime = 0;
  if (!isPlaying) play();
  if (exporter.start()) {
    btnRecord.classList.add('recording'); btnRecord.textContent = "■ Stop";
  }
};
function resetRecordBtn() { btnRecord.classList.remove('recording'); btnRecord.textContent = "● Export"; }
