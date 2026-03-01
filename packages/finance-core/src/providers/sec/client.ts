type SecResponse<T> = {
  data: T;
  url: string;
  retrievedAt: string;
};

const SEC_TICKER_MAP_URL = "https://www.sec.gov/files/company_tickers.json";

type SecTickerMapRow = {
  cik_str: number;
  ticker: string;
  title: string;
};

type SecTickerMap = Record<string, SecTickerMapRow>;

export type SecRecentFilings = {
  form?: string[];
  accessionNumber?: string[];
  filingDate?: Array<string | null>;
  reportDate?: Array<string | null>;
  primaryDocument?: Array<string | null>;
};

export type SecSubmissionsPayload = {
  filings?: {
    recent?: SecRecentFilings;
  };
};

type SecRequestParams = {
  url: string;
  credentials?: SecClientCredentials;
};

type RequestSecParams<T> = {
  url: string;
  credentials?: SecClientCredentials;
  accept: string;
  parse: (response: Response) => Promise<T>;
};

export type SecClientCredentials = {
  userAgent?: string;
};

function getSecUserAgent(credentials?: SecClientCredentials): string {
  return credentials?.userAgent
    ? credentials.userAgent
    : "FinnyResearch/0.1 (opensource; contact: example@example.com)";
}

async function requestSec<T>(
  params: RequestSecParams<T>,
): Promise<SecResponse<T>> {
  const response = await fetch(params.url, {
    headers: {
      "User-Agent": getSecUserAgent(params.credentials),
      Accept: params.accept,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `HTTP ${response.status} for ${params.url}: ${body.slice(0, 300)}`,
    );
  }

  return {
    data: await params.parse(response),
    url: params.url,
    retrievedAt: new Date().toISOString(),
  };
}

async function requestSecJson<T>(
  params: SecRequestParams,
): Promise<SecResponse<T>> {
  return requestSec<T>({
    url: params.url,
    credentials: params.credentials,
    accept: "application/json, text/plain;q=0.9, */*;q=0.8",
    parse: (response) => response.json() as Promise<T>,
  });
}

export async function resolveSecCik(
  ticker: string,
  credentials?: SecClientCredentials,
): Promise<string | null> {
  const upperTicker = ticker.trim().toUpperCase();
  if (!upperTicker) {
    return null;
  }

  const { data } = await requestSecJson<SecTickerMap>({
    url: SEC_TICKER_MAP_URL,
    credentials,
  });

  for (const key in data) {
    const row = data[key];
    if (!row) {
      continue;
    }

    if (row.ticker.toUpperCase() === upperTicker) {
      return String(row.cik_str).padStart(10, "0");
    }
  }

  return null;
}

export async function fetchSecSubmissions(
  cik: string,
  credentials?: SecClientCredentials,
): Promise<SecResponse<SecSubmissionsPayload>> {
  return requestSecJson<SecSubmissionsPayload>({
    url: `https://data.sec.gov/submissions/CIK${cik}.json`,
    credentials,
  });
}

export async function fetchSecText(
  url: string,
  credentials?: SecClientCredentials,
): Promise<SecResponse<string>> {
  return requestSec<string>({
    url,
    credentials,
    accept: "text/html, text/plain;q=0.9, */*;q=0.8",
    parse: (response) => response.text(),
  });
}
