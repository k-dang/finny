import type { Command } from "commander";
import { runChat } from "../chat/repl";

export function registerChatCommand(program: Command): void {
  program
    .command("chat")
    .description("Start interactive AI chat")
    .option("--verbose", "Show step and tool traces")
    .action(async (options: { verbose?: boolean }) => {
      await runChat({ verbose: options.verbose ?? false });
    });
}
