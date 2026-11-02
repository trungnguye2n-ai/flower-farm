import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Builds the order demo into ../assets as one script + one stylesheet,
// loaded by index.html. Run `npm run build` here after editing src/.
export default defineConfig({
  plugins: [react()],
  define: { 'process.env.NODE_ENV': '"production"' },
  build: {
    outDir: '../assets', emptyOutDir: false, target: 'es2020', cssCodeSplit: false,
    lib: { entry: 'src/main.tsx', name: 'VuonLanOrder', formats: ['iife'], fileName: () => 'order-demo.js', cssFileName: 'order-demo' },
  },
})
