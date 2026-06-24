# Web-Visualizer

음악 + 영상을 올리면 **음악에 반응하는 VFX**를 입혀 영상으로 내보내는 웹 스튜디오.
첫 화면에서 `Web-Visualizer` 인트로가 떴다 사라진 뒤, 휠/드래그/화살표로 돌리는 **3D 카드 카루셀**에서 효과를 골라 작업실로 들어갑니다.

**라이브: https://parsawoo.github.io/web-visualizer/**

## 스택

**Vite + React 18 + TypeScript + React Router (HashRouter)**

- **셸**(라우팅·랜딩·UI 컨트롤·레이아웃)은 React 컴포넌트.
- **렌더 엔진**(Three.js/WebGL 셰이더, Web Audio, MediaRecorder, ffmpeg.wasm)은 프레임워크-독립 명령형 모듈로, 각 효과 컴포넌트의 `useEffect`에서 마운트하고 언마운트 시 정리합니다. (canvas 작업의 표준 패턴)
- MediaPipe / TF.js / ffmpeg.wasm은 사용 시점에 CDN `<script>`로 동적 로드 → 번들 가볍게, 정적 호스팅 호환.

## 4가지 효과

| 효과 | 설명 | 핵심 기술 |
|------|------|-----------|
| **Audio Matrix** | 영상 픽셀이 음악(저/중/고역)에 맞춰 파티클로 분산·폭발 | Three.js Points + 셰이더 |
| **Neural Ghost** | AI 인물 누끼 + 비트 반응 글리치·디더·섬광 (8종) | MediaPipe Selfie Segmentation |
| **Cyber Tracker** | 객체·얼굴 추적 HUD가 사운드에 맞춰 락온/맥동 | TF.js COCO-SSD + MediaPipe Holistic |
| **ASCII Art** | 음량·고음이 커질수록 영상이 완전 ASCII로 디졸브 | Canvas 2D 셀 샘플링 + 오디오 디졸브 |

## 입·출력 포맷

- **업로드**: 영상 `MP4`(권장) · 음악 `MP3/WAV` (Audio Matrix·ASCII는 이미지도 가능)
- **다운로드**: 우상단 토글 — **WEBM(빠름, 네이티브)** / **MP4(호환, ffmpeg.wasm 변환)**. MP4는 첫 사용 시 변환 엔진(~25MB)을 1회 받습니다.

## 폴더 구조

```
index.html              Vite 엔트리
vite.config.ts          base: 빌드 시 /web-visualizer/, dev 시 /
src/
  main.tsx, App.tsx     엔트리 + 라우팅
  styles/               theme · landing · studio · app (글래스+그라데이션)
  components/           Aurora, Topbar
  pages/                Landing + landingCarousel (인트로·카루셀)
  lib/                  audioBake, exporter, loadScript, usePageChrome
  effects/
    AudioMatrix.tsx · NeuralGhost.tsx · CyberTracker.tsx · AsciiArt.tsx   (UI 셸)
    engines/            *.ts   (검증된 명령형 렌더 엔진)
.github/workflows/deploy.yml   Pages 자동 배포
legacy/                 이전 바닐라 버전 (참고용, 빌드 미포함)
```

## 개발 / 빌드

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # → dist/
npm run preview  # 빌드 결과 미리보기
```

## 배포

`main`에 push하면 **GitHub Actions**가 빌드 후 Pages에 자동 배포합니다(`.github/workflows/deploy.yml`). 빌드 불필요한 설정 변경은 없습니다.

## 알려진 한계

- 녹화는 **실시간**(재생 길이만큼 소요). 녹화 중에는 탭을 활성 상태로 두세요.
- 매우 긴 영상의 MP4 변환은 브라우저 메모리 한계로 실패 시 자동으로 WEBM 저장.
- 데스크톱 크롬 권장(WebGL/MediaRecorder).
