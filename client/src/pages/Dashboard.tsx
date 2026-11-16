import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { ArrowLeft, User } from "lucide-react";
import { api, getUser } from "../api";
import Navbar from "../components/Navbar";

interface Row {
  slug: string;
  status: "waiting" | "live" | "ended";
  createdAt: string;
  endedAt: string | null;
  candidate: string | null;
  question: string | null;
  difficulty: string | null;
  attempts: number;
  best: { passed: number; total: number } | null;
  minutes: number | null;
  scorecard: { correctness: number; codeQuality: number; efficiency: number } | null;
}

const STATUS: Record<Row["status"], { label: string; cls: string }> = {
  waiting: { label: "Waiting", cls: "bg-slate-200 text-slate-600" },
  live: { label: "Live", cls: "bg-emerald-100 text-emerald-700" },
  ended: { label: "Ended", cls: "bg-sky-100 text-sky-700" },
};

const DIFFICULTY: Record<string, string> = {
  Easy: "bg-emerald-100 text-emerald-700",
  Medium: "bg-amber-100 text-amber-700",
  Hard: "bg-red-100 text-red-700",
};

const FILTERS = [
  { key: "all", label: "All" },
  { key: "open", label: "In progress" },
  { key: "ended", label: "Ended" },
] as const;

export default function Dashboard() {
  const role = getUser()?.role;
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");

  useEffect(() => {
    if (role !== "interviewer") return;
    let active = true;
    api("/rooms")
      .then((r) => active && setRows(r))
      .catch((e: Error) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, [role]);

  if (role !== "interviewer") return <Navigate to="/" replace />;

  const shown = (rows ?? []).filter((r) =>
    filter === "all" ? true : filter === "ended" ? r.status === "ended" : r.status !== "ended"
  );

  return (
    <div className="lt-bg">
      <Navbar variant="light" />

      <main className="mx-auto max-w-6xl space-y-6 px-6 py-8">
        {/* Title row with filters */}
        <div className="flex flex-wrap items-center gap-4">
          <Link
            to="/"
            className="flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium text-slate-700 hover:bg-white/70"
          >
            <ArrowLeft size={16} /> Home
          </Link>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900">
            My <span className="serif-italic text-[1.12em]">interviews</span>
          </h1>

          <div className="ml-auto flex gap-2">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                aria-pressed={filter === f.key}
                className={`rounded-full px-5 py-2 text-sm font-semibold transition ${
                  filter === f.key
                    ? "btn-primary"
                    : "lt-pill text-slate-800 hover:bg-white"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-600">{error}</p>}
        {!rows && !error && <p className="text-sm text-slate-500">Loading...</p>}
        {rows && shown.length === 0 && (
          <p className="lt-card p-8 text-center text-slate-500">No interviews to show.</p>
        )}

        {shown.length > 0 && (
          <div className="lt-card overflow-x-auto p-2">
            <table className="w-full min-w-[56rem] text-left text-sm">
              <thead>
                <tr className="text-slate-500">
                  <th className="px-4 py-4 font-semibold">Candidate</th>
                  <th className="px-4 py-4 font-semibold">Question</th>
                  <th className="px-4 py-4 font-semibold">Status</th>
                  <th className="px-4 py-4 font-semibold">Best result</th>
                  <th className="px-4 py-4 font-semibold" title="correctness · code quality · efficiency">
                    Scores
                  </th>
                  <th className="px-4 py-4 font-semibold">Date</th>
                  <th className="px-4 py-4" />
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.slug} className="border-t border-slate-900/5 hover:bg-white/60">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                            r.candidate ? "bg-violet-100 font-bold text-indigo-700" : "bg-slate-100 text-slate-400"
                          }`}
                        >
                          {r.candidate ? r.candidate[0].toUpperCase() : <User size={18} />}
                        </span>
                        <span className={r.candidate ? "font-semibold text-slate-900" : "text-slate-400"}>
                          {r.candidate ?? "not joined"}
                        </span>
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      {r.question ? (
                        <span className="flex items-center gap-2 font-semibold text-slate-900">
                          {r.question}
                          {r.difficulty && (
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                DIFFICULTY[r.difficulty] ?? "bg-slate-100 text-slate-600"
                              }`}
                            >
                              {r.difficulty}
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-slate-400">none</span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <span className={`rounded-full px-3.5 py-1 text-xs font-semibold ${STATUS[r.status].cls}`}>
                        {STATUS[r.status].label}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      {r.best ? (
                        <>
                          <span
                            className={`font-bold ${
                              r.best.passed === r.best.total ? "text-emerald-600" : "text-amber-500"
                            }`}
                          >
                            {r.best.passed}/{r.best.total}
                          </span>
                          <span className="text-slate-500">
                            {" "}
                            · {r.attempts} attempt{r.attempts === 1 ? "" : "s"}
                            {r.minutes ? ` · ${r.minutes} min` : ""}
                          </span>
                        </>
                      ) : (
                        <span className="text-slate-500">no submissions</span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      {r.scorecard ? (
                        <span className="font-bold text-slate-900">
                          {r.scorecard.correctness} · {r.scorecard.codeQuality} · {r.scorecard.efficiency}
                        </span>
                      ) : (
                        <span className="text-slate-400">n/a</span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-slate-500">{new Date(r.createdAt).toLocaleString()}</td>

                    <td className="px-4 py-3 text-right">
                      {r.status === "ended" ? (
                        <Link
                          to={`/dashboard/${r.slug}`}
                          className="inline-block rounded-xl bg-violet-100 px-5 py-2 text-sm font-semibold text-indigo-700 hover:bg-violet-200"
                        >
                          Review
                        </Link>
                      ) : (
                        <Link
                          to={`/room/${r.slug}`}
                          className="inline-block rounded-xl bg-emerald-100 px-5 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-200"
                        >
                          Open room
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}