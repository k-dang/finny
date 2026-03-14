import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";
import { useEffect, useState } from "react";
import { type ChatEntry } from "@/chat/session";
import { ChatHeader } from "@/chat/tui/components/ChatHeader";
import { ComposerPane } from "@/chat/tui/components/ComposerPane";
import { ConversationPane } from "@/chat/tui/components/ConversationPane";
import { TracePane } from "@/chat/tui/components/TracePane";
import {
  BACKGROUND,
  type FocusTarget,
  styles,
} from "@/chat/tui/theme";
import { useChatKeyboard } from "@/chat/tui/useChatKeyboard";
import { useChatSession } from "@/chat/tui/useChatSession";
import { useComposerGuard } from "@/chat/tui/useComposerGuard";

type ChatAppProps = {
  initialVerbose: boolean;
  onExit: () => void;
};

export async function runChatTui(
  options: { verbose?: boolean } = {},
): Promise<void> {
  const renderer = await createCliRenderer({
    exitOnCtrlC: false,
    targetFps: 60,
  });
  renderer.setBackgroundColor(BACKGROUND);

  const root = createRoot(renderer);

  await new Promise<void>((resolve) => {
    let finished = false;

    const finish = () => {
      if (finished) {
        return;
      }

      finished = true;
      root.unmount();
      renderer.destroy();
      resolve();
    };

    root.render(
      <ChatApp initialVerbose={options.verbose ?? false} onExit={finish} />,
    );
  });
}

function ChatApp({ initialVerbose, onExit }: ChatAppProps) {
  const { session, snapshot } = useChatSession(initialVerbose);
  const [draft, setDraft] = useState("");
  const composerArmed = useComposerGuard();
  const [focusTarget, setFocusTarget] = useState<FocusTarget>("composer");
  const [exitArmed, setExitArmed] = useState(false);

  useEffect(() => {
    if (snapshot.isStreaming) {
      setFocusTarget("transcript");
      setExitArmed(false);
    }
  }, [snapshot.isStreaming]);

  useChatKeyboard({
    session,
    isStreaming: snapshot.isStreaming,
    exitArmed,
    setExitArmed,
    setFocusTarget,
    setDraft,
    onExit,
  });

  const submitDraft = async (value: string) => {
    if (snapshot.isStreaming) {
      return;
    }

    setExitArmed(false);
    setDraft("");
    const result = await session.handleInput(value);
    if (result.type === "exit") {
      onExit();
      return;
    }

    setFocusTarget("composer");
  };

  const focusLabel = focusTarget === "composer" ? "composer" : "transcript";
  const isComposerFocused = focusTarget === "composer";
  const isTranscriptFocused = focusTarget === "transcript";
  const showThinkingPlaceholder =
    snapshot.isStreaming && !hasPendingAssistant(snapshot.entries);

  return (
    <box style={styles.app}>
      <ChatHeader
        focusLabel={focusLabel}
        isStreaming={snapshot.isStreaming}
        turnCount={snapshot.turnCount}
        verbose={snapshot.verbose}
      />

      <box style={{ flexDirection: "column", flexGrow: 1 }}>
        <box
          style={{
            flexDirection: "row",
            flexGrow: 1,
            marginBottom: 1,
          }}
        >
          <ConversationPane
            entries={snapshot.entries}
            isStreaming={snapshot.isStreaming}
            isFocused={isTranscriptFocused}
            showThinkingPlaceholder={showThinkingPlaceholder}
            verbose={snapshot.verbose}
          />

          {snapshot.verbose ? <TracePane traces={snapshot.traces} /> : null}
        </box>

        <ComposerPane
          composerArmed={composerArmed}
          draft={draft}
          exitArmed={exitArmed}
          focused={isComposerFocused}
          isStreaming={snapshot.isStreaming}
          onDraftChange={setDraft}
          onSubmit={(value) => {
            void submitDraft(value);
          }}
        />
      </box>
    </box>
  );
}

function hasPendingAssistant(entries: ChatEntry[]): boolean {
  return entries.some((entry) => entry.role === "assistant" && entry.pending);
}
