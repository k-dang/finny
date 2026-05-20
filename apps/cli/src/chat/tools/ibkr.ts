import { createIbkrPortfolioService } from "@repo/ibkr";
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

function toToolError(result: {
  code: string;
  message: string;
}): IbkrToolError {
  const code =
    result.code === "authentication_required" ||
    result.code === "gateway_unreachable"
      ? result.code
      : "request_failed";

  return { ok: false, code, error: result.message };
}

export const ibkrTools = {
  ibkr_list_accounts: tool({
    description:
      "List available IBKR account IDs. Call this first when the user wants an IBKR portfolio snapshot and the account is unknown.",
    inputSchema: ibkrListAccountsInputSchema,
    execute: async (): Promise<IbkrListAccountsSuccess | IbkrToolError> => {
      const result = await createIbkrPortfolioService().accounts();
      if (!result.ok) return toToolError(result);

      const accounts = result.data.accounts;
      return {
        ok: true,
        accounts,
        note:
          accounts.length > 1
            ? "Multiple accounts found. Pass the chosen accountId to ibkr_portfolio_snapshot."
            : undefined,
      };
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

      const result = await createIbkrPortfolioService().snapshot({
        accountId: normalizedAccountId,
        includePositions: includePositions === true,
      });
      if (!result.ok) return toToolError(result);

      return {
        ok: true,
        accountId: result.data.accountId,
        summary: result.data.summary,
        positions: result.data.positions,
      };
    },
  }),
};
