import { Router } from "express";
import crypto from "crypto";
import { prisma } from "../prisma";
import { requireAuth, requireRole, AuthedRequest } from "../middleware/auth";
import { z } from "zod";
import { runQueue } from "../queue";
import rateLimit from "express-rate-limit";

const router = Router();
router.use(requireAuth);


const runLimiter = rateLimit({
  windowMs: 60_000,
  limit: 15, // 15 runs per user per minute
  keyGenerator: (req) => (req as AuthedRequest).user!.id,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many runs. Wait a minute and try again." },
});

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
  language: z.enum(["python", "cpp", "java"]), // allowlist
  code: z.string().max(50_000),
  stdin: z.string().max(10_000).default(""),
});

router.post("/:slug/run", runLimiter, async (req: AuthedRequest, res) => {
  const slug = String(req.params.slug);
  const parsed = runSchema.safeParse(req.body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return res.status(400).json({ error: `${first.path.join(".")}: ${first.message}` });
  }

  const room = await prisma.room.findUnique({ where: { slug } });
  if (!room || (room.interviewerId !== req.user!.id && room.candidateId !== req.user!.id))
    return res.status(403).json({ error: "Not a member of this room" });

  if ((await runQueue.getWaitingCount()) >= 50)
    return res.status(503).json({ error: "Server is busy. Try again in a few seconds." });

  const job = await runQueue.add("run", { ...parsed.data, userId: req.user!.id, roomSlug: slug });
  res.status(202).json({ jobId: job.id });
});


const pickSchema = z.object({ questionId: z.string().min(1) });

// Interviewer chooses the question for their room
router.put("/:slug/question", requireRole("interviewer"), async (req: AuthedRequest, res) => {
  const parsed = pickSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "questionId is required" });

  const room = await prisma.room.findUnique({ where: { slug: String(req.params.slug) } });
  if (!room || room.interviewerId !== req.user!.id)
    return res.status(403).json({ error: "Only the room's interviewer can do this" });
  if (room.status === "ended") return res.status(409).json({ error: "This interview has ended" });

  const question = await prisma.question.findUnique({ where: { id: parsed.data.questionId } });
  if (!question) return res.status(404).json({ error: "Question not found" });

  await prisma.room.update({ where: { id: room.id }, data: { questionId: question.id } });
  res.json({ ok: true });
});

// Either member reads the active question. Hidden test cases never leave the server.
router.get("/:slug/question", async (req: AuthedRequest, res) => {
  const room = await prisma.room.findUnique({ where: { slug: String(req.params.slug) } });
  if (!room || (room.interviewerId !== req.user!.id && room.candidateId !== req.user!.id))
    return res.status(403).json({ error: "Not a member of this room" });
  if (!room.questionId) return res.json(null);

  const question = await prisma.question.findUnique({
    where: { id: room.questionId },
    select: {
      id: true,
      title: true,
      difficulty: true,
      description: true,
      inputFormat: true,
      outputFormat: true,
      testCases: {
        where: { isHidden: false },
        orderBy: { order: "asc" },
        select: { input: true, expectedOutput: true },
      },
    },
  });
  if (!question) return res.json(null);

  const hiddenCount = await prisma.testCase.count({
    where: { questionId: question.id, isHidden: true },
  });
  const { testCases, ...rest } = question;
  res.json({ ...rest, examples: testCases, hiddenCount });
});

export default router;