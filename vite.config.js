import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import claudeBridge from './vite-plugin-claude-bridge.js'

export default defineConfig(({ mode }) => ({
  // claudeBridge is a no-op in `vite build` (apply: "serve"); it adds
  // /_ai/available + /_ai/complete endpoints during `vite dev` so the
  // browser app can run prompts through the locally-installed claude CLI
  // without needing the Electron preload bridge.
  plugins: [react(), claudeBridge()],
  base: './',  // Relative paths so Electron file:// loading works
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
