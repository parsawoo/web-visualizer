# Web-Visualizer

음악 + 영상을 올리면 **음악에 반응하는 VFX**를 입혀 영상으로 내보내는 웹 스튜디오.
첫 화면에서 `Web-Visualizer` 인트로가 떴다 사라진 뒤, 휠/드래그/화살표로 돌리는 **3D 카드 카루셀**에서 효과를 고르고, 카드를 클릭하면 작업실로 들어갑니다.

`parsawoo/B-Visual-Studio`의 3개 효과를 골라 **오디오 반응형**으로 재설계했습니다.

## 3가지 효과

| 효과 | 설명 | 핵심 기술 |
|------|------|-----------|
| **Audio Matrix** | 영상 픽셀이 음악(저/중/고역)에 맞춰 파티클로 분산·폭발 | Three.js Points + 셰이더 |
| **Neural Ghost** | AI 인물 누끼 + 비트에 반응하는 글리치·디더·섬광 (8종) | MediaPipe Selfie Segmentation |
| **Cyber Tracker** | 객체·얼굴 추적 HUD가 사운드에 맞춰 락온/맥동 *(오디오 반응 신규 추가)* | TF.js COCO-SSD + MediaPipe Holistic |

## 입·출력 포맷

- **업로드**: 영상 `MP4`(권장) · 음악 `MP3/WAV` (Audio Matrix는 이미지도 가능)
- **다운로드**: 우상단 토글로 선택
  - **WEBM · 빠름** — MediaRecorder로 즉시 저장 (브라우저 네이티브)
  - **MP4 · 호환** — 녹화한 webm을 브라우저 안에서 `ffmpeg.wasm`(H.264/AAC)으로 변환. 모든 환경에서 `.mp4` 보장.
    - 첫 변환 시 변환 엔진(~25MB)을 1회 내려받습니다.
    - 변환은 영상 길이에 비례해 시간이 걸립니다(브라우저 단독 처리).
    - 단일스레드 코어를 써서 GitHub Pages 등 정적 호스팅(COOP/COEP 헤더 없이)에서도 동작합니다.

## 작업 흐름

1. **영상** + **음악** 업로드
2. **Make / Summon / Analyze** — 오디오를 프레임별로 분석(베이킹)하고, 필요한 AI 모델을 돌립니다.
3. **Play** — 컨트롤 슬라이더를 움직이며 실시간으로 미세 조정
4. **Export** — WEBM/MP4 토글에 맞춰 영상 + 음악이 합쳐진 결과를 다운로드

## 폴더 구조

```
index.html                  랜딩 (인트로 + 카드 카루셀)
assets/
  css/theme.css             디자인 시스템 (글래스 + 비비드 그라데이션)
  css/landing.css           랜딩 전용
  css/studio.css            효과 작업실 공통
  js/landing.js             인트로 연출 + 카루셀 + 카드 미니 프리뷰
  js/lib/audio-bake.js      오디오 디코드 + 프레임별 반응 데이터 베이킹
  js/lib/exporter.js        WEBM/MP4 토글 익스포터 (ffmpeg.wasm 지연 로드)
effects/
  audio-matrix/  (index.html + main.js)
  neural-ghost/  (index.html + main.js)
  cyber-tracker/ (index.html + main.js)
_ref/                       원본 B-Visual-Studio 클론 (참고용)
```

## 로컬 실행

ES 모듈을 쓰므로 `file://`이 아닌 **로컬 서버**로 열어야 합니다.

```bash
python -m http.server 5500
# http://localhost:5500/  접속
```

## GitHub Pages 배포

저장소 루트에 그대로 올리고 Pages를 켜면 됩니다(빌드 불필요). 모든 의존성(Three.js, MediaPipe, TF.js, ffmpeg.wasm)은 CDN에서 불러옵니다.

## 알려진 한계

- 녹화는 **실시간**입니다(재생 길이만큼 소요). 탭을 백그라운드로 두면 프레임이 끊길 수 있어, 녹화 중에는 탭을 활성 상태로 두세요.
- 매우 긴 영상의 MP4 변환은 브라우저 메모리 한계로 실패할 수 있습니다 → 이 경우 자동으로 WEBM으로 저장됩니다.
- Neural Ghost / Cyber Tracker의 AI 모델 로딩에는 네트워크가 필요합니다.
