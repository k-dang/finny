import type { AlpacaCredentials } from "./types";

export async function requestAlpacaJson<T>(
  url: string,
  credentials: AlpacaCredentials,
): Promise<T> {
  const response = await fetch(url, {
    headers: {
      "APCA-API-KEY-ID": credentials.key,
      "APCA-API-SECRET-KEY": credentials.secret,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Alpaca API error ${response.status}: ${body}`);
  }

  return (await response.json()) as T;
}
