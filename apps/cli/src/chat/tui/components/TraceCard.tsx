import { type TraceEntry } from "@/chat/session";
import { BORDER, PANEL, TRACE_TONE_COLOR, styles } from "@/chat/tui/theme";

export function TraceCard({ trace }: { trace: TraceEntry }) {
  const tone = TRACE_TONE_COLOR[trace.tone];

  return (
    <box
      border
      borderColor={BORDER}
      style={{
        ...styles.card,
        backgroundColor: PANEL,
      }}
    >
      {trace.lines.map((line, index) => (
        <text key={`${trace.id}-${index}`} content={line} style={{ fg: tone }} />
      ))}
    </box>
  );
}
