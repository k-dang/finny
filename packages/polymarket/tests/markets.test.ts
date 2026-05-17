import { describe, expect, it } from "bun:test";
import {
  createPolymarketService,
  type GammaPolymarketClient,
} from "../src/service";

const emptyGammaClient: GammaPolymarketClient = {
  listEvents: async () => [],
  listMarkets: async () => [],
};

describe("PolymarketService.markets", () => {
  it("applies filters and computes midpoint/spreadBps", async () => {
    const service = createPolymarketService({
      gammaClient: {
        ...emptyGammaClient,
        listMarkets: async () => [
          {
            id: "m1",
            conditionId: null,
            slug: "fed-rates-up",
            question: "Fed rates up?",
            eventId: null,
            outcomes: [],
            outcomePrices: [],
            active: true,
            closed: false,
            acceptingOrders: true,
            endDate: null,
            volume: null,
            volume24hr: null,
            liquidity: null,
            bestBid: 0.42,
            bestAsk: 0.46,
            spread: null,
            oneHourPriceChange: null,
            oneDayPriceChange: null,
            oneWeekPriceChange: null,
            oneMonthPriceChange: null,
            lastTradePrice: null,
            clobTokenIds: ["1"],
          },
          {
            id: "m2",
            conditionId: null,
            slug: "fed-rates-down",
            question: "Fed rates down?",
            eventId: null,
            outcomes: [],
            outcomePrices: [],
            active: true,
            closed: false,
            acceptingOrders: true,
            endDate: null,
            volume: null,
            volume24hr: null,
            liquidity: null,
            bestBid: 0.49,
            bestAsk: 0.52,
            spread: 0.03,
            oneHourPriceChange: null,
            oneDayPriceChange: null,
            oneWeekPriceChange: null,
            oneMonthPriceChange: null,
            lastTradePrice: null,
            clobTokenIds: ["2"],
          },
          {
            id: "m3",
            conditionId: null,
            slug: "no-token-ids",
            question: "Ignore this one",
            eventId: null,
            outcomes: [],
            outcomePrices: [],
            active: true,
            closed: false,
            acceptingOrders: true,
            endDate: null,
            volume: null,
            volume24hr: null,
            liquidity: null,
            bestBid: 0.1,
            bestAsk: 0.2,
            spread: null,
            oneHourPriceChange: null,
            oneDayPriceChange: null,
            oneWeekPriceChange: null,
            oneMonthPriceChange: null,
            lastTradePrice: null,
            clobTokenIds: [],
          },
        ],
      },
    });

    const result = await service.markets({
      query: "fed rates",
      activeOnly: true,
      acceptingOrdersOnly: true,
      requireTokenIds: true,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected success");
    }

    expect(result.returnedMarkets).toBe(2);
    expect(result.markets.map((market) => market.id)).toEqual(["m1", "m2"]);

    const spreadDerived = result.markets.find((market) => market.id === "m1");
    expect(spreadDerived?.midpoint).toBe(0.44);
    expect(spreadDerived?.spreadBps).toBeCloseTo(909.0909, 3);

    const spreadFromField = result.markets.find((market) => market.id === "m2");
    expect(spreadFromField?.midpoint).toBe(0.505);
    expect(spreadFromField?.spreadBps).toBe(300);
  });

  it("returns null spreadBps/midpoint when bid/ask data is incomplete", async () => {
    const service = createPolymarketService({
      gammaClient: {
        ...emptyGammaClient,
        listMarkets: async () => [
          {
            id: "m4",
            conditionId: null,
            slug: "incomplete",
            question: "Incomplete",
            eventId: null,
            outcomes: [],
            outcomePrices: [],
            active: true,
            closed: false,
            acceptingOrders: true,
            endDate: null,
            volume: null,
            volume24hr: null,
            liquidity: null,
            bestBid: null,
            bestAsk: 0.6,
            spread: null,
            oneHourPriceChange: null,
            oneDayPriceChange: null,
            oneWeekPriceChange: null,
            oneMonthPriceChange: null,
            lastTradePrice: null,
            clobTokenIds: ["4"],
          },
        ],
      },
    });

    const result = await service.markets({});
    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected success");
    }

    expect(result.markets[0]?.midpoint).toBeNull();
    expect(result.markets[0]?.spreadBps).toBeNull();
  });

  it("returns error result for invalid input", async () => {
    const service = createPolymarketService({ gammaClient: emptyGammaClient });

    const invalidLimit = await service.markets({ limit: 0 });
    expect(invalidLimit).toEqual({
      ok: false,
      error: "limit must be a positive integer.",
    });

    const invalidMin = await service.markets({ minLiquidity: -1 });
    expect(invalidMin).toEqual({
      ok: false,
      error: "minVolume and minLiquidity must be non-negative numbers.",
    });

    const invalidMax = await service.markets({ limit: 101 });
    expect(invalidMax).toEqual({
      ok: false,
      error: "limit must be <= 100.",
    });
  });
});
