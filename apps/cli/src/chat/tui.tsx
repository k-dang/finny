import { createCliRenderer } from "@opentui/core";
import { createRoot, useKeyboard } from "@opentui/react";
import {
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  ChatSession,
  type ChatEntry,
  type ChatSessionSnapshot,
  type TraceEntry,
} from "@/chat/session";

type ChatAppProps = {
  initialVerbose: boolean;
  onExit: () => void;
};

type FocusTarget = "composer" | "transcript";

const BACKGROUND = "#06131f";
const PANEL = "#0d1b2a";
const PANEL_ALT = "#13263a";
const BORDER = "#284b63";
const TEXT = "#d8e7f3";
const MUTED = "#7e9bb2";
const USER = "#81c7d4";
const ASSISTANT = "#a3e635";
const SYSTEM = "#facc15";
const ERROR = "#f87171";

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
  const session = useMemo(
    () => new ChatSession({ verbose: initialVerbose }),
    [initialVerbose],
  );
  const [snapshot, setSnapshot] = useState<ChatSessionSnapshot>(
    session.snapshot(),
  );
  const [draft, setDraft] = useState("");
  const [focusTarget, setFocusTarget] = useState<FocusTarget>("composer");
  const [exitArmed, setExitArmed] = useState(false);

  useEffect(() => session.subscribe(setSnapshot), [session]);

  useEffect(() => {
    return () => {
      void session.dispose();
    };
  }, [session]);

  useEffect(() => {
    if (snapshot.isStreaming) {
      setFocusTarget("transcript");
      setExitArmed(false);
    }
  }, [snapshot.isStreaming]);

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

  useKeyboard((key) => {
    if (key.ctrl && key.name === "c") {
      void handleInterrupt(
        session,
        snapshot.isStreaming,
        exitArmed,
        setExitArmed,
        onExit,
      );
      return;
    }

    if (exitArmed) {
      setExitArmed(false);
    }

    if (key.name === "tab" && !snapshot.isStreaming) {
      setFocusTarget((current: FocusTarget) =>
        current === "composer" ? "transcript" : "composer",
      );
      return;
    }

    if (snapshot.isStreaming) {
      return;
    }

    if (key.ctrl && key.name === "l") {
      session.clear();
      setDraft("");
      return;
    }

  });

  const statusTone = snapshot.isStreaming ? ASSISTANT : SYSTEM;
  const focusLabel = focusTarget === "composer" ? "composer" : "transcript";

  return (
    <box
      style={{
        backgroundColor: BACKGROUND,
        flexDirection: "column",
        height: "100%",
        width: "100%",
        padding: 1,
      }}
    >
      <box
        title="Finny Chat"
        border
        borderColor={BORDER}
        style={{
          backgroundColor: PANEL,
          flexDirection: "column",
          marginBottom: 1,
          paddingLeft: 1,
          paddingRight: 1,
        }}
      >
        <text
          content={`Status: ${snapshot.isStreaming ? "streaming" : "idle"}  |  verbose: ${snapshot.verbose ? "on" : "off"}  |  turns: ${snapshot.turnCount}  |  focus: ${focusLabel}`}
          style={{ fg: statusTone }}
        />
        <text
          content={
            snapshot.isStreaming
              ? "Ctrl+C aborts the current response."
              : "Use /help for commands. Tab switches focus."
          }
          style={{ fg: MUTED, bg: PANEL }}
        />
      </box>

      <box style={{ flexDirection: "column", flexGrow: 1 }}>
        <box
          style={{
            flexDirection: "row",
            flexGrow: 1,
            marginBottom: 1,
          }}
        >
          <scrollbox
            title="Conversation"
            border
            borderColor={BORDER}
            stickyScroll
            stickyStart="bottom"
            focused={focusTarget === "transcript"}
            style={{
              backgroundColor: PANEL,
              flexGrow: 1,
              marginRight: snapshot.verbose ? 1 : 0,
              paddingTop: 1,
              paddingBottom: 1,
              paddingLeft: 1,
              paddingRight: 1,
            }}
          >
            <box style={{ flexDirection: "column", width: "100%" }}>
              {snapshot.entries.map((entry: ChatEntry) => (
                <EntryCard key={entry.id} entry={entry} />
              ))}
              {snapshot.isStreaming &&
              !hasPendingAssistant(snapshot.entries) ? (
                <box
                  border
                  borderColor={BORDER}
                  style={{
                    backgroundColor: PANEL_ALT,
                    marginBottom: 1,
                    paddingLeft: 1,
                    paddingRight: 1,
                  }}
                >
                  <text
                    content="assistant> thinking..."
                    style={{ fg: MUTED }}
                  />
                </box>
              ) : null}
            </box>
          </scrollbox>

          {snapshot.verbose ? (
            <scrollbox
              title="Trace"
              border
              borderColor={BORDER}
              stickyScroll
              stickyStart="bottom"
              style={{
                backgroundColor: PANEL_ALT,
                flexShrink: 0,
                width: 42,
                paddingTop: 1,
                paddingBottom: 1,
                paddingLeft: 1,
                paddingRight: 1,
              }}
            >
              <box style={{ flexDirection: "column", width: "100%" }}>
                {snapshot.traces.length === 0 ? (
                  <text content="No trace events yet." style={{ fg: MUTED }} />
                ) : (
                  snapshot.traces.map((trace: TraceEntry) => (
                    <TraceCard key={trace.id} trace={trace} />
                  ))
                )}
              </box>
            </scrollbox>
          ) : null}
        </box>

        <box
          title={snapshot.isStreaming ? "Composer (busy)" : "Composer"}
          border
          borderColor={BORDER}
          style={{
            backgroundColor: PANEL,
            flexDirection: "column",
            flexShrink: 0,
            paddingLeft: 1,
            paddingRight: 1,
          }}
        >
          <input
            focused={!snapshot.isStreaming && focusTarget === "composer"}
            value={draft}
            placeholder={
              snapshot.isStreaming
                ? "Assistant is responding..."
                : "Ask Finny anything, or use /help"
            }
            onInput={setDraft}
            onSubmit={(value) => {
              if (typeof value === "string") {
                void submitDraft(value);
              }
            }}
          />
          <text
            content={
              exitArmed
                ? "Press Ctrl+C again to exit."
                : "Shortcuts: Tab focus  Ctrl+L clear  /undo"
            }
            style={{ fg: exitArmed ? ERROR : MUTED, bg: PANEL }}
          />
        </box>
      </box>
    </box>
  );
}

