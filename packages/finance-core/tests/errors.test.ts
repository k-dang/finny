import { describe, expect, it } from "bun:test";
import { failResult, okResult } from "../src/errors";

describe("result helpers", () => {
  it("creates success result with defaults", () => {
    expect(okResult({ value: 42 })).toEqual({
      data: { value: 42 },
      error: false,
      message: undefined,
      provenance: undefined,
    });
  });

  it("creates success result with optional metadata", () => {
    expect(
      okResult([1, 2], {
        message: "ok",
        provenance: [
          {
            provider: "fmp",
            url: "https://example.test",
            retrievedAt: "2026-01-01T00:00:00.000Z",
          },
        ],
      }),
    ).toEqual({
      data: [1, 2],
      error: false,
      message: "ok",
      provenance: [
        {
          provider: "fmp",
          url: "https://example.test",
          retrievedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    });
  });

  it("creates failure result with default null data", () => {
    expect(failResult("boom")).toEqual({
      data: null,
      error: true,
      message: "boom",
      provenance: undefined,
    });
  });

  it("creates failure result with custom data and provenance", () => {
    expect(
      failResult("boom", {
        data: { retryable: true },
        provenance: [
          {
            provider: "sec",
            url: "https://sec.test",
            retrievedAt: "2026-01-01T00:00:00.000Z",
          },
        ],
      }),
    ).toEqual({
      data: { retryable: true },
      error: true,
      message: "boom",
      provenance: [
        {
          provider: "sec",
          url: "https://sec.test",
          retrievedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    });
  });
});
