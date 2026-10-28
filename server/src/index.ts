import "dotenv/config";
import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth";
import roomRoutes from "./routes/rooms";

const app = express();
app.use(cors({ origin: "http://localhost: 5173" }));
app.use(express.json());
app.use("/auth", authRoutes);
app.use("/rooms", roomRoutes)


app.get("/health", (_req, res) => res.json({ ok: true}));


app.listen(process.env.PORT || 4000, () => 
    console.log("API running on port", process.env.PORT || 4000)
);


