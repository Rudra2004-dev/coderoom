import { Router } from "express";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

// Only interviewers choose questions, so only they need the list
router.get("/", requireRole("interviewer"), async (_req, res) => {
  const questions = await prisma.question.findMany({
    orderBy: { position: "asc" },
    select: { id: true, title: true, difficulty: true },
  });
  res.json(questions);
});

export default router;