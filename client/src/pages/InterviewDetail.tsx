import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import Editor from "@monaco-editor/react";
import { api, getUser } from "../api";
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
  if (error) return <div className="p-8 text-red-400">{error}</div>;
  if (!report) return <div className="p-8 text-gray-400">Loading...</div>;

  const selected = view === "final" ? null : report.submissions.find((s) => s.id === view) ?? null;
  const code = selected ? selected.code : report.finalCode ?? "";
  const language = selected ? selected.language : report.finalLanguage ?? "plaintext";
  const minutes = report.endedAt
    ? Math.max(1, Math.round((new Date(report.endedAt).getTime() - new Date(report.createdAt).getTime()) / 60_000))
    : null;
  const bestPassed = report.submissions.reduce((m, s) => Math.max(m, s.passedCount), 0);
  const total = report.submissions[0]?.totalCount ?? 0;

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-6xl mx-auto space-y-5">
        <div className="flex items-center gap-4">
          <Link to="/dashboard" className="text-gray-400 underline text-sm">← My interviews</Link>
          <h1 className="text-xl font-bold">
            {report.candidate ?? "Candidate"} · {report.question?.title ?? "No question"}
          </h1>
          <button
            onClick={() => setShowScore(true)}
            className="ml-auto bg-blue-600 hover:bg-blue-500 rounded px-3 py-1.5 text-sm"
          >
            {report.scorecard ? "View scorecard" : "Generate scorecard"}
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div className="bg-gray-900 border border-gray-800 rounded p-3">
            <p className="text-xs text-gray-500">Best result</p>
            <p className="text-lg font-semibold">{report.submissions.length ? `${bestPassed}/${total}` : "none"}</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded p-3">
            <p className="text-xs text-gray-500">Attempts</p>
            <p className="text-lg font-semibold">{report.submissions.length}</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded p-3">
            <p className="text-xs text-gray-500">Duration</p>
            <p className="text-lg font-semibold">{minutes ? `${minutes} min` : "n/a"}</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded p-3">
            <p className="text-xs text-gray-500">Scores (C · Q · E)</p>
            <p className="text-lg font-semibold">
              {report.scorecard
                ? `${report.scorecard.correctness} · ${report.scorecard.codeQuality} · ${report.scorecard.efficiency}`
                : "n/a"}
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-[220px_1fr] gap-4">
          <div className="space-y-1 text-sm">
            <p className="text-xs text-gray-500 mb-1">Code to view</p>
            <button
              onClick={() => setView("final")}
              className={`w-full text-left rounded px-3 py-2 border ${
                view === "final" ? "border-blue-500 bg-gray-900" : "border-gray-800 hover:bg-gray-900"
              }`}
            >
              Final code
            </button>
            {report.submissions.map((s, i) => (
              <button
                key={s.id}
                onClick={() => setView(s.id)}
                className={`w-full text-left rounded px-3 py-2 border ${
                  view === s.id ? "border-blue-500 bg-gray-900" : "border-gray-800 hover:bg-gray-900"
                }`}
              >
                <span className="block">Attempt {i + 1} · {LANG_NAMES[s.language] ?? s.language}</span>
                <span className={s.passedCount === s.totalCount ? "text-green-400 text-xs" : "text-yellow-400 text-xs"}>
                  {s.passedCount}/{s.totalCount} passed
                </span>
                <span className="text-xs text-gray-500"> · {new Date(s.createdAt).toLocaleTimeString()}</span>
              </button>
            ))}
            {report.submissions.length === 0 && <p className="text-xs text-gray-500">No submissions were made.</p>}
          </div>

          <div className="space-y-4 min-w-0">
            <div className="border border-gray-800 rounded overflow-hidden">
              <Editor
                height="40vh"
                theme="vs-dark"
                language={language}
                value={code || "// (no code was saved)"}
                options={{ readOnly: true, minimap: { enabled: false }, fontSize: 14, automaticLayout: true }}
              />
            </div>

            {selected && (
              <div className="bg-gray-900 border border-gray-800 rounded p-3">
                <GradeView g={{ kind: "grade", ...selected.results }} />
              </div>
            )}
          </div>
        </div>
      </div>

      {showScore && <ScorecardPanel slug={report.slug} onClose={() => setShowScore(false)} />}
    </div>
  );
}