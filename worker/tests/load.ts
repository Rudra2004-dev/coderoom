import { Queue, QueueEvents } from "bullmq";
import { appendFileSync, existsSync, writeFileSync } from "fs";
import path from "path";

const connection = { host: "127.0.0.1", port: 6379 };
const queue = new Queue("code-runs", { connection });
const events = new QueueEvents("code-runs", { connection });

const PROGRAMS = {
  python: `print(sum(range(1000)))`,
  cpp: `#include <iostream>\nint main() { long s = 0; for (int i = 0; i < 1000; i++) s += i; std::cout << s << "\\n"; }`,
  java: `public class Main { public static void main(String[] a) { long s = 0; for (int i = 0; i < 1000; i++) s += i; System.out.println(s); } }`,
} as const;

type Lang = keyof typeof PROGRAMS;

function percentile(sorted: number[], p: number) {
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
}

async function runOne(lang: Lang) {
  const t0 = Date.now();
  const job = await queue.add(
    "run",
    { language: lang, code: PROGRAMS[lang], stdin: "", userId: "load-test", roomSlug: "load-test" },
    { removeOnComplete: { age: 60 }, removeOnFail: { age: 60 }, attempts: 1 }
  );
  const result = await job.waitUntilFinished(events, 180_000);
  const ok = result.exitCode === 0 && !result.timedOut && result.stdout.trim() === "499500";
  return { ms: Date.now() - t0, ok };
}

async function main() {
  const lang = (process.argv[2] ?? "python") as Lang;
  const total = Number(process.argv[3] ?? 30);
  const workerConcurrency = process.argv[4] ?? "2"; // just a label for the table
  if (!(lang in PROGRAMS)) throw new Error("language must be python | cpp | java");

  await events.waitUntilReady();

  console.log("Warm-up run (excluded from stats)...");
  await runOne(lang);

  console.log(`Submitting ${total} ${lang} jobs at once (worker concurrency ${workerConcurrency})...`);
  const start = Date.now();
  const results = await Promise.all(
    Array.from({ length: total }, () => runOne(lang).catch(() => ({ ms: 0, ok: false })))
  );
  const wallMs = Date.now() - start;

  const good = results.filter((r) => r.ok).map((r) => r.ms).sort((a, b) => a - b);
  const failures = results.length - good.length;
  const avg = good.reduce((s, x) => s + x, 0) / Math.max(good.length, 1);

  const row = {
    lang,
    jobs: total,
    workers: workerConcurrency,
    avg: Math.round(avg),
    p50: percentile(good, 50),
    p95: percentile(good, 95),
    max: good[good.length - 1],
    throughput: (total / (wallMs / 1000)).toFixed(2),
    failures,
  };
  console.table([row]);

  const file = path.join(process.cwd(), "tests", "BENCHMARK.md");
  if (!existsSync(file)) {
    writeFileSync(
      file,
      "| Language | Jobs | Worker concurrency | Avg (ms) | P50 (ms) | P95 (ms) | Max (ms) | Jobs/sec | Failures |\n|---|---|---|---|---|---|---|---|---|\n"
    );
  }
  appendFileSync(
    file,
    `| ${row.lang} | ${row.jobs} | ${row.workers} | ${row.avg} | ${row.p50} | ${row.p95} | ${row.max} | ${row.throughput} | ${row.failures} |\n`
  );
  console.log("Appended to tests/BENCHMARK.md");

  await queue.close();
  await events.close();
  process.exit(failures ? 1 : 0);
}

main();