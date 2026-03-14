import { type ChatEntry } from "@/chat/session";
import { BORDER, ENTRY_THEME, TEXT, styles } from "@/chat/tui/theme";

export function EntryCard({ entry }: { entry: ChatEntry }) {
  const theme = ENTRY_THEME[entry.role];
  const label = `${entry.role}>${entry.pending ? " streaming" : ""}`;

  return (
    <box
      border
      borderColor={BORDER}
      style={{
        ...styles.card,
        backgroundColor: theme.background,
      }}
    >
      <text content={label} style={{ fg: theme.accent }} />
      <text content={entry.text} style={{ fg: TEXT }} />
    </box>
  );
}
