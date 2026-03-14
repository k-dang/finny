import { type ChatEntry } from "@/chat/session";
import { EntryCard } from "@/chat/tui/components/EntryCard";
import { BORDER, MUTED, PANEL_ALT, styles } from "@/chat/tui/theme";

type ConversationPaneProps = {
  entries: ChatEntry[];
  isStreaming: boolean;
  isFocused: boolean;
  showThinkingPlaceholder: boolean;
  verbose: boolean;
};

export function ConversationPane({
  entries,
  isStreaming,
  isFocused,
  showThinkingPlaceholder,
  verbose,
}: ConversationPaneProps) {
  return (
    <scrollbox
      title="Conversation"
      border
      borderColor={BORDER}
      stickyScroll
      stickyStart="bottom"
      focused={isFocused}
      style={{
        ...styles.transcriptScrollbox,
        marginRight: verbose ? 1 : 0,
      }}
    >
      <box style={{ flexDirection: "column", width: "100%" }}>
        {entries.map((entry) => (
          <EntryCard key={entry.id} entry={entry} />
        ))}
        {isStreaming && showThinkingPlaceholder ? (
          <box
            border
            borderColor={BORDER}
            style={{
              ...styles.card,
              backgroundColor: PANEL_ALT,
            }}
          >
            <text content="assistant> thinking..." style={{ fg: MUTED }} />
          </box>
        ) : null}
      </box>
    </scrollbox>
  );
}
