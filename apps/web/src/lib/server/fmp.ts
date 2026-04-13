export function readFmpApiKey(): string | null {
  return process.env.FMP_API_KEY ?? null;
}
