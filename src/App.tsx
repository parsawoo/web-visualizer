import { Routes, Route } from 'react-router-dom';
import Aurora from './components/Aurora';
import Landing from './pages/Landing';
import AudioMatrix from './effects/AudioMatrix';
import NeuralGhost from './effects/NeuralGhost';
import CyberTracker from './effects/CyberTracker';
import AsciiArt from './effects/AsciiArt';

export default function App() {
  return (
    <>
      <Aurora />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/effects/audio-matrix" element={<AudioMatrix />} />
        <Route path="/effects/neural-ghost" element={<NeuralGhost />} />
        <Route path="/effects/cyber-tracker" element={<CyberTracker />} />
        <Route path="/effects/ascii-art" element={<AsciiArt />} />
        <Route path="*" element={<Landing />} />
      </Routes>
    </>
  );
}
