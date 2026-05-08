import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: './',  // Relative paths so Electron file:// loading works
  define: {
    __DEV_BUILD__: JSON.stringify(mode === 'development'),
  },
  optimizeDeps: {
    // WebLLM is heavy and dynamically imported only inside the Local AI Lab.
    // Excluding from pre-bundling speeds up dev startup.
    exclude: ['@mlc-ai/web-llm'],
  },
}))
