import { getOrderbookSummary } from "./clob";
import { DEFAULT_CLOB_BASE_URL, DEFAULT_GAMMA_BASE_URL } from "./constants";
import { getEventBySlug, listMarkets } from "./gamma";
import type { PolymarketClient, PolymarketClientOptions } from "./types";

export function createPolymarketClient(
  options: PolymarketClientOptions = {},
): PolymarketClient {
  const {
    gammaBaseUrl = DEFAULT_GAMMA_BASE_URL,
    clobBaseUrl = DEFAULT_CLOB_BASE_URL,
    fetchFn = fetch,
  } = options;

  return {
    listMarkets: (params) => listMarkets({ params, gammaBaseUrl, fetchFn }),
    getEventBySlug: (slug) => getEventBySlug({ slug, gammaBaseUrl, fetchFn }),
    getOrderbookSummary: (tokenId) =>
      getOrderbookSummary({ tokenId, clobBaseUrl, fetchFn }),
  };
}

export { PolymarketApiError } from "./http";
export type * from "./types";
