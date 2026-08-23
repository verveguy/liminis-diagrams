import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages serves this as a project page under /liminis-diagrams/ even
// though the repo owner's account also has a custom domain (v3rv.com) — the
// subpath is unaffected by that. Every asset reference 404s without this.
export default defineConfig({
  base: '/liminis-diagrams/',
  plugins: [react()],
});
