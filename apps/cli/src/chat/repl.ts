import { createInterface } from "node:readline/promises";
import type { ModelMessage } from "ai";
import { createAgent } from "./agent.js";

export async function runChat(): Promise<void> {
  if (!process.env.AI_GATEWAY_API_KEY) {
    console.error("Missing AI_GATEWAY_API_KEY.");
    console.error("Set AI_GATEWAY_API_KEY to use `cli chat` with AI Gateway.");
    process.exit(1);
  }

  const agent = createAgent();
  const messages: ModelMessage[] = [];
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  });

  let currentAbort: AbortController | null = null;
  let awaitingInput = false;
  let sigintCount = 0;

  const handleSigint = () => {
    if (currentAbort) {
      currentAbort.abort("Interrupted by user.");
      currentAbort = null;
      process.stderr.write("\nInterrupted current response.\n");
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

  console.log("Chat started. Type /help for commands.");

  try {
    while (true) {
      awaitingInput = true;
      const input = (await rl.question("> ")).trim();
      awaitingInput = false;
      sigintCount = 0;

      if (input.length === 0) {
        continue;
      }

      if (input === "/exit" || input === "/quit") {
        console.log("Goodbye.");
        return;
      }

      if (input === "/help") {
        console.log("Commands: /help, /clear, /exit, /quit");
        continue;
      }

      if (input === "/clear") {
        messages.length = 0;
        console.log("Cleared conversation history.");
        continue;
      }

      messages.push({
        role: "user",
        content: input,
      });

      currentAbort = new AbortController();

      try {
        const result = await agent.stream({
          messages,
          abortSignal: currentAbort.signal,
          onStepFinish: ({ finishReason, toolCalls }) => {
            process.stderr.write(
              `\n[step] finish=${finishReason} toolCalls=${toolCalls.length}\n`,
            );
          },
        });

        process.stdout.write("assistant> ");
        for await (const delta of result.textStream) {
          process.stdout.write(delta);
        }
        process.stdout.write("\n");

        const response = await result.response;
        messages.push(...response.messages);
      } catch (error) {
        if (currentAbort?.signal.aborted) {
          process.stderr.write("Response aborted.\n");
        } else {
          const message =
            error instanceof Error ? error.message : "Unknown chat error.";
          process.stderr.write(`Chat error: ${message}\n`);
        }
      } finally {
        currentAbort = null;
      }
    }
  } finally {
    process.off("SIGINT", handleSigint);
    rl.close();
  }
}