function EntryCard({ entry }: { entry: ChatEntry }) {
  const accent =
    entry.role === "user"
      ? USER
      : entry.role === "assistant"
        ? ASSISTANT
        : entry.role === "error"
          ? ERROR
          : SYSTEM;
  const background =
    entry.role === "user"
      ? "#102738"
      : entry.role === "assistant"
        ? "#15230f"
        : entry.role === "error"
          ? "#301317"
          : PANEL_ALT;
  const label = `${entry.role}>${entry.pending ? " streaming" : ""}`;

  return (
    <box
      border
      borderColor={BORDER}
      style={{
        backgroundColor: background,
        flexDirection: "column",
        marginBottom: 1,
        paddingLeft: 1,
        paddingRight: 1,
      }}
    >
      <text content={label} style={{ fg: accent }} />
      <text content={entry.text} style={{ fg: TEXT }} />
    </box>
  );
}

function TraceCard({ trace }: { trace: TraceEntry }) {
  const tone =
    trace.tone === "error"
      ? ERROR
      : trace.tone === "success"
        ? ASSISTANT
        : trace.tone === "warn"
          ? SYSTEM
          : MUTED;

  return (
    <box
      border
      borderColor={BORDER}
      style={{
        backgroundColor: PANEL,
        flexDirection: "column",
        marginBottom: 1,
        paddingLeft: 1,
        paddingRight: 1,
      }}
    >
      {trace.lines.map((line, index) => (
        <text
          key={`${trace.id}-${index}`}
          content={line}
          style={{ fg: tone }}
        />
      ))}
    </box>
  );
}

function hasPendingAssistant(entries: ChatEntry[]): boolean {
  return entries.some((entry) => entry.role === "assistant" && entry.pending);
}

async function handleInterrupt(
  session: ChatSession,
  isStreaming: boolean,
  exitArmed: boolean,
  setExitArmed: Dispatch<SetStateAction<boolean>>,
  onExit: () => void,
): Promise<void> {
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
