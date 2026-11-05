import { env } from "./env"; // must be first: it validates the configuration
import http from "http";
import express from "express";
import type { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import authRoutes from "./routes/auth";
import roomRoutes from "./routes/rooms";
import jobRoutes from "./routes/jobs";
import questionRoutes from "./routes/questions";
import { attachYjs } from "./yjs";

const app = express();

app.use(helmet());
app.use(cors({ origin: env.CLIENT_ORIGIN }));
app.use(express.json({ limit: "200kb" })); // code is capped at 50,000 chars, JSON escaping needs headroom

// Broad safety net per IP. The client polls, so this is generous.
app.use(rateLimit({ windowMs: 60_000, limit: 600, standardHeaders: true, legacyHeaders: false }));

// Login and register are the targets of password guessing
const authLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Try again in a few minutes." },
});

app.use("/auth", authLimiter, authRoutes);
app.use("/rooms", roomRoutes);
app.use("/jobs", jobRoutes);
app.use("/questions", questionRoutes);

app.get("/health", (_req, res) => res.json({ ok: true }));

// Unknown route
app.use((_req, res) => res.status(404).json({ error: "Not found" }));

// Any error: log it here, tell the caller as little as possible
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const status = (err as { status?: number }).status;
  if (status === 413) return res.status(413).json({ error: "Request too large" });
  if (status && status >= 400 && status < 500) return res.status(status).json({ error: "Bad request" });
  console.error(err);
  res.status(500).json({ error: "Something went wrong" });
});

process.on("unhandledRejection", (reason) => console.error("unhandled rejection:", reason));

const server = http.createServer(app);
attachYjs(server);
server.listen(env.PORT, () => console.log("API + Yjs running on port", env.PORT));