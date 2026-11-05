import { Router } from "express";
import crypto from "crypto";
import { prisma } from "../prisma";
import { requireAuth, requireRole, AuthedRequest } from "../middleware/auth";
import { z } from "zod";
import { runQueue } from "../queue";
import rateLimit from "express-rate-limit";
import { Prisma } from "@prisma/client";
import { gradeSubmission } from "../grading";
import { generateScorecard, ScorecardError, toDto } from "../scorecard";

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

router.get("/:slug", async (req: AuthedRequest, res) => {
  const slug = String(req.params.slug);
  const room = await prisma.room.findUnique({
    where: { slug },
    include: {
      interviewer: { select: { id: true, name: true } },
      candidate: { select: { id: true, name: true } },
    },
  });

  const me = req.user!.id;
  if (!room || (room.interviewer.id !== me && room.candidate?.id !== me))
    return res.status(404).json({ error: "Room not found" });

  // The final code is for the report route, not for the live room payload
  const { finalCode: _code, finalLanguage: _lang, ...safe } = room;
  res.json(safe);
});

router.post("/:slug/join", requireRole("candidate"), async (req: AuthedRequest, res) => {
  const slug = String(req.params.slug);
  const room = await prisma.room.findUnique({ where: { slug } });
  if (!room) return res.status(404).json({ error: "Room not found" });

  if (room.status === "ended") return res.status(409).json({ error: "This interview has ended" });

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

  if (room.status === "ended") return res.status(409).json({ error: "This interview has ended" });

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


const submitSchema = z.object({
  language: z.enum(["python", "cpp", "java"]), // allowlist, same as /run
  code: z.string().min(1).max(50_000),
});

const submitLimiter = rateLimit({
  windowMs: 60_000,
  limit: 6, // each submit fans out into several jobs, so the limit is lower than /run
  keyGenerator: (req) => (req as AuthedRequest).user!.id,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many submissions. Wait a minute and try again." },
});

// Rooms currently being graded, so a double click can't launch two gradings
const grading = new Set<string>();

router.post("/:slug/submit", submitLimiter, async (req: AuthedRequest, res) => {
  const parsed = submitSchema.safeParse(req.body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return res.status(400).json({ error: `${first.path.join(".")}: ${first.message}` });
  }

  const room = await prisma.room.findUnique({ where: { slug: String(req.params.slug) } });
  if (!room || (room.interviewerId !== req.user!.id && room.candidateId !== req.user!.id))
    return res.status(403).json({ error: "Not a member of this room" });
  if (room.status === "ended") return res.status(409).json({ error: "This interview has ended" });
  if (!room.questionId) return res.status(409).json({ error: "No question has been selected yet" });
  if (grading.has(room.id)) return res.status(409).json({ error: "A submission is already being graded" });

  const tests = await prisma.testCase.findMany({
    where: { questionId: room.questionId },
    orderBy: { order: "asc" },
  });
  if (tests.length === 0) return res.status(409).json({ error: "This question has no test cases" });

  // Fail fast with a clear message instead of making the user wait for a timeout
  if ((await runQueue.getWorkers()).length === 0)
    return res.status(503).json({ error: "No grader is available right now. Please try again shortly." });
  if ((await runQueue.getWaitingCount()) + tests.length > 50)
    return res.status(503).json({ error: "Server is busy. Try again in a few seconds." });

  grading.add(room.id);
  try {
    const result = await gradeSubmission(
      { language: parsed.data.language, code: parsed.data.code, userId: req.user!.id, roomSlug: room.slug },
      tests
    );
    const saved = await prisma.submission.create({
      data: {
        roomId: room.id,
        userId: req.user!.id,
        language: parsed.data.language,
        code: parsed.data.code,
        results: result as unknown as Prisma.InputJsonValue,
        passedCount: result.passedCount,
        totalCount: result.totalCount,
      },
    });
    res.json({ submissionId: saved.id, ...result });
  } catch (err) {
    console.error("grading failed:", err);
    res.status(503).json({ error: "Grading failed. Please try again." });
  } finally {
    grading.delete(room.id);
  }
});


const endSchema = z.object({
  finalCode: z.string().max(50_000),
  language: z.enum(["python", "cpp", "java"]),
});

// Interviewer ends the interview. Saves the final code. Never calls the AI.
router.post("/:slug/end", requireRole("interviewer"), async (req: AuthedRequest, res) => {
  const parsed = endSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "finalCode and language are required" });

  const room = await prisma.room.findUnique({ where: { slug: String(req.params.slug) } });
  if (!room || room.interviewerId !== req.user!.id)
    return res.status(403).json({ error: "Only the room's interviewer can do this" });
  if (room.status === "ended") return res.json({ ok: true, alreadyEnded: true });

  await prisma.room.update({
    where: { id: room.id },
    data: {
      status: "ended",
      endedAt: new Date(),
      finalCode: parsed.data.finalCode,
      finalLanguage: parsed.data.language,
    },
  });
  res.json({ ok: true });
});

