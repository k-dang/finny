import { describe, expect, it } from "bun:test";
import {
  createPolymarketService,
  type GammaPolymarketClient,
} from "../src/service";

const emptyGammaClient: GammaPolymarketClient = {
  listEvents: async () => [],
  listMarkets: async () => [],
};

describe("PolymarketService.activeEvents", () => {
  it("returns filtered active events and computed market counts", async () => {
    const service = createPolymarketService({
      gammaClient: {
        ...emptyGammaClient,
        listEvents: async () => [
          {
            id: "e1",
            slug: "fed-rates-2026",
            title: "Fed Rates 2026",
            description: "Policy path",
            active: true,
            closed: false,
            endDate: null,
            volume: 1200,
            volume24hr: null,
            liquidity: 700,
            markets: [
              {
                id: "m1",
                closed: false,
                acceptingOrders: true,
              },
              {
                id: "m2",
                closed: true,
                acceptingOrders: false,
              },
            ],
          },
          {
            id: "e2",
            slug: "closed-event",
            title: "Closed Event",
            description: null,
            active: true,
            closed: true,
            endDate: null,
            volume: null,
            volume24hr: null,
            liquidity: null,
            markets: [],
          },
        ],
      },
    });

    const result = await service.activeEvents({
      query: "fed rates",
      limit: 20,
      minVolume: 0,
      minLiquidity: 0,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected success");
    }

    expect(result.returnedEvents).toBe(1);
    expect(result.events).toEqual([
      {
        id: "e1",
        slug: "fed-rates-2026",
        title: "Fed Rates 2026",
        description: "Policy path",
        active: true,
        closed: false,
        endDate: null,
        volume: 1200,
        volume24hr: null,
        liquidity: 700,
        marketCount: 2,
        openMarkets: 1,
        acceptingOrderMarkets: 1,
      },
    ]);
    expect(Date.parse(result.generatedAt)).not.toBeNaN();
  });

  it("returns an error result for invalid limit and thresholds", async () => {
    const service = createPolymarketService({ gammaClient: emptyGammaClient });

    const invalidLimit = await service.activeEvents({ limit: 0 });
    expect(invalidLimit).toEqual({
      ok: false,
      error: "limit must be a positive integer.",
    });

    const invalidMin = await service.activeEvents({ minVolume: -1 });
    expect(invalidMin).toEqual({
      ok: false,
      error: "minVolume and minLiquidity must be non-negative numbers.",
    });
  });

  it("returns an error result when limit exceeds max", async () => {
    const result = await createPolymarketService({
      gammaClient: emptyGammaClient,
    }).activeEvents({ limit: 101 });
    expect(result).toEqual({
      ok: false,
      error: "limit must be <= 100.",
    });
  });
});
