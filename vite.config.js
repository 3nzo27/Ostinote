import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import claudeBridge from './vite-plugin-claude-bridge.js'

export default defineConfig(({ mode }) => ({
  // claudeBridge is a no-op in `vite build` (apply: "serve"); during
  // `vite dev` it adds the /_ai/* and /_yt/* endpoints so the browser
  // app can reach the local claude CLI + proxy YouTube captions. These
  // don't exist in a production build — a deployed site needs a
  // serverless proxy for those features (cloud AI keys work anywhere).
  plugins: [react(), claudeBridge()],
  base: './',  // Relative asset paths — works at any host path (server
  //              root, a GitHub Pages /repo/ subpath, or a custom domain).
  define: {
    __DEV_BUILD__: JSON.stringify(mode === 'development'),
  },
  server: {
    host: true,
  },
  optimizeDeps: {
    // WebLLM is heavy and dynamically imported only inside the Local AI Lab.
    // Excluding from pre-bundling speeds up dev startup.
    exclude: ['@mlc-ai/web-llm'],
  },
}))
