declare module "@colyseus/ws-transport" {
  import { Transport } from "colyseus";
  import type { Server } from "node:http";

  export interface WebSocketTransportOptions {
    server?: Server;
    noServer?: boolean;
    pingInterval?: number;
    pingMaxRetries?: number;
    maxPayload?: number;
    perMessageDeflate?: boolean;
  }

  export class WebSocketTransport extends Transport {
    constructor(options?: WebSocketTransportOptions);
  }
}
