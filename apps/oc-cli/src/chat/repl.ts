import { createInterface } from "node:readline/promises";
import { createOpencode } from "@opencode-ai/sdk";

type RunChatOptions = {
  verbose?: boolean;
};

type RunChatSmokeOptions = {
  timeoutMs?: number;
};

type OpencodeClient = {
  session: {
    create(input: { body: { title: string } }): Promise<unknown>;
    prompt(input: {
      path: { id: string };
      body: { parts: Array<{ type: "text"; text: string }> };
    }): Promise<unknown>;
  };
  instance: {
    dispose(): Promise<void>;
  };
};

const DEFAULT_SMOKE_TIMEOUT_MS = 20_000;
const MIN_DYNAMIC_PORT = 10_000;
const MAX_DYNAMIC_PORT = 60_000;
const ANSI_RESET = "\u001b[0m";
const ANSI_ROLE_COLORS = {
  user: "\u001b[36m",
  assistant: "\u001b[32m",
} as const;

function rolePrompt(role: keyof typeof ANSI_ROLE_COLORS): string {
  const label = `${role}>`;
  if (!process.stdout.isTTY) {
    return label;
  }

  return `${ANSI_ROLE_COLORS[role]}${label}${ANSI_RESET}`;
}

function textPart(text: string) {
  return [{ type: "text" as const, text }];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function collectTextParts(value: unknown, out: string[]): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectTextParts(item, out);
    }
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  if (value.type === "text" && typeof value.text === "string") {
    out.push(value.text);
  }

  for (const nested of Object.values(value)) {
    collectTextParts(nested, out);
  }
}

function assistantTextFromPromptResult(result: unknown): string {
  if (!isRecord(result)) {
    return "";
  }

  const data = result.data;
  if (!data) {
    return "";
  }

  const textParts: string[] = [];
  collectTextParts(data, textParts);
  return textParts.join("").trim();
}

function sessionIdFromCreateResult(result: unknown): string {
  if (!isRecord(result)) {
    throw new Error("Invalid session response.");
  }

  const fromData = result.data;
  if (isRecord(fromData) && typeof fromData.id === "string") {
    return fromData.id;
  }

  if (typeof result.id === "string") {
    return result.id;
  }

  throw new Error("Session id missing in response.");
}

function explainStartupError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/spawn\s+opencode\s+ENOENT/i.test(message) || /ENOENT/i.test(message)) {
    return "OpenCode executable not found. Install `opencode-ai` globally or ensure `opencode` is on PATH.";
  }

  return message;
}

function pickPort(): number {
  return (
    Math.floor(Math.random() * (MAX_DYNAMIC_PORT - MIN_DYNAMIC_PORT)) +
    MIN_DYNAMIC_PORT
  );
}

export async function runChatSmoke(
  options: RunChatSmokeOptions = {},
): Promise<void> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_SMOKE_TIMEOUT_MS;
  const abortController = new AbortController();
  const timeout = setTimeout(() => {
    abortController.abort("Smoke check timed out.");
  }, timeoutMs);

  let server: { close(): void } | null = null;

  try {
    const runtime = await createOpencode({
      signal: abortController.signal,
      timeout: timeoutMs,
      port: pickPort(),
    });

    const { client } = runtime;
    server = runtime.server;

    const session = await client.session.create({
      body: {
        title: "oc-cli smoke",
      },
    });

    const sessionId = sessionIdFromCreateResult(session);
    const response = await client.session.prompt({
      path: { id: sessionId },
      body: {
        parts: textPart("Reply with exactly: pong"),
      },
    });

    const assistantText = assistantTextFromPromptResult(response);
    if (assistantText.length === 0) {
      console.error("chat smoke: failed - empty assistant response");
      process.exit(1);
    }

    try {
      await client.instance.dispose();
    } catch {
      // Ignore dispose failures during smoke cleanup.
    }

    console.log("chat smoke: ok (model reachable)");
  } catch (error) {
    const message = explainStartupError(error);
    console.error(`chat smoke: failed - ${message}`);
    process.exit(1);
  } finally {
    clearTimeout(timeout);
    if (server) {
      server.close();
    }
  }
}

export async function runChat(options: RunChatOptions = {}): Promise<void> {
  const verbose = options.verbose ?? false;

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  });

  let runtime: {
    client: OpencodeClient;
    server: { close(): void };
    sessionId: string;
  } | null = null;

  const userPrompt = rolePrompt("user");
  const assistantPrompt = rolePrompt("assistant");

  const printHelp = () => {
    console.log(
      "Commands:\n  /help   Show command help\n  /clear  Start a fresh session\n  /exit   Exit chat\n  /quit   Exit chat",
    );
  };

  const shutdownRuntime = async (): Promise<void> => {
    if (!runtime) {
      return;
    }

    try {
      await runtime.client.instance.dispose();
    } catch {
      // Ignore dispose errors on shutdown.
    }

    runtime.server.close();
    runtime = null;
  };

  const ensureReady = async () => {
    if (runtime) {
      return runtime;
    }

    const created = await createOpencode({ port: pickPort() });
    const client = created.client as unknown as OpencodeClient;
    const session = await client.session.create({
      body: {
        title: "oc-cli chat",
      },
    });

    runtime = {
      client,
      server: created.server,
      sessionId: sessionIdFromCreateResult(session),
    };

    return runtime;
  };

  const resetSession = async (): Promise<void> => {
    await shutdownRuntime();
    await ensureReady();
  };

  const handleSigint = () => {
    process.stderr.write("\nExiting chat.\n");
    rl.close();
    process.exit(0);
  };

  process.on("SIGINT", handleSigint);

  console.log(
    `Chat started. Type /help for commands. Verbose traces ${verbose ? "on" : "off"}.`,
  );

  try {
    while (true) {
      const input = (await rl.question(`${userPrompt} `)).trim();
      if (input.length === 0) {
        continue;
      }

      if (input.startsWith("/")) {
        if (input === "/exit" || input === "/quit") {
          console.log("Goodbye.");
          return;
        }

        if (input === "/help") {
          printHelp();
          continue;
        }

        if (input === "/clear") {
          await resetSession();
          console.log("Started a fresh session.");
          continue;
        }

        console.log("Unknown command. Type /help for commands.");
        continue;
      }

      try {
        const ready = await ensureReady();
        process.stdout.write(`${assistantPrompt} thinking...`);
        const response = await ready.client.session.prompt({
          path: { id: ready.sessionId },
          body: {
            parts: textPart(input),
          },
        });

        process.stdout.write("\r\u001b[2K");
        const assistantText = assistantTextFromPromptResult(response);
        if (assistantText.length === 0) {
          console.log(`${assistantPrompt} (no text response)`);
          continue;
        }

        console.log(`${assistantPrompt} ${assistantText}`);
      } catch (error) {
        process.stdout.write("\r\u001b[2K");
        const message = explainStartupError(error);
        console.error(`[agent] chat error: ${message}`);
      }
    }
  } finally {
    process.off("SIGINT", handleSigint);
    rl.close();
    await shutdownRuntime();
  }
}
