import { ASSISTANT, BORDER, MUTED, PANEL, SYSTEM, styles } from "@/chat/tui/theme";

type ChatHeaderProps = {
  focusLabel: string;
  isStreaming: boolean;
  turnCount: number;
  verbose: boolean;
};

export function ChatHeader({
  focusLabel,
  isStreaming,
  turnCount,
  verbose,
}: ChatHeaderProps) {
  const statusTone = isStreaming ? ASSISTANT : SYSTEM;

  return (
    <box
      title="Finny Chat"
      border
      borderColor={BORDER}
      style={{
        ...styles.panel,
        flexShrink: 0,
        marginBottom: 1,
      }}
    >
      <text
        content={`Status: ${isStreaming ? "streaming" : "idle"}  |  verbose: ${verbose ? "on" : "off"}  |  turns: ${turnCount}  |  focus: ${focusLabel}`}
        style={{ fg: statusTone }}
      />
      <text
        content={
          isStreaming
            ? "Ctrl+C aborts the current response."
            : "Use /help for commands. Tab switches focus."
        }
        style={{ fg: MUTED, bg: PANEL }}
      />
    </box>
  );
}
