import { useEffect, useMemo, useState } from "react";
import { ChatSession, type ChatSessionSnapshot } from "@/chat/session";

export function useChatSession(initialVerbose: boolean): {
  session: ChatSession;
  snapshot: ChatSessionSnapshot;
} {
  const session = useMemo(
    () => new ChatSession({ verbose: initialVerbose }),
    [initialVerbose],
  );
  const [snapshot, setSnapshot] = useState<ChatSessionSnapshot>(
    session.snapshot(),
  );

  useEffect(() => session.subscribe(setSnapshot), [session]);

  useEffect(() => {
    return () => {
      void session.dispose();
    };
  }, [session]);

  return { session, snapshot };
}
