import { useKeyboard } from "@opentui/react";
import { type Dispatch, type SetStateAction } from "react";
import { type ChatSession } from "@/chat/session";
import { type FocusTarget } from "@/chat/tui/theme";

type UseChatKeyboardOptions = {
  session: ChatSession;
  isStreaming: boolean;
  exitArmed: boolean;
  setExitArmed: Dispatch<SetStateAction<boolean>>;
  setFocusTarget: Dispatch<SetStateAction<FocusTarget>>;
  setDraft: Dispatch<SetStateAction<string>>;
  onExit: () => void;
};

export function useChatKeyboard({
  session,
  isStreaming,
  exitArmed,
  setExitArmed,
  setFocusTarget,
  setDraft,
  onExit,
}: UseChatKeyboardOptions): void {
  useKeyboard((key) => {
    if (key.ctrl && key.name === "c") {
      void handleInterrupt({
        session,
        isStreaming,
        exitArmed,
        setExitArmed,
        onExit,
      });
      return;
    }

    if (exitArmed) {
      setExitArmed(false);
    }

    if (key.name === "tab" && !isStreaming) {
      setFocusTarget((current) =>
        current === "composer" ? "transcript" : "composer",
      );
      return;
    }

    if (isStreaming) {
      return;
    }

    if (key.ctrl && key.name === "l") {
      session.clear();
      setDraft("");
    }
  });
}

async function handleInterrupt({
  session,
  isStreaming,
  exitArmed,
  setExitArmed,
  onExit,
}: {
  session: ChatSession;
  isStreaming: boolean;
  exitArmed: boolean;
  setExitArmed: Dispatch<SetStateAction<boolean>>;
  onExit: () => void;
}): Promise<void> {
  if (isStreaming) {
    await session.abort();
    setExitArmed(false);
    return;
  }

  if (exitArmed) {
    onExit();
    return;
  }

  setExitArmed(true);
}
