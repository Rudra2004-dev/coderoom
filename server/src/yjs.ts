import type { Server } from "http";
import type { WebSocket } from "ws";
import { WebSocketServer } from "ws";
import jwt from "jsonwebtoken";
import { prisma } from "./prisma";
import { env } from "./env";

// y-websocket v2 ships a ready-made connection handler and its in-memory document map
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { setupWSConnection, docs } = require("y-websocket/bin/utils");

const MAX_SOCKETS_PER_ROOM = 6; // two people, a few tabs
const sockets = new Map<string, Set<WebSocket>>();

// The server's own copy of a room's code, so we never have to trust a browser for it
export function readRoomSnapshot(slug: string): { code: string; language: string | null } | null {
  const doc = docs.get(slug);
  if (!doc) return null;
  return {
    code: doc.getText("code").toString(),
    language: (doc.getMap("meta").get("language") as string | undefined) ?? null,
  };
}

// Disconnect everyone and free the document. Used when an interview ends.
export function closeRoomSockets(slug: string) {
  for (const ws of sockets.get(slug) ?? []) ws.close(1000, "Interview ended");
  sockets.delete(slug);
  setTimeout(() => {
    docs.get(slug)?.destroy();
    docs.delete(slug);
  }, 1000);
}

export function attachYjs(server: Server) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 1_000_000 });

  server.on("upgrade", async (req, socket, head) => {
    socket.on("error", () => {});
    const reject = (code: number, msg: string) => {
      socket.write(`HTTP/1.1 ${code} ${msg}\r\n\r\n`);
      socket.destroy();
    };

    try {
      const url = new URL(req.url ?? "", "http://localhost");
      const match = url.pathname.match(/^\/yjs\/([\w-]+)$/);
      if (!match) return reject(404, "Not Found");
      const slug = match[1];

      // 1. Who is this?
      const token = url.searchParams.get("token");
      if (!token) return reject(401, "Unauthorized");
      const payload = jwt.verify(token, env.JWT_SECRET) as { id: string };

      // 2. Do they belong to this room?
      const room = await prisma.room.findUnique({ where: { slug } });
      if (!room || (room.interviewerId !== payload.id && room.candidateId !== payload.id))
        return reject(403, "Forbidden");

      // 3. Is the room still open? Ended interviews accept no more edits.
      if (room.status === "ended") return reject(409, "Conflict");

      // 4. Not too many connections
      if ((sockets.get(slug)?.size ?? 0) >= MAX_SOCKETS_PER_ROOM) return reject(429, "Too Many Requests");

      wss.handleUpgrade(req, socket, head, (ws) => {
        let set = sockets.get(slug);
        if (!set) sockets.set(slug, (set = new Set()));
        set.add(ws);
        ws.on("close", () => set.delete(ws));
        setupWSConnection(ws, req, { docName: slug });
      });
    } catch {
      reject(401, "Unauthorized");
    }
  });
}