import { afterEach, describe, expect, it } from "bun:test";
import { listPolymarketMarkets } from "../src/markets";

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

describe("listPolymarketMarkets", () => {
  it("applies filters and computes midpoint/spreadBps", async () => {
    globalThis.fetch = async () =>
      jsonResponse([
        {
          id: "m1",
          slug: "fed-rates-up",
          question: "Fed rates up?",
          active: true,
          closed: false,
          acceptingOrders: true,
          clobTokenIds: '["1"]',
          bestBid: 0.42,
          bestAsk: 0.46,
          spread: null,
        },
        {
          id: "m2",
          slug: "fed-rates-down",
          question: "Fed rates down?",
          active: true,
          closed: false,
          acceptingOrders: true,
          clobTokenIds: '["2"]',
          bestBid: 0.49,
          bestAsk: 0.52,
          spread: 0.03,
        },
        {
          id: "m3",
          slug: "no-token-ids",
          question: "Ignore this one",
          active: true,
          closed: false,
          acceptingOrders: true,
          clobTokenIds: "[]",
          bestBid: 0.1,
          bestAsk: 0.2,
          spread: null,
        },
      ]);

    const result = await listPolymarketMarkets({
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
    globalThis.fetch = async () =>
      jsonResponse([
        {
          id: "m4",
          slug: "incomplete",
          question: "Incomplete",
          active: true,
          closed: false,
          acceptingOrders: true,
          clobTokenIds: '["4"]',
          bestBid: null,
          bestAsk: 0.6,
          spread: null,
        },
      ]);

    const result = await listPolymarketMarkets({});
    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected success");
    }

    expect(result.markets[0]?.midpoint).toBeNull();
    expect(result.markets[0]?.spreadBps).toBeNull();
  });

  it("returns error result for invalid input", async () => {
    const invalidLimit = await listPolymarketMarkets({ limit: 0 });
    expect(invalidLimit).toEqual({
      ok: false,
      error: "limit must be a positive integer.",
    });

    const invalidMin = await listPolymarketMarkets({ minLiquidity: -1 });
    expect(invalidMin).toEqual({
      ok: false,
      error: "minVolume and minLiquidity must be non-negative numbers.",
    });

    const invalidMax = await listPolymarketMarkets({ limit: 101 });
    expect(invalidMax).toEqual({
      ok: false,
      error: "limit must be <= 100.",
    });
  });
});
