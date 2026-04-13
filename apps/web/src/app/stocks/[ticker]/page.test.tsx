import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import StockPage from "./page";

const {
  permanentRedirectMock,
  getStockDashboardMock,
  normalizeTickerInputMock,
} = vi.hoisted(() => ({
  permanentRedirectMock: vi.fn(),
  getStockDashboardMock: vi.fn(),
  normalizeTickerInputMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  permanentRedirect: permanentRedirectMock,
}));

vi.mock("@/lib/stock-dashboard", () => ({
  getStockDashboard: getStockDashboardMock,
}));

vi.mock("@/lib/stocks", () => ({
  normalizeTickerInput: normalizeTickerInputMock,
}));

vi.mock("@/components/stock-dashboard-shell", () => ({
  StockDashboardShell: (props: {
    result: { ticker: string; status: string };
    quote: { status: string };
    fundamentals: { status: string };
    cashFlow: { status: string };
  }) => (
    <div>
      <h1>{props.result.ticker}</h1>
      <p>stock:{props.result.status}</p>
      <p>quote:{props.quote.status}</p>
      <p>fundamentals:{props.fundamentals.status}</p>
      <p>cash-flow:{props.cashFlow.status}</p>
    </div>
  ),
}));

describe("stocks/[ticker]/page", () => {
  it("redirects to the canonical uppercase route when the param is not normalized", async () => {
    const redirectError = new Error("redirect");
    permanentRedirectMock.mockImplementation(() => {
      throw redirectError;
    });
    normalizeTickerInputMock.mockReturnValue("AAPL");

    await expect(
      StockPage({
        params: Promise.resolve({ ticker: "aapl" }),
      }),
    ).rejects.toBe(redirectError);

    expect(permanentRedirectMock).toHaveBeenCalledWith("/stocks/AAPL");
    expect(getStockDashboardMock).not.toHaveBeenCalled();
  });

  it("renders the valid stock route for a supported ticker", async () => {
    normalizeTickerInputMock.mockReturnValue("AAPL");
    getStockDashboardMock.mockResolvedValue({
      stock: { status: "ready", ticker: "AAPL" },
      quote: { status: "success" },
      fundamentals: { status: "success" },
      cashFlow: { status: "success" },
    });

    render(
      await StockPage({
        params: Promise.resolve({ ticker: "AAPL" }),
      }),
    );

    expect(screen.getByRole("heading", { name: "AAPL" })).toBeTruthy();
    expect(screen.getByText("stock:ready")).toBeTruthy();
    expect(screen.getByText("quote:success")).toBeTruthy();
    expect(screen.getByText("fundamentals:success")).toBeTruthy();
    expect(screen.getByText("cash-flow:success")).toBeTruthy();
    expect(getStockDashboardMock).toHaveBeenCalledWith("AAPL");
  });

  it("renders the invalid ticker state instead of throwing", async () => {
    normalizeTickerInputMock.mockReturnValue("BAD!");
    getStockDashboardMock.mockResolvedValue({
      stock: { status: "invalid", ticker: "BAD!" },
      quote: { status: "empty" },
      fundamentals: { status: "empty" },
      cashFlow: { status: "empty" },
    });

    render(
      await StockPage({
        params: Promise.resolve({ ticker: "BAD!" }),
      }),
    );

    expect(screen.getByText("stock:invalid")).toBeTruthy();
    expect(screen.getByText("quote:empty")).toBeTruthy();
    expect(screen.getByText("fundamentals:empty")).toBeTruthy();
    expect(screen.getByText("cash-flow:empty")).toBeTruthy();
  });

  it("renders degraded section states for partially available dashboards", async () => {
    normalizeTickerInputMock.mockReturnValue("MSFT");
    getStockDashboardMock.mockResolvedValue({
      stock: { status: "unverified", ticker: "MSFT" },
      quote: { status: "partial" },
      fundamentals: { status: "error" },
      cashFlow: { status: "partial" },
    });

    render(
      await StockPage({
        params: Promise.resolve({ ticker: "MSFT" }),
      }),
    );

    expect(screen.getByText("stock:unverified")).toBeTruthy();
    expect(screen.getByText("quote:partial")).toBeTruthy();
    expect(screen.getByText("fundamentals:error")).toBeTruthy();
    expect(screen.getByText("cash-flow:partial")).toBeTruthy();
  });
});
