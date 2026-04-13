import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  normalizeTickerInput,
  resolveStockLookup,
  resolveTickerInput,
  validateTickerInput,
} from "@/lib/stocks";

const { getAssetMock, readAlpacaCredentialsMock } = vi.hoisted(() => ({
  getAssetMock: vi.fn(),
  readAlpacaCredentialsMock: vi.fn(),
}));

vi.mock("@repo/alpaca", () => ({
  getAsset: getAssetMock,
}));

vi.mock("@/lib/server/alpaca", () => ({
  readAlpacaCredentials: readAlpacaCredentialsMock,
}));

describe("stocks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("normalizeTickerInput", () => {
    it("trims whitespace, removes internal spaces, and uppercases the ticker", () => {
      expect(normalizeTickerInput("  brk . b  ")).toBe("BRK.B");
    });
  });

  describe("validateTickerInput", () => {
    it("accepts supported U.S. ticker formats", () => {
      expect(validateTickerInput("AAPL")).toEqual({
        valid: true,
        ticker: "AAPL",
      });

      expect(validateTickerInput("BRK.B")).toEqual({
        valid: true,
        ticker: "BRK.B",
      });
    });

    it("rejects empty and malformed input", () => {
      expect(validateTickerInput("")).toEqual({
        valid: false,
        message: "Enter a ticker to open a stock dashboard.",
      });

      expect(validateTickerInput("AAPL!")).toEqual({
        valid: false,
        message: "Enter a valid U.S. stock ticker, like AAPL or BRK.B.",
      });
    });
  });

  describe("resolveTickerInput", () => {
    it("returns an invalid state before any provider lookup for malformed tickers", async () => {
      await expect(resolveTickerInput("bad ticker!")).resolves.toEqual({
        status: "invalid",
        ticker: "BADTICKER!",
        message: "Enter a valid U.S. stock ticker, like AAPL or BRK.B.",
      });

      expect(readAlpacaCredentialsMock).not.toHaveBeenCalled();
      expect(getAssetMock).not.toHaveBeenCalled();
    });

    it("returns unverified when Alpaca credentials are missing", async () => {
      readAlpacaCredentialsMock.mockReturnValue(null);

      await expect(resolveTickerInput("aapl")).resolves.toEqual({
        status: "unverified",
        ticker: "AAPL",
        message:
          "Ticker verification is unavailable because Alpaca credentials are missing.",
      });
    });

    it("returns unsupported for non-active or non-U.S. assets", async () => {
      readAlpacaCredentialsMock.mockReturnValue({ key: "key", secret: "secret" });
      getAssetMock.mockResolvedValue({
        symbol: "OTCM",
        assetClass: "crypto",
        status: "inactive",
      });

      await expect(resolveTickerInput("otcm")).resolves.toEqual({
        status: "unsupported",
        ticker: "OTCM",
        message:
          "OTCM is outside the v1 coverage set. Only active U.S.-listed equities are supported right now.",
      });
    });
  });

  describe("resolveStockLookup", () => {
    it("returns company identity for supported active U.S. equities", async () => {
      readAlpacaCredentialsMock.mockReturnValue({ key: "key", secret: "secret" });
      getAssetMock.mockResolvedValue({
        symbol: "AAPL",
        name: "Apple Inc.",
        exchange: "NASDAQ",
        assetClass: "us_equity",
        status: "active",
      });

      await expect(resolveStockLookup(" aapl ")).resolves.toEqual({
        status: "ready",
        ticker: "AAPL",
        companyName: "Apple Inc.",
        exchange: "NASDAQ",
        provider: "alpaca",
      });
    });

    it("converts 404-style provider misses into an unsupported state", async () => {
      readAlpacaCredentialsMock.mockReturnValue({ key: "key", secret: "secret" });
      getAssetMock.mockRejectedValue(new Error("API error 404"));

      await expect(resolveStockLookup("MISS")).resolves.toEqual({
        status: "unsupported",
        ticker: "MISS",
        message:
          "MISS is outside the v1 coverage set. Only active U.S.-listed equities are supported right now.",
      });
    });

    it("returns unverified when the provider lookup fails unexpectedly", async () => {
      readAlpacaCredentialsMock.mockReturnValue({ key: "key", secret: "secret" });
      getAssetMock.mockRejectedValue(new Error("upstream timeout"));

      await expect(resolveStockLookup("AAPL")).resolves.toEqual({
        status: "unverified",
        ticker: "AAPL",
        message:
          "Ticker verification is temporarily unavailable. This URL remains stable, but coverage and company identity could not be confirmed.",
      });
    });
  });
});
