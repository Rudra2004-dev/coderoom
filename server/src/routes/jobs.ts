import { Router } from "express";
import { requireAuth, AuthedRequest } from "../middleware/auth";
import { runQueue } from "../queue";

const router = Router();
router.use(requireAuth);

router.get("/:id", async (req: AuthedRequest, res) => {
  const job = await runQueue.getJob(String(req.params.id));
  // 404 (not 403) so people can't probe which job ids exist
  if (!job || job.data.userId !== req.user!.id) return res.status(404).json({ error: "Job not found" });

  const state = await job.getState();
  if (state === "completed") return res.json({ state, result: job.returnvalue });
  if (state === "failed") return res.json({ state, error: "Execution failed. Please try again." });
  res.json({ state });
});

export default router;