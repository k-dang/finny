import { agent } from "@/chat/agent";
import { runChatTui } from "@/chat/tui";

type RunChatOptions = {
  verbose?: boolean;
};

type RunChatSmokeOptions = {
  timeoutMs?: number;
};

const DEFAULT_SMOKE_TIMEOUT_MS = 20_000;

function ensureGatewayApiKey(): void {
  if (!process.env.AI_GATEWAY_API_KEY) {
    console.error("Missing AI_GATEWAY_API_KEY.");
    console.error("Set AI_GATEWAY_API_KEY to use `cli chat` with AI Gateway.");
    process.exit(1);
  }
}

function ensureInteractiveTty(): void {
  if (process.stdin.isTTY && process.stdout.isTTY) {
    return;
  }

  console.error("`cli chat` now runs in an interactive terminal UI.");
  console.error("Run it from a TTY-enabled terminal session.");
  process.exit(1);
}

export async function runChatSmoke(
  options: RunChatSmokeOptions = {},
): Promise<void> {
  ensureGatewayApiKey();

  const timeoutMs = options.timeoutMs ?? DEFAULT_SMOKE_TIMEOUT_MS;
  const abortController = new AbortController();
  const timeout = setTimeout(() => {
    abortController.abort("Smoke check timed out.");
  }, timeoutMs);

  try {
    const result = await agent.stream({
      messages: [{ role: "user", content: "Reply with exactly: pong" }],
      abortSignal: abortController.signal,
    });

    let assistantText = "";
    for await (const part of result.fullStream) {
      if (part.type === "text-delta") {
        assistantText += part.text;
      }
    }

    await result.response;

    if (assistantText.trim() !== "pong") {
      console.error(
        `chat smoke: failed - unexpected assistant response: ${assistantText.trim() || "<empty>"}`,
      );
      process.exit(1);
    }

    console.log("chat smoke: ok (model reachable)");
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown chat error.";
    console.error(`chat smoke: failed - ${message}`);
    process.exit(1);
  } finally {
    clearTimeout(timeout);
  }
}

export async function runChat(options: RunChatOptions = {}): Promise<void> {
  ensureGatewayApiKey();
  ensureInteractiveTty();
  await runChatTui({ verbose: options.verbose ?? false });
}
