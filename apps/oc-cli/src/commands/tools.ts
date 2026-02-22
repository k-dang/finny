import { createOpencode } from "@opencode-ai/sdk";
import type { Command } from "commander";

type ToolsCommandOptions = {
  expect?: string[];
  provider?: string;
  model?: string;
};

const MIN_DYNAMIC_PORT = 10_000;
const MAX_DYNAMIC_PORT = 60_000;

function pickPort(): number {
  return (
    Math.floor(Math.random() * (MAX_DYNAMIC_PORT - MIN_DYNAMIC_PORT)) +
    MIN_DYNAMIC_PORT
  );
}

function collectList(value: string, previous: string[] = []): string[] {
  return [...previous, value];
}

function parseModel(value: string): { provider: string; model: string } | null {
  const [provider, ...rest] = value.split("/");
  if (!provider || rest.length === 0) {
    return null;
  }

  return { provider, model: rest.join("/") };
}

export function registerToolsCommand(program: Command): void {
  program
    .command("tools")
    .description("List available OpenCode tools and validate expected IDs")
    .option("--expect <toolId>", "Require a tool ID to exist", collectList, [])
    .option("--provider <provider>", "Provider ID for tool schema resolution")
    .option("--model <model>", "Model ID for tool schema resolution")
    .action(async (options: ToolsCommandOptions) => {
      let exitCode = 0;

      if (
        (options.provider && !options.model) ||
        (!options.provider && options.model)
      ) {
        console.error("tools: provide both --provider and --model together");
        process.exit(1);
        return;
      }

      let runtime: Awaited<ReturnType<typeof createOpencode>> | null = null;

      try {
        runtime = await createOpencode({ port: pickPort() });
        const idsResponse = await runtime.client.tool.ids({
          throwOnError: true,
        });
        const ids = [...idsResponse.data].sort((a, b) => a.localeCompare(b));

        console.log(`tools: ${ids.length} registered`);
        for (const id of ids) {
          console.log(`- ${id}`);
        }

        const expected = options.expect ?? [];
        const missing = expected.filter((id) => !ids.includes(id));
        if (missing.length > 0) {
          console.error(`tools: missing expected IDs: ${missing.join(", ")}`);
          exitCode = 1;
        }

        if (options.provider && options.model) {
          const listResponse = await runtime.client.tool.list({
            throwOnError: true,
            query: {
              provider: options.provider,
              model: options.model,
            },
          });

          console.log(
            `tools: resolved ${listResponse.data.length} tool definitions for ${options.provider}/${options.model}`,
          );
        }

        if (!options.provider && !options.model) {
          const configResponse = await runtime.client.config.get({
            throwOnError: true,
          });
          const resolved = parseModel(configResponse.data.model ?? "");
          if (resolved) {
            const listResponse = await runtime.client.tool.list({
              throwOnError: true,
              query: {
                provider: resolved.provider,
                model: resolved.model,
              },
            });
            console.log(
              `tools: resolved ${listResponse.data.length} tool definitions for ${resolved.provider}/${resolved.model}`,
            );
          } else {
            console.log(
              "tools: skipped schema-resolution check (no default model configured)",
            );
          }
        }

        console.log("tools: ok");
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`tools: failed - ${message}`);
        exitCode = 1;
      } finally {
        if (runtime) {
          try {
            await runtime.client.instance.dispose();
          } catch {
            // Ignore dispose failures during shutdown.
          }
          runtime.server.close();
        }
      }

      process.exit(exitCode);
    });
}
