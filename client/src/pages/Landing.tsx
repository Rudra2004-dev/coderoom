import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Code, UserCheck, ArrowRight, LogIn, ShieldCheck, Check, Sparkles } from "lucide-react";

function RoleCard({
  tint,
  icon,
  iconBg,
  title,
  text,
  to,
  cta,
}: {
  tint: string;
  icon: ReactNode;
  iconBg: string;
  title: string;
  text: string;
  to: string;
  cta: string;
}) {
  return (
    <div className={`lt-card ${tint} flex h-full flex-col p-[clamp(1.1rem,2.8vh,1.75rem)]`}>
      {/* flex-1 keeps both buttons on the same line */}
      <div className="flex flex-1 items-center gap-5">
        <span
          className={`flex h-[clamp(3.5rem,10vh,5.5rem)] w-[clamp(3.5rem,10vh,5.5rem)] shrink-0 items-center justify-center rounded-full ${iconBg}`}
        >
          {icon}
        </span>
        <div className="text-left">
          <h2 className="text-[clamp(1.15rem,3vh,1.6rem)] font-bold text-slate-900">{title}</h2>
          <p className="mt-1 text-[clamp(0.85rem,2vh,1.05rem)] text-slate-500">{text}</p>
        </div>
      </div>
      <Link
        to={to}
        className="btn-dark mt-[2vh] flex items-center justify-center gap-2 self-center px-[clamp(1.5rem,4vw,2.75rem)] py-[clamp(0.7rem,1.8vh,0.95rem)]"
      >
        {cta} <ArrowRight size={18} />
      </Link>
    </div>
  );
}

const FACTS = [
  { icon: <ShieldCheck size={16} />, text: "Sandboxed code execution" },
  { icon: <Check size={16} />, text: "Auto-graded with hidden tests" },
  { icon: <Sparkles size={16} />, text: "AI-assisted scorecards" },
];

export default function Landing() {
  return (
    <div className="lt-bg landing-root relative flex flex-col">
      {/* Soft background blobs */}
      <div className="pointer-events-none absolute -left-40 top-1/3 h-96 w-96 rounded-full bg-blue-200/40 blur-3xl" />
      <div className="pointer-events-none absolute -right-32 top-10 h-96 w-96 rounded-full bg-amber-200/40 blur-3xl" />

      {/* Navbar */}
      <header className="relative z-10 shrink-0">
        <nav className="mx-auto flex max-w-6xl items-center px-6 py-3">
          <Link to="/" className="flex items-center gap-3">
            <span className="btn-primary flex h-10 w-10 items-center justify-center">
              <Code size={20} />
            </span>
            <span className="text-xl font-bold text-slate-900">CodeRoom</span>
          </Link>
          <Link
            to="/auth"
            className="lt-pill ml-auto flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-slate-800 hover:bg-white"
          >
            Log in <LogIn size={16} />
          </Link>
        </nav>
      </header>

      {/* Content, centered in the remaining height */}
      <main className="relative z-10 mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col items-center justify-center gap-[2.6vh] px-6 py-4 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/70 px-4 py-1.5 text-sm text-slate-700 shadow-sm">
          <span className="h-2 w-2 rounded-full bg-emerald-500" /> Collaborative Coding Interviews
        </span>

        <h1 className="text-[clamp(2rem,min(6vw,8.5vh),4.25rem)] font-bold leading-[1.05] tracking-tight text-slate-900">
          Where Technical <br className="hidden sm:block" />
          Interviews Come <span className="serif-italic text-[1.12em]">Together.</span>
        </h1>

        <p className="max-w-2xl text-[clamp(0.9rem,2.3vh,1.2rem)] text-slate-500">
          A collaborative coding environment designed for interviewers and developers. Create interview rooms, solve
          problems, and collaborate in real time.
        </p>

        {/* Two identical-size cards */}
        <div className="grid w-full max-w-4xl items-stretch gap-6 md:grid-cols-2">
          <RoleCard
            tint="lt-tint-blue"
            iconBg="bg-blue-100"
            icon={<UserCheck size={34} className="text-blue-600" />}
            title="Join as Interviewer"
            text="Create and manage technical interviews."
            to="/auth?role=interviewer"
            cta="Continue as Interviewer"
          />
          <RoleCard
            tint="lt-tint-amber"
            iconBg="bg-amber-100"
            icon={<Code size={34} className="text-slate-900" />}
            title="Join as Candidate"
            text="Enter a room code to join an interview."
            to="/auth?role=candidate"
            cta="Continue as Candidate"
          />
        </div>

        {/* Facts you can actually back up */}
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-1 text-sm text-slate-500">
          {FACTS.map((f) => (
            <span key={f.text} className="flex items-center gap-2">
              <span className="text-indigo-600">{f.icon}</span> {f.text}
            </span>
          ))}
        </div>
      </main>
    </div>
  );
}