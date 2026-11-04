import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api, getUser } from "../api";
import CodeEditor from "../components/CodeEditor";
import type { Language } from "../components/CodeEditor";
import QuestionPanel from "../components/QuestionPanel";
import OutputPanel from "../components/OutputPanel";
import type { SharedOutput, GradeOutput } from "../components/OutputPanel";
import { useRoomDoc } from "../hooks/useRoomDoc";

interface RoomData {
  slug: string;
  status: string;
  questionId: string | null;
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

function formatResult(r: RunResult): SharedOutput {
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
  return { kind: "run", text: parts.join("\n"), isError };
}

export default function Room() {
  const { slug = "" } = useParams();
  const { doc, provider, status } = useRoomDoc(slug);

  const [room, setRoom] = useState<RoomData | null>(null);
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(0);

  // Shared state, mirrored from the Yjs document
  const [stdin, setStdin] = useState("");
  const [output, setOutput] = useState<SharedOutput | null>(null);
  const [runInfo, setRunInfo] = useState<{ name: string; at: number; what?: string } | null>(null);

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

  function publish(out: SharedOutput) {
    const me = getUser();
    doc
      ?.getMap<string>("run")
      .set("result", JSON.stringify({ ...out, by: me?.name ?? "someone", at: Date.now() }));
  }

  function setBusyFlag(what: "running" | "grading") {
    const me = getUser();
    doc?.getMap<string>("run").set("running", JSON.stringify({ name: me?.name ?? "someone", at: Date.now(), what }));
  }

  async function handleRun(code: string, language: Language) {
    const runMap = doc?.getMap<string>("run");
    setRunning(true);
    setBusyFlag("running");
    try {
      const { jobId } = await api(`/rooms/${slug}/run`, {
        method: "POST",
        body: JSON.stringify({ language, code, stdin }),
      });
      for (let i = 0; i < 60; i++) {
        await new Promise((r) => setTimeout(r, 500));
        const job = await api(`/jobs/${jobId}`);
        if (job.state === "completed") return publish(formatResult(job.result));
        if (job.state === "failed") return publish({ kind: "run", text: job.error, isError: true });
      }
      publish({ kind: "run", text: "No response from the worker. Is it running?", isError: true });
    } catch (err) {
      publish({ kind: "run", text: (err as Error).message, isError: true });
    } finally {
      runMap?.delete("running");
      setRunning(false);
    }
  }

  async function handleSubmit(code: string, language: Language) {
    const runMap = doc?.getMap<string>("run");
    setRunning(true);
    setBusyFlag("grading");
    try {
      const result: Omit<GradeOutput, "kind"> = await api(`/rooms/${slug}/submit`, {
        method: "POST",
        body: JSON.stringify({ language, code }),
      });
      publish({ kind: "grade", ...result });
    } catch (err) {
      publish({ kind: "run", text: (err as Error).message, isError: true });
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

  // A busy flag expires, in case the person who set it closed their tab. Grading gets longer.
  const ttl = runInfo?.what === "grading" ? 120_000 : 40_000;
  const runningLabel =
    runInfo && (now || runInfo.at) - runInfo.at < ttl
      ? `${runInfo.name} is ${runInfo.what === "grading" ? "grading" : "running"}...`
      : null;
  const busy = running || runningLabel !== null;

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
        <QuestionPanel
          slug={room.slug}
          questionId={room.questionId}
          isInterviewer={getUser()?.id === room.interviewer.id}
          onChanged={(id) => setRoom((r) => (r ? { ...r, questionId: id } : r))}
        />
        <CodeEditor
          doc={doc}
          provider={provider}
          status={status}
          busy={busy}
          canSubmit={room.questionId !== null}
          onRun={handleRun}
          onSubmit={handleSubmit}
        />
        <OutputPanel
          output={output}
          runningLabel={runningLabel}
          stdin={stdin}
          onStdinChange={handleStdinChange}
        />
      </div>
    </div>
  );
}