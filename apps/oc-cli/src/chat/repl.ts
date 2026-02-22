import { createInterface } from "node:readline/promises";
import { createOpencode } from "@opencode-ai/sdk";

type RunChatOptions = {
  verbose?: boolean;
};

type RunChatSmokeOptions = {
  timeoutMs?: number;
};

type MessagePartDeltaEvent = {
  type: "message.part.delta";
  properties: {
    sessionID: string;
    messageID: string;
    partID: string;
    field: string;
    delta: string;
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

function toMessagePartDeltaEvent(event: unknown): MessagePartDeltaEvent | null {
  if (!event || typeof event !== "object") {
    return null;
  }

  const candidate = event as {
    type?: unknown;
    properties?: {
      sessionID?: unknown;
      messageID?: unknown;
      partID?: unknown;
      field?: unknown;
      delta?: unknown;
    };
  };

  if (candidate.type !== "message.part.delta") {
    return null;
  }

  if (!candidate.properties || typeof candidate.properties !== "object") {
    return null;
  }

  const { sessionID, messageID, partID, field, delta } = candidate.properties;
  if (
    typeof sessionID !== "string" ||
    typeof messageID !== "string" ||
    typeof partID !== "string" ||
    typeof field !== "string" ||
    typeof delta !== "string"
  ) {
    return null;
  }

  return {
    type: "message.part.delta",
    properties: {
      sessionID,
      messageID,
      partID,
      field,
      delta,
    },
  };
}

function shortId(value: string): string {
  if (value.length <= 8) {
    return value;
  }

  return value.slice(0, 8);
}

function writeVerboseLine(message: string): void {
  process.stderr.write(`[verbose] ${message}\n`);
}

export async function runChatSmoke(
  options: RunChatSmokeOptions = {},
): Promise<void> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_SMOKE_TIMEOUT_MS;
  const abortController = new AbortController();
  const timeout = setTimeout(() => {
    abortController.abort("Smoke check timed out.");
  }, timeoutMs);

  let runtime: Awaited<ReturnType<typeof createOpencode>> | null = null;

  try {
    runtime = await createOpencode({
      signal: abortController.signal,
      timeout: timeoutMs,
      port: pickPort(),
    });

    const { client } = runtime;

    const session = await client.session.create({
      throwOnError: true,
      body: {
        title: "oc-cli smoke",
      },
    });

    const sessionId = session.data.id;
    const response = await client.session.prompt({
      throwOnError: true,
      path: { id: sessionId },
      body: {
        parts: [{ type: "text", text: "Reply with exactly: pong" }],
      },
    });

    const assistantText = response.data.parts
      .filter((part) => part.type === "text")
      .map((part) => part.text)
      .join("")
      .trim();

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
    if (runtime) {
      runtime.server.close();
    }
  }
}

export async function runChat(options: RunChatOptions = {}): Promise<void> {
  let verbose = options.verbose ?? false;

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  });

  let runtime: Awaited<ReturnType<typeof createOpencode>> | null = null;
  let sessionId: string | null = null;

  const userPrompt = rolePrompt("user");
  const assistantPrompt = rolePrompt("assistant");
  let currentAbort: AbortController | null = null;
  let awaitingInput = false;
  let sigintCount = 0;

  const printHelp = () => {
    console.log(
      "Commands:\n  /help            Show command help\n  /status          Show current chat status\n  /verbose on|off  Toggle compact stream diagnostics\n  /clear           Start a fresh session\n  /exit            Exit chat\n  /quit            Exit chat",
    );
  };

  const clearCurrentLine = () => {
    process.stdout.write("\r\u001b[2K");
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
    sessionId = null;
  };

  const ensureReady = async () => {
    if (runtime && sessionId) {
      return { runtime, sessionId };
    }

    runtime = await createOpencode({ port: pickPort() });
    const session = await runtime.client.session.create({
      throwOnError: true,
      body: {
        title: "oc-cli chat",
      },
    });

    sessionId = session.data.id;

    return { runtime, sessionId };
  };

  const resetSession = async (): Promise<void> => {
    await shutdownRuntime();
    await ensureReady();
  };

  const handleSigint = () => {
    if (currentAbort) {
      process.stderr.write("\nInterrupting response...\n");
      currentAbort.abort("Interrupted by user.");
      return;
    }

    if (awaitingInput) {
      sigintCount += 1;
      if (sigintCount === 1) {
        process.stderr.write("\nPress Ctrl+C again to exit.\n");
        return;
      }
    }

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
      awaitingInput = true;
      const input = (await rl.question(`${userPrompt} `)).trim();
      awaitingInput = false;
      sigintCount = 0;

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

        if (input === "/status") {
          const state = runtime && sessionId ? "ready" : "not-started";
          const responding = currentAbort ? "yes" : "no";
          console.log(
            `Status: session=${state}, responding=${responding}, verbose=${verbose ? "on" : "off"}.`,
          );
          continue;
        }

        if (input.startsWith("/verbose")) {
          const [, mode] = input.split(/\s+/, 2);
          const normalizedMode = mode?.toLowerCase();

          if (normalizedMode === "on") {
            verbose = true;
            console.log("Verbose traces enabled.");
            continue;
          }

          if (normalizedMode === "off") {
            verbose = false;
            console.log("Verbose traces disabled.");
            continue;
          }

          console.log("Usage: /verbose on|off");
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
        const turnAbort = new AbortController();
        currentAbort = turnAbort;

        process.stdout.write(`${assistantPrompt} thinking...`);
        const events = await ready.runtime.client.event.subscribe({
          throwOnError: true,
          signal: turnAbort.signal,
        });

        let assistantStarted = false;
        let assistantHasText = false;
        let thinkingVisible = true;
        const userMessageIDs = new Set<string>();
        const assistantMessageIDs = new Set<string>();
        const textByPartID = new Map<string, string>();
        let streamError: string | null = null;

        const streamTask = (async () => {
          try {
            for await (const event of events.stream) {
              if (turnAbort.signal.aborted) {
                break;
              }

              const deltaEvent = toMessagePartDeltaEvent(event);

              if (deltaEvent) {
                const { sessionID, messageID, partID, field, delta } =
                  deltaEvent.properties;

                if (verbose) {
                  writeVerboseLine(
                    `text: ${delta} (session ${shortId(sessionID)}, message ${shortId(messageID)}, part ${shortId(partID)})`,
                  );
                }

                if (
                  sessionID !== ready.sessionId ||
                  field !== "text" ||
                  userMessageIDs.has(messageID) ||
                  delta.length === 0
                ) {
                  continue;
                }

                if (!assistantStarted) {
                  clearCurrentLine();
                  process.stdout.write(`${assistantPrompt} `);
                  assistantStarted = true;
                  thinkingVisible = false;
                }

                process.stdout.write(delta);
                assistantHasText = true;

                const previous = textByPartID.get(partID) ?? "";
                textByPartID.set(partID, `${previous}${delta}`);
                continue;
              }

              if (verbose) {
                switch (event.type) {
                  case "message.updated": {
                    const info = event.properties.info;
                    writeVerboseLine(
                      `message ${info.role} updated (session ${shortId(info.sessionID)}, message ${shortId(info.id)})`,
                    );
                    break;
                  }
                  case "message.part.updated": {
                    const part = event.properties.part;
                    if (part.type === "text") {
                      writeVerboseLine(
                        `text snapshot updated (message ${shortId(part.messageID)}, part ${shortId(part.id)})`,
                      );
                      break;
                    }

                    writeVerboseLine(
                      `part ${part.type} updated (message ${shortId(part.messageID)}, part ${shortId(part.id)})`,
                    );
                    break;
                  }
                  case "session.status": {
                    writeVerboseLine(
                      `session status ${event.properties.status.type} (session ${shortId(event.properties.sessionID)})`,
                    );
                    break;
                  }
                  case "session.idle": {
                    writeVerboseLine(
                      `session idle (session ${shortId(event.properties.sessionID)})`,
                    );
                    break;
                  }
                  case "session.error": {
                    const errorInfo = event.properties.error;
                    const errorMessage =
                      typeof errorInfo?.data === "object" &&
                      errorInfo.data !== null &&
                      "message" in errorInfo.data &&
                      typeof errorInfo.data.message === "string"
                        ? errorInfo.data.message
                        : (errorInfo?.name ?? "unknown");
                    writeVerboseLine(
                      `session error: ${errorMessage} (session ${shortId(event.properties.sessionID ?? "unknown")})`,
                    );
                    break;
                  }
                  default: {
                    break;
                  }
                }
              }

              switch (event.type) {
                case "message.updated": {
                  if (event.properties.info.sessionID !== ready.sessionId) {
                    continue;
                  }

                  const info = event.properties.info;
                  const messageID = info.id;

                  if (info.role === "user") {
                    userMessageIDs.add(messageID);
                  } else if (info.role === "assistant") {
                    assistantMessageIDs.add(messageID);
                  }
                  continue;
                }
                case "message.part.updated": {
                  const { part, delta } = event.properties;
                  if (
                    part.sessionID !== ready.sessionId ||
                    part.type !== "text"
                  ) {
                    continue;
                  }

                  const messageID = part.messageID;
                  if (userMessageIDs.has(messageID)) {
                    continue;
                  }

                  let chunk = "";
                  if (typeof delta === "string" && delta.length > 0) {
                    chunk = delta;
                  } else {
                    const previous = textByPartID.get(part.id) ?? "";
                    chunk = part.text.startsWith(previous)
                      ? part.text.slice(previous.length)
                      : part.text;
                    textByPartID.set(part.id, part.text);
                  }

                  if (chunk.length === 0) {
                    continue;
                  }

                  if (
                    !assistantMessageIDs.has(messageID) &&
                    chunk.trim() === input.trim()
                  ) {
                    continue;
                  }

                  if (!assistantStarted) {
                    clearCurrentLine();
                    process.stdout.write(`${assistantPrompt} `);
                    assistantStarted = true;
                    thinkingVisible = false;
                  }

                  process.stdout.write(chunk);
                  assistantHasText = true;
                  continue;
                }
                case "session.error": {
                  const eventSessionID = event.properties.sessionID;
                  if (eventSessionID && eventSessionID !== ready.sessionId) {
                    continue;
                  }

                  const errorInfo = event.properties.error;
                  const errorMessage =
                    typeof errorInfo?.data === "object" &&
                    errorInfo.data !== null &&
                    "message" in errorInfo.data &&
                    typeof errorInfo.data.message === "string"
                      ? errorInfo.data.message
                      : null;

                  streamError =
                    errorMessage ?? errorInfo?.name ?? "Unknown chat error.";
                  continue;
                }
                case "session.idle": {
                  if (event.properties.sessionID !== ready.sessionId) {
                    continue;
                  }
                  break;
                }
                case "session.status": {
                  if (event.properties.sessionID !== ready.sessionId) {
                    continue;
                  }

                  if (event.properties.status.type !== "idle") {
                    continue;
                  }

                  break;
                }
                default: {
                  continue;
                }
              }

              break;
            }
          } catch (error) {
            if (turnAbort.signal.aborted) {
              return;
            }

            throw error;
          }
        })();

        const promptTask = ready.runtime.client.session
          .promptAsync({
            throwOnError: true,
            path: { id: ready.sessionId },
            body: {
              parts: [{ type: "text", text: input }],
            },
            signal: turnAbort.signal,
          })
          .catch((error) => {
            if (!turnAbort.signal.aborted) {
              turnAbort.abort("Prompt request failed.");
            }

            throw error;
          });

        await Promise.all([streamTask, promptTask]);

        if (thinkingVisible) {
          clearCurrentLine();
        }

        if (turnAbort.signal.aborted) {
          try {
            await ready.runtime.client.session.abort({
              throwOnError: true,
              path: { id: ready.sessionId },
            });
          } catch {
            // Ignore abort failures after local interruption.
          }

          if (assistantStarted) {
            process.stdout.write("\n");
          }
          console.log("Interrupted.");
          continue;
        }

        if (streamError) {
          if (assistantStarted) {
            process.stdout.write("\n");
          }
          console.error(`[agent] chat error: ${streamError}`);
          continue;
        }

        if (!assistantHasText) {
          console.log(`${assistantPrompt} (no text response)`);
          continue;
        }

        process.stdout.write("\n");
      } catch (error) {
        clearCurrentLine();
        if (currentAbort?.signal.aborted) {
          console.log("Interrupted.");
          continue;
        }

        const message = explainStartupError(error);
        console.error(`[agent] chat error: ${message}`);
      } finally {
        currentAbort = null;
      }
    }
  } finally {
    process.off("SIGINT", handleSigint);
    rl.close();
    await shutdownRuntime();
  }
}
