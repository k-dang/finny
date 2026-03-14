import { BORDER, ERROR, MUTED, PANEL, styles } from "@/chat/tui/theme";

type ComposerPaneProps = {
  composerArmed: boolean;
  draft: string;
  exitArmed: boolean;
  focused: boolean;
  isStreaming: boolean;
  onDraftChange: (value: string) => void;
  onSubmit: (value: string) => void;
};

export function ComposerPane({
  composerArmed,
  draft,
  exitArmed,
  focused,
  isStreaming,
  onDraftChange,
  onSubmit,
}: ComposerPaneProps) {
  const title = isStreaming ? "Composer (busy)" : "Composer";
  const placeholder = isStreaming
    ? "Assistant is responding..."
    : "Ask Finny anything, or use /help";
  const shortcutHint = exitArmed
    ? "Press Ctrl+C again to exit."
    : "Shortcuts: Tab focus  Ctrl+L clear  /undo";

  return (
    <box
      title={title}
      border
      borderColor={BORDER}
      style={{
        ...styles.panel,
        flexShrink: 0,
      }}
    >
      <input
        focused={composerArmed && focused && !isStreaming}
        value={draft}
        placeholder={placeholder}
        onInput={(value) => {
          if (composerArmed) {
            onDraftChange(value);
          }
        }}
        onSubmit={(value) => {
          if (composerArmed && typeof value === "string") {
            onSubmit(value);
          }
        }}
      />
      <text
        content={shortcutHint}
        style={{ fg: exitArmed ? ERROR : MUTED, bg: PANEL }}
      />
    </box>
  );
}
