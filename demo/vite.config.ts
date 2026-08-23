import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The demo lives one level down: the site root is the documentation, and this
// is linked from it. It was at /liminis-diagrams/ until the docs site existed,
// so anything still pointing there now lands on the docs home rather than 404ing
// — which is why the docs home carries a prominent demo link.
//
// Every asset reference 404s if this does not match where Pages serves it.
export default defineConfig({
  base: '/liminis-diagrams/demo/',
  plugins: [react()],
});
