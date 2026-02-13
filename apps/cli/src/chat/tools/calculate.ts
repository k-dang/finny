import { jsonSchema, tool } from "ai";

export const calculate = tool({
  description:
    "Evaluate a basic arithmetic expression using numbers, parentheses, +, -, *, and /.",
  inputSchema: jsonSchema<{ expression: string }>({
    type: "object",
    properties: {
      expression: { type: "string" },
    },
    required: ["expression"],
    additionalProperties: false,
  }),
  execute: async ({ expression }) => {
    try {
      return {
        expression,
        result: evaluateExpression(expression),
      };
    } catch (error) {
      return {
        expression,
        error: error instanceof Error ? error.message : "Invalid expression",
      };
    }
  },
});

function evaluateExpression(expression: string): number {
  const trimmed = expression.trim();
  if (trimmed.length === 0) {
    throw new Error("Expression cannot be empty.");
  }

  if (!/^[\d+\-*/().\s]+$/.test(trimmed)) {
    throw new Error("Expression contains unsupported characters.");
  }

  let depth = 0;
  for (const character of trimmed) {
    if (character === "(") depth += 1;
    if (character === ")") depth -= 1;
    if (depth < 0) {
      throw new Error("Unbalanced parentheses.");
    }
  }
  if (depth !== 0) {
    throw new Error("Unbalanced parentheses.");
  }

  const evaluator = new Function(`return (${trimmed});`);
  const result = evaluator();

  if (typeof result !== "number" || !Number.isFinite(result)) {
    throw new Error("Expression did not evaluate to a finite number.");
  }

  return result;
}
