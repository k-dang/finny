import type { ModelMessage } from "ai";
import { agent } from "@/chat/agent";

type EntryRole = "assistant" | "error" | "system" | "user";
type TraceTone = "error" | "info" | "success" | "warn";

type CompletedTurn = {
  entryStartIndex: number;
  messageStartIndex: number;
  traceStartIndex: number;
  userInput: string;
};

export type ChatEntry = {
  id: string;
  role: EntryRole;
  text: string;
  pending?: boolean;
};

export type TraceEntry = {
  id: string;
  lines: string[];
  tone: TraceTone;
};

export type ChatSessionSnapshot = {
  entries: ChatEntry[];
  isStreaming: boolean;
  lastRetriableInput: string | null;
  messageCount: number;
  turnCount: number;
  traces: TraceEntry[];
  verbose: boolean;
};

type ChatSessionOptions = {
  verbose?: boolean;
};

type InputResult = {
  type: "exit" | "handled" | "submitted";
};

const COMMAND_HELP = [
  "Commands:",
  "  /help            Show command help",
  "  /status          Show current chat status",
  "  /verbose on|off  Toggle step and tool traces",
  "  /undo            Remove the most recent completed turn",
  "  /retry           Retry the last input",
  "  /clear           Clear conversation history",
  "  /exit            Exit chat",
  "  /quit            Exit chat",
].join("\n");

const MAX_PREVIEW_LENGTH = 180;

export class ChatSession {
  private entries: ChatEntry[] = [];
  private traces: TraceEntry[] = [];
  private messages: ModelMessage[] = [];
  private turnHistory: CompletedTurn[] = [];
  private listeners = new Set<(snapshot: ChatSessionSnapshot) => void>();
  private currentAbort: AbortController | null = null;
  private lastRetriableInput: string | null = null;
  private verbose: boolean;
  private nextId = 0;

  constructor(options: ChatSessionOptions = {}) {
    this.verbose = options.verbose ?? false;
    this.pushEntry(
      "system",
      `Chat started. Type /help for commands. Verbose traces ${this.verbose ? "on" : "off"}.`,
    );
  }

  subscribe(listener: (snapshot: ChatSessionSnapshot) => void): () => void {
    this.listeners.add(listener);
    listener(this.snapshot());

    return () => {
      this.listeners.delete(listener);
    };
  }

  snapshot(): ChatSessionSnapshot {
    return {
      entries: [...this.entries],
      isStreaming: this.currentAbort !== null,
      lastRetriableInput: this.lastRetriableInput,
      messageCount: this.messages.length,
      turnCount: this.turnHistory.length,
      traces: [...this.traces],
      verbose: this.verbose,
    };
  }

  async handleInput(rawInput: string): Promise<InputResult> {
    const input = rawInput.trim();
    if (input.length === 0) {
      return { type: "handled" };
    }

    if (input.startsWith("/")) {
      return this.handleCommand(input);
    }

    await this.runTurn(input);
    return { type: "submitted" };
  }

  async retry(): Promise<void> {
    if (this.currentAbort) {
      return;
    }

    const removedTurn = this.turnHistory.pop();
    if (removedTurn) {
      this.messages.length = removedTurn.messageStartIndex;
      this.entries.length = removedTurn.entryStartIndex;
      this.traces.length = removedTurn.traceStartIndex;
      this.lastRetriableInput = removedTurn.userInput;
      this.emit();
    }

    if (!this.lastRetriableInput) {
      this.pushEntry("system", "Nothing to retry.");
      return;
    }

    this.pushEntry("system", "Retrying last input...");
    await this.runTurn(this.lastRetriableInput);
  }

  undo(): void {
    if (this.currentAbort) {
      return;
    }

    const removedTurn = this.turnHistory.pop();
    if (!removedTurn) {
      this.pushEntry("system", "Nothing to undo.");
      return;
    }

    this.messages.length = removedTurn.messageStartIndex;
    this.entries.length = removedTurn.entryStartIndex;
    this.traces.length = removedTurn.traceStartIndex;
    this.lastRetriableInput = removedTurn.userInput;

    const remainingTurns = this.turnHistory.length;
    const turnLabel = remainingTurns === 1 ? "turn" : "turns";
    this.emit();
    this.pushEntry(
      "system",
      `Undid 1 turn. ${remainingTurns} ${turnLabel} remaining.`,
    );
  }

