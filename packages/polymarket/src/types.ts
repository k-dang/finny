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

export type OrderbookSnapshot = {
  tokenId: string;
  bestBid: number | null;
  bestAsk: number | null;
  midpoint: number | null;
  spreadBps: number | null;
  timestamp: string;
};

export type MispricingConfidence = "low" | "medium" | "high";

export type MispricingSignal = {
  marketId: string;
  marketSlug: string;
  side: "YES" | "NO";
  marketProb: number;
  fairProbProxy: number;
  edgePct: number;
  mispricingScore: number;
  confidence: MispricingConfidence;
  rationale: string[];
  riskFlags: string[];
};

export type MispricingComponentScores = {
  spreadQuality: number;
  liquidityDepthQuality: number;
  momentumDislocation: number;
  relatedMarketConsistency: number;
  edgeMagnitude: number;
};

export type MispricingPenalties = {
  stalePenalty: number;
  lowActivityPenalty: number;
};

export type MispricingTrace = {
  marketId: string;
  marketSlug: string;
  marketProb: number;
  fairProbProxy: number;
  selectedSide: "YES" | "NO";
  edgePct: number;
  componentScores: MispricingComponentScores;
  penalties: MispricingPenalties;
  spreadBps: number | null;
  liquidity: number | null;
  volume24h: number | null;
  orderbookAgeMinutes: number | null;
  peerCount: number;
  partitionDislocation: number | null;
  rationale: string[];
  riskFlags: string[];
};

export type MispricingWeights = {
  spreadQuality: number;
  liquidityDepthQuality: number;
  momentumDislocation: number;
  relatedMarketConsistency: number;
  edgeMagnitude: number;
};

export type ScoringThresholds = {
  lowVolume24h: number;
  moderateVolume24h: number;
  staleAfterMinutes: number;
  veryStaleAfterMinutes: number;
};

export type ScoreMispricingInput = {
  market: PolymarketMarket;
  orderbook: OrderbookSnapshot | null;
  relatedMarkets: PolymarketMarket[];
  nowIso: string;
  timeHorizonHours: number;
};

export type RankMispricingSignalsInput = {
  candidates: Array<{
    market: PolymarketMarket;
    orderbook: OrderbookSnapshot | null;
    relatedMarkets: PolymarketMarket[];
  }>;
  nowIso: string;
  timeHorizonHours?: number;
  minVolume?: number;
  maxSpreadBps?: number;
  minEdgePct?: number;
  limit?: number;
  includeTrace?: boolean;
};

export type RankMispricingSignalsResult = {
  signals: MispricingSignal[];
  traces?: MispricingTrace[];
};
