import { useEffect, useState } from "react";
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
  Easy: "bg-green-900 text-green-300",
  Medium: "bg-yellow-900 text-yellow-300",
  Hard: "bg-red-900 text-red-300",
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
    <aside className="h-full overflow-auto border border-gray-800 rounded bg-gray-900 p-4 space-y-3">
      {isInterviewer && (
        <select
          value={questionId ?? ""}
          onChange={(e) => pick(e.target.value)}
          className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded px-2 py-1.5"
        >
          <option value="">Choose a question...</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.title} ({o.difficulty})
            </option>
          ))}
        </select>
      )}

      {error && <p className="text-red-400 text-xs">{error}</p>}

      {!questionId && (
        <p className="text-sm text-gray-500">
          {isInterviewer ? "Pick a question to start the interview." : "Waiting for the interviewer to pick a question..."}
        </p>
      )}

      {questionId && !shown && !error && <p className="text-sm text-gray-500">Loading question...</p>}

      {shown && (
        <>
          <h2 className="font-bold">{shown.title}</h2>
          <span className={`text-xs rounded px-2 py-0.5 ${badge[shown.difficulty] ?? "bg-gray-800 text-gray-300"}`}>
            {shown.difficulty}
          </span>
          <p className="text-sm text-gray-300">{shown.description}</p>

          <div className="text-xs text-gray-400">
            <p className="font-semibold text-gray-300">Input format</p>
            <p className="whitespace-pre-line">{shown.inputFormat}</p>
          </div>
          <div className="text-xs text-gray-400">
            <p className="font-semibold text-gray-300">Output format</p>
            <p className="whitespace-pre-line">{shown.outputFormat}</p>
          </div>

          <div className="text-xs text-gray-400 space-y-2">
            <p className="font-semibold text-gray-300">Examples</p>
            {shown.examples.map((ex, i) => (
              <div key={i} className="bg-gray-950 rounded p-2 space-y-1">
                <p className="text-gray-500">Input</p>
                <pre className="whitespace-pre-wrap">{ex.input.trimEnd()}</pre>
                <p className="text-gray-500">Output</p>
                <pre className="whitespace-pre-wrap">{ex.expectedOutput}</pre>
              </div>
            ))}
            {shown.hiddenCount > 0 && (
              <p className="text-gray-500">+ {shown.hiddenCount} hidden test cases are checked on submit.</p>
            )}
          </div>
        </>
      )}
    </aside>
  );
}