import { afterEach, describe, expect, it } from "bun:test";
import { listPolymarketActiveEvents } from "../src/events";

const originalFetch = globalThis.fetch;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("listPolymarketActiveEvents", () => {
  it("returns filtered active events and computed market counts", async () => {
    globalThis.fetch = async () =>
      jsonResponse([
        {
          id: "e1",
          slug: "fed-rates-2026",
          title: "Fed Rates 2026",
          description: "Policy path",
          active: true,
          closed: false,
          volume: 1200,
          liquidity: 700,
          markets: [
            { id: "m1", closed: false, acceptingOrders: true },
            { id: "m2", closed: true, acceptingOrders: false },
          ],
        },
        {
          id: "e2",
          slug: "closed-event",
          title: "Closed Event",
          active: true,
          closed: true,
          markets: [],
        },
      ]);

    const result = await listPolymarketActiveEvents({
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
    const invalidLimit = await listPolymarketActiveEvents({ limit: 0 });
    expect(invalidLimit).toEqual({
      ok: false,
      error: "limit must be a positive integer.",
    });

    const invalidMin = await listPolymarketActiveEvents({ minVolume: -1 });
    expect(invalidMin).toEqual({
      ok: false,
      error: "minVolume and minLiquidity must be non-negative numbers.",
    });
  });

  it("returns an error result when limit exceeds max", async () => {
    const result = await listPolymarketActiveEvents({ limit: 101 });
    expect(result).toEqual({
      ok: false,
      error: "limit must be <= 100.",
    });
  });
});
