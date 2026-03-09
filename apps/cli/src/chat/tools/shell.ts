import { createBashTool } from "bash-tool";

export async function createBashTools() {
  const { tools } = await createBashTool();
  return { tools };
}
