import { useEffect, useState } from "react";
import Editor from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { MonacoBinding } from "y-monaco";
import { WS_BASE, getUser } from "../api";

const COLORS = ["#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ec4899"];
const colorFor = (id: string) =>
  COLORS[[...id].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % COLORS.length];

const STARTER = `# Write your solution here\n\ndef solve():\n    pass\n`;

export default function CodeEditor({ slug }: { slug: string }) {
  const [monacoEditor, setMonacoEditor] = useState<editor.IStandaloneCodeEditor | null>(null);
  const [status, setStatus] = useState<"connecting" | "connected" | "disconnected">("connecting");

  useEffect(() => {
    if (!monacoEditor) return;
    const model = monacoEditor.getModel();
    const user = getUser();
    const token = localStorage.getItem("token");
    if (!model || !user || !token) return;

    // 1. A shared document and the connection to the server
    const doc = new Y.Doc();
    const provider = new WebsocketProvider(WS_BASE, slug, doc, { params: { token } });
    const yText = doc.getText("code");

    // 2. Bind Monaco <-> Yjs
    const binding = new MonacoBinding(yText, model, new Set([monacoEditor]), provider.awareness);

    // 3. Tell others who we are (shows as the cursor label)
    provider.awareness.setLocalStateField("user", {
      name: `${user.name} (${user.role})`,
      color: colorFor(user.id),
    });

    // 4. Connection status for the UI
    provider.on("status", ({ status }: { status: "connecting" | "connected" | "disconnected" }) =>
      setStatus(status)
    );

    // 5. The interviewer seeds starter code, only if the document is empty after syncing
    provider.on("sync", (synced: boolean) => {
      if (synced && user.role === "interviewer" && yText.length === 0) {
        yText.insert(0, STARTER);
      }
    });

    // 6. Generate CSS for each remote user's cursor and selection
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
            content: "${label}"; position: absolute; top: -1.5em; left: -2px;
            background: ${color}; color: white; font-size: 11px; padding: 0 4px;
            border-radius: 3px; white-space: nowrap; z-index: 10;
          }`;
      });
      styleEl.textContent = css;
    };
    provider.awareness.on("change", renderCursorStyles);

    // Cleanup when leaving the page (also runs in React StrictMode's double mount)
    return () => {
      provider.awareness.off("change", renderCursorStyles);
      styleEl.remove();
      binding.destroy();
      provider.destroy();
      doc.destroy();
    };
  }, [monacoEditor, slug]);

  const dot =
    status === "connected" ? "bg-green-500" : status === "connecting" ? "bg-yellow-500" : "bg-red-500";

  return (
    <div className="border border-gray-800 rounded overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-900 text-xs text-gray-400">
        <span className={`inline-block w-2 h-2 rounded-full ${dot}`} />
        {status}
      </div>
      <Editor
        height="65vh"
        theme="vs-dark"
        defaultLanguage="python"
        options={{ minimap: { enabled: false }, fontSize: 14, automaticLayout: true }}
        onMount={(ed) => setMonacoEditor(ed)}
      />
    </div>
  );
}