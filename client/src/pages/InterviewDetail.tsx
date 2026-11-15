import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import Editor from "@monaco-editor/react";
import type { Monaco } from "@monaco-editor/react";
import { ArrowLeft, Clock, RefreshCw, Sparkles, Star, Target } from "lucide-react";
import { api, getUser } from "../api";
import Navbar from "../components/Navbar";
import { GradeView } from "../components/OutputPanel";
import type { GradeOutput } from "../components/OutputPanel";
import ScorecardPanel from "../components/ScorecardPanel";

interface Report {
  slug: string;
  status: string;
  createdAt: string;
  endedAt: string | null;
  candidate: string | null;
  question: { title: string; difficulty: string; description: string } | null;
  finalCode: string | null;
  finalLanguage: string | null;
  submissions: {
    id: string;
    language: string;
    code: string;
    passedCount: number;
    totalCount: number;
    createdAt: string;
    results: Omit<GradeOutput, "kind">;
  }[];
  scorecard: { correctness: number; codeQuality: number; efficiency: number } | null;
}

const LANG_NAMES: Record<string, string> = { python: "Python", cpp: "C++", java: "Java" };

const DIFFICULTY: Record<string, string> = {
  Easy: "bg-emerald-100 text-emerald-700",
  Medium: "bg-amber-100 text-amber-700",
  Hard: "bg-red-100 text-red-700",
};

// Same navy editor theme as the live room (defining it twice is harmless)
function defineTheme(monaco: Monaco) {
  monaco.editor.defineTheme("coderoom-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [],
    colors: {
      "editor.background": "#222633",
      "editorGutter.background": "#222633",
      "editor.lineHighlightBackground": "#2a2f3f",
      "editorLineNumber.foreground": "#6b7280",
      "editorLineNumber.activeForeground": "#cbd5e1",
    },
  });
}

