import { describe, expect, it } from "bun:test";
import {
  asBoolean,
  asNumber,
  asString,
  buildUrl,
  isRecord,
  PolymarketApiError,
  requestPolymarketJson,
} from "../src/http";

describe("buildUrl", () => {
  it("normalizes base/path and sets query params", () => {
    const url = buildUrl("https://gamma-api.polymarket.com/", "markets", {
      limit: 10,
      closed: false,
      query: "fed",
      skip: undefined,
    });

    expect(url).toBe(
      "https://gamma-api.polymarket.com/markets?limit=10&closed=false&query=fed",
    );
  });
});

describe("coercion helpers", () => {
  it("coerces strings, booleans, numbers, and records", () => {
    expect(asString("abc")).toBe("abc");
    expect(asString(12)).toBeNull();

    expect(asBoolean(true)).toBe(true);
    expect(asBoolean("true", true)).toBe(true);

    expect(asNumber(1.23)).toBe(1.23);
    expect(asNumber("4.56")).toBe(4.56);
    expect(asNumber("bad")).toBeNull();

    expect(isRecord({ a: 1 })).toBe(true);
    expect(isRecord([])).toBe(false);
    expect(isRecord(null)).toBe(false);
  });
});

describe("requestPolymarketJson", () => {
  it("returns parsed JSON on ok response", async () => {
    const fetchFn: typeof fetch = async () => new Response('{"ok":true}', { status: 200 });

    const payload = await requestPolymarketJson<{ ok: boolean }>({
      fetchFn,
      url: "https://example.com/markets",
    });

    expect(payload).toEqual({ ok: true });
  });

  it("throws on non-ok responses", async () => {
    const fetchFn: typeof fetch = async () =>
      new Response("server error", { status: 500 });

    await expect(
      requestPolymarketJson({
        fetchFn,
        url: "https://example.com/markets",
      }),
    ).rejects.toThrow(
      new PolymarketApiError(
        "Polymarket API error (500) for https://example.com/markets: server error",
      ),
    );
  });

  it("throws on invalid JSON", async () => {
    const fetchFn: typeof fetch = async () =>
      new Response("not-json", {
        status: 200,
        headers: { "content-type": "application/json" },
      });

    await expect(
      requestPolymarketJson({
        fetchFn,
        url: "https://example.com/markets",
      }),
    ).rejects.toThrow(
      new PolymarketApiError(
        "Invalid JSON response for https://example.com/markets.",
      ),
    );
  });

  it("wraps fetch failures", async () => {
    const fetchFn: typeof fetch = async () => {
      throw new Error("network down");
    };

    await expect(
      requestPolymarketJson({
        fetchFn,
        url: "https://example.com/markets",
      }),
    ).rejects.toThrow(
      new PolymarketApiError(
        "Failed to fetch https://example.com/markets. Details: network down",
      ),
    );
  });
});
