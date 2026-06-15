export type {
  AlpacaMarketDataClient,
  AlpacaMarketDataService,
  AlpacaResult,
  LatestPricesPayload,
  OptionChainPayload,
} from "./service";

export type {
  AlpacaCredentials,
  NormalizedOption,
  NormalizedPrice,
  OptionType,
} from "./types";

export { createAlpacaClient, createAlpacaMarketDataService } from "./service";
