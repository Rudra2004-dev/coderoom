import { useState } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Hash, ArrowRight, Users, Code, ShieldCheck } from "lucide-react";
import { api } from "../api";

// Accept a plain code or a pasted link such as http://.../room/abc123
function extractCode(input: string) {
  const text = input.trim();
  const m = text.match(/\/room\/([\w-]+)/);
  return m ? m[1] : text;
}

const FEATURES: { icon: ReactNode; iconBg: string; title: string; text: string }[] = [
  {
    icon: <Users size={24} className="text-blue-600" />,
    iconBg: "bg-blue-100",
    title: "Real-time Collaboration",
    text: "Code together with a shared editor",
  },
  {
    icon: <Code size={24} className="text-violet-600" />,
    iconBg: "bg-violet-100",
    title: "Multi-language Support",
    text: "Run and test Python, C++ and Java",
  },
  {
    icon: <ShieldCheck size={24} className="text-amber-500" />,
    iconBg: "bg-amber-100",
    title: "Secure Sandbox",
    text: "Your code runs in an isolated container",
  },
];

export default function CandidateHome() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");

  async function join(e: React.FormEvent) {
    e.preventDefault();
    const slug = extractCode(code);
    if (!/^[\w-]+$/.test(slug)) {
      setError("Enter the room code your interviewer gave you.");
      return;
    }
    setJoining(true);
    setError("");
    try {
      await api(`/rooms/${slug}/join`, { method: "POST" });
      navigate(`/room/${slug}`);
    } catch (err) {
      setError((err as Error).message);
      setJoining(false);
    }
  }

  return (
    <main className="relative z-10 mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col items-center justify-center gap-[2.6vh] px-6 py-4 text-center">
      <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/70 px-4 py-1.5 text-sm text-slate-700 shadow-sm">
        <span className="h-2 w-2 rounded-full bg-emerald-500" /> Collaborative Tech Interviews
      </span>

      <h1 className="text-[clamp(2rem,min(6vw,8.5vh),4.25rem)] font-bold leading-[1.05] tracking-tight text-slate-900">
        Join an <span className="serif-italic text-[1.12em]">Interview</span> Room
      </h1>

      <p className="max-w-2xl text-[clamp(0.9rem,2.3vh,1.2rem)] text-slate-500">
        Enter the room code shared by your interviewer to join the live session.
      </p>

      {/* Join box */}
      <form onSubmit={join} className="lt-card flex w-full max-w-3xl flex-col gap-3 p-[clamp(0.6rem,1.6vh,1rem)] sm:flex-row">
        <label className="flex flex-1 items-center gap-3 rounded-2xl bg-slate-100/80 px-3 focus-within:ring-4 focus-within:ring-indigo-100">
          <span className="flex h-[clamp(2.4rem,6vh,3.25rem)] w-[clamp(2.4rem,6vh,3.25rem)] shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
            <Hash size={22} />
          </span>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Paste room code"
            aria-label="Room code"
            autoComplete="off"
            className="w-full bg-transparent py-[clamp(0.7rem,1.9vh,1.1rem)] text-lg text-slate-900 outline-none placeholder:text-slate-400"
          />
        </label>
        <button
          disabled={joining || !code.trim()}
          className="btn-dark flex items-center justify-center gap-2 px-[clamp(1.75rem,4vw,2.75rem)] py-[clamp(0.8rem,2vh,1.1rem)] text-lg"
        >
          {joining ? "Joining..." : "Join"} {!joining && <ArrowRight size={20} />}
        </button>
      </form>
      {error && <p className="rounded-xl bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p>}

      <div className="flex w-full max-w-3xl items-center gap-4 text-sm text-slate-500">
        <span className="h-px flex-1 bg-indigo-900/10" /> What to expect <span className="h-px flex-1 bg-indigo-900/10" />
      </div>

      {/* Feature cards, equal height */}
      <div className="grid w-full items-stretch gap-4 md:grid-cols-3">
        {FEATURES.map((f) => (
          <div key={f.title} className="lt-card flex items-center gap-4 p-[clamp(0.8rem,2vh,1.25rem)] text-left">
            <span className={`flex h-[clamp(2.75rem,7vh,3.5rem)] w-[clamp(2.75rem,7vh,3.5rem)] shrink-0 items-center justify-center rounded-2xl ${f.iconBg}`}>
              {f.icon}
            </span>
            <div>
              <p className="font-semibold text-slate-900">{f.title}</p>
              <p className="text-sm text-slate-500">{f.text}</p>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}