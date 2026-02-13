import type { Command } from "commander";
import { runChat } from "../chat/repl.js";

export function registerChatCommand(program: Command): void {
  program
    .command("chat")
    .description("Start interactive AI chat")
    .action(async () => {
      await runChat();
    });
}
