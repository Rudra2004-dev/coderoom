import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Info, RefreshCw, Sparkles, X } from "lucide-react";
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
  const color = value >= 8 ? "bg-emerald-500" : value >= 5 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="rounded-2xl bg-white/70 p-4 shadow-sm">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-semibold text-slate-800">{label}</span>
        <span className="text-lg font-bold text-slate-900">{value}/10</span>
      </div>
      <div className="mt-2 h-2 rounded-full bg-slate-200">
        <div className={`h-2 rounded-full ${color}`} style={{ width: `${value * 10}%` }} />
      </div>
      <p className="mt-1.5 text-xs text-slate-500">{note}</p>
    </div>
  );
}

function BulletList({ title, items, titleCls }: { title: string; items: string[]; titleCls: string }) {
  return (
    <div>
      <p className={`mb-1.5 text-sm font-semibold ${titleCls}`}>{title}</p>
      <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600">
        {items.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ul>
    </div>
  );
}

function PrimaryButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="btn-primary flex items-center gap-2 px-6 py-3 text-sm"
    >
      {children}
    </button>
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

  // Close with the Escape key
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="scorecard-title"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-2xl space-y-5 overflow-auto rounded-3xl border border-white/80 p-6 shadow-2xl sm:p-8"
        style={{ background: "linear-gradient(135deg, #ffffff 45%, #fef3c7 100%)" }}
      >
        {/* Header */}
        <div className="flex items-center gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600">
            <Sparkles size={26} />
          </span>
          <h2 id="scorecard-title" className="text-2xl font-bold text-slate-900">
            {card ? "Interview scorecard" : "Generate scorecard"}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="ml-auto flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 hover:text-slate-900"
          >
            <X size={18} />
          </button>
        </div>

        {/* Notice */}
        <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50/90 p-4 text-sm text-slate-700">
          <Info size={20} className="mt-0.5 shrink-0 text-amber-500" />
          <p>
            AI-generated to assist the interviewer. It is not a hiring decision. Only the pass rate is measured; the
            other scores are model estimates and can be wrong. The final code was sent to Groq to produce this review.
          </p>
        </div>

        {loading && <p className="text-sm text-slate-500">Loading...</p>}
        {error && <p className="rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-600">{error}</p>}

        {/* No scorecard yet */}
        {!loading && !card && (
          <PrimaryButton onClick={() => generate(false)} disabled={generating}>
            <Sparkles size={16} /> {generating ? "Generating scorecard..." : "Generate scorecard"}
          </PrimaryButton>
        )}

        {/* Saved scorecard */}
        {card && (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <Score label="Correctness" value={card.correctness} note="Measured: best test pass rate" />
              <Score label="Code quality" value={card.codeQuality} note="AI estimate" />
              <Score
                label="Efficiency"
                value={card.efficiency}
                note={`AI estimate · ${card.details.time_complexity}`}
              />
            </div>

            <p className="text-sm leading-relaxed text-slate-700">{card.details.summary}</p>

            <div className="grid gap-5 sm:grid-cols-2">
              <BulletList title="Strengths" items={card.details.strengths} titleCls="text-emerald-600" />
              <BulletList title="Improvements" items={card.details.improvements} titleCls="text-amber-600" />
            </div>

            {card.details.follow_up_questions.length > 0 && (
              <BulletList
                title="Suggested follow-up questions"
                items={card.details.follow_up_questions}
                titleCls="text-slate-800"
              />
            )}

            <div className="flex items-center border-t border-slate-900/5 pt-4 text-xs text-slate-400">
              <span>Model: {card.model}</span>
              <button
                disabled={generating}
                onClick={() => generate(true)}
                className="ml-auto flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                <RefreshCw size={14} className={generating ? "animate-spin" : ""} />
                {generating ? "Regenerating..." : "Regenerate"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}