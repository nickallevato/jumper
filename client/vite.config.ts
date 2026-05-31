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
      "^/[A-Za-z0-9_-]+(?:/[A-Za-z0-9_-]+)?(?:\\?.*)?$": {
        target: `http://localhost:${SERVER_PORT}`,
        ws: true,
        changeOrigin: true,
      },
    },
  },
});
