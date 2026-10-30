import type { Server } from "http";
import { WebSocketServer } from "ws";
import jwt from "jsonwebtoken";
import { prisma } from "./prisma";

// y-websocket v2 ships a ready-made connection handler
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { setupWSConnection } = require("y-websocket/bin/utils");

export function attachYjs(server: Server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", async (req, socket, head) => {
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
      const payload = jwt.verify(token, process.env.JWT_SECRET!) as { id: string };

      // 2. Do they belong to this room?
      const room = await prisma.room.findUnique({ where: { slug } });
      if (!room || (room.interviewerId !== payload.id && room.candidateId !== payload.id))
        return reject(403, "Forbidden");

      // 3. Hand the connection to Yjs. The document is named after the room slug.
      wss.handleUpgrade(req, socket, head, (ws) => {
        setupWSConnection(ws, req, { docName: slug });
      });
    } catch {
      reject(401, "Unauthorized");
    }
  });
}