const scorecardLimiter = rateLimit({
  windowMs: 60 * 60_000,
  limit: 10, // protects your Groq quota
  keyGenerator: (req) => (req as AuthedRequest).user!.id,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many scorecard requests. Try again later." },
});

const scoring = new Set<string>();

// Interviewer reads the saved scorecard (null if none yet)
router.get("/:slug/scorecard", requireRole("interviewer"), async (req: AuthedRequest, res) => {
  const room = await prisma.room.findUnique({
    where: { slug: String(req.params.slug) },
    include: { scorecard: true },
  });
  if (!room || room.interviewerId !== req.user!.id)
    return res.status(403).json({ error: "Only the room's interviewer can do this" });
  res.json(room.scorecard ? toDto(room.scorecard) : null);
});

// Interviewer generates (or regenerates) the scorecard for an ended interview
router.post("/:slug/scorecard", requireRole("interviewer"), scorecardLimiter, async (req: AuthedRequest, res) => {
  const room = await prisma.room.findUnique({
    where: { slug: String(req.params.slug) },
    include: { scorecard: true },
  });
  if (!room || room.interviewerId !== req.user!.id)
    return res.status(403).json({ error: "Only the room's interviewer can do this" });
  if (room.status !== "ended") return res.status(409).json({ error: "End the interview first" });
  if (room.scorecard && req.query.regenerate !== "1") return res.json(toDto(room.scorecard));
  if (scoring.has(room.id)) return res.status(409).json({ error: "A scorecard is already being generated" });

  scoring.add(room.id);
  try {
    res.json(toDto(await generateScorecard(room.id)));
  } catch (err) {
    if (err instanceof ScorecardError) return res.status(err.status).json({ error: err.message });
    console.error("scorecard failed:", err);
    res.status(500).json({ error: "Could not generate the scorecard" });
  } finally {
    scoring.delete(room.id);
  }
});


// The interviewer's own interviews, newest first
router.get("/", requireRole("interviewer"), async (req: AuthedRequest, res) => {
  const rooms = await prisma.room.findMany({
    where: { interviewerId: req.user!.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      slug: true,
      status: true,
      createdAt: true,
      endedAt: true,
      candidate: { select: { name: true } },
      question: { select: { title: true, difficulty: true } },
      submissions: { select: { passedCount: true, totalCount: true } },
      scorecard: { select: { correctness: true, codeQuality: true, efficiency: true } },
    },
  });

  res.json(
    rooms.map((r) => {
      // Best attempt = highest pass rate
      let best: { passed: number; total: number } | null = null;
      let bestRatio = -1;
      for (const s of r.submissions) {
        const ratio = s.totalCount ? s.passedCount / s.totalCount : 0;
        if (ratio > bestRatio) {
          bestRatio = ratio;
          best = { passed: s.passedCount, total: s.totalCount };
        }
      }
      return {
        slug: r.slug,
        status: r.status,
        createdAt: r.createdAt,
        endedAt: r.endedAt,
        candidate: r.candidate?.name ?? null,
        question: r.question?.title ?? null,
        difficulty: r.question?.difficulty ?? null,
        attempts: r.submissions.length,
        best,
        minutes: r.endedAt ? Math.max(1, Math.round((r.endedAt.getTime() - r.createdAt.getTime()) / 60_000)) : null,
        scorecard: r.scorecard,
      };
    })
  );
});

// Everything about one interview. Owner only.
router.get("/:slug/report", requireRole("interviewer"), async (req: AuthedRequest, res) => {
  const room = await prisma.room.findUnique({
    where: { slug: String(req.params.slug) },
    include: {
      candidate: { select: { name: true } },
      question: { select: { title: true, difficulty: true, description: true } },
      submissions: { orderBy: { createdAt: "asc" } },
      scorecard: true,
    },
  });
  // 404 for "missing" and "not yours" alike, so slugs can't be probed
  if (!room || room.interviewerId !== req.user!.id) return res.status(404).json({ error: "Interview not found" });

  res.json({
    slug: room.slug,
    status: room.status,
    createdAt: room.createdAt,
    endedAt: room.endedAt,
    candidate: room.candidate?.name ?? null,
    question: room.question,
    finalCode: room.finalCode,
    finalLanguage: room.finalLanguage,
    submissions: room.submissions.map((s) => ({
      id: s.id,
      language: s.language,
      code: s.code,
      passedCount: s.passedCount,
      totalCount: s.totalCount,
      createdAt: s.createdAt,
      results: s.results,
    })),
    scorecard: room.scorecard ? toDto(room.scorecard) : null,
  });
});

export default router;