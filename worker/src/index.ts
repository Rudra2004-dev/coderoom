import { Worker, Job } from "bullmq";
import { runInSandbox } from "./sandbox";
import type { JobData, RunResult } from "./sandbox";

const worker = new Worker<JobData, RunResult>(
  "code-runs",
  async (job: Job<JobData, RunResult>) => {
    console.log(`[job ${job.id}] ${job.data.language}, ${job.data.code.length} chars`);
    const result = await runInSandbox(job.data);
    console.log(`[job ${job.id}] exit=${result.exitCode} timedOut=${result.timedOut} ${result.timeMs}ms`);
    return result;
  },
  { connection: { host: "127.0.0.1", port: 6379 }, concurrency: 2 }
);

worker.on("failed", (job, err) => console.error(`[job ${job?.id}] failed:`, err.message));
worker.on("error", (err) => console.error("worker error:", err.message));
console.log("Worker ready, waiting for jobs...");