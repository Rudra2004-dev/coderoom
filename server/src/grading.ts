import { runQueue, queueEvents } from "./queue";

export interface SandboxResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
  compileTimedOut: boolean;
  truncated: boolean;
  compileError: boolean;
  memoryExceeded: boolean;
  timeMs: number;
}

export type Verdict =
  | "passed"
  | "wrong_answer"
  | "runtime_error"
  | "time_limit"
  | "memory_limit"
  | "output_limit"
  | "compile_error"
  | "not_run";

export interface TestInput {
  input: string;
  expectedOutput: string;
  isHidden: boolean;
}

// This is exactly what the browser receives. Hidden tests carry no input, expected or actual output.
export interface TestOutcome {
  index: number;
  hidden: boolean;
  verdict: Verdict;
  timeMs: number;
  input?: string;
  expected?: string;
  actual?: string;
  stderr?: string;
}

export interface GradeResult {
  passedCount: number;
  totalCount: number;
  compileError: string | null;
  tests: TestOutcome[];
}

const clip = (s: string, max: number) => (s.length > max ? s.slice(0, max) + "…" : s);

// Ignore \r\n vs \n, trailing spaces on each line, and trailing blank lines
export const normalize = (s: string) =>
  s
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trimEnd();

function verdictOf(r: SandboxResult, expected: string): Verdict {
  if (r.compileError || r.compileTimedOut) return "compile_error";
  if (r.timedOut) return "time_limit";
  if (r.memoryExceeded) return "memory_limit";
  if (r.truncated) return "output_limit";
  if (r.exitCode !== 0) return "runtime_error";
  return normalize(r.stdout) === normalize(expected) ? "passed" : "wrong_answer";
}

function outcome(index: number, t: TestInput, r: SandboxResult | null, verdict: Verdict): TestOutcome {
  const base = { index, hidden: t.isHidden, verdict, timeMs: r?.timeMs ?? 0 };
  if (t.isHidden) return base; // nothing else may leave the server
  return {
    ...base,
    input: t.input,
    expected: t.expectedOutput,
    actual: clip(r?.stdout ?? "", 2000),
    stderr: clip(r?.stderr ?? "", 1000),
  };
}

export async function gradeSubmission(
  base: { language: string; code: string; userId: string; roomSlug: string },
  tests: TestInput[]
): Promise<GradeResult> {
  await queueEvents.waitUntilReady();

  const run = async (t: TestInput): Promise<SandboxResult> => {
    // kind: "grade" hides these jobs from GET /jobs/:id
    const job = await runQueue.add("run", { ...base, stdin: t.input, kind: "grade" });
    return (await job.waitUntilFinished(queueEvents, 90_000)) as SandboxResult;
  };

  const results: (SandboxResult | null)[] = tests.map(() => null);

  // Test 1 alone: if the code can't compile, don't waste N-1 more containers
  const first = await run(tests[0]);
  results[0] = first;
  const compileFailed = first.compileError || first.compileTimedOut;

  if (!compileFailed) {
    const rest = await Promise.all(tests.slice(1).map(run));
    rest.forEach((r, i) => (results[i + 1] = r));
  }

  const outcomes = tests.map((t, i) => {
    const r = results[i];
    return outcome(i, t, r, r ? verdictOf(r, t.expectedOutput) : "not_run");
  });

  return {
    passedCount: outcomes.filter((o) => o.verdict === "passed").length,
    totalCount: tests.length,
    compileError: compileFailed
      ? first.compileTimedOut
        ? "Compilation timed out"
        : clip(first.stderr, 4000)
      : null,
    tests: outcomes,
  };
}