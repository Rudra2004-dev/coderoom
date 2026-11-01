import { Worker } from "bullmq";
import { execFile } from "child_process";
import { runInSandbox } from "./sandbox";
import type { JobData, RunResult } from "./sandbox";

// On startup, remove sandbox containers left behind by an earlier crash
function reapOrphans() {
  execFile("docker", ["ps", "-aq", "--filter", "name=^cr-"], (err, out) => {
    if (err) return console.error("reaper: could not list containers");
    const ids = out.split(/\s+/).filter(Boolean);
    if (ids.length)
      execFile("docker", ["rm", "-f", ...ids], () => console.log(`reaped ${ids.length} orphan container(s)`));
  });
}
reapOrphans();

const worker = new Worker<JobData, RunResult>(
  "code-runs",
  async (job) => {
    console.log(`[job ${job.id}] ${job.data.language}, ${job.data.code.length} chars`);
    const result = await runInSandbox(job.data);
    console.log(`[job ${job.id}] exit=${result.exitCode} timedOut=${result.timedOut} ${result.timeMs}ms`);
    return result;
  },
  { connection: { host: "127.0.0.1", port: 6379 }, concurrency: 2 }
);

worker.on("failed", (job, err) => console.error(`[job ${job?.id}] failed:`, err.message));
worker.on("error", (err) => console.error("worker error:", err.message));

// Finish the current job before exiting on Ctrl+C
process.on("SIGINT", async () => {
  await worker.close();
  process.exit(0);
});

console.log("Worker ready, waiting for jobs...");