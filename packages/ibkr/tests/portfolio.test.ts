import { describe, expect, it } from "bun:test";
import { createIbkrPortfolioService, type IbkrGatewayPort } from "../src/portfolio";

class FakeGateway implements IbkrGatewayPort {
  readonly requests: Array<{ method: "GET" | "POST"; path: string }> = [];
  private readonly gets = new Map<string, unknown>();

  onGet(path: string, payload: unknown): this {
    this.gets.set(path, payload);
    return this;
  }

  async get(path: string): Promise<unknown> {
    this.requests.push({ method: "GET", path });
    if (!this.gets.has(path)) throw new Error(`Missing fake GET ${path}`);
    return this.gets.get(path);
  }

}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

describe("createIbkrPortfolioService", () => {
  it("lists accounts through an injected gateway port", async () => {
    const service = createIbkrPortfolioService({
      gatewayClient: new FakeGateway()
        .onGet("/v1/api/tickle", { authenticated: true })
        .onGet("/v1/api/portfolio/accounts", {
          accounts: ["DU1001", { accountId: "DU1002" }],
        }),
    });

    await expect(service.accounts()).resolves.toEqual({
      ok: true,
      data: { accounts: ["DU1001", "DU1002"] },
    });
  });

  it("returns authentication_required when auth probes fail", async () => {
    const service = createIbkrPortfolioService({
      gatewayClient: new FakeGateway()
        .onGet("/v1/api/tickle", { authenticated: false })
        .onGet("/v1/api/iserver/auth/status", { authenticated: false }),
    });

    const result = await service.accounts();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("authentication_required");
  });

  it("builds a snapshot, selects first account, and returns balance warnings", async () => {
    const service = createIbkrPortfolioService({
      gatewayClient: new FakeGateway()
        .onGet("/v1/api/tickle", { authenticated: true })
        .onGet("/v1/api/portfolio/accounts", { accounts: ["DU1001", "DU1002"] })
        .onGet("/v1/api/portfolio/DU1001/summary", {
          currency: "USD",
          NetLiquidation: "100000",
          TotalCashValue: "25000",
          AvailableFunds: "50000",
        }),
    });

    const result = await service.snapshot();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual(
        expect.objectContaining({
          accountId: "DU1001",
          accountSelection: "first_available",
          balance: {
            currency: "USD",
            netLiquidation: "100000",
            cashBalance: "25000",
            availableFunds: "50000",
          },
        }),
      );
      expect(result.warnings).toEqual([
        "Multiple accounts found; using the first. Pass accountId to choose.",
      ]);
    }
  });

  it("returns enriched stock positions", async () => {
    const service = createIbkrPortfolioService({
      gatewayClient: new FakeGateway()
        .onGet("/v1/api/tickle", { authenticated: true })
        .onGet("/v1/api/portfolio2/DU1001/positions", [
          { secType: "STK", conid: 123, description: "AAPL", marketValue: 1000 },
          { secType: "OPT", conid: 456, description: "ignored" },
        ])
        .onGet("/v1/api/trsrv/secdef?conids=123", {
          secdef: [{ conid: 123, ticker: "AAPL", name: "Apple Inc." }],
        }),
    });

    await expect(service.stockPositions({ accountId: "DU1001" })).resolves.toEqual({
      ok: true,
      data: {
        accountId: "DU1001",
        positions: [
          expect.objectContaining({
            conid: "123",
            symbol: "AAPL",
            companyName: "Apple Inc.",
            marketValue: 1000,
          }),
        ],
      },
      warnings: undefined,
    });
  });

  it("wires HTTP defaults when no gateway is injected", async () => {
    const calls: Array<{ input: string; init?: RequestInit & { tls?: unknown } }> = [];
    const service = createIbkrPortfolioService({
      baseUrl: "https://localhost:5000/",
      verifyTls: true,
      fetchFn: (async (input, init) => {
        calls.push({ input: String(input), init: init as RequestInit & { tls?: unknown } });
        return calls.length === 1
          ? jsonResponse({ authenticated: true })
          : jsonResponse({ accounts: ["DU1001"] });
      }) as typeof fetch,
    });

    await service.accounts();

    expect(calls[0]?.input).toBe("https://localhost:5000/v1/api/tickle");
    expect(calls[0]?.init?.method).toBe("GET");
    expect(calls[0]?.init?.tls).toEqual({ rejectUnauthorized: true });
  });
});
