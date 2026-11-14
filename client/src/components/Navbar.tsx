import { Link, NavLink, useNavigate } from "react-router-dom";
import { Code, Layers, LogOut, User } from "lucide-react";
import { getUser } from "../api";

export default function Navbar({ variant = "dark" }: { variant?: "dark" | "light" }) {
  const light = variant === "light";
  const user = getUser();
  const navigate = useNavigate();

  const pill = light
    ? "lt-pill flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-white"
    : "flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-gray-200 hover:bg-white/10";
  const icon = light ? "text-slate-900" : "text-violet-300";
  const active = light ? "bg-white" : "bg-white/10";

  function logout() {
    localStorage.clear();
    navigate("/");
  }

  return (
    <header className={`border-b ${light ? "border-slate-900/5" : "border-white/10"}`}>
      <nav className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-6 py-4">
        <Link to="/" className="flex items-center gap-3">
          <span className="btn-primary flex h-11 w-11 items-center justify-center">
            <Code size={22} />
          </span>
          <span className={`text-xl font-bold ${light ? "text-slate-900" : ""}`}>CodeRoom</span>
        </Link>

        <div className="ml-auto flex flex-wrap items-center gap-3">
          {user?.role === "interviewer" && (
            <NavLink to="/dashboard" className={({ isActive }) => `${pill} ${isActive ? active : ""}`}>
              <Layers size={16} className={icon} /> My interviews
            </NavLink>
          )}

          {light ? (
            <span className="lt-pill flex items-center gap-3 py-1.5 pl-2 pr-5">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-linear-to-br from-indigo-500 to-violet-600 text-sm font-bold text-white">
                {user?.name?.[0]?.toUpperCase() ?? "?"}
              </span>
              <span className="leading-tight">
                <span className="block text-sm font-semibold text-slate-900">{user?.name}</span>
                <span className="block text-xs capitalize text-slate-500">({user?.role})</span>
              </span>
            </span>
          ) : (
            <span className={pill}>
              <User size={16} className={icon} />
              {user?.name}
              <span className="hidden text-gray-400 sm:inline">({user?.role})</span>
            </span>
          )}

          <button onClick={logout} className={pill}>
            Log out <LogOut size={16} className={icon} />
          </button>
        </div>
      </nav>
    </header>
  );
}