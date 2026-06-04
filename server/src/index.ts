import { Server } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { validateRoomDocument } from "@jumper/shared";
import { JumperRoom } from "./JumperRoom";

const PORT = Number(process.env.PORT ?? 2567);
const isProduction = process.env.NODE_ENV === "production";
const DEV_ROOM_DIR = process.env.JUMPER_DEV_ROOM_DIR ?? join(process.cwd(), "data", "rooms");
const MAX_DEV_ROOM_BYTES = 256 * 1024;

const httpServer = createServer((req, res) => {
  if (!isProduction && req.method === "POST" && req.url?.startsWith("/dev/rooms/")) {
    void handleDevRoomSave(req, res);
    return;
  }

  res.statusCode = 404;
  res.end("Not found");
});

const gameServer = new Server({
  transport: new WebSocketTransport({ server: httpServer }),
});

gameServer.define("jumper", JumperRoom);

gameServer.listen(PORT).then(() => {
  console.log(`[server] Colyseus listening on ws://localhost:${PORT}`);
  if (!isProduction) {
    console.log(`[server] dev room save endpoint enabled at POST /dev/rooms/:roomId`);
  }
});

async function handleDevRoomSave(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const roomId = decodeURIComponent(req.url!.slice("/dev/rooms/".length).split("?")[0] ?? "").trim();
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(roomId)) {
      sendJson(res, 400, { ok: false, errors: ["room id must be 1-64 URL-safe characters"] });
      return;
    }

    const body = await readBody(req, MAX_DEV_ROOM_BYTES);
    const room = JSON.parse(body) as unknown;
    const validation = validateRoomDocument(room);
    if (!validation.ok) {
      sendJson(res, 422, validation);
      return;
    }

    await mkdir(DEV_ROOM_DIR, { recursive: true });
    const filePath = join(DEV_ROOM_DIR, `${roomId}.json`);
    await writeFile(filePath, `${JSON.stringify(room, null, 2)}\n`, "utf8");
    sendJson(res, 200, { ok: true, path: filePath });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    sendJson(res, message.includes("too large") ? 413 : 400, { ok: false, errors: [message] });
  }
}

function readBody(req: IncomingMessage, maxBytes: number): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => {
      size += chunk.byteLength;
      if (size > maxBytes) {
        reject(new Error("room JSON body is too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function sendJson(res: ServerResponse, statusCode: number, value: unknown): void {
  res.statusCode = statusCode;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(value));
}
