import * as THREE from 'three';
import { decodeAudioFile, bakeAudio } from '../../lib/audioBake';
import { MediaExporter } from '../../lib/exporter';
import { loadScript } from '../../lib/loadScript';

export function init(root: HTMLElement): () => void {
  const $ = (id: string) => root.querySelector('#' + id) as any;
  const videoElement = $('sourceVideo') as HTMLVideoElement;
  const webglCanvas = $('webglCanvas') as HTMLCanvasElement;
  const hudCanvas = $('hudCanvas') as HTMLCanvasElement, hudCtx = hudCanvas.getContext('2d')!;
  const visCanvas = $('audioVisualizer') as HTMLCanvasElement, visCtx = visCanvas.getContext('2d')!;
  const uiBoxStyle = $('uiBoxStyle'), uiEffect = $('uiEffect'), uiIntensity = $('uiIntensity');
  const uiAudioReact = $('uiAudioReact'), uiObjects = $('uiObjects'), uiSensitivity = $('uiSensitivity');
  const uiNodes = $('uiNodes'), uiLineStyle = $('uiLineStyle'), uiLineDensity = $('uiLineDensity'), uiColor = $('uiColor');
  const imageUpload = $('imageUpload'), audioUpload = $('audioUpload');
  const btnAnalyze = $('btnAnalyze'), btnPlay = $('btnPlay'), btnReset = $('btnReset'), btnRecord = $('btnRecord');
  const statusOverlay = $('statusOverlay'), statusText = $('statusText');
  const progressContainer = $('progressContainer'), progressBar = $('progressBar'), mainLoader = $('mainLoader');

  const FPS = 30;
  let renderer: any, scene: any, camera: any, mesh: any, material: any, sourceTex: any = null;
  let isPlaying = false, isAnalyzing = false;
  let trackingData: any[] = [];
  let rawAudioFile: File | null = null, renderAudio: HTMLAudioElement | null = null, bakedAudioData: any[] = [];
  let pulse = 0, hudPulse = 0, rafId = 0, disposed = false;

  const mergeCanvas = document.createElement('canvas');
  const mergeCtx = mergeCanvas.getContext('2d')!;

  const MAX_OBJECTS = 50, MAX_FACES = 40, TOTAL_BOXES = MAX_OBJECTS + MAX_FACES;
  const renderBoxes = Array.from({ length: TOTAL_BOXES }, () => ({ active: false, class: '', x: 0, y: 0, w: 0, h: 0 }));
  let objectModel: any, holisticModel: any, holisticResolve: any = null;

  const exporter = new MediaExporter({ getCanvas: () => mergeCanvas, getAudioElement: () => renderAudio, baseName: 'CyberTracker', fps: FPS });
  exporter.bindToggle($('fmtSwitch'));

  async function initDualAI() {
    try {
      await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs');
      await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd');
      await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/holistic/holistic.js');
      objectModel = await cocoSsd.load();
      holisticModel = new Holistic({ locateFile: (f: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${f}` });
      holisticModel.setOptions({ modelComplexity: 1, smoothLandmarks: true });
      holisticModel.onResults((r: any) => { if (holisticResolve) { holisticResolve(r); holisticResolve = null; } });
      await holisticModel.initialize();
      if (mainLoader) mainLoader.style.display = 'none';
    } catch (err) { console.error(err); statusText.textContent = 'AI 엔진 로딩 실패 — 새로고침 해주세요.'; if (mainLoader) mainLoader.style.display = 'none'; }
  }

  const cyberShader = {
    uniforms: {
      tDiffuse: { value: null }, uTime: { value: 0.0 },
      uBoxes: { value: Array(TOTAL_BOXES).fill(null).map(() => new THREE.Vector4()) },
      uEffect: { value: 9 }, uIntensity: { value: 1.0 }, uPulse: { value: 0.0 },
    },
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position, 1.0); }`,
    fragmentShader: `
      precision highp float; varying vec2 vUv; uniform sampler2D tDiffuse; uniform float uTime;
      uniform vec4 uBoxes[${TOTAL_BOXES}]; uniform int uEffect; uniform float uIntensity; uniform float uPulse;
      float rand(vec2 co){ return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453); }
      void main() {
        vec2 uv = vUv; bool inside = false; vec4 bData = vec4(0.0);
        for(int i=0; i<${TOTAL_BOXES}; i++) {
          vec4 b = uBoxes[i];
          if(b.z > 0.0 && uv.x > b.x && uv.x < b.x + b.z && uv.y > b.y && uv.y < b.y + b.w) { inside = true; bData = b; break; }
        }
        vec4 color = texture2D(tDiffuse, uv);
        float eff = uIntensity * (1.0 + uPulse * 1.3);
        if(inside && uEffect > 0) {
          if(uEffect==2) { float pix = 50.0/clamp(eff,0.1,3.0); color = texture2D(tDiffuse,floor(uv*pix)/pix); }
          else if(uEffect==4) { vec2 z=bData.xy+(uv-bData.xy)*clamp(1.0-(eff*0.4),0.1,1.0); color=texture2D(tDiffuse,z); }
          else if(uEffect==8) {
            float lum = dot(color.rgb,vec3(0.299,0.587,0.114)); vec2 scl=gl_FragCoord.xy/clamp(eff*2.0,1.0,5.0);
            float dth = fract(sin(dot(floor(scl),vec2(12.9898,78.233)))*43758.5453);
            color.rgb = vec3(step(0.5,lum+(dth*0.5-0.25))) * mix(vec3(1.0),vec3(0.0,1.0,0.6),clamp(eff,0.0,1.0));
          }
          else if(uEffect==9) {
            float luma = dot(color.rgb, vec3(0.299,0.587,0.114)) * eff;
            int cx = int(mod(gl_FragCoord.x,4.0)); int cy = int(mod(gl_FragCoord.y,4.0));
            float m = 0.0;
            if(cx==0&&cy==0)m=0.0625; else if(cx==1&&cy==0)m=0.5625; else if(cx==2&&cy==0)m=0.1875; else if(cx==3&&cy==0)m=0.6875;
            else if(cx==0&&cy==1)m=0.8125; else if(cx==1&&cy==1)m=0.3125; else if(cx==2&&cy==1)m=0.9375; else if(cx==3&&cy==1)m=0.4375;
            else if(cx==0&&cy==2)m=0.2500; else if(cx==1&&cy==2)m=0.7500; else if(cx==2&&cy==2)m=0.1250; else if(cx==3&&cy==2)m=0.6250;
            else if(cx==0&&cy==3)m=1.0000; else if(cx==1&&cy==3)m=0.5000; else if(cx==2&&cy==3)m=0.8750; else m=0.3750;
            color.rgb = vec3(step(m, luma));
          }
        }
        color.rgb *= 1.0 + uPulse * 0.10;
        color.rgb += (sin(vUv.y * 900.0 + uTime * 8.0) * 0.5 + 0.5) * uPulse * 0.05;
        gl_FragColor = color;
      }`,
  };

  function initGL() {
    renderer = new THREE.WebGLRenderer({ canvas: webglCanvas, antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1);
    scene = new THREE.Scene(); camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    material = new THREE.ShaderMaterial({ uniforms: cyberShader.uniforms, vertexShader: cyberShader.vertexShader, fragmentShader: cyberShader.fragmentShader });
    mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material); scene.add(mesh);
    rafId = requestAnimationFrame(animate);
  }

  function syncCameraAspect() {
    if (!renderer || !videoElement) return;
    const origW = videoElement.videoWidth || 1920, origH = videoElement.videoHeight || 1080, aspect = origW / origH;
    const box = $('renderArea').getBoundingClientRect();
    let uiW = box.width, uiH = box.height;
    if (uiW / uiH > aspect) uiW = uiH * aspect; else uiH = uiW / aspect;
    uiW = Math.floor(uiW); uiH = Math.floor(uiH);
    renderer.setSize(origW, origH, false);
    webglCanvas.style.width = uiW + 'px'; webglCanvas.style.height = uiH + 'px';
    hudCanvas.width = origW; hudCanvas.height = origH; hudCanvas.style.width = uiW + 'px'; hudCanvas.style.height = uiH + 'px';
    mergeCanvas.width = origW; mergeCanvas.height = origH;
  }
  const onResize = () => syncCameraAspect();
  window.addEventListener('resize', onResize);

  imageUpload.onchange = (e: any) => {
    const file = e.target.files[0]; if (!file) return;
    videoElement.src = URL.createObjectURL(file);
    videoElement.loop = false; videoElement.muted = true; videoElement.playsInline = true; videoElement.style.display = 'block';
    videoElement.onloadeddata = () => {
      sourceTex = new THREE.VideoTexture(videoElement); sourceTex.minFilter = THREE.LinearFilter; sourceTex.magFilter = THREE.LinearFilter;
      material.uniforms.tDiffuse.value = sourceTex;
      syncCameraAspect(); resetSystem();
      btnAnalyze.disabled = false;
      statusText.innerHTML = "옵션을 설정한 뒤<br><span class='hl'>[ANALYZE]</span>를 누르세요.";
      videoElement.play().then(() => { videoElement.pause(); videoElement.currentTime = 0.01; }).catch(() => {});
    };
  };
  audioUpload.onchange = (e: any) => { rawAudioFile = e.target.files[0] || null; };

  function resetSystem() {
    isPlaying = false; isAnalyzing = false;
    if (exporter.recording) { exporter.stop(); resetRecordBtn(); }
    trackingData = []; bakedAudioData = []; pulse = 0; hudPulse = 0;
    if (renderAudio) renderAudio.pause();
    if (videoElement) { videoElement.pause(); videoElement.currentTime = 0.01; }
    btnPlay.disabled = true; btnPlay.classList.remove('playing'); btnPlay.textContent = 'Play';
    btnAnalyze.disabled = false; btnAnalyze.textContent = '3 · Analyze';
    statusOverlay.style.display = 'flex'; progressContainer.style.display = 'none';
    hudCtx.clearRect(0, 0, hudCanvas.width, hudCanvas.height);
  }
  btnReset.onclick = () => { rawAudioFile = null; renderAudio = null; audioUpload.value = ''; resetSystem(); };

  btnAnalyze.onclick = async () => {
    if (!videoElement || trackingData.length > 0) return;
    isAnalyzing = true; btnAnalyze.disabled = true; btnAnalyze.textContent = 'Analyzing…';
    progressContainer.style.display = 'block';

    if (rawAudioFile) {
      statusText.textContent = '오디오 에너지 분석 중…';
      try {
        const decoded = await decodeAudioFile(rawAudioFile);
        bakedAudioData = await bakeAudio(decoded, { fps: FPS, mode: 'energy', onProgress: (r) => (progressBar.style.width = `${r * 100}%`) });
        renderAudio = new Audio(URL.createObjectURL(rawAudioFile));
        renderAudio.addEventListener('ended', onMediaEnd);
      } catch (e) { console.error(e); }
    }

    statusText.textContent = 'AI가 픽셀을 분석하는 중…\n(화면을 그대로 두세요)';
    const maxObjs = parseInt(uiObjects.value), minScore = parseFloat(uiSensitivity.value);
    const processFps = 15, totalFrames = Math.floor(videoElement.duration * processFps);

    for (let i = 0; i <= totalFrames; i++) {
      if (!isAnalyzing) break;
      videoElement.currentTime = i / processFps;
      await new Promise<void>((r) => {
        const h = () => { videoElement.removeEventListener('seeked', h); r(); };
        videoElement.addEventListener('seeked', h); setTimeout(r, 200);
      });

      const objects = await objectModel.detect(videoElement, maxObjs, minScore);
      const parsedObjs = objects.map((o: any) => ({
        class: o.class, x: o.bbox[0] / videoElement.videoWidth, y: o.bbox[1] / videoElement.videoHeight,
        w: o.bbox[2] / videoElement.videoWidth, h: o.bbox[3] / videoElement.videoHeight,
      }));

      const holisticRes: any = await new Promise((res) => { holisticResolve = res; holisticModel.send({ image: videoElement }); });
      const parsedFaces: any[] = [];
      if (holisticRes && holisticRes.faceLandmarks) {
        const face = holisticRes.faceLandmarks;
        const features: Record<string, number[]> = {
          EYE_L: [33, 133, 160, 159, 158, 144], EYE_R: [362, 263, 387, 386, 385, 373],
          NOSE: [1, 2, 98, 327, 168], MOUTH: [61, 291, 39, 181, 0, 17],
          BROW_L: [46, 53, 52, 65, 55], BROW_R: [276, 283, 282, 295, 285],
          CHEEK_L: [116, 117, 118, 119], CHEEK_R: [345, 346, 347, 348],
          CHIN: [152, 148, 176, 149, 150], FOREHEAD: [10, 338, 297, 332, 284, 109, 67, 103, 54, 21],
        };
        for (const name in features) {
          let minX = 1, minY = 1, maxX = 0, maxY = 0, valid = false;
          features[name].forEach((idx) => { if (face[idx]) { valid = true; minX = Math.min(minX, face[idx].x); minY = Math.min(minY, face[idx].y); maxX = Math.max(maxX, face[idx].x); maxY = Math.max(maxY, face[idx].y); } });
          if (valid) { const w = Math.max((maxX - minX) * 1.5, 0.03), h = Math.max((maxY - minY) * 1.5, 0.03); parsedFaces.push({ class: name, x: (minX + maxX) / 2 - w / 2, y: (minY + maxY) / 2 - h / 2, w, h }); }
        }
      }
      trackingData.push({ time: i / processFps, boxes: [...parsedObjs, ...parsedFaces] });
      progressBar.style.width = `${(i / totalFrames) * 100}%`;
    }

    isAnalyzing = false; videoElement.currentTime = 0.01;
    statusOverlay.style.display = 'none'; btnAnalyze.textContent = 'Analysis Done'; btnPlay.disabled = false;
  };

  btnPlay.onclick = () => {
    if (trackingData.length === 0) return;
    if (isPlaying) {
      videoElement.pause(); if (renderAudio) renderAudio.pause();
      isPlaying = false; btnPlay.classList.remove('playing'); btnPlay.textContent = 'Resume';
    } else {
      if (videoElement.currentTime >= videoElement.duration - 0.1) { videoElement.currentTime = 0; if (renderAudio) renderAudio.currentTime = 0; }
      if (renderAudio) { renderAudio.currentTime = videoElement.currentTime; renderAudio.play(); }
      videoElement.play(); isPlaying = true; btnPlay.classList.add('playing'); btnPlay.textContent = 'Pause';
    }
  };
  videoElement.onended = onMediaEnd;
  function onMediaEnd() {
    if (!isPlaying) return;
    isPlaying = false; videoElement.pause(); if (renderAudio) renderAudio.pause();
    btnPlay.classList.remove('playing'); btnPlay.textContent = 'Replay';
    if (exporter.recording) { exporter.stop(); resetRecordBtn(); }
  }

  function drawHUD() {
    hudCtx.clearRect(0, 0, hudCanvas.width, hudCanvas.height);
    for (let i = 0; i < TOTAL_BOXES; i++) material.uniforms.uBoxes.value[i].set(0, 0, 0, 0);
    if (trackingData.length === 0) return;
    const ct = videoElement.currentTime;
    const currentFrame = trackingData.reduce((p, c) => (Math.abs(c.time - ct) < Math.abs(p.time - ct) ? c : p));
    const maxRenderObjs = parseInt(uiObjects.value), maxRenderNodes = parseInt(uiNodes.value);
    let activeBoxCount = 0, activeFaceCount = 0;
    currentFrame.boxes.forEach((o: any, i: number) => {
      if (i >= TOTAL_BOXES) return;
      const isFacePart = o.class.match(/EYE|NOSE|MOUTH|BROW|CHEEK|CHIN|FOREHEAD/);
      if (isFacePart) { if (activeFaceCount >= maxRenderNodes) return; activeFaceCount++; }
      else { if (activeBoxCount >= maxRenderObjs) return; activeBoxCount++; }
      const rb = renderBoxes[i];
      rb.active = true; rb.class = o.class;
      rb.x += (o.x - rb.x) * 0.4; rb.y += (o.y - rb.y) * 0.4; rb.w += (o.w - rb.w) * 0.4; rb.h += (o.h - rb.h) * 0.4;
    });
    for (let i = currentFrame.boxes.length; i < TOTAL_BOXES; i++) renderBoxes[i].active = false;

    const color = uiColor.value, boxStyle = uiBoxStyle.value, lineStyle = uiLineStyle.value, lineDens = parseFloat(uiLineDensity.value);
    hudCtx.strokeStyle = color; hudCtx.lineWidth = 1.2 + hudPulse * 2.2;
    hudCtx.font = `12px 'Space Mono', monospace`;
    hudCtx.shadowBlur = (boxStyle === 'glow' ? 15 : 0) + hudPulse * 22; hudCtx.shadowColor = color;

    const activeCenters: { x: number; y: number }[] = [];
    renderBoxes.forEach((rb, i) => {
      if (!rb.active) return;
      const cx = rb.x * hudCanvas.width, cy = rb.y * hudCanvas.height, cw = rb.w * hudCanvas.width, ch = rb.h * hudCanvas.height;
      activeCenters.push({ x: cx + cw / 2, y: cy + ch / 2 });
      hudCtx.setLineDash([]); hudCtx.beginPath();
      if (boxStyle === 'scope') {
        const len = Math.min(cw, ch) * 0.2;
        hudCtx.moveTo(cx, cy + len); hudCtx.lineTo(cx, cy); hudCtx.lineTo(cx + len, cy);
        hudCtx.moveTo(cx + cw, cy + len); hudCtx.lineTo(cx + cw, cy); hudCtx.lineTo(cx + cw - len, cy);
        hudCtx.moveTo(cx, cy + ch - len); hudCtx.lineTo(cx, cy + ch); hudCtx.lineTo(cx + len, cy + ch);
        hudCtx.moveTo(cx + cw, cy + ch - len); hudCtx.lineTo(cx + cw, cy + ch); hudCtx.lineTo(cx + cw - len, cy + ch);
        hudCtx.stroke(); hudCtx.fillStyle = color; hudCtx.fillText(`[${rb.class.toUpperCase()}]`, cx, cy - 8);
      } else if (boxStyle === 'label') {
        hudCtx.strokeRect(cx, cy, cw, ch);
        hudCtx.fillStyle = color; hudCtx.fillRect(cx, cy - 18, Math.max(cw, 60), 18);
        hudCtx.fillStyle = '#000'; hudCtx.fillText(`${rb.class.toUpperCase()}`, cx + 4, cy - 5);
      } else {
        hudCtx.strokeRect(cx, cy, cw, ch); hudCtx.fillStyle = color; hudCtx.fillText(`${rb.class.toUpperCase()}`, cx, cy - 8);
      }
      if (hudPulse > 0.03) {
        const pad = hudPulse * 16;
        hudCtx.save(); hudCtx.globalAlpha = Math.min(0.6, hudPulse * 0.9);
        hudCtx.setLineDash([]); hudCtx.lineWidth = 1 + hudPulse * 2;
        hudCtx.strokeRect(cx - pad, cy - pad, cw + pad * 2, ch + pad * 2); hudCtx.restore();
      }
      material.uniforms.uBoxes.value[i].set(rb.x, 1.0 - (rb.y + rb.h), rb.w, rb.h);
    });

    hudCtx.globalAlpha = Math.min(0.9, 0.4 + hudPulse * 0.5); hudCtx.shadowBlur = 0;
    const connectDist = hudCanvas.width * lineDens;
    if (lineStyle === 'dashed') hudCtx.setLineDash([4, 6]); else hudCtx.setLineDash([]);
    hudCtx.beginPath();
    for (let i = 0; i < activeCenters.length; i++) for (let j = i + 1; j < activeCenters.length; j++) {
      const p1 = activeCenters[i], p2 = activeCenters[j], dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
      if (dist < connectDist && connectDist > 0) {
        hudCtx.moveTo(p1.x, p1.y);
        if (lineStyle === 'curved') { const cpX = (p1.x + p2.x) / 2, cpY = Math.min(p1.y, p2.y) - dist * 0.2; hudCtx.quadraticCurveTo(cpX, cpY, p2.x, p2.y); }
        else hudCtx.lineTo(p2.x, p2.y);
      }
    }
    hudCtx.stroke(); hudCtx.globalAlpha = 1.0; hudCtx.setLineDash([]);
  }

  function animate(time: number) {
    rafId = requestAnimationFrame(animate);
    if (sourceTex && videoElement.readyState >= 2) sourceTex.needsUpdate = true;
    if (isPlaying && bakedAudioData.length) {
      const frame = Math.floor(videoElement.currentTime * FPS); const raw = bakedAudioData[frame] || 0;
      pulse += (raw - pulse) * (raw > pulse ? 0.5 : 0.25);
    } else pulse += (0 - pulse) * 0.2;
    const react = parseFloat(uiAudioReact.value); hudPulse = pulse * react;

    visCtx.clearRect(0, 0, visCanvas.width, visCanvas.height);
    if (bakedAudioData.length) { visCtx.fillStyle = '#ff2d6b'; visCtx.fillRect(10, visCanvas.height - hudPulse * 26, visCanvas.width - 20, hudPulse * 26); }

    material.uniforms.uTime.value = time * 0.001;
    material.uniforms.uEffect.value = parseInt(uiEffect.value) || 0;
    material.uniforms.uIntensity.value = parseFloat(uiIntensity.value) || 1.0;
    material.uniforms.uPulse.value = hudPulse;

    if (sourceTex && trackingData.length > 0) drawHUD();
    renderer.render(scene, camera);

    if (exporter.recording) {
      mergeCtx.clearRect(0, 0, mergeCanvas.width, mergeCanvas.height);
      mergeCtx.drawImage(webglCanvas, 0, 0, mergeCanvas.width, mergeCanvas.height);
      mergeCtx.drawImage(hudCanvas, 0, 0, mergeCanvas.width, mergeCanvas.height);
    }
  }

  btnRecord.onclick = () => {
    if (trackingData.length === 0) { alert('먼저 [Analyze]로 분석을 완료하세요.'); return; }
    if (exporter.recording) { exporter.stop(); resetRecordBtn(); return; }
    videoElement.currentTime = 0; if (renderAudio) renderAudio.currentTime = 0;
    if (!isPlaying) btnPlay.click();
    mergeCtx.drawImage(webglCanvas, 0, 0, mergeCanvas.width, mergeCanvas.height);
    if (exporter.start()) { btnRecord.classList.add('recording'); btnRecord.textContent = '■ Stop'; }
  };
  function resetRecordBtn() { btnRecord.classList.remove('recording'); btnRecord.textContent = '● Export'; }

  initGL();
  initDualAI();

  return () => {
    disposed = true;
    cancelAnimationFrame(rafId);
    window.removeEventListener('resize', onResize);
    if (exporter.recording) exporter.stop();
    if (renderAudio) renderAudio.pause();
    try { videoElement.pause(); } catch {}
    try { holisticModel && holisticModel.close && holisticModel.close(); } catch {}
    try { renderer && renderer.dispose(); } catch {}
  };
}
