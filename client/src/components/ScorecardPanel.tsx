import { useEffect, useState } from "react";
import { api } from "../api";

interface Scorecard {
  correctness: number;
  codeQuality: number;
  efficiency: number;
  model: string;
  createdAt: string;
  details: {
    time_complexity: string;
    strengths: string[];
    improvements: string[];
    follow_up_questions: string[];
    summary: string;
  };
}

function Score({ label, value, note }: { label: string; value: number; note: string }) {
  const color = value >= 8 ? "bg-green-500" : value >= 5 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div>
      <div className="flex justify-between text-sm">
        <span>{label}</span>
        <span className="font-semibold">{value}/10</span>
      </div>
      <div className="h-2 bg-gray-800 rounded mt-1">
        <div className={`h-2 rounded ${color}`} style={{ width: `${value * 10}%` }} />
      </div>
      <p className="text-xs text-gray-500 mt-1">{note}</p>
    </div>
  );
}

export default function ScorecardPanel({ slug, onClose }: { slug: string; onClose: () => void }) {
  const [card, setCard] = useState<Scorecard | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    api(`/rooms/${slug}/scorecard`)
      .then((c) => active && setCard(c))
      .catch((e: Error) => active && setError(e.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [slug]);

  async function generate(regenerate: boolean) {
    setGenerating(true);
    setError("");
    try {
      setCard(await api(`/rooms/${slug}/scorecard${regenerate ? "?regenerate=1" : ""}`, { method: "POST" }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-auto p-6 space-y-4">
        <div className="flex items-center">
          <h2 className="text-lg font-bold">Interview scorecard</h2>
          <button onClick={onClose} className="ml-auto text-gray-400 hover:text-white">✕</button>
        </div>

        <p className="text-xs text-yellow-300 bg-yellow-950 rounded p-2">
          AI-generated to assist the interviewer. It is not a hiring decision. Only the pass rate is measured; the other
          scores are model estimates and can be wrong. The final code was sent to Groq to produce this review.
        </p>

        {loading && <p className="text-gray-400 text-sm">Loading...</p>}
        {error && <p className="text-red-400 text-sm">{error}</p>}

        {!loading && !card && (
          <button
            disabled={generating}
            onClick={() => generate(false)}
            className="bg-blue-600 hover:bg-blue-500 rounded px-4 py-2 disabled:opacity-50"
          >
            {generating ? "Generating scorecard..." : "Generate scorecard"}
          </button>
        )}

        {card && (
          <>
            <div className="space-y-3">
              <Score label="Correctness" value={card.correctness} note="Measured: best test pass rate" />
              <Score label="Code quality" value={card.codeQuality} note="AI estimate" />
              <Score label="Efficiency" value={card.efficiency} note={`AI estimate · complexity: ${card.details.time_complexity}`} />
            </div>

            <p className="text-sm text-gray-200">{card.details.summary}</p>

            <div className="grid sm:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="font-semibold text-green-400 mb-1">Strengths</p>
                <ul className="list-disc ml-5 space-y-1 text-gray-300">
                  {card.details.strengths.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </div>
              <div>
                <p className="font-semibold text-yellow-400 mb-1">Improvements</p>
                <ul className="list-disc ml-5 space-y-1 text-gray-300">
                  {card.details.improvements.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </div>
            </div>

            {card.details.follow_up_questions.length > 0 && (
              <div className="text-sm">
                <p className="font-semibold mb-1">Suggested follow-up questions</p>
                <ul className="list-disc ml-5 space-y-1 text-gray-300">
                  {card.details.follow_up_questions.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </div>
            )}

            <div className="flex items-center text-xs text-gray-500">
              <span>Model: {card.model}</span>
              <button
                disabled={generating}
                onClick={() => generate(true)}
                className="ml-auto underline hover:text-white disabled:opacity-50"
              >
                {generating ? "Regenerating..." : "Regenerate"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}