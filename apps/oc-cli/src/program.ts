import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import { registerChatCommand } from "./commands/chat";
import { registerStartCommand } from "./commands/start";

type PackageJson = {
  version?: string;
};

export function buildProgram(): Command {
  const program = new Command()
    .name("oc-cli")
    .description("OpenCode CLI workspace app.")
    .helpOption("-h, --help", "Show help")
    .version(resolveVersion(), "-v, --version", "Show version")
    .showSuggestionAfterError()
    .showHelpAfterError()
    .exitOverride();

  registerStartCommand(program);
  registerChatCommand(program);

  return program;
}

function resolveVersion(): string {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const packageJsonPath = join(__dirname, "..", "package.json");

  try {
    const packageJson = JSON.parse(
      readFileSync(packageJsonPath, "utf-8"),
    ) as PackageJson;
    return packageJson.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}
