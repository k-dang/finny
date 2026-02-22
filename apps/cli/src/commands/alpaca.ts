import {
  getLatestPrices,
  getOptionChain,
  type NormalizedOption,
  type NormalizedPrice,
} from "@repo/alpaca";
import type { Command } from "commander";
import {
  failWithMessage,
  getCredentials,
  outputJson,
  parseOptionType,
  parseSymbols,
} from "@/utils/alpaca/helpers";

type PricesPayload = {
  symbols: string[];
  prices: Record<string, NormalizedPrice | null>;
};

type OptionsPayload = {
  underlying: string;
  contracts: NormalizedOption[];
};

export function registerAlpacaCommand(program: Command): void {
  const alpaca = program
    .command("alpaca")
    .description("Quick Alpaca data checks for prices and options");

  alpaca
    .command("price")
    .description("Fetch latest stock prices")
    .argument("[symbols...]", "Stock symbols")
    .option("--symbols <list>", "Comma-separated symbol list")
    .option("--minimal", "Output minified JSON", false)
    .action(
      async (
        symbols: string[],
        options: { symbols?: string; minimal?: boolean },
      ) => {
        try {
          const credentials = getCredentials();

          const allSymbols = parseSymbols([
            ...symbols,
            ...(options.symbols ? [options.symbols] : []),
          ]);

          if (allSymbols.length === 0) {
            throw new Error("Please provide at least one symbol.");
          }

          const normalized = await getLatestPrices({
            symbols: allSymbols,
            credentials,
          });
          const prices: PricesPayload["prices"] = {};

          for (const symbol of allSymbols) {
            if (normalized[symbol]) {
              prices[symbol] = normalized[symbol];
            } else {
              prices[symbol] = null;
              console.error(`Warning: no latest trade found for ${symbol}.`);
            }
          }

          const payload: PricesPayload = {
            symbols: allSymbols,
            prices,
          };

          outputJson(payload, options.minimal ?? false);
        } catch (error) {
          failWithMessage(error);
        }
      },
    );

  alpaca
    .command("options")
    .description("Fetch option chain for a symbol")
    .argument("<symbol>", "Underlying symbol")
    .option("--expiration <date>", "Filter by expiration date (YYYY-MM-DD)")
    .option("--type <type>", "Filter by 'call' or 'put'")
    .option(
      "--limit <number>",
      "Max contracts to return",
      (value) => {
        const parsed = Number.parseInt(value, 10);
        if (Number.isNaN(parsed) || parsed <= 0) {
          throw new Error("--limit must be a positive integer.");
        }
        return parsed;
      },
      100,
    )
    .option("--minimal", "Output minified JSON", false)
    .action(
      async (
        symbol: string,
        options: {
          expiration?: string;
          type?: string;
          limit?: number;
          minimal?: boolean;
        },
      ) => {
        try {
          const credentials = getCredentials();
          const underlying = symbol.toUpperCase();
          const optionType = parseOptionType(options.type);

          const contracts = await getOptionChain({
            underlying,
            expiration: options.expiration,
            type: optionType,
            limit: options.limit,
            credentials,
          });

          const payload: OptionsPayload = {
            underlying,
            contracts,
          };

          outputJson(payload, options.minimal ?? false);
        } catch (error) {
          failWithMessage(error);
        }
      },
    );
}
