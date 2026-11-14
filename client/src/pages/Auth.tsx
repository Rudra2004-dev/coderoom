import { useState } from "react";
import type { ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Code, Mail, Lock, Eye, EyeOff, User, ArrowRight } from "lucide-react";
import { api } from "../api";

type Role = "candidate" | "interviewer";

interface FormState {
  name: string;
  email: string;
  password: string;
  role: Role;
}

function Field({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white/80 px-4 transition focus-within:border-indigo-400 focus-within:ring-4 focus-within:ring-indigo-100">
      <span className="text-slate-500">{icon}</span>
      {children}
    </div>
  );
}

// Field height scales with the window height
const inputCls =
  "w-full bg-transparent py-[clamp(0.55rem,1.6vh,0.9rem)] text-slate-900 outline-none placeholder:text-slate-400";

export default function Auth() {
  const [params] = useSearchParams();
  const roleParam = params.get("role");
  const initialRole: Role = roleParam === "interviewer" ? "interviewer" : "candidate";

  const [mode, setMode] = useState<"login" | "register">("login");
  const [form, setForm] = useState<FormState>({
    name: "",
    email: "",
    password: "",
    role: initialRole,
  });
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function switchMode() {
    setMode((m) => (m === "login" ? "register" : "login"));
    setError("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const body = mode === "login" ? { email: form.email, password: form.password } : form;
      const data = await api(`/auth/${mode}`, { method: "POST", body: JSON.stringify(body) });
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      navigate("/");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const isLogin = mode === "login";

  return (
    <div className="lt-bg landing-root relative flex flex-col">
      {/* Soft background blobs */}
      <div className="pointer-events-none absolute -left-40 top-1/4 h-96 w-96 rounded-full bg-blue-200/40 blur-3xl" />
      <div className="pointer-events-none absolute -right-32 bottom-0 h-96 w-96 rounded-full bg-blue-200/40 blur-3xl" />
      <div className="pointer-events-none absolute right-0 top-0 h-80 w-96 rounded-full bg-amber-200/40 blur-3xl" />

      <header className="relative z-10 mx-auto w-full max-w-6xl shrink-0 px-6 py-3">
        <Link to="/" className="inline-flex items-center gap-3">
          <span className="btn-primary flex h-10 w-10 items-center justify-center">
            <Code size={20} />
          </span>
          <span className="text-xl font-bold text-slate-900">CodeRoom</span>
        </Link>
      </header>

      {/* The card is centered in whatever height is left */}
      <main className="relative z-10 flex min-h-0 flex-1 items-center justify-center px-4 py-3">
        <form
          onSubmit={submit}
          className="lt-card flex w-full max-w-md flex-col gap-[clamp(0.5rem,1.5vh,0.9rem)] p-[clamp(1.25rem,3.5vh,2.5rem)]"
        >
          <div className="text-center">
            <h1 className="text-[clamp(1.5rem,4vh,1.875rem)] font-bold text-slate-900">
              {isLogin ? "Log in to CodeRoom" : "Create your account"}
            </h1>
            {roleParam && (
              <p className="mt-1 text-sm text-indigo-600">
                Continuing as {roleParam === "interviewer" ? "an interviewer" : "a candidate"}
              </p>
            )}
          </div>

          {!isLogin && (
            <>
              <Field icon={<User size={20} />}>
                <input
                  className={inputCls}
                  placeholder="Name"
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  maxLength={100}
                  autoComplete="name"
                  required
                />
              </Field>

              <div className="grid grid-cols-2 gap-1 rounded-2xl border border-slate-200 bg-white/60 p-1">
                {(["candidate", "interviewer"] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    aria-pressed={form.role === r}
                    onClick={() => set("role", r)}
                    className={`rounded-xl py-[clamp(0.4rem,1.1vh,0.6rem)] text-sm font-medium capitalize transition ${
                      form.role === r ? "bg-slate-900 text-white shadow" : "text-slate-600 hover:bg-white"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </>
          )}

          <Field icon={<Mail size={20} />}>
            <input
              className={inputCls}
              type="email"
              placeholder="Email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              maxLength={254}
              autoComplete="email"
              required
            />
          </Field>

          <Field icon={<Lock size={20} />}>
            <input
              className={inputCls}
              type={showPw ? "text" : "password"}
              placeholder="Password (min 8 chars)"
              value={form.password}
              onChange={(e) => set("password", e.target.value)}
              minLength={isLogin ? undefined : 8}
              maxLength={200}
              autoComplete={isLogin ? "current-password" : "new-password"}
              required
            />
            <button
              type="button"
              onClick={() => setShowPw((s) => !s)}
              aria-label={showPw ? "Hide password" : "Show password"}
              className="text-slate-500 hover:text-slate-900"
            >
              {showPw ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </Field>

          {error && <p className="rounded-xl bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p>}

          <button
            disabled={loading}
            className="btn-dark flex w-full items-center justify-center gap-2 py-[clamp(0.7rem,1.7vh,1rem)] text-[clamp(1rem,2.2vh,1.125rem)]"
          >
            {loading ? "Please wait..." : isLogin ? "Log in" : "Create account"}
            {!loading && <ArrowRight size={20} />}
          </button>

          <div className="flex items-center gap-4 text-sm text-slate-500">
            <span className="h-px flex-1 bg-slate-900/10" /> or <span className="h-px flex-1 bg-slate-900/10" />
          </div>

          <p className="text-center text-slate-700">
            {isLogin ? "Need an account? " : "Already have an account? "}
            <button type="button" onClick={switchMode} className="font-semibold text-indigo-600 hover:text-indigo-800">
              {isLogin ? "Register" : "Log in"}
            </button>
          </p>
        </form>
      </main>
    </div>
  );
}