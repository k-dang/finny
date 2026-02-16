export type FetchLike = typeof fetch;

export type PolymarketClientOptions = {
  gammaBaseUrl?: string;
  clobBaseUrl?: string;
  fetchFn?: FetchLike;
};

export type ListMarketsParams = {
  limit?: number;
  offset?: number;
  order?: string;
  ascending?: boolean;
  closed?: boolean;
  minVolume?: number;
  minLiquidity?: number;
};

export type PolymarketMarket = {
  id: string;
  conditionId: string | null;
  slug: string | null;
  question: string | null;
  eventId: string | null;
  outcomes: string[];
  outcomePrices: number[];
  active: boolean;
  closed: boolean;
  acceptingOrders: boolean;
  endDate: string | null;
  volume: number | null;
  volume24hr: number | null;
  liquidity: number | null;
  bestBid: number | null;
  bestAsk: number | null;
  spread: number | null;
  clobTokenIds: string[];
};

export type PolymarketEvent = {
  id: string;
  slug: string | null;
  title: string | null;
  description: string | null;
  active: boolean;
  closed: boolean;
  endDate: string | null;
  volume: number | null;
  volume24hr: number | null;
  liquidity: number | null;
  markets: PolymarketMarket[];
};

export type PolymarketOrderLevel = {
  price: number;
  size: number;
};

export type PolymarketOrderbookSummary = {
  market: string;
  assetId: string;
  timestamp: string;
  hash: string;
  bids: PolymarketOrderLevel[];
  asks: PolymarketOrderLevel[];
  bestBid: number | null;
  bestAsk: number | null;
  minOrderSize: number | null;
  tickSize: number | null;
  negRisk: boolean;
};

export type PolymarketClient = {
  listMarkets: (params?: ListMarketsParams) => Promise<PolymarketMarket[]>;
  getEventBySlug: (slug: string) => Promise<PolymarketEvent>;
  getOrderbookSummary: (tokenId: string) => Promise<PolymarketOrderbookSummary>;
};
