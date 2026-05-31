import { WebSocket, WebSocketServer } from "ws";

// @colyseus/ws-transport does `import WS from "ws"; new WS.Server(...)`.
// In ESM, `ws` default export is just the WebSocket class without `.Server`.
// Patch it so the transport constructor works under vitest.
(WebSocket as any).Server = WebSocketServer;
