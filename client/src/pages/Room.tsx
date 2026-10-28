import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../api";

interface RoomData {
  slug: string;
  status: string;
  interviewer: { id: string; name: string };
  candidate: { id: string; name: string } | null;
}

export default function Room() {
  const { slug } = useParams();
  const [room, setRoom] = useState<RoomData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const data = await api(`/rooms/${slug}`);
        if (active) setRoom(data);
      } catch (err) {
        if (active) setError((err as Error).message);
      }
    }
    load();
    const timer = setInterval(load, 3000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [slug]);

  if (error) return <div className="p-8 text-red-400">{error}</div>;
  if (!room) return <div className="p-8 text-gray-400">Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8 space-y-4">
      <Link to="/" className="text-sm text-gray-400 underline">← Back</Link>
      <h1 className="text-xl font-bold">Room {room.slug}</h1>
      <p>Status: <span className="text-green-400">{room.status}</span></p>
      <p>Interviewer: {room.interviewer.name}</p>
      <p>Candidate: {room.candidate ? room.candidate.name : "Waiting for candidate..."}</p>
      <div className="mt-6 p-10 border border-dashed border-gray-700 rounded text-gray-500">
        Editor goes here (Day 4)
      </div>
    </div>
  );
}