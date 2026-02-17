import { describe, expect, it } from "bun:test";
import { listEvents, listMarkets, normalizeMarket } from "../src/gamma";
import { PolymarketApiError } from "../src/http";

type FetchCall = {
  url: string;
  init: RequestInit | undefined;
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("normalizeMarket", () => {
  it("maps wire payload into normalized market shape", () => {
    const market = normalizeMarket({
      id: "m-1",
      slug: "fed-rates",
      question: "Will Fed cut rates?",
      conditionId: "cond-1",
      events: [{ id: "e-1" }],
      outcomes: '["Yes","No"]',
      outcomePrices: "[0.42,0.58]",
      active: true,
      closed: false,
      acceptingOrders: true,
      endDateIso: "2026-03-01T00:00:00Z",
      volumeNum: 1234.5,
      volume24hr: "45.5",
      liquidityNum: "890.1",
      bestBid: "0.41",
      bestAsk: 0.43,
      spread: "0.02",
      clobTokenIds: '["1","2"]',
    });

    expect(market).toMatchObject({
      id: "m-1",
      eventId: "e-1",
      slug: "fed-rates",
      question: "Will Fed cut rates?",
      outcomes: ["Yes", "No"],
      outcomePrices: [0.42, 0.58],
      active: true,
      closed: false,
      acceptingOrders: true,
      endDate: "2026-03-01T00:00:00Z",
      volume: 1234.5,
      volume24hr: 45.5,
      liquidity: 890.1,
      bestBid: 0.41,
      bestAsk: 0.43,
      spread: 0.02,
      clobTokenIds: ["1", "2"],
    });
  });

  it("falls back safely for malformed optional fields", () => {
    const market = normalizeMarket({
      id: "m-2",
      events: "bad-shape",
      outcomes: "{bad}",
      outcomePrices: "{bad}",
      clobTokenIds: 10,
    });

    expect(market.id).toBe("m-2");
    expect(market.eventId).toBeNull();
    expect(market.outcomes).toEqual([]);
    expect(market.outcomePrices).toEqual([]);
    expect(market.clobTokenIds).toEqual([]);
  });
});

describe("listMarkets/listEvents", () => {
  it("passes mapped query params to markets endpoint", async () => {
    const calls: FetchCall[] = [];
    const fetchFn: typeof fetch = async (input, init) => {
      calls.push({ url: String(input), init });
      return jsonResponse([]);
    };

    await listMarkets({
      fetchFn,
      params: {
        limit: 10,
        offset: 5,
        order: "volume",
        ascending: false,
        closed: false,
        minVolume: 100,
        minLiquidity: 50,
      },
    });

    const url = new URL(calls[0]?.url ?? "");
    expect(`${url.origin}${url.pathname}`).toBe(
      "https://gamma-api.polymarket.com/markets",
    );
    expect(url.searchParams.get("limit")).toBe("10");
    expect(url.searchParams.get("offset")).toBe("5");
    expect(url.searchParams.get("order")).toBe("volume");
    expect(url.searchParams.get("ascending")).toBe("false");
    expect(url.searchParams.get("closed")).toBe("false");
    expect(url.searchParams.get("volume_num_min")).toBe("100");
    expect(url.searchParams.get("liquidity_num_min")).toBe("50");
    expect(calls[0]?.init?.method).toBe("GET");
  });

  it("passes mapped query params to events endpoint", async () => {
    const calls: FetchCall[] = [];
    const fetchFn: typeof fetch = async (input, init) => {
      calls.push({ url: String(input), init });
      return jsonResponse([]);
    };

    await listEvents({
      fetchFn,
      params: {
        limit: 20,
        active: true,
        closed: false,
        minVolume: 42,
      },
    });

    const url = new URL(calls[0]?.url ?? "");
    expect(`${url.origin}${url.pathname}`).toBe(
      "https://gamma-api.polymarket.com/events",
    );
    expect(url.searchParams.get("active")).toBe("true");
    expect(url.searchParams.get("closed")).toBe("false");
    expect(url.searchParams.get("volume_num_min")).toBe("42");
    expect(calls[0]?.init?.method).toBe("GET");
  });

  it("throws when markets payload is not an array", async () => {
    const fetchFn: typeof fetch = async () => jsonResponse({ not: "array" });

    await expect(listMarkets({ fetchFn })).rejects.toThrow(
      new PolymarketApiError("Unexpected markets response format."),
    );
  });

  it("throws when events payload is not an array", async () => {
    const fetchFn: typeof fetch = async () => jsonResponse({ not: "array" });

    await expect(listEvents({ fetchFn })).rejects.toThrow(
      new PolymarketApiError("Unexpected events response format."),
    );
  });
});
