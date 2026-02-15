import { createBashTool } from "bash-tool";
import type { BashToolkit } from "bash-tool";

const MAX_BASH_OUTPUT_LENGTH = 12_000;

export async function getBashToolkit(): Promise<BashToolkit> {
  return createBashTool({
    destination: ".",
    maxOutputLength: MAX_BASH_OUTPUT_LENGTH,
  });
}
