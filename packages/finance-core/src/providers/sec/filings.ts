import { failResult, okResult } from "../../errors";
import type { FilingType, FinanceCoreResult } from "../../types";
import {
  fetchSecSubmissions,
  fetchSecText,
  resolveSecCik,
  type SecClientCredentials,
  type SecSubmissionsPayload,
} from "./client";

type ListSecFilingsInput = {
  ticker: string;
  filingTypes?: FilingType[];
  limit: number;
  credentials?: SecClientCredentials;
};

type ReadSecFilingItemsInput = {
  ticker: string;
  filingType: FilingType;
  accessionNumber: string;
  items?: string[];
  maxChars?: number;
  credentials?: SecClientCredentials;
};

type SecFilingMetadata = {
  ticker: string;
  cik: string;
  accessionNumber: string;
  filingType: string;
  filingDate: string | null;
  reportDate: string | null;
  primaryDocument: string | null;
  filingUrl: string | null;
};

type SecFilingsPayload = Record<string, SecFilingMetadata[]>;

type SecFilingItemsPayload = Record<
  string,
  {
    accessionNumber: string;
    filingType: string;
    filingDate: string | null;
    reportDate: string | null;
    requestedItems: string[];
    itemTexts?: Record<string, string>;
    excerpt?: string;
    truncated: boolean;
  }
>;

function normalizeCik(cik: string): string {
  return String(Number(cik));
}

function toSecArchiveUrl(params: {
  cik: string;
  accessionNumber: string;
  primaryDocument: string;
}): string {
  const accessionNoDash = params.accessionNumber.replace(/-/g, "");
  return `https://www.sec.gov/Archives/edgar/data/${normalizeCik(params.cik)}/${accessionNoDash}/${params.primaryDocument}`;
}

function parseRecentFilings(
  submissionsPayload: SecSubmissionsPayload,
  ticker: string,
  cik: string,
): SecFilingMetadata[] {
  const recent = submissionsPayload.filings?.recent;
  if (!recent) {
    return [];
  }

  const form = recent.form;
  const accessionNumber = recent.accessionNumber;
  const filingDate = recent.filingDate;
  const reportDate = recent.reportDate;
  const primaryDocument = recent.primaryDocument;

  if (
    !Array.isArray(form) ||
    !Array.isArray(accessionNumber) ||
    !Array.isArray(filingDate) ||
    !Array.isArray(reportDate) ||
    !Array.isArray(primaryDocument)
  ) {
    return [];
  }

  const output: SecFilingMetadata[] = [];
  const size = Math.min(
    form.length,
    accessionNumber.length,
    filingDate.length,
    reportDate.length,
    primaryDocument.length,
  );

  for (let i = 0; i < size; i += 1) {
    const filingType = form[i];
    const accession = accessionNumber[i];
    const filedAt = filingDate[i];
    const reportedAt = reportDate[i];
    const doc = primaryDocument[i];

    if (typeof filingType !== "string" || typeof accession !== "string") {
      continue;
    }

    const filingUrl =
      typeof doc === "string"
        ? toSecArchiveUrl({
            cik,
            accessionNumber: accession,
            primaryDocument: doc,
          })
        : null;

    output.push({
      ticker,
      cik,
      accessionNumber: accession,
      filingType,
      filingDate: typeof filedAt === "string" ? filedAt : null,
      reportDate: typeof reportedAt === "string" ? reportedAt : null,
      primaryDocument: typeof doc === "string" ? doc : null,
      filingUrl,
    });
  }

  return output;
}

