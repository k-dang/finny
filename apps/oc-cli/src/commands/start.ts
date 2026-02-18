import { Command } from "commander";

export function registerStartCommand(program: Command): void {
  program
    .command("start")
    .description("Run the oc-cli start flow")
    .action(() => {
      console.log("oc-cli start is running");
    });
}
