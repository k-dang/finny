export type FetchLike = typeof fetch;

export type ListMarketsParams = {
  limit?: number;
  offset?: number;
  order?: string;
  ascending?: boolean;
  closed?: boolean;
  minVolume?: number;
  minLiquidity?: number;
};

export type ListEventsParams = {
  limit?: number;
  offset?: number;
  order?: string;
  ascending?: boolean;
  active?: boolean;
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
  oneHourPriceChange: number | null;
  oneDayPriceChange: number | null;
  oneWeekPriceChange: number | null;
  oneMonthPriceChange: number | null;
  lastTradePrice: number | null;
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
