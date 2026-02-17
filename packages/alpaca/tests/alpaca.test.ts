import { describe, expect, it } from "bun:test";
import {
  normalizeOptionChainResponse,
  parseOptionSymbol,
} from "../src/options";
import { normalizeLatestTrades } from "../src/stocks";

describe("normalizeLatestTrades", () => {
  it("maps latest trades to normalized prices", () => {
    const output = normalizeLatestTrades({
      trades: {
        AAPL: { t: "2024-01-01T00:00:00Z", p: 123.45, x: "Q" },
        TSLA: { t: "2024-01-01T00:00:01Z", p: 234.56, x: "V" },
      },
    });

    expect(output).toEqual({
      AAPL: {
        symbol: "AAPL",
        price: 123.45,
        timestamp: "2024-01-01T00:00:00Z",
        exchange: "Q",
      },
      TSLA: {
        symbol: "TSLA",
        price: 234.56,
        timestamp: "2024-01-01T00:00:01Z",
        exchange: "V",
      },
    });
  });

  it("returns an empty object when there are no trades", () => {
    expect(normalizeLatestTrades({ trades: {} })).toEqual({});
  });
});

describe("parseOptionSymbol", () => {
  it("parses valid OCC symbols", () => {
    expect(parseOptionSymbol("AAPL240216C00185000")).toEqual({
      underlying: "AAPL",
      expiration: "2024-02-16",
      type: "call",
      strike: 185,
    });

    expect(parseOptionSymbol("SPY240216P00450500")).toEqual({
      underlying: "SPY",
      expiration: "2024-02-16",
      type: "put",
      strike: 450.5,
    });
  });

  it("returns null for invalid symbols", () => {
    expect(parseOptionSymbol("AAPL")).toBeNull();
    expect(parseOptionSymbol("AAPL240216X00185000")).toBeNull();
    expect(parseOptionSymbol("AAPL2402C00185000")).toBeNull();
  });
});

describe("normalizeOptionChainResponse", () => {
  it("normalizes snapshots and includes market data fields", () => {
    const response = {
      snapshots: {
        AAPL240216C00185000: {
          latestQuote: {
            bp: 2.5,
            ap: 2.6,
            bs: 10,
            as: 15,
            t: "2024-01-15T10:00:00Z",
          },
          latestTrade: { p: 2.55, s: 5, t: "2024-01-15T09:55:00Z" },
          greeks: {
            delta: 0.55,
            gamma: 0.08,
            theta: -0.05,
            vega: 0.12,
            rho: 0.02,
          },
          impliedVolatility: 0.25,
        },
      },
    };

    expect(normalizeOptionChainResponse(response)).toEqual([
      {
        symbol: "AAPL240216C00185000",
        name: "AAPL 2024-02-16 185 call",
        underlying: "AAPL",
        type: "call",
        strike: 185,
        expiration: "2024-02-16",
        bid: 2.5,
        ask: 2.6,
        lastPrice: 2.55,
        impliedVolatility: 0.25,
        delta: 0.55,
        gamma: 0.08,
        theta: -0.05,
        vega: 0.12,
      },
    ]);
  });

  it("filters invalid option symbols", () => {
    const response = {
      snapshots: {
        INVALID: {
          latestTrade: { p: 1, s: 1, t: "2024-01-15T09:55:00Z" },
        },
      },
    };

    expect(normalizeOptionChainResponse(response)).toEqual([]);
  });
});
