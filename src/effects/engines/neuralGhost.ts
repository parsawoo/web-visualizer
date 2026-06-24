import * as THREE from 'three';
import { decodeAudioFile, bakeAudio } from '../../lib/audioBake';
import { MediaExporter } from '../../lib/exporter';
import { loadScript } from '../../lib/loadScript';

export function init(root: HTMLElement): () => void {
  const $ = (id: string) => root.querySelector('#' + id) as any;
  const webglCanvas = $('webglCanvas') as HTMLCanvasElement;
  const sourceVideo = $('sourceVideo') as HTMLVideoElement;
  const visualUpload = $('visualUpload'), audioUpload = $('audioUpload');
  const btnMake = $('btnMake'), btnPlay = $('btnPlay'), btnRecord = $('btnRecord'), btnReset = $('btnReset');
  const progressBar = $('progressBar'), progressContainer = $('progressContainer');
  const statusOverlay = $('statusOverlay'), statusText = $('statusText'), loadingSpinner = $('loadingSpinner');
  const visCanvas = $('audioVisualizer') as HTMLCanvasElement, visCtx = visCanvas.getContext('2d')!;

  const FPS = 30;
  let renderer: any, scene: any, camera: any, mesh: any, material: any;
  let sourceTex: any = null, maskTex: any = null, maskCanvas: any = null, maskCtx: any = null;
  let renderVideo: HTMLVideoElement | null = null, selfieSegmentation: any, renderAudio: HTMLAudioElement | null = null, bakedAudioData: any[] = [];
  let isPlaying = false, visualFileUrl: string | null = null, rawAudioFile: File | null = null, segPending = false;
  let currentTargetValue = 0, rafId = 0, intervalId = 0, disposed = false;

  const exporter = new MediaExporter({ getCanvas: () => webglCanvas, getAudioElement: () => renderAudio, baseName: 'NeuralGhost', fps: FPS });
  exporter.bindToggle($('fmtSwitch'));

  async function initEngine() {
    maskCanvas = document.createElement('canvas'); maskCanvas.width = 640; maskCanvas.height = 480;
    maskCtx = maskCanvas.getContext('2d');
    maskCtx.fillStyle = '#ffffff'; maskCtx.fillRect(0, 0, 640, 480);
    maskTex = new THREE.CanvasTexture(maskCanvas);
    maskTex.minFilter = THREE.LinearFilter; maskTex.magFilter = THREE.LinearFilter; maskTex.generateMipmaps = false;
    await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/selfie_segmentation.js');
    selfieSegmentation = new SelfieSegmentation({ locateFile: (f: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${f}` });
    selfieSegmentation.setOptions({ modelSelection: 1 });
    selfieSegmentation.onResults((results: any) => {
      if (results.segmentationMask) {
        maskCtx.clearRect(0, 0, 640, 480);
        maskCtx.drawImage(results.segmentationMask, 0, 0, 640, 480);
        maskTex.needsUpdate = true;
      }
      segPending = false;
    });
    await selfieSegmentation.initialize();
  }

  function syncCameraAspect() {
    if (!renderer) return;
    const v = renderVideo || sourceVideo;
    const origW = v.videoWidth || 1920, origH = v.videoHeight || 1080, aspect = origW / origH;
    renderer.setSize(origW, origH, false);
    const panel = $('renderArea').getBoundingClientRect();
    let w = panel.width, h = panel.height;
    if (w / h > aspect) w = h * aspect; else h = w / aspect;
    webglCanvas.style.width = Math.floor(w) + 'px'; webglCanvas.style.height = Math.floor(h) + 'px';
  }

  function initGL() {
    if (renderer) return;
    renderer = new THREE.WebGLRenderer({ canvas: webglCanvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
    scene = new THREE.Scene();
    camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1); camera.position.z = 1;
    const dummy = document.createElement('canvas'); dummy.width = 2; dummy.height = 2;
    const dummyTex = new THREE.CanvasTexture(dummy);
    material = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: dummyTex }, tMask: { value: maskTex }, uTarget: { value: 0.0 }, uTime: { value: 0 },
        uCutout: { value: 1.0 }, uGlitch: { value: 1.5 }, uReactMode: { value: 0 },
      },
      vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `
        varying vec2 vUv;
        uniform sampler2D tDiffuse; uniform sampler2D tMask;
        uniform float uTarget; uniform float uTime; uniform float uCutout; uniform float uGlitch; uniform int uReactMode;
        float rand(vec2 co){ return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453); }
        void main() {
          vec2 uv = vUv;
          float fineY = floor(vUv.y * 600.0); float glitchBlock = rand(vec2(fineY, uTime));
          if (uTarget > 0.05 && glitchBlock > 0.8) { uv.x += (rand(vec2(uTime)) - 0.5) * 0.03 * uGlitch * uTarget; }
          vec2 maskUv = vUv; float edgeNoiseY = floor(vUv.y * 300.0);
          float edgeNoise = rand(vec2(edgeNoiseY, uTime * 2.0)) - 0.5;
          maskUv.x += edgeNoise * 0.025 * uGlitch * uTarget;
          float mask = texture2D(tMask, maskUv).r; float alpha = 1.0;
          if (uCutout > 0.5) { alpha = smoothstep(0.3, 0.6, mask); if (alpha + (edgeNoise * 0.4 * uTarget) < 0.25) discard; }
          vec3 col = texture2D(tDiffuse, uv).rgb;
          if (uReactMode == 0) { float fl = 0.95 + 0.05 * rand(vec2(uTime*10.0,0.0)); col *= 1.0 + (uTarget*fl*0.3); }
          else if (uReactMode == 1) { col += vec3(uTarget*0.15, uTarget*0.05, uTarget*0.2) * uGlitch * 0.5; }
          else if (uReactMode == 2) { float lum = dot(col,vec3(0.299,0.587,0.114)); lum += uTarget*0.5; vec2 g = floor(gl_FragCoord.xy*0.5); col = vec3(step(rand(g), lum)); }
          else if (uReactMode == 3) { float lum = dot(col,vec3(0.299,0.587,0.114)); lum += uTarget*0.4; vec2 g = floor(gl_FragCoord.xy*0.5); float dn=(rand(g)-0.5)*0.4; float st=4.0; col = vec3(floor(clamp(lum+dn,0.0,1.0)*st)/(st-1.0)); }
          else if (uReactMode == 4) { float lum = dot(col,vec3(0.299,0.587,0.114)); lum += uTarget*0.35; vec2 g = floor(gl_FragCoord.xy*0.5); float n=(rand(g)-0.5)*0.15; float st=8.0; col = vec3(floor(clamp(lum+n,0.0,1.0)*st)/(st-1.0)); }
          else if (uReactMode == 5) { float gr = max(20.0, 300.0-(uTarget*250.0)); vec2 pu = floor(uv*gr)/gr; col = texture2D(tDiffuse, pu).rgb; col *= 1.0+(uTarget*0.3); }
          else if (uReactMode == 6) { float ib = smoothstep(0.1,0.5,uTarget); col = mix(col, vec3(1.0)-col, ib); col *= 1.0+(uTarget*0.3); }
          else if (uReactMode == 7) {
            vec2 c = vec2(0.5); float bs = uTarget*0.03*uGlitch; vec2 bd = (uv-c)*bs;
            vec3 bc = vec3(0.0); for(int i=0;i<8;i++){ bc += texture2D(tDiffuse, uv-bd*float(i)).rgb; }
            col = bc/8.0; col *= 1.0+(uTarget*0.3);
          }
          float scan = sin(vUv.y*1000.0 + uTime*10.0)*0.02; col += scan;
          gl_FragColor = vec4(clamp(col,0.0,1.0), alpha);
        }`,
      transparent: true,
    });
    mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material); scene.add(mesh);
    animate(0);
  }

  btnMake.onclick = async () => {
    btnMake.disabled = true; loadingSpinner.style.display = 'block';
    statusText.textContent = '오디오 반응 에너지 추출 중…'; progressContainer.style.display = 'block';
    try {
      const decoded = await decodeAudioFile(rawAudioFile!);
      bakedAudioData = await bakeAudio(decoded, { fps: FPS, mode: 'energy', onProgress: (r) => (progressBar.style.width = `${r * 100}%`) });
      renderVideo = document.createElement('video');
      renderVideo.src = visualFileUrl!; renderVideo.loop = true; renderVideo.muted = true; renderVideo.playsInline = true;
      renderVideo.onloadeddata = () => {
        renderVideo!.play().then(() => {
          renderVideo!.pause(); renderVideo!.currentTime = 0.01;
          loadingSpinner.style.display = 'none'; statusOverlay.style.display = 'none';
          btnPlay.disabled = false; btnRecord.disabled = false; syncCameraAspect();
        });
      };
      renderAudio = new Audio(URL.createObjectURL(rawAudioFile!));
    } catch (e) { console.error(e); statusText.textContent = '디코딩 중 오류가 발생했습니다.'; btnMake.disabled = false; }
  };

  function animate(time: number) {
    rafId = requestAnimationFrame(animate);
    if (renderVideo && renderVideo.readyState >= 2 && !sourceTex) {
      sourceTex = new THREE.VideoTexture(renderVideo); sourceTex.minFilter = THREE.LinearFilter; sourceTex.generateMipmaps = false;
      if (material) material.uniforms.tDiffuse.value = sourceTex; syncCameraAspect();
    }
    if (isPlaying && renderVideo && renderVideo.readyState >= 2 && !segPending && selfieSegmentation) {
      segPending = true;
      selfieSegmentation.send({ image: renderVideo }).then(() => { segPending = false; }).catch(() => { segPending = false; });
    }
    if (isPlaying && renderAudio) {
      const frame = Math.floor(renderAudio.currentTime * FPS);
      if (bakedAudioData[frame] !== undefined) {
        const rawTarget = bakedAudioData[frame]; const k = rawTarget > currentTargetValue ? 0.6 : 0.4;
        currentTargetValue += (rawTarget - currentTargetValue) * k;
        if (material) material.uniforms.uTarget.value = currentTargetValue;
        visCtx.clearRect(0, 0, visCanvas.width, visCanvas.height);
        visCtx.fillStyle = '#19e3ff'; visCtx.fillRect(10, visCanvas.height - currentTargetValue * 26, visCanvas.width - 20, currentTargetValue * 26);
      }
    }
    if (material) {
      material.uniforms.uTime.value = time * 0.001;
      material.uniforms.uCutout.value = parseFloat($('uiCutout').value);
      material.uniforms.uGlitch.value = parseFloat($('uiGlitch').value);
      material.uniforms.uReactMode.value = parseInt($('uiReactMode').value);
    }
    if (renderer) renderer.render(scene, camera);
  }

  btnPlay.onclick = () => {
    if (!renderAudio) return;
    if (isPlaying) { renderVideo!.pause(); renderAudio.pause(); isPlaying = false; btnPlay.textContent = 'Play'; btnPlay.classList.remove('playing'); }
    else {
      if (renderAudio.currentTime >= renderAudio.duration - 0.1) { renderAudio.currentTime = 0; renderVideo!.currentTime = 0; }
      renderVideo!.play(); renderAudio.play(); isPlaying = true; btnPlay.textContent = 'Pause'; btnPlay.classList.add('playing');
    }
  };

  intervalId = window.setInterval(() => {
    if (isPlaying && renderAudio && renderAudio.ended) {
      isPlaying = false; renderVideo!.pause(); btnPlay.textContent = 'Play'; btnPlay.classList.remove('playing');
      if (exporter.recording) { exporter.stop(); resetRecordBtn(); }
    }
  }, 100);

  btnReset.onclick = () => {
    if (exporter.recording) { exporter.stop(); resetRecordBtn(); }
    isPlaying = false;
    if (renderAudio) { renderAudio.pause(); renderAudio = null; }
    if (renderVideo) { renderVideo.pause(); renderVideo = null; }
    if (sourceVideo) { sourceVideo.pause(); sourceVideo.removeAttribute('src'); sourceVideo.style.display = 'none'; }
    bakedAudioData = []; visualFileUrl = null; rawAudioFile = null;
    visualUpload.value = ''; audioUpload.value = '';
    if (sourceTex) { sourceTex.dispose(); sourceTex = null; }
    visCtx.clearRect(0, 0, visCanvas.width, visCanvas.height);
    btnMake.disabled = true; btnMake.textContent = '3 · Summon Ghost';
    btnPlay.disabled = true; btnPlay.textContent = 'Play'; btnPlay.classList.remove('playing'); btnRecord.disabled = true;
    statusOverlay.style.display = 'flex';
    statusText.innerHTML = "영상과 음악을 올린 뒤<br><span class='hl'>[SUMMON GHOST]</span>로 분석을 시작하세요.";
    progressContainer.style.display = 'none';
    if (maskCtx) { maskCtx.fillStyle = '#ffffff'; maskCtx.fillRect(0, 0, 640, 480); if (maskTex) maskTex.needsUpdate = true; }
  };

  visualUpload.onchange = (e: any) => {
    const f = e.target.files[0]; if (!f) return;
    visualFileUrl = URL.createObjectURL(f);
    sourceVideo.src = visualFileUrl; sourceVideo.style.display = 'block';
    sourceVideo.onloadeddata = () => { syncCameraAspect(); btnMake.disabled = !rawAudioFile; };
  };
  audioUpload.onchange = (e: any) => { rawAudioFile = e.target.files[0]; btnMake.disabled = !visualFileUrl; };

  btnRecord.onclick = () => {
    if (bakedAudioData.length === 0) return;
    if (exporter.recording) { exporter.stop(); resetRecordBtn(); return; }
    renderAudio!.currentTime = 0; renderVideo!.currentTime = 0;
    if (!isPlaying) btnPlay.click();
    if (exporter.start()) { btnRecord.classList.add('recording'); btnRecord.textContent = '■ Stop'; }
  };
  function resetRecordBtn() { btnRecord.classList.remove('recording'); btnRecord.textContent = '● Export'; }

  initEngine().then(() => { if (!disposed) initGL(); }).catch((e) => console.error(e));

  return () => {
    disposed = true;
    cancelAnimationFrame(rafId);
    clearInterval(intervalId);
    if (exporter.recording) exporter.stop();
    if (renderAudio) renderAudio.pause();
    if (renderVideo) renderVideo.pause();
    try { selfieSegmentation && selfieSegmentation.close && selfieSegmentation.close(); } catch {}
    try { renderer && renderer.dispose(); } catch {}
  };
}
