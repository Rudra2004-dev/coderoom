import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Check, Code, Copy, Power } from "lucide-react";
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
  const navigate = useNavigate();
  const [room, setRoom] = useState<RoomData | null>(null);
  const { doc, provider, status } = useRoomDoc(slug, room?.status !== "ended");
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

  async function endInterview() {
    if (!doc) return;
    if (!window.confirm("End this interview? Nobody will be able to run or submit code afterwards.")) return;
    const finalCode = doc.getText("code").toString();
    const language = doc.getMap<string>("meta").get("language") ?? "python";
    try {
      await api(`/rooms/${slug}/end`, { method: "POST", body: JSON.stringify({ finalCode, language }) });
      navigate(`/dashboard/${slug}`);
    } catch (err) {
      window.alert((err as Error).message);
    }
  }

  function copyCode() {
    navigator.clipboard.writeText(slug);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (error) return <div className="lt-bg p-8 text-red-600">{error}</div>;
  if (!room) return <div className="lt-bg p-8 text-slate-500">Loading...</div>;

  if (room.status === "ended") {
    const mine = getUser()?.id === room.interviewer.id;
    return (
      <div className="lt-bg flex items-center justify-center p-6">
        <div className="lt-card max-w-md space-y-4 p-10 text-center">
          <h1 className="text-2xl font-bold text-slate-900">This interview has ended</h1>
          <p className="text-slate-500">
            {mine ? "The code, results and scorecard are saved in your dashboard." : "Thank you for taking part!"}
          </p>
          <Link
            to={mine ? `/dashboard/${room.slug}` : "/"}
            className="btn-dark inline-block px-6 py-3"
          >
            {mine ? "View report" : "Back to home"}
          </Link>
        </div>
      </div>
    );
  }

  // A busy flag expires, in case the person who set it closed their tab. Grading gets longer.
  const ttl = runInfo?.what === "grading" ? 120_000 : 40_000;
  const runningLabel =
    runInfo && (now || runInfo.at) - runInfo.at < ttl
      ? `${runInfo.name} is ${runInfo.what === "grading" ? "grading" : "running"}...`
      : null;
  const isInterviewer = getUser()?.id === room.interviewer.id;
  const busy = running || runningLabel !== null;

  return (
    <div className="lt-bg flex h-dvh flex-col overflow-hidden">
      {/* Logo row */}
      <div className="flex shrink-0 items-center px-6 pt-3">
        <Link to="/" className="flex items-center gap-3">
          <span className="btn-primary flex h-9 w-9 items-center justify-center">
            <Code size={18} />
          </span>
          <span className="text-lg font-bold text-slate-900">CodeRoom</span>
        </Link>
      </div>

      {/* Room header */}
      <header className="lt-card mx-3 mt-2 flex shrink-0 flex-wrap items-center gap-3 px-4 py-2.5">
        <Link to="/" className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900">
          <ArrowLeft size={16} /> Back
        </Link>
        <span className="text-lg font-bold text-slate-900">Room {room.slug}</span>

        <button onClick={copyCode} className="lt-pill flex items-center gap-2 px-4 py-1.5 text-sm font-medium text-slate-800 hover:bg-white">
          {copied ? <Check size={15} className="text-emerald-600" /> : <Copy size={15} />}
          {copied ? "Copied!" : "Copy code"}
        </button>

        <span
          className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium ${
            room.status === "live" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
          }`}
        >
          <span className={`h-2 w-2 rounded-full ${room.status === "live" ? "bg-emerald-500" : "bg-amber-500"}`} />
          {room.status === "live" ? "Live" : "Waiting"}
        </span>

        {isInterviewer && (
          <button
            onClick={endInterview}
            className="flex items-center gap-2 rounded-full bg-red-500 px-4 py-1.5 text-sm font-semibold text-white hover:bg-red-600"
          >
            <Power size={15} /> End Interview
          </button>
        )}

        <span className="ml-auto text-sm text-slate-500">
          Interviewer: <span className="font-medium text-slate-800">{room.interviewer.name}</span>
          <span className="mx-2">·</span>
          Candidate:{" "}
          <span className="font-semibold text-slate-900">{room.candidate ? room.candidate.name : "waiting..."}</span>
        </span>
      </header>

      {/* Three panels */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-y-auto p-3 lg:grid-cols-[minmax(220px,260px)_minmax(0,1fr)_minmax(260px,320px)] lg:overflow-hidden">
        <div className="min-h-64 lg:min-h-0">
          <QuestionPanel
            slug={room.slug}
            questionId={room.questionId}
            isInterviewer={isInterviewer}
            onChanged={(id) => setRoom((r) => (r ? { ...r, questionId: id } : r))}
          />
        </div>
        <div className="min-h-112 lg:min-h-0">
          <CodeEditor
            doc={doc}
            provider={provider}
            status={status}
            busy={busy}
            canSubmit={room.questionId !== null}
            onRun={handleRun}
            onSubmit={handleSubmit}
          />
        </div>
        <div className="min-h-80 lg:min-h-0">
          <OutputPanel
            output={output}
            runningLabel={runningLabel}
            stdin={stdin}
            onStdinChange={handleStdinChange}
          />
        </div>
      </div>
    </div>
  );
}