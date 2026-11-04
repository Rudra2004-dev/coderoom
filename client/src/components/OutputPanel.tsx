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

function GradeView({ g }: { g: GradeOutput }) {
  const allPassed = g.passedCount === g.totalCount;
  return (
    <div className="space-y-2">
      <p className={`font-semibold ${allPassed ? "text-green-400" : "text-yellow-400"}`}>
        {g.passedCount}/{g.totalCount} tests passed
      </p>

      {g.compileError && (
        <pre className="text-xs text-red-400 bg-gray-950 rounded p-2 whitespace-pre-wrap">{g.compileError}</pre>
      )}

      <ul className="space-y-1">
        {g.tests.map((t) => {
          const ok = t.verdict === "passed";
          const name = t.hidden ? `Hidden test ${t.index + 1}` : `Test ${t.index + 1}`;
          const row = (
            <span className="flex items-center gap-2">
              <span>{ok ? "✅" : t.verdict === "not_run" ? "⏸" : "❌"}</span>
              <span className="flex-1">{name}</span>
              <span className={ok ? "text-green-400" : "text-red-400"}>{LABEL[t.verdict]}</span>
              {t.verdict !== "not_run" && <span className="text-xs text-gray-500">{t.timeMs} ms</span>}
            </span>
          );

          // Hidden tests, and visible tests with nothing to show, are a plain row
          if (t.hidden || t.input === undefined) {
            return (
              <li key={t.index} className="bg-gray-950 rounded px-2 py-1.5 text-xs">
                {row}
              </li>
            );
          }

          return (
            <li key={t.index} className="bg-gray-950 rounded text-xs">
              <details open={!ok && t.verdict !== "not_run"}>
                <summary className="cursor-pointer px-2 py-1.5">{row}</summary>
                <div className="px-2 pb-2 space-y-1 text-gray-300">
                  <p className="text-gray-500">Input</p>
                  <pre className="whitespace-pre-wrap">{t.input.trimEnd()}</pre>
                  <p className="text-gray-500">Expected</p>
                  <pre className="whitespace-pre-wrap">{t.expected}</pre>
                  <p className="text-gray-500">Your output</p>
                  <pre className="whitespace-pre-wrap">{t.actual || "(nothing)"}</pre>
                  {t.stderr && (
                    <>
                      <p className="text-gray-500">Errors</p>
                      <pre className="whitespace-pre-wrap text-red-400">{t.stderr}</pre>
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
    <aside className="h-full flex flex-col border border-gray-800 rounded bg-gray-900 overflow-hidden">
      <div className="px-3 py-2 text-xs text-gray-400 border-b border-gray-800">Input (stdin), shared</div>
      <textarea
        value={stdin}
        onChange={(e) => onStdinChange(e.target.value)}
        placeholder="Optional input for your program"
        className="h-24 resize-none bg-gray-950 p-3 text-sm text-gray-200 outline-none border-b border-gray-800"
      />
      <div className="px-3 py-2 text-xs text-gray-400 border-b border-gray-800">
        {output?.kind === "grade" && !runningLabel ? "Test results" : "Output"}
        {output?.by && !runningLabel ? ` · by ${output.by}` : ""}
      </div>
      <div className="flex-1 overflow-auto p-3 text-sm">
        {runningLabel ? (
          <p className="text-gray-300">{runningLabel}</p>
        ) : !output ? (
          <p className="text-gray-500">Click Run to execute your code, or Submit to run all tests.</p>
        ) : output.kind === "grade" ? (
          <GradeView g={output} />
        ) : (
          <pre className={`whitespace-pre-wrap ${output.isError ? "text-red-400" : "text-gray-200"}`}>
            {output.text}
          </pre>
        )}
      </div>
    </aside>
  );
}