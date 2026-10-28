import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";

export default function Auth() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "candidate" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const update = (key: string, value: string) => setForm({ ...form, [key]: value });

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

  const input = "w-full rounded bg-gray-800 border border-gray-700 px-3 py-2 text-white";

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 bg-gray-900 p-6 rounded-xl">
        <h1 className="text-2xl font-bold text-white">
          {mode === "login" ? "Log in to CodeRoom" : "Create your account"}
        </h1>

        {mode === "register" && (
          <>
            <input className={input} placeholder="Name" value={form.name}
              onChange={(e) => update("name", e.target.value)} required />
            <select className={input} value={form.role} onChange={(e) => update("role", e.target.value)}>
              <option value="candidate">Candidate</option>
              <option value="interviewer">Interviewer</option>
            </select>
          </>
        )}

        <input className={input} type="email" placeholder="Email" value={form.email}
          onChange={(e) => update("email", e.target.value)} required />
        <input className={input} type="password" placeholder="Password (min 8 chars)" value={form.password}
          onChange={(e) => update("password", e.target.value)} required />

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <button disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-500 text-white rounded py-2 disabled:opacity-50">
          {loading ? "Please wait..." : mode === "login" ? "Log in" : "Register"}
        </button>

        <button type="button" className="text-sm text-gray-400 hover:text-white"
          onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}>
          {mode === "login" ? "Need an account? Register" : "Have an account? Log in"}
        </button>
      </form>
    </div>
  );
}