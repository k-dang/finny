import { describe, expect, it } from "bun:test";
import {
  createAlpacaMarketDataService,
  type AlpacaMarketDataClient,
} from "../src/service";

function createFakeClient(
  overrides: Partial<AlpacaMarketDataClient> = {},
): AlpacaMarketDataClient {
  return {
    latestTrades: async () => ({ trades: {} }),
    stockSnapshots: async () => ({}),
    optionChain: async () => ({ snapshots: {} }),
    asset: async ({ symbol }) => ({ symbol, tradable: true }),
    ...overrides,
  };
}

describe("createAlpacaMarketDataService", () => {
  it("normalizes latest price symbols and fills missing prices", async () => {
    const calls: Array<{ symbols: string[]; feed: string }> = [];
    const service = createAlpacaMarketDataService({
      client: createFakeClient({
        latestTrades: async (input) => {
          calls.push(input);
          return {
            trades: {
              AAPL: { t: "2024-01-01T00:00:00Z", p: 123.45, x: "Q" },
            },
          };
        },
      }),
    });

    const result = await service.latestPrices({
      symbols: [" aapl ", "AAPL", "msft"],
    });

    expect(calls).toEqual([{ symbols: ["AAPL", "MSFT"], feed: "iex" }]);
    expect(result).toEqual({
      ok: true,
      data: {
        symbols: ["AAPL", "MSFT"],
        prices: {
          AAPL: {
            symbol: "AAPL",
            price: 123.45,
            timestamp: "2024-01-01T00:00:00Z",
            exchange: "Q",
          },
          MSFT: null,
        },
      },
      warnings: ["No latest trade found for MSFT."],
    });
  });

  it("applies stock snapshot defaults and missing warnings", async () => {
    const calls: Array<{ symbols: string[]; feed: string }> = [];
    const service = createAlpacaMarketDataService({
      defaults: { stockFeed: "sip" },
      client: createFakeClient({
        stockSnapshots: async (input) => {
          calls.push(input);
          return {
            TSLA: {
              latestTrade: { t: "2024-01-02T00:00:00Z", p: 250, x: "V" },
            },
          };
        },
      }),
    });

    const result = await service.stockSnapshots({
      symbols: ["tsla", "nvda"],
    });

    expect(calls).toEqual([{ symbols: ["TSLA", "NVDA"], feed: "sip" }]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.snapshots.NVDA).toBeNull();
      expect(result.warnings).toEqual(["No stock snapshot found for NVDA."]);
    }
  });

  it("normalizes option chain input and applies the default limit", async () => {
    const calls: Array<{
      underlying: string;
      expiration?: string;
      type?: "call" | "put";
      limit?: number;
    }> = [];
    const service = createAlpacaMarketDataService({
      defaults: { optionLimit: 12 },
      client: createFakeClient({
        optionChain: async (input) => {
          calls.push(input);
          return {
            snapshots: {
              AAPL240216C00185000: {
                latestTrade: { p: 2.55, s: 5, t: "2024-01-15T09:55:00Z" },
              },
            },
          };
        },
      }),
    });

    const result = await service.optionChain({
      underlying: " aapl ",
      expiration: "2024-02-16",
      type: "call",
    });

    expect(calls).toEqual([
      {
        underlying: "AAPL",
        expiration: "2024-02-16",
        type: "call",
        limit: 12,
      },
    ]);
    expect(result).toEqual({
      ok: true,
      data: {
        underlying: "AAPL",
        contracts: [
          {
            symbol: "AAPL240216C00185000",
            name: "AAPL 2024-02-16 185 call",
            underlying: "AAPL",
            type: "call",
            strike: 185,
            expiration: "2024-02-16",
            lastPrice: 2.55,
          },
        ],
      },
      warnings: [],
    });
  });

  it("returns failed results for invalid input and port errors", async () => {
    const invalidService = createAlpacaMarketDataService({
      client: createFakeClient(),
    });
    expect(await invalidService.latestPrices({ symbols: [" "] })).toEqual({
      ok: false,
      error: "Provide at least one valid symbol.",
    });

    const throwingService = createAlpacaMarketDataService({
      client: createFakeClient({
        asset: async () => {
          throw new Error("network down");
        },
      }),
    });

    expect(await throwingService.asset({ symbol: "AAPL" })).toEqual({
      ok: false,
      error: "network down",
    });
  });
});
