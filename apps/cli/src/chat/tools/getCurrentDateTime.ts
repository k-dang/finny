import { jsonSchema, tool } from "ai";

export const getCurrentDateTime = tool({
  description:
    "Get the current date and time. Optional timezone in IANA format like America/New_York.",
  inputSchema: jsonSchema<{ timezone?: string }>({
    type: "object",
    properties: {
      timezone: { type: "string" },
    },
    additionalProperties: false,
  }),
  execute: async ({ timezone }) => {
    const now = new Date();
    const resolvedTimezone = timezone?.trim() || "UTC";

    try {
      const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: resolvedTimezone,
        dateStyle: "full",
        timeStyle: "long",
      });

      return {
        iso: now.toISOString(),
        timezone: resolvedTimezone,
        formatted: formatter.format(now),
      };
    } catch {
      return {
        iso: now.toISOString(),
        timezone: "UTC",
        formatted: now.toUTCString(),
        warning: `Invalid timezone "${resolvedTimezone}". Returned UTC.`,
      };
    }
  },
});
