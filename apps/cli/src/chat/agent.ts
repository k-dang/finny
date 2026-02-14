import { gateway, stepCountIs, ToolLoopAgent } from "ai";
import { tools } from "./tools";

export function createAgent() {
  return new ToolLoopAgent({
    model: gateway("anthropic/claude-sonnet-4.5"),
    instructions:
      "You are a concise CLI assistant. Keep answers short and actionable.",
    stopWhen: stepCountIs(6),
    tools,
  });
}
