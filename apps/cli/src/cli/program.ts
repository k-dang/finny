import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import { registerChatCommand } from "../commands/chat";

type PackageJson = {
  version?: string;
};

export function buildProgram(): Command {
  const program = new Command();

  program
    .name("cli")
    .description("Bun-native CLI app.")
    .helpOption("-h, --help", "Show help")
    .version(resolveVersion(), "-v, --version", "Show version")
    .showSuggestionAfterError()
    .showHelpAfterError()
    .exitOverride();

  registerChatCommand(program);

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