function Stat({ icon, iconCls, label, value }: { icon: ReactNode; iconCls: string; label: string; value: string }) {
  return (
    <div className="lt-card flex items-center gap-4 p-4">
      <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${iconCls}`}>{icon}</span>
      <div>
        <p className="text-sm text-slate-500">{label}</p>
        <p className="text-xl font-bold text-slate-900">{value}</p>
      </div>
    </div>
  );
}

export default function InterviewDetail() {
  const { slug = "" } = useParams();
  const role = getUser()?.role;
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");
  const [view, setView] = useState<"final" | string>("final");
  const [showScore, setShowScore] = useState(false);

  useEffect(() => {
    if (role !== "interviewer") return;
    let active = true;
    api(`/rooms/${slug}/report`)
      .then((r) => active && setReport(r))
      .catch((e: Error) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, [slug, role]);

  if (role !== "interviewer") return <Navigate to="/" replace />;

  if (error || !report) {
    return (
      <div className="lt-bg">
        <Navbar variant="light" />
        <div className="mx-auto max-w-6xl px-6 py-10">
          {error ? <p className="text-red-600">{error}</p> : <p className="text-slate-500">Loading...</p>}
        </div>
      </div>
    );
  }

  const selected = view === "final" ? null : report.submissions.find((s) => s.id === view) ?? null;
  const code = selected ? selected.code : report.finalCode ?? "";
  const language = selected ? selected.language : report.finalLanguage ?? "plaintext";
  const minutes = report.endedAt
    ? Math.max(1, Math.round((new Date(report.endedAt).getTime() - new Date(report.createdAt).getTime()) / 60_000))
    : null;
  const bestPassed = report.submissions.reduce((m, s) => Math.max(m, s.passedCount), 0);
  const total = report.submissions[0]?.totalCount ?? 0;

  return (
    <div className="lt-bg">
      <Navbar variant="light" />

      <main className="mx-auto max-w-6xl space-y-6 px-6 py-8">
        {/* Title row */}
        <div className="flex flex-wrap items-center gap-4">
          <Link
            to="/dashboard"
            className="lt-pill flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-white"
          >
            <ArrowLeft size={16} /> My interviews
          </Link>
          <div className="min-w-0">
            <h1 className="flex flex-wrap items-center gap-3 text-2xl font-bold text-slate-900">
              {report.candidate ?? "Candidate"} · {report.question?.title ?? "No question"}
              {report.question && (
                <span
                  className={`rounded-full px-3 py-0.5 text-xs font-medium ${
                    DIFFICULTY[report.question.difficulty] ?? "bg-slate-100 text-slate-600"
                  }`}
                >
                  {report.question.difficulty}
                </span>
              )}
            </h1>
            <p className="text-sm text-slate-500">
              Room {report.slug} · {new Date(report.createdAt).toLocaleString()}
            </p>
          </div>
          <button
            onClick={() => setShowScore(true)}
            className="btn-dark ml-auto flex items-center gap-2 px-6 py-3 text-sm"
          >
            <Sparkles size={16} /> {report.scorecard ? "View scorecard" : "Generate scorecard"}
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat
            icon={<Target size={22} />}
            iconCls="bg-emerald-100 text-emerald-600"
            label="Best result"
            value={report.submissions.length ? `${bestPassed}/${total}` : "none"}
          />
          <Stat
            icon={<RefreshCw size={22} />}
            iconCls="bg-indigo-100 text-indigo-600"
            label="Attempts"
            value={String(report.submissions.length)}
          />
          <Stat
            icon={<Clock size={22} />}
            iconCls="bg-sky-100 text-sky-600"
            label="Duration"
            value={minutes ? `${minutes} min` : "n/a"}
          />
          <Stat
            icon={<Star size={22} />}
            iconCls="bg-amber-100 text-amber-600"
            label="Scores (C · Q · E)"
            value={
              report.scorecard
                ? `${report.scorecard.correctness} · ${report.scorecard.codeQuality} · ${report.scorecard.efficiency}`
                : "n/a"
            }
          />
        </div>

        {/* Attempts list + code */}
        <div className="grid gap-4 md:grid-cols-[250px_minmax(0,1fr)]">
          <div className="lt-card space-y-2 p-4">
            <p className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Code to view</p>

            <button
              onClick={() => setView("final")}
              className={`w-full rounded-xl border px-3 py-2.5 text-left text-sm font-medium transition ${
                view === "final"
                  ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                  : "border-transparent text-slate-700 hover:bg-slate-100"
              }`}
            >
              Final code
            </button>

            {report.submissions.map((s, i) => (
              <button
                key={s.id}
                onClick={() => setView(s.id)}
                className={`w-full rounded-xl border px-3 py-2.5 text-left text-sm transition ${
                  view === s.id
                    ? "border-indigo-300 bg-indigo-50"
                    : "border-transparent hover:bg-slate-100"
                }`}
              >
                <span className="block font-medium text-slate-800">
                  Attempt {i + 1} · {LANG_NAMES[s.language] ?? s.language}
                </span>
                <span
                  className={`text-xs font-medium ${
                    s.passedCount === s.totalCount ? "text-emerald-600" : "text-amber-600"
                  }`}
                >
                  {s.passedCount}/{s.totalCount} passed
                </span>
                <span className="text-xs text-slate-400"> · {new Date(s.createdAt).toLocaleTimeString()}</span>
              </button>
            ))}

            {report.submissions.length === 0 && (
              <p className="px-1 text-xs text-slate-400">No submissions were made.</p>
            )}
          </div>

          <div className="min-w-0 space-y-4">
            <div className="lt-card p-3">
              <p className="px-2 pb-2 text-sm font-medium text-slate-600">
                {selected ? `Attempt ${report.submissions.indexOf(selected) + 1}` : "Final code"} ·{" "}
                {LANG_NAMES[language] ?? language}
              </p>
              <div className="overflow-hidden rounded-2xl">
                <Editor
                  height="clamp(18rem, 42vh, 30rem)"
                  theme="coderoom-dark"
                  language={language}
                  value={code || "// (no code was saved)"}
                  beforeMount={defineTheme}
                  options={{
                    readOnly: true,
                    minimap: { enabled: false },
                    fontSize: 14,
                    automaticLayout: true,
                    scrollBeyondLastLine: false,
                    padding: { top: 12 },
                  }}
                />
              </div>
            </div>

            {selected && (
              <div className="lt-card p-5">
                <GradeView g={{ kind: "grade", ...selected.results }} />
              </div>
            )}
          </div>
        </div>
      </main>

      {showScore && <ScorecardPanel slug={report.slug} onClose={() => setShowScore(false)} />}
    </div>
  );
}