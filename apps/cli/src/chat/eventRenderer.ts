type EventRendererOptions = {
  stream?: NodeJS.WriteStream;
};

type StepEvent = {
  stepNumber: number;
};

type StepFinishEvent = {
  stepNumber: number;
  finishReason: string;
};

type StepSummaryEvent = {
  stepNumber: number;
  finishReason: string;
  toolNames: string[];
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
};

type ToolCallEvent = {
  stepNumber: number;
  toolName: string;
  toolCallId: string;
  input: unknown;
};

type ToolResultEvent = {
  stepNumber: number;
  toolName: string;
  toolCallId: string;
  output: unknown;
};

type ToolErrorEvent = {
  stepNumber: number;
  toolName: string;
  toolCallId: string;
  error: unknown;
};

type AnsiStyle = "bold" | "dim" | "cyan" | "yellow" | "green" | "red";

const ANSI_CODES: Record<AnsiStyle, string> = {
  bold: "\u001b[1m",
  dim: "\u001b[2m",
  cyan: "\u001b[36m",
  yellow: "\u001b[33m",
  green: "\u001b[32m",
  red: "\u001b[31m",
};

const ANSI_RESET = "\u001b[0m";
const MAX_PREVIEW_LENGTH = 180;

export function createEventRenderer(options: EventRendererOptions = {}) {
  return new EventRenderer(options.stream ?? process.stderr);
}

class EventRenderer {
  private readonly stream: NodeJS.WriteStream;
  private readonly useColor: boolean;

  constructor(stream: NodeJS.WriteStream) {
    this.stream = stream;
    this.useColor = stream.isTTY;
  }

  renderStepStart({ stepNumber }: StepEvent): void {
    this.write([
      `${this.stepPrefix(stepNumber)} ${this.paint("cyan", "start")}`,
    ]);
  }

  renderStepFinish({ stepNumber, finishReason }: StepFinishEvent): void {
    this.write([
      `${this.stepPrefix(stepNumber)} ${this.paint("cyan", "finish")} reason=${this.paint("bold", finishReason)}`,
    ]);
  }

  renderStepSummary({
    stepNumber,
    finishReason,
    toolNames,
    usage,
  }: StepSummaryEvent): void {
    const uniqueToolNames = [...new Set(toolNames)];
    const toolSummary =
      uniqueToolNames.length > 0 ? uniqueToolNames.join(", ") : "none";
    const usageSummary = this.formatUsage(usage);

    this.write([
      `${this.stepPrefix(stepNumber)} ${this.paint("dim", "summary")} finish=${finishReason} tools=${toolNames.length} [${toolSummary}]${usageSummary}`,
    ]);
  }

  renderToolCall({ stepNumber, toolName, toolCallId, input }: ToolCallEvent): void {
    this.write([
      `${this.stepPrefix(stepNumber)} ${this.paint("yellow", "tool call")} ${toolName} id=${toolCallId}`,
      `  ${this.paint("dim", "input:")} ${this.preview(input)}`,
    ]);
  }

  renderToolResult({
    stepNumber,
    toolName,
    toolCallId,
    output,
  }: ToolResultEvent): void {
    this.write([
      `${this.stepPrefix(stepNumber)} ${this.paint("green", "tool result")} ${toolName} id=${toolCallId}`,
      `  ${this.paint("dim", "output:")} ${this.preview(output)}`,
    ]);
  }

  renderToolError({ stepNumber, toolName, toolCallId, error }: ToolErrorEvent): void {
    this.write([
      `${this.stepPrefix(stepNumber)} ${this.paint("red", "tool error")} ${toolName} id=${toolCallId}`,
      `  ${this.paint("dim", "error:")} ${this.errorMessage(error)}`,
    ]);
  }

  renderAbort(reason?: string): void {
    const suffix = reason ? ` reason=${reason}` : "";
    this.write([`${this.agentPrefix()} ${this.paint("red", "aborted")}${suffix}`]);
  }

  renderStreamError(error: unknown): void {
    this.write([
      `${this.agentPrefix()} ${this.paint("red", "stream error")}: ${this.errorMessage(error)}`,
    ]);
  }

  renderChatError(message: string): void {
    this.write([`${this.agentPrefix()} ${this.paint("red", "chat error")}: ${message}`]);
  }

  private formatUsage(usage?: StepSummaryEvent["usage"]): string {
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
    const output = typeof outputTokens === "number" ? String(outputTokens) : "-";
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

  private stepPrefix(stepNumber: number): string {
    return this.paint("dim", `[step ${stepNumber}]`);
  }

  private agentPrefix(): string {
    return this.paint("dim", "[agent]");
  }

  private paint(style: AnsiStyle, text: string): string {
    if (!this.useColor) {
      return text;
    }

    return `${ANSI_CODES[style]}${text}${ANSI_RESET}`;
  }

  private write(lines: string[]): void {
    this.stream.write(`${lines.join("\n")}\n`);
  }
}
