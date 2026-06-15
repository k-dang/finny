export type AlpacaCredentials = {
  key: string;
  secret: string;
};

export type OptionType = "call" | "put";

export type LatestTrade = {
  t: string;
  p: number;
  x?: string;
  s?: number;
  c?: string[];
  i?: number;
  z?: string;
};

export type LatestTradesResponse = {
  trades: Record<string, LatestTrade>;
};

export type NormalizedPrice = {
  symbol: string;
  price: number;
  timestamp: string;
  exchange?: string;
};

export type OptionSnapshot = {
  latestQuote?: { bp: number; ap: number; bs: number; as: number; t: string };
  latestTrade?: { p: number; s: number; t: string };
  greeks?: {
    delta: number;
    gamma: number;
    theta: number;
    vega: number;
    rho: number;
  };
  impliedVolatility?: number;
};

export type OptionChainResponse = {
  snapshots: Record<string, OptionSnapshot>;
  next_page_token?: string | null;
};

export type NormalizedOption = {
  symbol: string;
  name: string;
  underlying: string;
  type: OptionType;
  strike: number;
  expiration: string;
  bid?: number;
  ask?: number;
  lastPrice?: number;
  impliedVolatility?: number;
  delta?: number;
  gamma?: number;
  theta?: number;
  vega?: number;
  rho?: number;
};
