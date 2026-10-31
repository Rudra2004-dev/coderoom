import { Router } from "express";
import crypto from "crypto";
import { prisma } from "../prisma";
import { requireAuth, requireRole, AuthedRequest } from "../middleware/auth";
import { z } from "zod";
import { runQueue } from "../queue";

const router = Router();
router.use(requireAuth);

router.post("/", requireRole("interviewer"), async (req: AuthedRequest, res) => {
  const room = await prisma.room.create({
    data: { slug: crypto.randomBytes(5).toString("hex"), interviewerId: req.user!.id },
  });
  res.status(201).json(room);
});

router.get("/:slug", async (req, res) => {
  const slug = String(req.params.slug);
  const room = await prisma.room.findUnique({
    where: { slug },
    include: {
      interviewer: { select: { id: true, name: true } },
      candidate: { select: { id: true, name: true } },
    },
  });
  if (!room) return res.status(404).json({ error: "Room not found" });
  res.json(room);
});

router.post("/:slug/join", requireRole("candidate"), async (req: AuthedRequest, res) => {
  const slug = String(req.params.slug);
  const room = await prisma.room.findUnique({ where: { slug } });
  if (!room) return res.status(404).json({ error: "Room not found" });
  if (room.candidateId && room.candidateId !== req.user!.id)
    return res.status(409).json({ error: "Room already has a candidate" });
  const updated = await prisma.room.update({
    where: { id: room.id },
    data: { candidateId: req.user!.id, status: "live" },
  });
  res.json(updated);
});


const runSchema = z.object({
  language: z.enum(["python", "javascript", "cpp"]), // allowlist
  code: z.string().max(50_000),
  stdin: z.string().max(10_000).default(""),
});

router.post("/:slug/run", async (req: AuthedRequest, res) => {
  const slug = String(req.params.slug);
  const parsed = runSchema.safeParse(req.body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return res.status(400).json({ error: `${first.path.join(".")}: ${first.message}` });
  }

  const room = await prisma.room.findUnique({ where: { slug } });
  if (!room || (room.interviewerId !== req.user!.id && room.candidateId !== req.user!.id))
    return res.status(403).json({ error: "Not a member of this room" });

  const job = await runQueue.add("run", { ...parsed.data, userId: req.user!.id, roomSlug: slug });
  res.status(202).json({ jobId: job.id });
});

export default router;