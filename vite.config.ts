import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev serves at '/', production builds for the GitHub Pages project subpath.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/web-visualizer/' : '/',
  plugins: [react()],
}));