export async function listSecFilings(
  input: ListSecFilingsInput,
): Promise<FinanceCoreResult<SecFilingsPayload>> {
  const ticker = input.ticker.toUpperCase();
  const filingTypeSet = new Set<string>(input.filingTypes ?? []);

  try {
    const cik = await resolveSecCik(ticker, input.credentials);
    if (!cik) {
      return failResult(`Could not resolve SEC CIK for ticker ${ticker}.`);
    }

    const submissions = await fetchSecSubmissions(cik, input.credentials);
    const filings = parseRecentFilings(submissions.data, ticker, cik)
      .filter((entry) =>
        filingTypeSet.size > 0 ? filingTypeSet.has(entry.filingType) : true,
      )
      .slice(0, input.limit);

    return okResult(
      {
        [ticker]: filings,
      },
      {
        provenance: [
          {
            provider: "sec",
            ticker,
            url: submissions.url,
            retrievedAt: submissions.retrievedAt,
            asOfDate: filings[0]?.filingDate ?? undefined,
          },
        ],
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return failResult(message);
  }
}

function toPlainText(htmlOrText: string): string {
  return htmlOrText
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeItemMarker(item: string): string[] {
  const normalized = item.trim().toUpperCase().replace(/\s+/g, "");
  if (!normalized) {
    return [];
  }

  if (normalized.includes("PART-") || normalized.includes("PART,")) {
    const noHyphen = normalized.replace(/-/g, "");
    return [
      noHyphen.replace(",", " "),
      noHyphen.replace(",", ""),
      noHyphen.replace(",", " - "),
    ];
  }

  return [
    normalized.replace("ITEM-", "ITEM "),
    normalized.replace("ITEM-", "ITEM"),
  ];
}

function extractItemsFromText(params: {
  text: string;
  items: string[];
  maxChars: number;
}): Record<string, string> {
  const upperText = params.text.toUpperCase();
  const output: Record<string, string> = {};

  for (const item of params.items) {
    const markers = normalizeItemMarker(item);
    let start = -1;

    for (const marker of markers) {
      const idx = upperText.indexOf(marker);
      if (idx >= 0) {
        start = idx;
        break;
      }
    }

    if (start < 0) {
      continue;
    }

    const end = Math.min(start + params.maxChars, params.text.length);
    output[item] = params.text.slice(start, end);
  }

  return output;
}

export async function readSecFilingItems(
  input: ReadSecFilingItemsInput,
): Promise<FinanceCoreResult<SecFilingItemsPayload>> {
  const ticker = input.ticker.toUpperCase();
  const maxChars = input.maxChars ?? 12_000;

  try {
    const listResult = await listSecFilings({
      ticker,
      filingTypes: [input.filingType],
      limit: 25,
      credentials: input.credentials,
    });

    const filings = listResult.data?.[ticker];

    const target = filings?.find(
      (entry) => entry.accessionNumber === input.accessionNumber,
    );

    if (!target || !target.filingUrl) {
      return failResult(
        `Filing ${input.accessionNumber} was not found for ${ticker}.`,
      );
    }

    const filingDocument = await fetchSecText(
      target.filingUrl,
      input.credentials,
    );
    const text = toPlainText(filingDocument.data);
    const items = input.items && input.items.length > 0 ? input.items : [];

    const extractedItems =
      items.length > 0
        ? extractItemsFromText({ text, items, maxChars })
        : undefined;

    const fullExcerpt =
      items.length === 0 ? text.slice(0, maxChars) : undefined;

    let warningMessage: string | undefined;
    if (
      items.length > 0 &&
      (!extractedItems || Object.keys(extractedItems).length === 0)
    ) {
      warningMessage =
        "Requested filing items could not be located with parser heuristics; section extraction may be incomplete.";
    }

    return okResult(
      {
        [ticker]: {
          accessionNumber: target.accessionNumber,
          filingType: target.filingType,
          filingDate: target.filingDate,
          reportDate: target.reportDate,
          requestedItems: items,
          itemTexts: extractedItems,
          excerpt: fullExcerpt,
          truncated: text.length > maxChars,
        },
      },
      {
        message: warningMessage,
        provenance: [
          {
            provider: "sec",
            ticker,
            filingType: input.filingType,
            accessionNumber: target.accessionNumber,
            url: filingDocument.url,
            retrievedAt: filingDocument.retrievedAt,
            asOfDate: target.filingDate ?? undefined,
          },
        ],
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return failResult(message);
  }
}
