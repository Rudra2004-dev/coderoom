import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api, getUser } from "../api";
import CodeEditor from "../components/CodeEditor";
import type { Language } from "../components/CodeEditor";
import QuestionPanel from "../components/QuestionPanel";
import OutputPanel from "../components/OutputPanel";
import type { RunOutput } from "../components/OutputPanel";
import { useRoomDoc } from "../hooks/useRoomDoc";

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
  compileTimedOut: boolean;
  truncated: boolean;
  compileError: boolean;
  memoryExceeded: boolean;
  timeMs: number;
}

function formatResult(r: RunResult): RunOutput {
  const parts: string[] = [];
  if (r.compileError) parts.push("Compilation failed:");
  if (r.stdout) parts.push(r.stdout);
  if (r.stderr) parts.push(r.stderr);
  if (r.compileTimedOut) parts.push("⏱ Compilation timed out");
  else if (r.timedOut) parts.push("⏱ Time limit exceeded");
  else if (r.memoryExceeded) parts.push("💥 Memory limit exceeded");
  else if (r.truncated) parts.push("… output truncated (limit reached)");
  else if (!r.compileError && r.exitCode !== 0) parts.push(`Exited with code ${r.exitCode}`);
  else if (!r.stdout && !r.stderr) parts.push("(program finished with no output)");
  parts.push(`(${r.timeMs} ms)`);
  const isError = r.timedOut || r.memoryExceeded || r.compileError || r.exitCode !== 0;
  return { text: parts.join("\n"), isError };
}

export default function Room() {
  const { slug = "" } = useParams();
  const { doc, provider, status } = useRoomDoc(slug);

  const [room, setRoom] = useState<RoomData | null>(null);
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);
  const [copied, setCopied] = useState(false);

  // Shared state, mirrored from the Yjs document
  const [stdin, setStdin] = useState("");
  const [output, setOutput] = useState<RunOutput | null>(null);
  const [runInfo, setRunInfo] = useState<{ name: string; at: number } | null>(null);
  const [now, setNow] = useState(0);

useEffect(() => {
  const t = setInterval(() => setNow(Date.now()), 5000);
  return () => clearInterval(t);
}, []);

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

  useEffect(() => {
    if (!doc) return;
    const yStdin = doc.getText("stdin");
    const runMap = doc.getMap<string>("run");

    const readStdin = () => setStdin(yStdin.toString());
    const readRun = () => {
      try {
        const r = runMap.get("result");
        setOutput(r ? JSON.parse(r) : null);
        const s = runMap.get("running");
        setRunInfo(s ? JSON.parse(s) : null);
      } catch {
        /* ignore malformed data */
      }
    };

    yStdin.observe(readStdin);
    runMap.observe(readRun);
    readStdin();
    readRun();
    return () => {
      yStdin.unobserve(readStdin);
      runMap.unobserve(readRun);
    };
  }, [doc]);

  // Turn "the textarea now says X" into a minimal edit on the shared text
  function handleStdinChange(next: string) {
    if (!doc) return;
    const y = doc.getText("stdin");
    const prev = y.toString();
    if (prev === next) return;
    let start = 0;
    while (start < prev.length && start < next.length && prev[start] === next[start]) start++;
    let endPrev = prev.length;
    let endNext = next.length;
    while (endPrev > start && endNext > start && prev[endPrev - 1] === next[endNext - 1]) {
      endPrev--;
      endNext--;
    }
    doc.transact(() => {
      if (endPrev > start) y.delete(start, endPrev - start);
      if (endNext > start) y.insert(start, next.slice(start, endNext));
    });
  }

  function publish(out: RunOutput) {
    const me = getUser();
    doc?.getMap<string>("run").set("result", JSON.stringify({ ...out, by: me?.name ?? "someone", at: Date.now() }));
  }

  async function handleRun(code: string, language: Language) {
    const me = getUser();
    const runMap = doc?.getMap<string>("run");
    setRunning(true);
    runMap?.set("running", JSON.stringify({ name: me?.name ?? "someone", at: Date.now() }));
    try {
      const { jobId } = await api(`/rooms/${slug}/run`, {
        method: "POST",
        body: JSON.stringify({ language, code, stdin }),
      });
      for (let i = 0; i < 60; i++) {
        await new Promise((r) => setTimeout(r, 500));
        const job = await api(`/jobs/${jobId}`);
        if (job.state === "completed") return publish(formatResult(job.result));
        if (job.state === "failed") return publish({ text: job.error, isError: true });
      }
      publish({ text: "No response from the worker. Is it running?", isError: true });
    } catch (err) {
      publish({ text: (err as Error).message, isError: true });
    } finally {
      runMap?.delete("running");
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

  // Ignore a "running" flag older than 40 s, in case the runner closed their tab
  const runningBy = runInfo && (now || runInfo.at) - runInfo.at < 40_000 ? runInfo.name : null;
  const busy = running || runningBy !== null;

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
        <CodeEditor doc={doc} provider={provider} status={status} busy={busy} onRun={handleRun} />
        <OutputPanel output={output} runningBy={runningBy} stdin={stdin} onStdinChange={handleStdinChange} />
      </div>
    </div>
  );
}