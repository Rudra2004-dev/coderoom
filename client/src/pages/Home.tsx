import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, getUser } from "../api";

export default function Home() {
  const user = getUser();
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  async function createRoom() {
    try {
      const room = await api("/rooms", { method: "POST" });
      navigate(`/room/${room.slug}`);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function joinRoom() {
    try {
      const slug = code.trim();
      await api(`/rooms/${slug}/join`, { method: "POST" });
      navigate(`/room/${slug}`);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  function logout() {
    localStorage.clear();
    navigate("/auth");
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">CodeRoom</h1>
          <div className="text-sm text-gray-400">
            {user?.name} ({user?.role}){" "}
            <button onClick={logout} className="ml-3 underline hover:text-white">Log out</button>
          </div>
        </div>

        {user?.role === "interviewer" ? (
          <button onClick={createRoom} className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded">
            Create interview room
          </button>
        ) : (
          <div className="flex gap-2">
            <input value={code} onChange={(e) => setCode(e.target.value)}
              placeholder="Paste room code"
              className="flex-1 rounded bg-gray-800 border border-gray-700 px-3 py-2" />
            <button onClick={joinRoom} className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded">
              Join
            </button>
          </div>
        )}

        {error && <p className="text-red-400 text-sm">{error}</p>}
      </div>
    </div>
  );
}