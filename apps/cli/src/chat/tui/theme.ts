import type { ChatEntry, TraceEntry } from "@/chat/session";

export type FocusTarget = "composer" | "transcript";

export const STARTUP_INPUT_GUARD_MS = 120;
export const BACKGROUND = "#06131f";
export const PANEL = "#0d1b2a";
export const PANEL_ALT = "#13263a";
export const BORDER = "#284b63";
export const TEXT = "#d8e7f3";
export const MUTED = "#7e9bb2";
export const USER = "#81c7d4";
export const ASSISTANT = "#a3e635";
export const SYSTEM = "#facc15";
export const ERROR = "#f87171";

export const ENTRY_THEME: Record<
  ChatEntry["role"],
  { accent: string; background: string }
> = {
  user: {
    accent: USER,
    background: "#102738",
  },
  assistant: {
    accent: ASSISTANT,
    background: "#15230f",
  },
  error: {
    accent: ERROR,
    background: "#301317",
  },
  system: {
    accent: SYSTEM,
    background: PANEL_ALT,
  },
};

export const TRACE_TONE_COLOR: Record<TraceEntry["tone"], string> = {
  error: ERROR,
  info: MUTED,
  success: ASSISTANT,
  warn: SYSTEM,
};

export const styles = {
  app: {
    backgroundColor: BACKGROUND,
    flexDirection: "column" as const,
    height: "100%",
    width: "100%",
    padding: 1,
  },
  panel: {
    backgroundColor: PANEL,
    flexDirection: "column" as const,
    paddingLeft: 1,
    paddingRight: 1,
  },
  panelAlt: {
    backgroundColor: PANEL_ALT,
    flexDirection: "column" as const,
    paddingLeft: 1,
    paddingRight: 1,
  },
  card: {
    borderColor: BORDER,
    flexDirection: "column" as const,
    marginBottom: 1,
    paddingLeft: 1,
    paddingRight: 1,
  },
  transcriptScrollbox: {
    backgroundColor: PANEL,
    flexGrow: 1,
    paddingTop: 1,
    paddingBottom: 1,
    paddingLeft: 1,
    paddingRight: 1,
  },
  traceScrollbox: {
    backgroundColor: PANEL_ALT,
    flexShrink: 0,
    width: 42,
    paddingTop: 1,
    paddingBottom: 1,
    paddingLeft: 1,
    paddingRight: 1,
  },
} as const;
