import { createBashTool } from "bash-tool";

export async function createBashTools(): Promise<{ tools: Record<string, unknown> }> {
  const { tools } = await createBashTool();
  return { tools };
}
