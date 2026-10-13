import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // El CORS de la API solo acepta este origen. Con strictPort, si el 5173
    // esta ocupado Vite avisa y no arranca, en vez de pasarse al 5174 y que
    // el navegador bloquee todas las peticiones.
    port: 5173,
    strictPort: true,
  },
})
