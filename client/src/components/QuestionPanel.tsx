import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { api } from "../api";

interface Question {
  id: string;
  title: string;
  difficulty: string;
  description: string;
  inputFormat: string;
  outputFormat: string;
  examples: { input: string; expectedOutput: string }[];
  hiddenCount: number;
}

interface Option {
  id: string;
  title: string;
  difficulty: string;
}

interface Props {
  slug: string;
  questionId: string | null;
  isInterviewer: boolean;
  onChanged: (id: string) => void;
}

const badge: Record<string, string> = {
  Easy: "bg-emerald-100 text-emerald-700",
  Medium: "bg-amber-100 text-amber-700",
  Hard: "bg-red-100 text-red-700",
};

export default function QuestionPanel({ slug, questionId, isInterviewer, onChanged }: Props) {
  const [question, setQuestion] = useState<Question | null>(null);
  const [options, setOptions] = useState<Option[]>([]);
  const [error, setError] = useState("");

  // Load the active question whenever the room's questionId changes
  useEffect(() => {
    if (!questionId) return;
    let active = true;
    api(`/rooms/${slug}/question`)
      .then((q) => active && setQuestion(q))
      .catch((e: Error) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, [slug, questionId]);

  // Only the interviewer needs the picker list
  useEffect(() => {
    if (!isInterviewer) return;
    let active = true;
    api("/questions")
      .then((list) => active && setOptions(list))
      .catch((e: Error) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, [isInterviewer]);

  async function pick(id: string) {
    if (!id) return;
    setError("");
    try {
      await api(`/rooms/${slug}/question`, { method: "PUT", body: JSON.stringify({ questionId: id }) });
      onChanged(id);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  // Ignore a stale question that doesn't match the room's current one
  const shown = question && question.id === questionId ? question : null;

  return (
    <aside className="lt-card h-full space-y-4 overflow-auto p-5">
      {isInterviewer && (
        <div className="relative">
          <select
            value={questionId ?? ""}
            onChange={(e) => pick(e.target.value)}
            className="w-full appearance-none rounded-xl border border-slate-200 bg-white py-3 pl-4 pr-10 text-sm font-medium text-slate-800 outline-none focus:border-indigo-400"
          >
            <option value="">Choose a question...</option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.title} ({o.difficulty})
              </option>
            ))}
          </select>
          <ChevronDown size={18} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" />
        </div>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}

      {!questionId && (
        <p className="text-sm text-slate-500">
          {isInterviewer ? "Pick a question to start the interview." : "Waiting for the interviewer to pick a question..."}
        </p>
      )}

      {questionId && !shown && !error && <p className="text-sm text-slate-400">Loading question...</p>}

      {shown && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900">{shown.title}</h2>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${badge[shown.difficulty] ?? "bg-slate-100 text-slate-600"}`}>
              {shown.difficulty}
            </span>
          </div>
          <p className="text-sm text-slate-600">{shown.description}</p>

          <div className="text-xs text-slate-500">
            <p className="font-semibold text-slate-800">Input format</p>
            <p className="whitespace-pre-line">{shown.inputFormat}</p>
          </div>
          <div className="text-xs text-slate-500">
            <p className="font-semibold text-slate-800">Output format</p>
            <p className="whitespace-pre-line">{shown.outputFormat}</p>
          </div>

          <div className="space-y-2 text-xs text-slate-500">
            <p className="font-semibold text-slate-800">Examples</p>
            {shown.examples.map((ex, i) => (
              <div key={i} className="space-y-1 rounded-xl bg-slate-100/80 p-3">
                <p className="text-slate-400">Input</p>
                <pre className="whitespace-pre-wrap text-slate-800">{ex.input.trimEnd()}</pre>
                <p className="text-slate-400">Output</p>
                <pre className="whitespace-pre-wrap text-slate-800">{ex.expectedOutput}</pre>
              </div>
            ))}
            {shown.hiddenCount > 0 && (
              <p className="text-slate-400">+ {shown.hiddenCount} hidden test cases are checked on submit.</p>
            )}
          </div>
        </>
      )}
    </aside>
  );
}