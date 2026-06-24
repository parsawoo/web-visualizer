/* Decode an audio file and pre-compute per-frame reactivity (rAF chunks + progress). */

let _ctx: AudioContext | null = null;
export function audioContext(): AudioContext {
  if (!_ctx) _ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  return _ctx;
}

export async function decodeAudioFile(file: File): Promise<AudioBuffer> {
  const ctx = audioContext();
  const buf = await file.arrayBuffer();
  return await ctx.decodeAudioData(buf);
}

export interface Bands { bass: number; mid: number; treble: number; }
interface BakeOpts { fps?: number; mode?: 'bands' | 'energy'; onProgress?: (r: number) => void; }

export function bakeAudio(audioBuffer: AudioBuffer, opts: BakeOpts = {}): Promise<any[]> {
  const { fps = 30, mode = 'bands', onProgress } = opts;
  return new Promise((resolve) => {
    const data = audioBuffer.getChannelData(0);
    const samplesPerFrame = Math.max(1, Math.floor(audioBuffer.sampleRate / fps));
    const totalFrames = Math.floor(data.length / samplesPerFrame);
    const out: any[] = [];
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
          out.push(Math.min(Math.pow(energy * 5.0, 2.0) * 1.2, 1.5));
        } else {
          let bass = 0, mid = 0, treble = 0, last = 0, smoothed = 0;
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
