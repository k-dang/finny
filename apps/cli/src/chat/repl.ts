import { createInterface } from "node:readline/promises";
import type { ModelMessage } from "ai";
import { createAgent } from "./agent";
import { createEventRenderer } from "./eventRenderer";

type RunChatOptions = {
  verbose?: boolean;
};

type CompletedTurn = {
  startIndex: number;
  userInput: string;
};

export async function runChat(options: RunChatOptions = {}): Promise<void> {
  if (!process.env.AI_GATEWAY_API_KEY) {
    console.error("Missing AI_GATEWAY_API_KEY.");
    console.error("Set AI_GATEWAY_API_KEY to use `cli chat` with AI Gateway.");
    process.exit(1);
  }

  let verbose = options.verbose ?? false;
  const agent = createAgent();
  const eventRenderer = createEventRenderer();
  const messages: ModelMessage[] = [];
  const turnHistory: CompletedTurn[] = [];
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  });

  let currentAbort: AbortController | null = null;
  let lastRetriableInput: string | null = null;
  let awaitingInput = false;
  let sigintCount = 0;

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

  const printHelp = () => {
    console.log(
      "Commands:\n  /help            Show command help\n  /status          Show current chat status\n  /verbose on|off  Toggle step and tool traces\n  /undo            Remove the most recent completed turn\n  /retry           Retry the last input\n  /clear           Clear conversation history\n  /exit            Exit chat\n  /quit            Exit chat",
    );
  };

  const runTurn = async (input: string): Promise<void> => {
    const turnStartIndex = messages.length;
    lastRetriableInput = input;

    messages.push({
      role: "user",
      content: input,
    });

    const turnAbort = new AbortController();
    currentAbort = turnAbort;

    let streamStepNumber = 0;
    let summaryStepNumber = 0;
    let assistantStarted = false;
    let sawAbortEvent = false;
    let thinkingShownInTTY = false;
    let stdoutHasOpenLine = false;

    const showThinking = () => {
      if (process.stdout.isTTY) {
        process.stdout.write("assistant> thinking...");
        thinkingShownInTTY = true;
        stdoutHasOpenLine = true;
        return;
      }

      process.stdout.write("assistant> thinking...\n");
      stdoutHasOpenLine = false;
    };

    const clearThinking = () => {
      if (!thinkingShownInTTY) {
        return;
      }

      process.stdout.write("\r\u001b[2K");
      thinkingShownInTTY = false;
      stdoutHasOpenLine = false;
    };

    const ensureTraceStartsOnNewLine = () => {
      if (stdoutHasOpenLine) {
        process.stdout.write("\n");
        stdoutHasOpenLine = false;
      }

      thinkingShownInTTY = false;
    };

    showThinking();

    try {
      const result = await agent.stream({
        messages,
        abortSignal: turnAbort.signal,
        onStepFinish: ({ finishReason, toolCalls, usage }) => {
          if (!verbose) {
            return;
          }

          ensureTraceStartsOnNewLine();
          summaryStepNumber += 1;
          eventRenderer.renderStepSummary({
            stepNumber: summaryStepNumber,
            finishReason,
            toolNames: toolCalls.map(({ toolName }) => toolName),
            usage,
          });
        },
      });

      for await (const part of result.fullStream) {
        switch (part.type) {
          case "start-step": {
            if (verbose) {
              ensureTraceStartsOnNewLine();
              streamStepNumber += 1;
              eventRenderer.renderStepStart({ stepNumber: streamStepNumber });
            }
            break;
          }
          case "finish-step": {
            if (verbose) {
              ensureTraceStartsOnNewLine();
              const stepNumber = streamStepNumber === 0 ? 1 : streamStepNumber;
              eventRenderer.renderStepFinish({
                stepNumber,
                finishReason: part.finishReason,
              });
            }
            break;
          }
          case "tool-call": {
            if (verbose) {
              ensureTraceStartsOnNewLine();
              const stepNumber = streamStepNumber === 0 ? 1 : streamStepNumber;
              eventRenderer.renderToolCall({
                stepNumber,
                toolName: part.toolName,
                toolCallId: part.toolCallId,
                input: part.input,
              });
            }
            break;
          }
          case "tool-result": {
            if (verbose) {
              ensureTraceStartsOnNewLine();
              const stepNumber = streamStepNumber === 0 ? 1 : streamStepNumber;
              eventRenderer.renderToolResult({
                stepNumber,
                toolName: part.toolName,
                toolCallId: part.toolCallId,
                output: part.output,
              });
            }
            break;
          }
          case "tool-error": {
            if (verbose) {
              ensureTraceStartsOnNewLine();
              const stepNumber = streamStepNumber === 0 ? 1 : streamStepNumber;
              eventRenderer.renderToolError({
                stepNumber,
                toolName: part.toolName,
                toolCallId: part.toolCallId,
                error: part.error,
              });
            }
            break;
          }
          case "abort": {
            clearThinking();
            ensureTraceStartsOnNewLine();
            sawAbortEvent = true;
            eventRenderer.renderAbort(part.reason);
            break;
          }
          case "error": {
            clearThinking();
            ensureTraceStartsOnNewLine();
            eventRenderer.renderStreamError(part.error);
            break;
          }
          case "text-delta": {
            if (!assistantStarted) {
              clearThinking();
              process.stdout.write("assistant> ");
              assistantStarted = true;
              stdoutHasOpenLine = true;
            }

            process.stdout.write(part.text);
            stdoutHasOpenLine = !part.text.endsWith("\n");
            break;
          }
          default: {
            break;
          }
        }
      }

      clearThinking();

      if (assistantStarted) {
        process.stdout.write("\n");
        stdoutHasOpenLine = false;
      }

      const response = await result.response;
      messages.push(...response.messages);
      turnHistory.push({ startIndex: turnStartIndex, userInput: input });
    } catch (error) {
      clearThinking();

      if (assistantStarted) {
        process.stdout.write("\n");
        stdoutHasOpenLine = false;
      }

      messages.length = turnStartIndex;

      if (turnAbort.signal.aborted) {
        if (!sawAbortEvent) {
          ensureTraceStartsOnNewLine();
          eventRenderer.renderAbort("Interrupted by user.");
        }
      } else {
        const message =
          error instanceof Error ? error.message : "Unknown chat error.";
        ensureTraceStartsOnNewLine();
        eventRenderer.renderChatError(message);
      }
    } finally {
      if (currentAbort === turnAbort) {
        currentAbort = null;
      }
    }
  };

  console.log(
    `Chat started. Type /help for commands. Verbose traces ${verbose ? "on" : "off"}.`,
  );

  try {
    while (true) {
      awaitingInput = true;
      const input = (await rl.question("you> ")).trim();
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

        if (input === "/clear") {
          messages.length = 0;
          turnHistory.length = 0;
          lastRetriableInput = null;
          console.log("Cleared conversation history.");
          continue;
        }

        if (input === "/status") {
          const turnCount = turnHistory.length;
          const messageCount = messages.length;
          console.log(
            `Status: turns=${turnCount}, messages=${messageCount}, verbose=${verbose ? "on" : "off"}.`,
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

        if (input === "/undo") {
          const removedTurn = turnHistory.pop();
          if (!removedTurn) {
            console.log("Nothing to undo.");
            continue;
          }

          messages.length = removedTurn.startIndex;
          lastRetriableInput = removedTurn.userInput;

          const remainingTurns = turnHistory.length;
          const turnLabel = remainingTurns === 1 ? "turn" : "turns";
          console.log(
            `Undid 1 turn. ${remainingTurns} ${turnLabel} remaining.`,
          );
          continue;
        }

        if (input === "/retry") {
          const removedTurn = turnHistory.pop();
          if (removedTurn) {
            messages.length = removedTurn.startIndex;
            lastRetriableInput = removedTurn.userInput;
          }

          if (!lastRetriableInput) {
            console.log("Nothing to retry.");
            continue;
          }

          console.log("Retrying last input...");
          await runTurn(lastRetriableInput);
          continue;
        }

        console.log("Unknown command. Type /help for commands.");
        continue;
      }

      await runTurn(input);
    }
  } finally {
    process.off("SIGINT", handleSigint);
    rl.close();
  }
}
