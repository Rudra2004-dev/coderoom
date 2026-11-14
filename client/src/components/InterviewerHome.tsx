import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Play, Clock, Activity, Video, Check, Code, Hourglass, ArrowRight, ChevronRight, Calendar } from "lucide-react";
import { api } from "../api";

interface Row {
  slug: string;
  status: "waiting" | "live" | "ended";
  createdAt: string;
  candidate: string | null;
  question: string | null;
  minutes: number | null;
  best: { passed: number; total: number } | null;
}

const BADGE: Record<Row["status"], { label: string; cls: string }> = {
  ended: { label: "Completed", cls: "bg-emerald-100 text-emerald-700" },
  live: { label: "In Progress", cls: "bg-sky-100 text-sky-700" },
  waiting: { label: "Waiting", cls: "bg-slate-200 text-slate-600" },
};

// Static illustration, written in a language the platform really runs
const SAMPLE = [
  "def two_sum(nums, target):",
  "    seen = {}",
  "    for i, x in enumerate(nums):",
  "        # ...",
  "    return []",
];
const KEYWORDS = new Set(["def", "for", "in", "return"]);
const FUNCS = new Set(["two_sum", "enumerate"]);

function Line({ text }: { text: string }) {
  if (text.trim().startsWith("#")) return <span className="italic text-slate-400">{text}</span>;
  return (
    <>
      {text.split(/(\s+|[(),:{}[\]])/).map((tok, i) => (
        <span key={i} className={KEYWORDS.has(tok) ? "text-rose-600" : FUNCS.has(tok) ? "text-blue-600" : ""}>
          {tok}
        </span>
      ))}
    </>
  );
}

