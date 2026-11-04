import { Queue, QueueEvents } from "bullmq";

const connection = { host: "127.0.0.1", port: 6379 };

export const runQueue = new Queue("code-runs", {
  connection,
  defaultJobOptions: {
    attempts: 1, // never silently re-run user code
    removeOnComplete: { age: 600 },
    removeOnFail: { age: 600 },
  },
});

// Lets the API wait for a job's result (used by grading)
export const queueEvents = new QueueEvents("code-runs", { connection });