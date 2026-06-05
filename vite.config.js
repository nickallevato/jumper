import { defineConfig } from 'vite'

export default defineConfig({
  root: 'client',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        app: 'client/index.html',
        roomEditor: 'client/room-editor.html',
      },
    },
  },
  server: {
    proxy: {
      '/socket.io': { target: 'http://localhost:3002', ws: true },
      '/api': 'http://localhost:3002',
    },
  },
})
