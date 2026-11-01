import { useEffect, useState } from "react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { WS_BASE } from "../api";

export type ConnStatus = "connecting" | "connected" | "disconnected";

export function useRoomDoc(slug: string) {
  const [session, setSession] = useState<{ doc: Y.Doc; provider: WebsocketProvider } | null>(null);
  const [status, setStatus] = useState<ConnStatus>("connecting");

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!slug || !token) return;

    const doc = new Y.Doc();
    const provider = new WebsocketProvider(WS_BASE, slug, doc, { params: { token } });
    const onStatus = ({ status }: { status: ConnStatus }) => setStatus(status);
    provider.on("status", onStatus);

    // Syncing React with an external system (a WebSocket) is what effects are for
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSession({ doc, provider });

    return () => {
      provider.off("status", onStatus);
      provider.destroy();
      doc.destroy();
      setSession(null);
    };
  }, [slug]);

  return { doc: session?.doc ?? null, provider: session?.provider ?? null, status };
}