import { defineConfig } from "vite";

const SERVER_PORT = Number(process.env.PORT ?? 2567);

export default defineConfig({
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      // Proxy Colyseus WebSocket and matchmake HTTP traffic to the game server
      "/matchmake": {
        target: `http://localhost:${SERVER_PORT}`,
        ws: true,
        changeOrigin: true,
      },
      "^/[a-z0-9]{8,}$": {
        target: `http://localhost:${SERVER_PORT}`,
        ws: true,
        changeOrigin: true,
      },
    },
  },
});
