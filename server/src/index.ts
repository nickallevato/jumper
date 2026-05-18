import { Server } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { JumperRoom } from "./JumperRoom";

const PORT = Number(process.env.PORT ?? 2567);

const gameServer = new Server({
  transport: new WebSocketTransport(),
});

gameServer.define("jumper", JumperRoom);

gameServer.listen(PORT).then(() => {
  console.log(`[server] Colyseus listening on ws://localhost:${PORT}`);
});
