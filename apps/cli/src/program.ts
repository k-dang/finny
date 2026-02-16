import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import { registerAlpacaCommand } from "./commands/alpaca";
import { registerChatCommand } from "./commands/chat";
import { registerIbkrCommand } from "./commands/ibkr";

type PackageJson = {
  version?: string;
};

export function buildProgram(): Command {
  const program = new Command();

  program
    .name("cli")
    .description("Finny: finance-focused trading and portfolio copilot.")
    .helpOption("-h, --help", "Show help")
    .version(resolveVersion(), "-v, --version", "Show version")
    .showSuggestionAfterError()
    .showHelpAfterError()
    .exitOverride();

  registerChatCommand(program);
  registerAlpacaCommand(program);
  registerIbkrCommand(program);

  return program;
}

function resolveVersion(): string {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const packageJsonPath = join(__dirname, "..", "..", "package.json");

  try {
    const packageJson = JSON.parse(
      readFileSync(packageJsonPath, "utf-8"),
    ) as PackageJson;
    return packageJson.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}
