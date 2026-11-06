const isDev = import.meta.env.DEV;
const BASE = isDev ? "http://localhost:4000" : "/api";
export const WS_BASE = isDev
  ? "ws://localhost:4000/yjs"
  : `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/yjs`;

export async function api(path: string, options: RequestInit = {}) {
  const token = localStorage.getItem("token");
  const res = await fetch(BASE + path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
  const msg = typeof data.error === "string" ? data.error : `Request failed (HTTP ${res.status})`;
  throw new Error(msg);
}
  return data;
}

export function getUser(): { id: string; name: string; email: string; role: "interviewer" | "candidate" } | null {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
}