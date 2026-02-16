import { createIbkrClient } from "@repo/ibkr";
import { tool } from "ai";
import { z } from "zod";

const ibkrListAccountsInputSchema = z.object({}).strict();

const ibkrPortfolioSnapshotInputSchema = z
  .object({
    accountId: z
      .string()
      .describe(
        "IBKR account id such as U1234567. Use ibkr_list_accounts first if unknown.",
      ),
    includePositions: z
      .boolean()
      .optional()
      .describe("Include open positions in the response. Defaults to false."),
  })
  .strict();

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

export const ibkrTools = {
  ibkr_list_accounts: tool({
    description:
      "List available IBKR account IDs. Call this first when the user wants an IBKR portfolio snapshot and the account is unknown.",
    inputSchema: ibkrListAccountsInputSchema,
    execute: async (): Promise<IbkrListAccountsSuccess | IbkrToolError> => {
      try {
        const client = createIbkrClient();
        const accounts = await client.getAccounts();

        if (accounts.length === 0) {
          return {
            ok: false,
            code: "request_failed",
            error: "No IBKR accounts available.",
          };
        }

        return {
          ok: true,
          accounts,
          note:
            accounts.length > 1
              ? "Multiple accounts found. Pass the chosen accountId to ibkr_portfolio_snapshot."
              : undefined,
        };
      } catch (error) {
        const recoverable = toRecoverableError(error);
        if (recoverable) return recoverable;
        throw error;
      }
    },
  }),

  ibkr_portfolio_snapshot: tool({
    description:
      "Get a read-only IBKR portfolio snapshot for one account (summary, optionally positions). Requires accountId from ibkr_list_accounts.",
    inputSchema: ibkrPortfolioSnapshotInputSchema,
    execute: async ({
      accountId,
      includePositions,
    }): Promise<IbkrPortfolioSnapshotSuccess | IbkrToolError> => {
      const normalizedAccountId = accountId?.trim();
      if (!normalizedAccountId) {
        return {
          ok: false,
          code: "invalid_input",
          error:
            "accountId is required. Use ibkr_list_accounts first if unknown.",
        };
      }

      const client = createIbkrClient();

      try {
        const summary = await client.getAccountSummary(normalizedAccountId);
        const shouldIncludePositions = includePositions === true;
        const positions = shouldIncludePositions
          ? await client.getPositions(normalizedAccountId)
          : undefined;

        return {
          ok: true,
          accountId: normalizedAccountId,
          summary,
          positions,
        };
      } catch (error) {
        const recoverable = toRecoverableError(error);
        if (recoverable) return recoverable;
        throw error;
      }
    },
  }),
};
