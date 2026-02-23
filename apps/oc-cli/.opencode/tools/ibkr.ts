import { createIbkrClient } from "@repo/ibkr";
import { tool } from "@opencode-ai/plugin";

type IbkrToolErrorCode =
  | "authentication_required"
  | "gateway_unreachable"
  | "invalid_input"
  | "request_failed";

type IbkrToolError = {
  ok: false;
  code: IbkrToolErrorCode;
  error: string;
};

type IbkrListAccountsSuccess = {
  ok: true;
  accounts: string[];
  note?: string;
};

type IbkrPortfolioSnapshotSuccess = {
  ok: true;
  accountId: string;
  summary: Record<string, unknown>;
  positions?: Record<string, unknown>[];
};

function toRecoverableError(error: unknown): IbkrToolError | null {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();

  if (
    normalized.includes("not authenticated") ||
    normalized.includes("auth") ||
    normalized.includes("401") ||
    normalized.includes("403")
  ) {
    return {
      ok: false,
      code: "authentication_required",
      error:
        "IBKR authentication required. Log in to TWS/IB Gateway and keep Client Portal running.",
    };
  }

  if (normalized.includes("unable to reach ibkr gateway")) {
    return {
      ok: false,
      code: "gateway_unreachable",
      error: message,
    };
  }

  return null;
}

export const list_accounts = tool({
  description:
    "List available IBKR account IDs. Call this first when the user wants an IBKR portfolio snapshot and the account is unknown.",
  args: {},
  execute: async (): Promise<string> => {
    try {
      const client = createIbkrClient();
      const accounts = await client.getAccounts();

      if (accounts.length === 0) {
        const result: IbkrToolError = {
          ok: false,
          code: "request_failed",
          error: "No IBKR accounts available.",
        };

        return JSON.stringify(result);
      }

      const result: IbkrListAccountsSuccess = {
        ok: true,
        accounts,
        note:
          accounts.length > 1
            ? "Multiple accounts found. Pass the chosen accountId to ibkr_portfolio_snapshot."
            : undefined,
      };

      return JSON.stringify(result);
    } catch (error) {
      const recoverable = toRecoverableError(error);
      if (recoverable) {
        return JSON.stringify(recoverable);
      }

      const message = error instanceof Error ? error.message : String(error);
      const result: IbkrToolError = {
        ok: false,
        code: "request_failed",
        error: message,
      };

      return JSON.stringify(result);
    }
  },
});

export const portfolio_snapshot = tool({
  description:
    "Get a read-only IBKR portfolio snapshot for one account (summary, optionally positions). Requires accountId from ibkr_list_accounts.",
  args: {
    accountId: tool.schema
      .string()
      .describe(
        "IBKR account id such as U1234567. Use ibkr_list_accounts first if unknown.",
      ),
    includePositions: tool.schema
      .boolean()
      .optional()
      .describe("Include open positions in the response. Defaults to false."),
  },
  execute: async ({ accountId, includePositions }): Promise<string> => {
    const normalizedAccountId = accountId?.trim();
    if (!normalizedAccountId) {
      const result: IbkrToolError = {
        ok: false,
        code: "invalid_input",
        error:
          "accountId is required. Use ibkr_list_accounts first if unknown.",
      };

      return JSON.stringify(result);
    }

    const client = createIbkrClient();

    try {
      const summary = await client.getAccountSummary(normalizedAccountId);
      const shouldIncludePositions = includePositions === true;
      const positions = shouldIncludePositions
        ? await client.getPositions(normalizedAccountId)
        : undefined;

      const result: IbkrPortfolioSnapshotSuccess = {
        ok: true,
        accountId: normalizedAccountId,
        summary,
        positions,
      };

      return JSON.stringify(result);
    } catch (error) {
      const recoverable = toRecoverableError(error);
      if (recoverable) {
        return JSON.stringify(recoverable);
      }

      const message = error instanceof Error ? error.message : String(error);
      const result: IbkrToolError = {
        ok: false,
        code: "request_failed",
        error: message,
      };

      return JSON.stringify(result);
    }
  },
});
