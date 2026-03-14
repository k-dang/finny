import { type TraceEntry } from "@/chat/session";
import { TraceCard } from "@/chat/tui/components/TraceCard";
import { BORDER, MUTED, styles } from "@/chat/tui/theme";

export function TracePane({ traces }: { traces: TraceEntry[] }) {
  return (
    <scrollbox
      title="Trace"
      border
      borderColor={BORDER}
      stickyScroll
      stickyStart="bottom"
      style={styles.traceScrollbox}
    >
      <box style={{ flexDirection: "column", width: "100%" }}>
        {traces.length === 0 ? (
          <text content="No trace events yet." style={{ fg: MUTED }} />
        ) : (
          traces.map((trace) => <TraceCard key={trace.id} trace={trace} />)
        )}
      </box>
    </scrollbox>
  );
}