  clear(): void {
    if (this.currentAbort) {
      return;
    }

    this.messages = [];
    this.turnHistory = [];
    this.entries = [];
    this.traces = [];
    this.lastRetriableInput = null;
    this.pushEntry("system", "Cleared conversation history.");
  }

  async abort(reason = "Interrupted by user."): Promise<boolean> {
    if (!this.currentAbort) {
      return false;
    }

    this.currentAbort.abort(reason);
    return true;
  }

  async dispose(): Promise<void> {
    await this.abort("Chat closed.");
  }

  private async handleCommand(input: string): Promise<InputResult> {
    if (input === "/exit" || input === "/quit") {
      return { type: "exit" };
    }

    if (input === "/help") {
      this.pushEntry("system", COMMAND_HELP);
      return { type: "handled" };
    }

    if (input === "/clear") {
      this.clear();
      return { type: "handled" };
    }

    if (input === "/status") {
      this.pushEntry(
        "system",
        `Status: turns=${this.turnHistory.length}, messages=${this.messages.length}, verbose=${this.verbose ? "on" : "off"}, streaming=${this.currentAbort ? "yes" : "no"}.`,
      );
      return { type: "handled" };
    }

    if (input.startsWith("/verbose")) {
      const [, mode] = input.split(/\s+/, 2);
      const normalizedMode = mode?.toLowerCase();

      if (normalizedMode === "on") {
        this.verbose = true;
        this.emit();
        this.pushEntry("system", "Verbose traces enabled.");
        return { type: "handled" };
      }

      if (normalizedMode === "off") {
        this.verbose = false;
        this.emit();
        this.pushEntry("system", "Verbose traces disabled.");
        return { type: "handled" };
      }

      this.pushEntry("system", "Usage: /verbose on|off");
      return { type: "handled" };
    }

    if (input === "/undo") {
      this.undo();
      return { type: "handled" };
    }

    if (input === "/retry") {
      await this.retry();
      return { type: "handled" };
    }

    this.pushEntry("system", "Unknown command. Type /help for commands.");
    return { type: "handled" };
  }

