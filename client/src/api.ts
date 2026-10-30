const BASE = "http://localhost:4000";
export const WS_BASE = "ws://localhost:4000/yjs";

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
    throw new Error(typeof data.error === "string" ? data.error : "Request failed. Check your inputs.");
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