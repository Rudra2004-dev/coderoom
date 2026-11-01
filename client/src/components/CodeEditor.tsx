import { useEffect, useRef, useState } from "react";
import Editor from "@monaco-editor/react";
import type { Monaco } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import type * as Y from "yjs";
import type { WebsocketProvider } from "y-websocket";
import { MonacoBinding } from "y-monaco";
import { getUser } from "../api";
import type { ConnStatus } from "../hooks/useRoomDoc";

export type Language = "python" | "cpp" | "java";

const STARTERS: Record<Language, string> = {
  python: `import sys\n\ndata = sys.stdin.read()\n\ndef solve():\n    pass\n\nsolve()\n`,
  cpp: `#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    ios::sync_with_stdio(false);\n    cin.tie(nullptr);\n\n    return 0;\n}\n`,
  java: `import java.util.*;\n\n// The public class must be named Main\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n\n    }\n}\n`,
};

const COLORS = ["#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ec4899"];
const colorFor = (id: string) =>
  COLORS[[...id].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % COLORS.length];

interface Props {
  doc: Y.Doc | null;
  provider: WebsocketProvider | null;
  status: ConnStatus;
  busy: boolean;
  onRun: (code: string, language: Language) => void;
}

export default function CodeEditor({ doc, provider, status, busy, onRun }: Props) {
  const [monacoEditor, setMonacoEditor] = useState<editor.IStandaloneCodeEditor | null>(null);
  const [language, setLanguage] = useState<Language>("python");

  const monacoRef = useRef<Monaco | null>(null);
  const yTextRef = useRef<Y.Text | null>(null);
  const metaRef = useRef<Y.Map<string> | null>(null);

  useEffect(() => {
    if (!monacoEditor || !doc || !provider) return;
    const model = monacoEditor.getModel();
    const user = getUser();
    if (!model || !user) return;

    const yText = doc.getText("code");
    const meta = doc.getMap<string>("meta");
    yTextRef.current = yText;
    metaRef.current = meta;

    const binding = new MonacoBinding(yText, model, new Set([monacoEditor]), provider.awareness);

    provider.awareness.setLocalStateField("user", {
      name: `${user.name} (${user.role})`,
      color: colorFor(user.id),
    });

    const applyLanguage = () => {
      const lang = (meta.get("language") as Language) ?? "python";
      setLanguage(lang);
      monacoRef.current?.editor.setModelLanguage(model, lang);
    };
    meta.observe(applyLanguage);

    // The connection may already be synced by the time the editor mounts
    const onSync = (synced: boolean) => {
      if (!synced) return;
      if (user.role === "interviewer") {
        doc.transact(() => {
          if (!meta.has("language")) meta.set("language", "python");
          if (yText.length === 0) yText.insert(0, STARTERS[meta.get("language") as Language]);
        });
      }
      applyLanguage();
    };
    if (provider.synced) onSync(true);
    provider.on("sync", onSync);

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
      provider.off("sync", onSync);
      meta.unobserve(applyLanguage);
      provider.awareness.off("change", renderCursorStyles);
      styleEl.remove();
      binding.destroy();
      yTextRef.current = null;
      metaRef.current = null;
    };
  }, [monacoEditor, doc, provider]);

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
          <option value="python">Python</option>
          <option value="cpp">C++</option>
          <option value="java">Java</option>
        </select>

        <button
          disabled={busy || status !== "connected"}
          onClick={() => onRun(yTextRef.current?.toString() ?? "", language)}
          className="bg-green-600 hover:bg-green-500 text-white rounded px-3 py-1 disabled:opacity-50"
        >
          {busy ? "Running..." : "▶ Run"}
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