function Stat({ icon, iconCls, value, label }: { icon: ReactNode; iconCls: string; value: number; label: string }) {
  return (
    <div className="lt-tile flex items-center gap-4 p-4">
      <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${iconCls}`}>{icon}</span>
      <div>
        <p className="text-2xl font-bold leading-none text-slate-900">{value}</p>
        <p className="mt-1 text-sm text-slate-500">{label}</p>
      </div>
    </div>
  );
}

export default function InterviewerHome() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  useEffect(() => {
    let active = true;
    api("/rooms")
      .then((r: Row[]) => active && setRows(r))
      .catch((e: Error) => active && setLoadError(e.message));
    return () => {
      active = false;
    };
  }, []);

  async function createRoom() {
    setCreating(true);
    setCreateError("");
    try {
      const room = await api("/rooms", { method: "POST" });
      navigate(`/room/${room.slug}`);
    } catch (err) {
      setCreateError((err as Error).message);
      setCreating(false);
    }
  }

  const list = rows ?? [];
  const count = (s: Row["status"]) => list.filter((r) => r.status === s).length;

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-6 py-10">
      {/* Hero */}
      <section className="grid items-center gap-10 lg:grid-cols-2">
        <div className="space-y-6">
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-sm text-slate-700">
            <span className="h-2 w-2 rounded-full bg-emerald-500" /> Live Interview Platform
          </span>
          <h1 className="text-5xl font-bold leading-[1.1] tracking-tight text-slate-900 sm:text-6xl">
            Conduct Technical Interviews, <span className="serif-italic text-[1.12em]">Effortlessly</span>
          </h1>
          <p className="max-w-lg text-lg text-slate-500">
            A real-time, collaborative coding interview platform for companies, teams, and students.
          </p>
          <div className="flex flex-wrap gap-3">
            <button onClick={createRoom} disabled={creating} className="btn-dark flex items-center gap-2 px-7 py-4">
              <Plus size={18} /> {creating ? "Creating..." : "Create Interview Room"}
            </button>
            <Link to="/dashboard" className="btn-outline flex items-center gap-2 px-7 py-4">
              <Play size={16} /> View my interviews
            </Link>
          </div>
          {createError && <p className="text-sm text-red-600">{createError}</p>}
        </div>

        {/* Decorative preview */}
        <div className="lt-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-red-500" />
            <span className="h-3 w-3 rounded-full bg-yellow-400" />
            <span className="h-3 w-3 rounded-full bg-green-500" />
            <span className="ml-auto flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Live
            </span>
          </div>
          <div className="grid grid-cols-[120px_1fr] gap-3">
            <div className="space-y-5 rounded-xl bg-slate-100/70 p-4 text-center text-xs text-slate-700">
              {[
                { who: "Interviewer", dot: "bg-emerald-500" },
                { who: "Candidate", dot: "bg-slate-300" },
              ].map(({ who, dot }) => (
                <div key={who}>
                  <span className="mx-auto mb-1 flex h-11 w-11 items-center justify-center rounded-full bg-linear-to-br from-indigo-500 to-violet-600 text-base font-bold text-white">
                    {who[0]}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    {who} <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
                  </span>
                </div>
              ))}
            </div>
            <pre className="overflow-x-auto rounded-xl bg-white/60 p-4 font-mono text-xs leading-6 text-slate-800">
              {SAMPLE.map((line, i) => (
                <div key={i}>
                  <span className="mr-4 select-none text-slate-300">{i + 1}</span>
                  <Line text={line} />
                </div>
              ))}
            </pre>
          </div>
        </div>
      </section>

      {/* Recent interviews + activity */}
      <section className="grid gap-6 lg:grid-cols-[1.7fr_1fr]">
        <div className="lt-card p-6">
          <div className="mb-3 flex items-center">
            <h2 className="flex items-center gap-3 text-xl font-semibold text-slate-900">
              <Clock size={22} className="text-indigo-600" /> Recent Interviews
            </h2>
            <Link to="/dashboard" className="ml-auto flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900">
              View all <ArrowRight size={14} />
            </Link>
          </div>

          {loadError && <p className="text-sm text-red-600">{loadError}</p>}
          {!rows && !loadError && <p className="text-sm text-slate-400">Loading...</p>}
          {rows && rows.length === 0 && (
            <p className="py-6 text-sm text-slate-400">No interviews yet. Create your first room above.</p>
          )}

          <ul className="divide-y divide-slate-900/5">
            {list.slice(0, 4).map((r) => (
              <li key={r.slug} className="flex flex-wrap items-center gap-4 py-3.5">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-indigo-600">
                  <Code size={22} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-slate-900">{r.question ?? "Interview room"}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-sm text-slate-500">
                    <span>{r.candidate ?? "Waiting for candidate"}</span>
                    <span className="flex items-center gap-1">
                      <Calendar size={13} />
                      {new Date(r.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                    {r.minutes && <span>{r.minutes} min</span>}
                    {r.best && <span>{r.best.passed}/{r.best.total} tests</span>}
                  </p>
                </div>
                <span className={`rounded-full px-4 py-1.5 text-sm font-medium ${BADGE[r.status].cls}`}>
                  {BADGE[r.status].label}
                </span>
                <Link
                  to={r.status === "ended" ? `/dashboard/${r.slug}` : `/room/${r.slug}`}
                  aria-label={r.status === "ended" ? "Review interview" : "Open room"}
                  className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-900"
                >
                  <ChevronRight size={20} />
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="lt-card p-6">
          <h2 className="mb-4 flex items-center gap-3 text-xl font-semibold text-slate-900">
            <Activity size={22} className="text-indigo-600" /> Your Activity
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <Stat icon={<Video size={22} />} iconCls="bg-indigo-100 text-indigo-600" value={list.length} label="Total Interviews" />
            <Stat icon={<Check size={22} />} iconCls="bg-emerald-100 text-emerald-600" value={count("ended")} label="Completed" />
            <Stat icon={<Code size={22} />} iconCls="bg-sky-100 text-sky-600" value={count("live")} label="In Progress" />
            <Stat icon={<Hourglass size={22} />} iconCls="bg-fuchsia-100 text-fuchsia-600" value={count("waiting")} label="Waiting" />
          </div>
          <p className="mt-3 text-xs text-slate-400">Based on your 50 most recent interviews.</p>
        </div>
      </section>
    </main>
  );
}