import { describe, expect, it } from "bun:test";
import { createFmpProvider } from "../src/providers/fmp/provider";

const NOW = new Date("2026-01-01T00:00:00.000Z");

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

function textResponse(body: string, init: ResponseInit): Response {
  return new Response(body, init);
}

function pathname(url: string): string {
  return new URL(url).pathname;
}

describe("createFmpProvider", () => {
  it("fetches fundamentals with normalized ticker and provenance", async () => {
    const calls: string[] = [];
    const fetchFn = async (url: string | URL | Request): Promise<Response> => {
      const requestUrl = String(url);
      calls.push(requestUrl);
      const path = pathname(requestUrl);

      if (path.endsWith("/income-statement")) {
        return jsonResponse([{ date: "2025-12-31", revenue: 100 }]);
      }
      if (path.endsWith("/balance-sheet-statement")) {
        return jsonResponse([{ date: "2025-12-30", assets: 200 }]);
      }
      if (path.endsWith("/cash-flow-statement")) {
        return jsonResponse([{ date: "2025-12-29", operatingCashFlow: 50 }]);
      }

      throw new Error(`Unexpected URL ${requestUrl}`);
    };

    const fmp = createFmpProvider({ apiKey: "test-key", fetchFn, now: () => NOW });
    const result = await fmp.fundamentals({
      ticker: " aapl ",
      period: "ttm",
      limit: 4,
    });

    expect(result.error).toBe(false);
    expect(result.data?.AAPL.periodResolved).toBe("quarterly");
    expect(result.data?.AAPL.incomeStatements).toEqual([
      { date: "2025-12-31", revenue: 100 },
    ]);
    expect(result.provenance).toHaveLength(3);
    expect(result.provenance?.[0]).toMatchObject({
      provider: "fmp",
      ticker: "AAPL",
      retrievedAt: NOW.toISOString(),
      asOfDate: "2025-12-31",
    });

    for (const call of calls) {
      const url = new URL(call);
      expect(url.searchParams.get("symbol")).toBe("AAPL");
      expect(url.searchParams.get("period")).toBe("quarter");
      expect(url.searchParams.get("limit")).toBe("4");
      expect(url.searchParams.get("apikey")).toBe("test-key");
    }
  });

  it("falls back to annual ratios when quarterly is blocked by FMP plan limits", async () => {
    const periods: Array<string | null> = [];
    const fetchFn = async (url: string | URL | Request): Promise<Response> => {
      const parsed = new URL(String(url));
      periods.push(parsed.searchParams.get("period"));

      if (parsed.searchParams.get("period") === "quarter") {
        return textResponse("period not available", { status: 402 });
      }

      return jsonResponse([{ date: "2025-12-31", peRatio: 20 }]);
    };

    const fmp = createFmpProvider({ apiKey: "test-key", fetchFn, now: () => NOW });
    const result = await fmp.ratios({
      ticker: "msft",
      period: "quarterly",
      limit: 2,
    });

    expect(periods).toEqual(["quarter", "annual"]);
    expect(result.error).toBe(false);
    expect(result.message).toBe(
      "Quarterly FMP ratios are not available for this API plan; returned annual ratios instead.",
    );
    expect(result.data?.MSFT.periodResolved).toBe("annual");
    expect(result.data?.MSFT.records).toEqual([{ date: "2025-12-31", peRatio: 20 }]);
  });

  it("falls back to annual segments when quarterly is blocked by FMP plan limits", async () => {
    const periods: Array<string | null> = [];
    const fetchFn = async (url: string | URL | Request): Promise<Response> => {
      const parsed = new URL(String(url));
      periods.push(parsed.searchParams.get("period"));

      if (parsed.searchParams.get("period") === "quarter") {
        return textResponse("period not available", { status: 402 });
      }

      return jsonResponse([
        { date: "2025-12-31", cloud: 10 },
        { date: "2024-12-31", cloud: 8 },
      ]);
    };

    const fmp = createFmpProvider({ apiKey: "test-key", fetchFn, now: () => NOW });
    const result = await fmp.segments({
      ticker: "msft",
      period: "quarterly",
      limit: 1,
    });

    expect(periods).toEqual(["quarter", "annual"]);
    expect(result.error).toBe(false);
    expect(result.message).toBe(
      "Quarterly FMP segment data is not available for this API plan; returned annual segments instead.",
    );
    expect(result.data?.MSFT).toEqual([{ date: "2025-12-31", cloud: 10 }]);
  });

  it("returns a failed result when the API key is missing", async () => {
    const fmp = createFmpProvider({ fetchFn: fetch, now: () => NOW });
    const result = await fmp.estimates({ ticker: "AAPL", limit: 1 });

    expect(result).toEqual({
      data: null,
      error: true,
      message: "Missing FMP_API_KEY credential.",
      provenance: undefined,
    });
  });
});
