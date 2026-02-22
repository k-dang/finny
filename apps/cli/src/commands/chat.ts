import type { Command } from "commander";
import { runChat, runChatSmoke } from "@/chat/repl";

export function registerChatCommand(program: Command): void {
  program
    .command("chat")
    .description("Start interactive AI chat")
    .option("--verbose", "Show step and tool traces")
    .option("--smoke", "Run one-turn model connectivity check and exit")
    .action(async (options: { verbose?: boolean; smoke?: boolean }) => {
      if (options.smoke) {
        await runChatSmoke();
        return;
      }

      await runChat({ verbose: options.verbose ?? false });
    });
}
