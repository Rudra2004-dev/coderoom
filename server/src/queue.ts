import { Queue } from "bullmq";

export const runQueue = new Queue("code-runs", {
  connection: { host: "127.0.0.1", port: 6379 },
  defaultJobOptions: {
    attempts: 1, // never silently re-run user code
    removeOnComplete: { age: 600 },
    removeOnFail: { age: 600 },
  },
});