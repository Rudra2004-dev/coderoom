import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../api";
import CodeEditor from "../components/CodeEditor";
import type { Language } from "../components/CodeEditor";
import QuestionPanel from "../components/QuestionPanel";
import OutputPanel from "../components/OutputPanel";
import type { RunOutput } from "../components/OutputPanel";

interface RoomData {
  slug: string;
  status: string;
  interviewer: { id: string; name: string };
  candidate: { id: string; name: string } | null;
}


interface RunResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
  truncated: boolean;
  compileError: boolean;
  timeMs: number;
}

function formatResult(r: RunResult): RunOutput {
  const parts: string[] = [];
  if (r.compileError) parts.push("Compilation failed:");
  if (!r.stdout && !r.stderr && !r.timedOut && !r.compileError && r.exitCode === 0)
  parts.push("(program finished with no output)");
  if (r.stdout) parts.push(r.stdout);
  if (r.stderr) parts.push(r.stderr);
  if (r.timedOut) parts.push("⏱ Time limit exceeded");
  else if (r.truncated) parts.push("… output truncated (limit reached)");
  else if (!r.compileError && r.exitCode !== 0) parts.push(`Exited with code ${r.exitCode}`);
  parts.push(`(${r.timeMs} ms)`);
  const isError = r.timedOut || r.compileError || r.exitCode !== 0;
  return { text: parts.join("\n"), isError };
}

export default function Room() {
  const { slug } = useParams();
  const [room, setRoom] = useState<RoomData | null>(null);
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState<RunOutput | null>(null);
  const [copied, setCopied] = useState(false);
  const [stdin, setStdin] = useState("");

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

  // Placeholder: Day 6 replaces this with a real call to the sandbox
 async function handleRun(code: string, language: Language) {
  setRunning(true);
  setOutput(null);
  try {
    const { jobId } = await api(`/rooms/${slug}/run`, {
      method: "POST",
      body: JSON.stringify({ language, code, stdin }),
    });
    for (let i = 0; i < 60; i++) {
      await new Promise((r) => setTimeout(r, 500));
      const job = await api(`/jobs/${jobId}`);
      if (job.state === "completed") return setOutput(formatResult(job.result));
      if (job.state === "failed") return setOutput({ text: job.error, isError: true });
    }
    setOutput({ text: "No response from the worker. Is it running?", isError: true });
  } catch (err) {
    setOutput({ text: (err as Error).message, isError: true });
  } finally {
    setRunning(false);
  }
}

  function copyCode() {
    navigator.clipboard.writeText(room!.slug);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (error) return <div className="p-8 text-red-400">{error}</div>;
  if (!room) return <div className="p-8 text-gray-400">Loading...</div>;

  return (
    <div className="h-screen flex flex-col bg-gray-950 text-white">
      <header className="flex items-center gap-4 px-4 py-2 border-b border-gray-800 text-sm">
        <Link to="/" className="text-gray-400 underline">← Back</Link>
        <span className="font-semibold">Room {room.slug}</span>
        <button onClick={copyCode} className="text-xs border border-gray-700 rounded px-2 py-0.5 hover:bg-gray-800">
          {copied ? "Copied!" : "Copy code"}
        </button>
        <span className={room.status === "live" ? "text-green-400" : "text-yellow-400"}>● {room.status}</span>
        <span className="ml-auto text-gray-400">
          Interviewer: {room.interviewer.name} · Candidate: {room.candidate ? room.candidate.name : "waiting..."}
        </span>
      </header>

      <div className="flex-1 min-h-0 grid grid-cols-[260px_1fr_320px] gap-3 p-3">
        <QuestionPanel />
        <CodeEditor slug={room.slug} running={running} onRun={handleRun} />
        <OutputPanel output={output} running={running} stdin={stdin} onStdinChange={setStdin} />
      </div>
    </div>
  );
}