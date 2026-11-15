export type Verdict =
  | "passed"
  | "wrong_answer"
  | "runtime_error"
  | "time_limit"
  | "memory_limit"
  | "output_limit"
  | "compile_error"
  | "not_run";

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

export interface RunOutput {
  kind?: "run";
  text: string;
  isError: boolean;
  by?: string;
  at?: number;
}

export interface GradeOutput {
  kind: "grade";
  passedCount: number;
  totalCount: number;
  compileError: string | null;
  tests: TestOutcome[];
  by?: string;
  at?: number;
}

export type SharedOutput = RunOutput | GradeOutput;

const LABEL: Record<Verdict, string> = {
  passed: "Passed",
  wrong_answer: "Wrong answer",
  runtime_error: "Runtime error",
  time_limit: "Time limit exceeded",
  memory_limit: "Memory limit exceeded",
  output_limit: "Output limit exceeded",
  compile_error: "Compile error",
  not_run: "Not run",
};

export function GradeView({ g }: { g: GradeOutput }) {
  const allPassed = g.passedCount === g.totalCount;
  return (
    <div className="space-y-2">
      <p className={`font-semibold ${allPassed ? "text-emerald-600" : "text-amber-600"}`}>
        {g.passedCount}/{g.totalCount} tests passed
      </p>

      {g.compileError && (
        <pre className="whitespace-pre-wrap rounded-lg bg-red-50 p-2 text-xs text-red-600">{g.compileError}</pre>
      )}

      <ul className="space-y-1">
        {g.tests.map((t) => {
          const ok = t.verdict === "passed";
          const name = t.hidden ? `Hidden test ${t.index + 1}` : `Test ${t.index + 1}`;
          const row = (
            <span className="flex items-center gap-2">
              <span>{ok ? "✅" : t.verdict === "not_run" ? "⏸" : "❌"}</span>
              <span className="flex-1 text-slate-800">{name}</span>
              <span className={ok ? "text-emerald-600" : "text-red-600"}>{LABEL[t.verdict]}</span>
              {t.verdict !== "not_run" && <span className="text-xs text-slate-400">{t.timeMs} ms</span>}
            </span>
          );

          // Hidden tests, and visible tests with nothing to show, are a plain row
          if (t.hidden || t.input === undefined) {
            return (
              <li key={t.index} className="rounded-lg bg-white px-2 py-1.5 text-xs shadow-sm">
                {row}
              </li>
            );
          }

          return (
            <li key={t.index} className="rounded-lg bg-white text-xs shadow-sm">
              <details open={!ok && t.verdict !== "not_run"}>
                <summary className="cursor-pointer px-2 py-1.5">{row}</summary>
                <div className="space-y-1 px-2 pb-2 text-slate-700">
                  <p className="text-slate-400">Input</p>
                  <pre className="whitespace-pre-wrap">{t.input.trimEnd()}</pre>
                  <p className="text-slate-400">Expected</p>
                  <pre className="whitespace-pre-wrap">{t.expected}</pre>
                  <p className="text-slate-400">Your output</p>
                  <pre className="whitespace-pre-wrap">{t.actual || "(nothing)"}</pre>
                  {t.stderr && (
                    <>
                      <p className="text-slate-400">Errors</p>
                      <pre className="whitespace-pre-wrap text-red-600">{t.stderr}</pre>
                    </>
                  )}
                </div>
              </details>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

interface Props {
  output: SharedOutput | null;
  runningLabel: string | null;
  stdin: string;
  onStdinChange: (value: string) => void;
}

export default function OutputPanel({ output, runningLabel, stdin, onStdinChange }: Props) {
  return (
    <aside className="lt-card flex h-full flex-col overflow-hidden">
      <div className="shrink-0 p-4">
        <p className="mb-2 text-sm font-semibold text-slate-900">Input (stdin), shared</p>
        <textarea
          value={stdin}
          onChange={(e) => onStdinChange(e.target.value)}
          placeholder="Optional input for your program"
          className="h-[clamp(5rem,16vh,8rem)] w-full resize-none rounded-xl bg-slate-100/80 p-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:ring-4 focus:ring-indigo-100"
        />
      </div>

      <div className="flex min-h-0 flex-1 flex-col border-t border-slate-900/5 p-4">
        <p className="mb-2 text-sm font-semibold text-slate-900">
          {output?.kind === "grade" && !runningLabel ? "Test results" : "Output"}
          {output?.by && !runningLabel ? (
            <span className="font-normal text-slate-400"> · by {output.by}</span>
          ) : null}
        </p>
        <div className="min-h-0 flex-1 overflow-auto rounded-xl bg-slate-100/80 p-3 text-sm">
          {runningLabel ? (
            <p className="text-slate-600">{runningLabel}</p>
          ) : !output ? (
            <p className="text-slate-400">Click Run to execute your code, or Submit to run all tests.</p>
          ) : output.kind === "grade" ? (
            <GradeView g={output} />
          ) : (
            <pre className={`whitespace-pre-wrap ${output.isError ? "text-red-600" : "text-slate-800"}`}>
              {output.text}
            </pre>
          )}
        </div>
      </div>
    </aside>
  );
}