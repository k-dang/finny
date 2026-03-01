type FmpResponse<T> = {
  data: T;
  url: string;
  retrievedAt: string;
};

const DEFAULT_FMP_STABLE_BASE_URL = "https://financialmodelingprep.com/stable";

type FmpRequestParams = {
  path: string;
  query?: Record<string, string | number | undefined>;
  apiKey?: string;
};

function buildUrl(params: FmpRequestParams, apiKey: string): string {
  const url = new URL(`${DEFAULT_FMP_STABLE_BASE_URL}${params.path}`);
  for (const [key, value] of Object.entries(params.query ?? {})) {
    if (value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  }

  url.searchParams.set("apikey", apiKey);
  return url.toString();
}

export function getFmpApiKey(apiKey?: string): string {
  if (!apiKey) {
    throw new Error("Missing FMP_API_KEY credential.");
  }

  return apiKey;
}

export async function requestFmpJson<T>(
  params: FmpRequestParams,
): Promise<FmpResponse<T>> {
  const apiKey = getFmpApiKey(params.apiKey);
  const url = buildUrl(params, apiKey);

  const response = await fetch(url);

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `HTTP ${response.status} for ${url}: ${body.slice(0, 300)}`,
    );
  }

  return {
    data: (await response.json()) as T,
    url,
    retrievedAt: new Date().toISOString(),
  };
}
