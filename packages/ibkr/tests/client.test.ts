import { describe, expect, it } from "bun:test";
import {
  createIbkrClient,
  extractAccounts,
  IbkrClientError,
  isAuthenticatedPayload,
  normalizeAccounts,
} from "../src/client";

type FetchCall = {
  input: string;
  init: RequestInit | undefined;
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("normalizeAccounts", () => {
  it("extracts account ids from string and object shapes", () => {
    const result = normalizeAccounts([
      "DU1001",
      { accountId: "DU1002" },
      { account_id: "DU1003" },
      { id: "DU1004" },
      { ignored: "x" },
    ]);

    expect(result).toEqual(["DU1001", "DU1002", "DU1003", "DU1004"]);
  });

  it("throws when account ids are missing", () => {
    expect(() => normalizeAccounts([{ foo: "bar" }, 123])).toThrow(
      new IbkrClientError("No account ids found in IBKR response."),
    );
  });
});

describe("extractAccounts", () => {
  it("handles object payload with accounts property", () => {
    expect(
      extractAccounts({ accounts: ["DU2001", { accountId: "DU2002" }] }),
    ).toEqual(["DU2001", "DU2002"]);
  });

  it("handles direct array payload", () => {
    expect(extractAccounts(["DU3001", { account_id: "DU3002" }])).toEqual([
      "DU3001",
      "DU3002",
    ]);
  });

  it("throws on unsupported payload shape", () => {
    expect(() => extractAccounts({ nope: true })).toThrow(
      new IbkrClientError("Unexpected accounts response format."),
    );
  });
});

describe("isAuthenticatedPayload", () => {
  it("returns true for accepted auth payload variants", () => {
    expect(isAuthenticatedPayload({ status: "ok" })).toBe(true);
    expect(isAuthenticatedPayload({ authenticated: true })).toBe(true);
    expect(
      isAuthenticatedPayload({ iserver: { authStatus: { authenticated: true } } }),
    ).toBe(true);
    expect(isAuthenticatedPayload({ authStatus: { authenticated: true } })).toBe(
      true,
    );
  });

  it("returns false for non-auth payloads", () => {
    expect(isAuthenticatedPayload(null)).toBe(false);
    expect(isAuthenticatedPayload({ authenticated: false })).toBe(false);
    expect(isAuthenticatedPayload({ status: "error" })).toBe(false);
  });
});

describe("createIbkrClient", () => {
  it("builds expected URLs and query params for getOrders", async () => {
    const calls: FetchCall[] = [];
    const fetchFn: typeof fetch = async (input, init) => {
      calls.push({ input: String(input), init });
      if (calls.length === 1) {
        return jsonResponse({ ok: true });
      }
      return jsonResponse({ orders: [] });
    };

    const client = createIbkrClient({
      baseUrl: "https://localhost:5000/",
      verifyTls: true,
      fetchFn,
    });
    await client.getOrders({ accountId: "DU9001", filters: "Filled", force: true });

    expect(calls.map((call) => call.input)).toEqual([
      "https://localhost:5000/v1/api/iserver/accounts",
      "https://localhost:5000/v1/api/iserver/account/orders?accountId=DU9001&filters=Filled&force=true",
    ]);
    expect(calls[0]?.init?.tls).toEqual({ rejectUnauthorized: true });
    expect(calls[1]?.init?.method).toBe("GET");
  });

  it("surfaces HTTP errors with status and body", async () => {
    const client = createIbkrClient({
      fetchFn: async () => new Response("gateway down", { status: 502 }),
    });

    await expect(client.getAccounts()).rejects.toThrow(
      "IBKR gateway error (502) for /v1/api/portfolio/accounts: gateway down",
    );
  });

  it("surfaces invalid JSON payloads", async () => {
    const client = createIbkrClient({
      fetchFn: async () =>
        new Response("not-json", {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    });

    await expect(client.getAccounts()).rejects.toThrow(
      "Invalid JSON response for /v1/api/portfolio/accounts.",
    );
  });

  it("wraps fetch connectivity failures", async () => {
    const client = createIbkrClient({
      baseUrl: "https://localhost:7000",
      fetchFn: async () => {
        throw new Error("connect ECONNREFUSED");
      },
    });

    await expect(client.getAccounts()).rejects.toThrow(
      "Unable to reach IBKR gateway at https://localhost:7000. Details: connect ECONNREFUSED",
    );
  });
});
