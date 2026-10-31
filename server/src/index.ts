import "dotenv/config";
import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth";
import roomRoutes from "./routes/rooms";
import http from "http";
import { attachYjs } from "./yjs";
import jobRoutes from "./routes/jobs";

const app = express();
app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());
app.use("/auth", authRoutes);
app.use("/rooms", roomRoutes);
app.use("/jobs", jobRoutes);


app.get("/health", (_req, res) => res.json({ ok: true}));


const server = http.createServer(app);
attachYjs(server);

const port = Number(process.env.PORT) || 4000;
server.listen(port, () => console.log("API + Yjs running on port", port));

