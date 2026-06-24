/* ============================================================
   audio-bake.js — decode an audio file and pre-compute
   per-frame reactivity data (runs in rAF chunks w/ progress).
   ============================================================ */

let _ctx = null;
export function audioContext() {
  if (!_ctx) _ctx = new (window.AudioContext || window.webkitAudioContext)();
  return _ctx;
}

export async function decodeAudioFile(file) {
  const ctx = audioContext();
  const buf = await file.arrayBuffer();
  // decodeAudioData wants a fresh ArrayBuffer; clone is implicit here.
  return await ctx.decodeAudioData(buf);
}

/**
 * Bake per-frame reactivity.
 * @param {AudioBuffer} audioBuffer
 * @param {object} opts { fps=30, mode='bands'|'energy', onProgress(0..1) }
 * @returns {Promise<Array>} bands → [{bass,mid,treble}], energy → [number]
 */
export function bakeAudio(audioBuffer, { fps = 30, mode = 'bands', onProgress } = {}) {
  return new Promise((resolve) => {
    const data = audioBuffer.getChannelData(0);
    const samplesPerFrame = Math.max(1, Math.floor(audioBuffer.sampleRate / fps));
    const totalFrames = Math.floor(data.length / samplesPerFrame);
    const out = [];
    let frame = 0;

    function chunk() {
      const end = Math.min(frame + 600, totalFrames);
      for (; frame < end; frame++) {
        const start = frame * samplesPerFrame;
        const stop = start + samplesPerFrame;

        if (mode === 'energy') {
          let energy = 0;
          for (let j = start; j < stop; j += 4) energy += Math.abs(data[j] || 0);
          energy = energy / (samplesPerFrame / 4);
          const punch = Math.min(Math.pow(energy * 5.0, 2.0) * 1.2, 1.5);
          out.push(punch);
        } else {
          let bass = 0, mid = 0, treble = 0;
          let last = 0, smoothed = 0;
          for (let j = start; j < stop; j++) {
            const s = data[j] || 0;
            const abs = Math.abs(s);
            smoothed += (s - smoothed) * 0.05;
            bass += Math.abs(smoothed);
            treble += Math.abs(s - last);
            last = s;
            mid += abs;
          }
          bass = Math.pow((bass / samplesPerFrame) * 4.0, 2.0);
          mid = (mid / samplesPerFrame) * 3.0;
          treble = (treble / samplesPerFrame) * 5.0;
          out.push({ bass, mid, treble });
        }
      }
      if (onProgress) onProgress(totalFrames ? frame / totalFrames : 1);
      if (frame < totalFrames) requestAnimationFrame(chunk);
      else resolve(out);
    }
    chunk();
  });
}