  private async runTurn(input: string): Promise<void> {
    const messageStartIndex = this.messages.length;
    const entryStartIndex = this.entries.length;
    const traceStartIndex = this.traces.length;
    this.lastRetriableInput = input;

    this.messages.push({
      role: "user",
      content: input,
    });
    this.pushEntry("user", input);

    const turnAbort = new AbortController();
    this.currentAbort = turnAbort;
    this.emit();

    let streamStepNumber = 0;
    let summaryStepNumber = 0;
    let assistantEntryId: string | null = null;
    let sawAbortEvent = false;

    try {
      const result = await agent.stream({
        messages: this.messages,
        abortSignal: turnAbort.signal,
        onStepFinish: ({ finishReason, toolCalls, usage }) => {
          if (!this.verbose) {
            return;
          }

          summaryStepNumber += 1;
          const uniqueToolNames = [
            ...new Set(toolCalls.map(({ toolName }) => toolName)),
          ];
          const toolSummary =
            uniqueToolNames.length > 0 ? uniqueToolNames.join(", ") : "none";
          const usageSummary = this.formatUsage(usage);

          this.pushTrace("info", [
            `[step ${summaryStepNumber}] summary finish=${finishReason} tools=${toolCalls.length} [${toolSummary}]${usageSummary}`,
          ]);
        },
      });

      for await (const part of result.fullStream) {
        switch (part.type) {
          case "start-step": {
            if (this.verbose) {
              streamStepNumber += 1;
              this.pushTrace("info", [`[step ${streamStepNumber}] start`]);
            }
            break;
          }
          case "finish-step": {
            if (this.verbose) {
              const stepNumber = streamStepNumber === 0 ? 1 : streamStepNumber;
              this.pushTrace("info", [
                `[step ${stepNumber}] finish reason=${part.finishReason}`,
              ]);
            }
            break;
          }
          case "tool-call": {
            if (this.verbose) {
              const stepNumber = streamStepNumber === 0 ? 1 : streamStepNumber;
              this.pushTrace("warn", [
                `[step ${stepNumber}] tool call ${part.toolName} id=${part.toolCallId}`,
                `input: ${this.preview(part.input)}`,
              ]);
            }
            break;
          }
          case "tool-result": {
            if (this.verbose) {
              const stepNumber = streamStepNumber === 0 ? 1 : streamStepNumber;
              this.pushTrace("success", [
                `[step ${stepNumber}] tool result ${part.toolName} id=${part.toolCallId}`,
                `output: ${this.preview(part.output)}`,
              ]);
            }
            break;
          }
          case "tool-error": {
            if (this.verbose) {
              const stepNumber = streamStepNumber === 0 ? 1 : streamStepNumber;
              this.pushTrace("error", [
                `[step ${stepNumber}] tool error ${part.toolName} id=${part.toolCallId}`,
                `error: ${this.errorMessage(part.error)}`,
              ]);
            }
            break;
          }
          case "abort": {
            sawAbortEvent = true;
            this.pushTrace("error", [
              `[agent] aborted reason=${part.reason ?? "unknown"}`,
            ]);
            break;
          }
          case "error": {
            this.pushTrace("error", [
              `[agent] stream error: ${this.errorMessage(part.error)}`,
            ]);
            break;
          }
          case "text-delta": {
            if (!assistantEntryId) {
              assistantEntryId = this.pushEntry("assistant", "", true);
            }

            this.appendEntryText(assistantEntryId, part.text);
            break;
          }
          default: {
            break;
          }
        }
      }

      const response = await result.response;
      this.messages.push(...response.messages);
      if (assistantEntryId) {
        this.setEntryPending(assistantEntryId, false);
      }

      this.turnHistory.push({
        entryStartIndex,
        messageStartIndex,
        traceStartIndex,
        userInput: input,
      });
      this.emit();
    } catch (error) {
      this.messages.length = messageStartIndex;
      this.entries.length = entryStartIndex;
      this.emit();

      if (turnAbort.signal.aborted) {
        if (!sawAbortEvent) {
          this.pushTrace("error", [
            "[agent] aborted reason=Interrupted by user.",
          ]);
        }
        this.pushEntry("system", "Response interrupted.");
      } else {
        const message =
          error instanceof Error ? error.message : "Unknown chat error.";
        this.pushTrace("error", [`[agent] chat error: ${message}`]);
        this.pushEntry("error", `Chat error: ${message}`);
      }
    } finally {
      if (this.currentAbort === turnAbort) {
        this.currentAbort = null;
        this.emit();
      }
    }
  }

  private formatUsage(usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  }): string {
    if (!usage) {
      return "";
    }

    const { inputTokens, outputTokens, totalTokens } = usage;
    if (
      typeof inputTokens !== "number" &&
      typeof outputTokens !== "number" &&
      typeof totalTokens !== "number"
    ) {
      return "";
    }

    const input = typeof inputTokens === "number" ? String(inputTokens) : "-";
    const output =
      typeof outputTokens === "number" ? String(outputTokens) : "-";
    const total = typeof totalTokens === "number" ? String(totalTokens) : "-";
    return ` tokens=${input}/${output}/${total}`;
  }

  private preview(value: unknown): string {
    const raw = this.safeStringify(value);
    const compact = raw.replace(/\s+/g, " ").trim();
    if (compact.length <= MAX_PREVIEW_LENGTH) {
      return compact;
    }

    return `${compact.slice(0, MAX_PREVIEW_LENGTH - 3)}...`;
  }

  private safeStringify(value: unknown): string {
    if (typeof value === "string") {
      return value;
    }

    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  private errorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return this.preview(error);
  }

  private pushEntry(role: EntryRole, text: string, pending = false): string {
    const id = this.createId();
    this.entries = [...this.entries, { id, role, text, pending }];
    this.emit();
    return id;
  }

  private appendEntryText(id: string, text: string): void {
    this.entries = this.entries.map((entry) =>
      entry.id === id ? { ...entry, text: `${entry.text}${text}` } : entry,
    );
    this.emit();
  }

  private setEntryPending(id: string, pending: boolean): void {
    this.entries = this.entries.map((entry) =>
      entry.id === id ? { ...entry, pending } : entry,
    );
    this.emit();
  }

  private pushTrace(tone: TraceTone, lines: string[]): void {
    this.traces = [...this.traces, { id: this.createId(), lines, tone }];
    this.emit();
  }

  private createId(): string {
    this.nextId += 1;
    return `chat-${this.nextId}`;
  }

  private emit(): void {
    const snapshot = this.snapshot();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }
}
