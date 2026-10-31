import { useEffect, useRef, useState } from "react";
import Editor from "@monaco-editor/react";
import type { Monaco } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { MonacoBinding } from "y-monaco";
import { WS_BASE, getUser } from "../api";

export type Language = "python" | "java" | "cpp";

const STARTERS: Record<Language, string> = {
  cpp: `#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    ios::sync_with_stdio(false);\n    cin.tie(nullptr);\n\n    return 0;\n}\n`,
  java: `import java.util.*;\nimport java.io.*;\n\npublic class Main {\n    public static void main(String[] args) throws IOException {\n        Scanner sc = new Scanner(System.in);\n        solve(sc);\n    }\n    static void solve(Scanner sc) {\n    }\n}\n`,
  python: `import sys\n\ndata = sys.stdin.read()\n\ndef solve():\n    pass\n\nsolve()\n`,
};

const COLORS = ["#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ec4899"];
const colorFor = (id: string) =>
  COLORS[[...id].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % COLORS.length];

interface Props {
  slug: string;
  running: boolean;
  onRun: (code: string, language: Language) => void;
}

export default function CodeEditor({ slug, running, onRun }: Props) {
  const [monacoEditor, setMonacoEditor] = useState<editor.IStandaloneCodeEditor | null>(null);
  const [status, setStatus] = useState<"connecting" | "connected" | "disconnected">("connecting");
  const [language, setLanguage] = useState<Language>("python");

  const monacoRef = useRef<Monaco | null>(null);
  const yTextRef = useRef<Y.Text | null>(null);
  const metaRef = useRef<Y.Map<string> | null>(null);

  useEffect(() => {
    if (!monacoEditor) return;
    const model = monacoEditor.getModel();
    const user = getUser();
    const token = localStorage.getItem("token");
    if (!model || !user || !token) return;

    const doc = new Y.Doc();
    const provider = new WebsocketProvider(WS_BASE, slug, doc, { params: { token } });
    const yText = doc.getText("code");
    const meta = doc.getMap<string>("meta");
    yTextRef.current = yText;
    metaRef.current = meta;

    const binding = new MonacoBinding(yText, model, new Set([monacoEditor]), provider.awareness);

    provider.awareness.setLocalStateField("user", {
      name: `${user.name} (${user.role})`,
      color: colorFor(user.id),
    });

    provider.on("status", ({ status }: { status: "connecting" | "connected" | "disconnected" }) =>
      setStatus(status)
    );

    // Keep React state and Monaco's syntax highlighting in step with the shared language
    const applyLanguage = () => {
      const lang = (meta.get("language") as Language) ?? "python";
      setLanguage(lang);
      monacoRef.current?.editor.setModelLanguage(model, lang);
    };
    meta.observe(applyLanguage);

    provider.on("sync", (synced: boolean) => {
      if (!synced) return;
      if (user.role === "interviewer") {
        doc.transact(() => {
          if (!meta.has("language")) meta.set("language", "python");
          if (yText.length === 0) yText.insert(0, STARTERS[meta.get("language") as Language]);
        });
      }
      applyLanguage();
    });

    // Remote cursor labels
    const styleEl = document.createElement("style");
    document.head.appendChild(styleEl);
    const renderCursorStyles = () => {
      let css = "";
      provider.awareness.getStates().forEach((state, clientId) => {
        if (clientId === doc.clientID || !state.user) return;
        const color: string = state.user.color;
        const label = String(state.user.name).replace(/[^\w\s().-]/g, "");
        css += `
          .yRemoteSelection-${clientId} { background-color: ${color}55; }
          .yRemoteSelectionHead-${clientId} { border-left: 2px solid ${color}; position: relative; }
          .yRemoteSelectionHead-${clientId}::after {
            content: "${label}"; position: absolute; top: 1.4em; left: -2px;
            background: ${color}; color: white; font-size: 11px; padding: 0 4px;
            border-radius: 3px; white-space: nowrap; z-index: 10;
          }`;
      });
      styleEl.textContent = css;
    };
    provider.awareness.on("change", renderCursorStyles);

    return () => {
      meta.unobserve(applyLanguage);
      provider.awareness.off("change", renderCursorStyles);
      styleEl.remove();
      binding.destroy();
      provider.destroy();
      doc.destroy();
      yTextRef.current = null;
      metaRef.current = null;
    };
  }, [monacoEditor, slug]);

  function changeLanguage(next: Language) {
    const meta = metaRef.current;
    const yText = yTextRef.current;
    if (!meta || !yText) return;
    const prev = (meta.get("language") as Language) ?? "python";
    yText.doc!.transact(() => {
      meta.set("language", next);
      // Swap the starter template only if nobody has changed it yet
      if (yText.length === 0 || yText.toString() === STARTERS[prev]) {
        yText.delete(0, yText.length);
        yText.insert(0, STARTERS[next]);
      }
    });
  }

  const dot =
    status === "connected" ? "bg-green-500" : status === "connecting" ? "bg-yellow-500" : "bg-red-500";

  return (
    <div className="h-full flex flex-col border border-gray-800 rounded overflow-hidden">
      <div className="flex items-center gap-3 px-3 py-2 bg-gray-900 text-xs text-gray-400">
        <span className={`inline-block w-2 h-2 rounded-full ${dot}`} />
        <span>{status}</span>

        <select
          value={language}
          onChange={(e) => changeLanguage(e.target.value as Language)}
          className="ml-auto bg-gray-800 border border-gray-700 text-white rounded px-2 py-1"
        >
          <option value="cpp">C++</option>
          <option value="java">Java</option>
          <option value="python">Python</option>
        </select>

        <button
          disabled={running || status !== "connected"}
          onClick={() => onRun(yTextRef.current?.toString() ?? "", language)}
          className="bg-green-600 hover:bg-green-500 text-white rounded px-3 py-1 disabled:opacity-50"
        >
          {running ? "Running..." : "▶ Run"}
        </button>
      </div>

      <div className="flex-1 min-h-0">
        <Editor
          height="100%"
          theme="vs-dark"
          defaultLanguage="python"
          options={{ minimap: { enabled: false }, fontSize: 14, automaticLayout: true }}
          onMount={(ed, monaco) => {
            monacoRef.current = monaco;
            setMonacoEditor(ed);
          }}
        />
      </div>
    </div>
  );
}