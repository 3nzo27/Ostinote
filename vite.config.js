import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  define: {
    __DEV_BUILD__: JSON.stringify(mode === 'development'),
  },
}))
