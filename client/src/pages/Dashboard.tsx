import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { api, getUser } from "../api";

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

const statusStyle: Record<Row["status"], string> = {
  waiting: "bg-gray-800 text-gray-300",
  live: "bg-green-900 text-green-300",
  ended: "bg-blue-900 text-blue-300",
};

export default function Dashboard() {
  const role = getUser()?.role;
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"all" | "open" | "ended">("all");

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
    <div className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Link to="/" className="text-gray-400 underline text-sm">← Home</Link>
          <h1 className="text-2xl font-bold">My interviews</h1>
          <div className="ml-auto flex gap-1 text-xs">
            {(["all", "open", "ended"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded px-3 py-1 border ${
                  filter === f ? "bg-blue-600 border-blue-600" : "border-gray-700 hover:bg-gray-800"
                }`}
              >
                {f === "all" ? "All" : f === "open" ? "In progress" : "Ended"}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}
        {!rows && !error && <p className="text-gray-400 text-sm">Loading...</p>}
        {rows && shown.length === 0 && <p className="text-gray-500 text-sm">No interviews to show.</p>}

        {shown.length > 0 && (
          <div className="overflow-x-auto border border-gray-800 rounded">
            <table className="w-full text-sm">
              <thead className="bg-gray-900 text-gray-400 text-left text-xs">
                <tr>
                  <th className="px-3 py-2">Candidate</th>
                  <th className="px-3 py-2">Question</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Best result</th>
                  <th className="px-3 py-2" title="correctness · code quality · efficiency">Scores</th>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.slug} className="border-t border-gray-800 hover:bg-gray-900">
                    <td className="px-3 py-2">{r.candidate ?? <span className="text-gray-500">not joined</span>}</td>
                    <td className="px-3 py-2">
                      {r.question ?? <span className="text-gray-500">none</span>}
                      {r.difficulty && <span className="ml-2 text-xs text-gray-500">{r.difficulty}</span>}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`text-xs rounded px-2 py-0.5 ${statusStyle[r.status]}`}>{r.status}</span>
                    </td>
                    <td className="px-3 py-2">
                      {r.best ? (
                        <>
                          <span className={r.best.passed === r.best.total ? "text-green-400" : "text-yellow-400"}>
                            {r.best.passed}/{r.best.total}
                          </span>
                          <span className="text-xs text-gray-500">
                            {" "}· {r.attempts} attempt{r.attempts === 1 ? "" : "s"}
                            {r.minutes ? ` · ${r.minutes} min` : ""}
                          </span>
                        </>
                      ) : (
                        <span className="text-gray-500">no submissions</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-gray-300">
                      {r.scorecard
                        ? `${r.scorecard.correctness} · ${r.scorecard.codeQuality} · ${r.scorecard.efficiency}`
                        : <span className="text-gray-600">n/a</span>}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-400">{new Date(r.createdAt).toLocaleString()}</td>
                    <td className="px-3 py-2 text-right">
                      {r.status === "ended" ? (
                        <Link to={`/dashboard/${r.slug}`} className="text-blue-400 hover:underline">Review</Link>
                      ) : (
                        <Link to={`/room/${r.slug}`} className="text-green-400 hover:underline">Open room</Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}