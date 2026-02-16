import type {
  MispricingComponentScores,
  MispricingConfidence,
  MispricingPenalties,
  MispricingSignal,
  MispricingTrace,
  MispricingWeights,
  OrderbookSnapshot,
  PolymarketMarket,
  PolymarketOrderbookSummary,
  RankMispricingSignalsInput,
  RankMispricingSignalsResult,
  ScoreMispricingInput,
  ScoringThresholds,
} from "./types";

const DEFAULT_WEIGHTS: MispricingWeights = {
  spreadQuality: 0.23,
  liquidityDepthQuality: 0.25,
  momentumDislocation: 0.18,
  relatedMarketConsistency: 0.18,
  edgeMagnitude: 0.16,
};

const DEFAULT_THRESHOLDS: ScoringThresholds = {
  lowVolume24h: 250,
  moderateVolume24h: 2_500,
  staleAfterMinutes: 20,
  veryStaleAfterMinutes: 60,
};

const SCORE_EPSILON = 0.000_001;

type MarketProbabilitySnapshot = {
  marketProb: number;
  spreadBps: number | null;
};

type PartitionConsistency = {
  score: number;
  fairAdjustment: number;
  partitionDislocation: number | null;
  peerCount: number;
};

export function toOrderbookSnapshot(
  orderbook: PolymarketOrderbookSummary,
): OrderbookSnapshot {
  const bestBid = findBestBid(orderbook);
  const bestAsk = findBestAsk(orderbook);
  const midpoint =
    bestBid !== null && bestAsk !== null ? (bestBid + bestAsk) / 2 : null;
  const spreadBps =
    midpoint !== null && midpoint > 0 && bestBid !== null && bestAsk !== null
      ? ((bestAsk - bestBid) / midpoint) * 10_000
      : null;

  return {
    tokenId: orderbook.assetId,
    bestBid,
    bestAsk,
    midpoint: midpoint === null ? null : clampProbability(midpoint),
    spreadBps: spreadBps === null ? null : Math.max(0, spreadBps),
    timestamp: normalizeTimestamp(orderbook.timestamp),
  };
}

export function scoreMispricingCandidate(input: {
  market: ScoreMispricingInput["market"];
  orderbook: ScoreMispricingInput["orderbook"];
  relatedMarkets: ScoreMispricingInput["relatedMarkets"];
  nowIso: ScoreMispricingInput["nowIso"];
  timeHorizonHours: ScoreMispricingInput["timeHorizonHours"];
  weights?: MispricingWeights;
  thresholds?: ScoringThresholds;
}): {
  signal: MispricingSignal;
  trace: MispricingTrace;
} {
  const {
    market,
    orderbook,
    relatedMarkets,
    nowIso,
    timeHorizonHours,
    weights = DEFAULT_WEIGHTS,
    thresholds = DEFAULT_THRESHOLDS,
  } = input;

  const probability = resolveMarketProbability(market, orderbook);
  const marketProb = probability.marketProb;
  const spreadBps = probability.spreadBps;

  const momentum = computeMomentumDislocation(market, timeHorizonHours);
  const consistency = computePartitionConsistency(
    market,
    marketProb,
    relatedMarkets,
  );

  const fairProbProxy = clampProbability(
    marketProb + momentum.fairAdjustment + consistency.fairAdjustment,
  );
  const signedEdge = fairProbProxy - marketProb;
  const side: "YES" | "NO" = signedEdge >= 0 ? "YES" : "NO";
  const edgePct = Math.abs(signedEdge) * 100;

  const componentScores: MispricingComponentScores = {
    spreadQuality: scoreSpreadQuality(spreadBps),
    liquidityDepthQuality: scoreLiquidityDepthQuality(market, orderbook),
    momentumDislocation: momentum.score,
    relatedMarketConsistency: consistency.score,
    edgeMagnitude: clamp(edgePct / 4, 0, 1),
  };

  const penalties = computePenalties(market, orderbook, nowIso, thresholds);
  const penaltyTotal = penalties.stalePenalty + penalties.lowActivityPenalty;

  const weightedScore =
    componentScores.spreadQuality * weights.spreadQuality +
    componentScores.liquidityDepthQuality * weights.liquidityDepthQuality +
    componentScores.momentumDislocation * weights.momentumDislocation +
    componentScores.relatedMarketConsistency *
      weights.relatedMarketConsistency +
    componentScores.edgeMagnitude * weights.edgeMagnitude;

  const mispricingScore = clamp((weightedScore - penaltyTotal) * 100, 0, 100);
  const confidence = determineConfidence(
    mispricingScore,
    edgePct,
    penaltyTotal,
  );
  const rationale = buildRationale({
    edgePct,
    spreadBps,
    componentScores,
    partitionDislocation: consistency.partitionDislocation,
  });
  const riskFlags = buildRiskFlags({
    spreadBps,
    market,
    orderbook,
    nowIso,
    confidence,
    thresholds,
    hasMomentumData: momentum.hasData,
  });

  const signal: MispricingSignal = {
    marketId: market.id,
    marketSlug: market.slug ?? market.id,
    side,
    marketProb: round4(marketProb),
    fairProbProxy: round4(fairProbProxy),
    edgePct: round2(edgePct),
    mispricingScore: round2(mispricingScore),
    confidence,
    rationale,
    riskFlags,
  };

  const trace: MispricingTrace = {
    marketId: signal.marketId,
    marketSlug: signal.marketSlug,
    marketProb: signal.marketProb,
    fairProbProxy: signal.fairProbProxy,
    selectedSide: signal.side,
    edgePct: signal.edgePct,
    componentScores: {
      spreadQuality: round4(componentScores.spreadQuality),
      liquidityDepthQuality: round4(componentScores.liquidityDepthQuality),
      momentumDislocation: round4(componentScores.momentumDislocation),
      relatedMarketConsistency: round4(
        componentScores.relatedMarketConsistency,
      ),
      edgeMagnitude: round4(componentScores.edgeMagnitude),
    },
    penalties: {
      stalePenalty: round4(penalties.stalePenalty),
      lowActivityPenalty: round4(penalties.lowActivityPenalty),
    },
    spreadBps: spreadBps === null ? null : round2(spreadBps),
    liquidity: market.liquidity,
    volume24h: market.volume24hr,
    orderbookAgeMinutes: computeOrderbookAgeMinutes(orderbook, nowIso),
    peerCount: consistency.peerCount,
    partitionDislocation:
      consistency.partitionDislocation === null
        ? null
        : round4(consistency.partitionDislocation),
    rationale,
    riskFlags,
  };

  return { signal, trace };
}

export function rankMispricingSignals(
  input: RankMispricingSignalsInput,
): RankMispricingSignalsResult {
  const {
    candidates,
    nowIso,
    timeHorizonHours = 24,
    minVolume,
    maxSpreadBps,
    minEdgePct = 0,
    limit = 20,
    includeTrace = false,
  } = input;

  const scored: Array<{ signal: MispricingSignal; trace: MispricingTrace }> =
    [];

  for (const candidate of candidates) {
    if (
      minVolume !== undefined &&
      (candidate.market.volume24hr ?? Number.NEGATIVE_INFINITY) < minVolume
    ) {
      continue;
    }

    const previewSpread = resolveSpreadBps(
      candidate.market,
      candidate.orderbook,
    );
    if (
      maxSpreadBps !== undefined &&
      previewSpread !== null &&
      previewSpread > maxSpreadBps
    ) {
      continue;
    }

    const result = scoreMispricingCandidate({
      market: candidate.market,
      orderbook: candidate.orderbook,
      relatedMarkets: candidate.relatedMarkets,
      nowIso,
      timeHorizonHours,
    });

    if (result.signal.edgePct + SCORE_EPSILON < minEdgePct) {
      continue;
    }

    scored.push(result);
  }

  scored.sort((a, b) => {
    if (b.signal.mispricingScore !== a.signal.mispricingScore) {
      return b.signal.mispricingScore - a.signal.mispricingScore;
    }

    if (b.signal.edgePct !== a.signal.edgePct) {
      return b.signal.edgePct - a.signal.edgePct;
    }

    return a.signal.marketSlug.localeCompare(b.signal.marketSlug);
  });

  const trimmed = scored.slice(0, Math.max(0, limit));

  return {
    signals: trimmed.map((item) => item.signal),
    traces: includeTrace ? trimmed.map((item) => item.trace) : undefined,
  };
}

function findBestBid(orderbook: PolymarketOrderbookSummary): number | null {
  const levels = orderbook.bids;
  if (levels.length === 0) {
    return null;
  }

  let best = levels[0]?.price ?? null;
  for (const level of levels) {
    if (best === null || level.price > best) {
      best = level.price;
    }
  }

  return best;
}

function findBestAsk(orderbook: PolymarketOrderbookSummary): number | null {
  const levels = orderbook.asks;
  if (levels.length === 0) {
    return null;
  }

  let best = levels[0]?.price ?? null;
  for (const level of levels) {
    if (best === null || level.price < best) {
      best = level.price;
    }
  }

  return best;
}

function normalizeTimestamp(timestamp: string): string {
  const fromMillis = Number(timestamp);
  if (Number.isFinite(fromMillis) && fromMillis > 0) {
    return new Date(fromMillis).toISOString();
  }

  const parsed = Date.parse(timestamp);
  if (Number.isFinite(parsed)) {
    return new Date(parsed).toISOString();
  }

  return timestamp;
}

function resolveMarketProbability(
  market: PolymarketMarket,
  orderbook: OrderbookSnapshot | null,
): MarketProbabilitySnapshot {
  const outcomeProb = getYesProbability(market);
  const quoteMid =
    market.bestBid !== null && market.bestAsk !== null
      ? clampProbability((market.bestBid + market.bestAsk) / 2)
      : null;
  const orderbookMid = orderbook?.midpoint ?? null;

  const marketProb =
    orderbookMid !== null
      ? blend(orderbookMid, quoteMid ?? outcomeProb ?? orderbookMid, 0.55)
      : quoteMid !== null
        ? blend(quoteMid, outcomeProb ?? quoteMid, 0.7)
        : (outcomeProb ?? 0.5);

  return {
    marketProb: clampProbability(marketProb),
    spreadBps: resolveSpreadBps(market, orderbook),
  };
}

function resolveSpreadBps(
  market: PolymarketMarket,
  orderbook: OrderbookSnapshot | null,
): number | null {
  if (orderbook?.spreadBps !== null && orderbook?.spreadBps !== undefined) {
    return Math.max(0, orderbook.spreadBps);
  }

  if (market.spread !== null) {
    return Math.max(0, market.spread * 10_000);
  }

  if (market.bestBid !== null && market.bestAsk !== null) {
    const mid = (market.bestBid + market.bestAsk) / 2;
    if (mid > 0) {
      return Math.max(0, ((market.bestAsk - market.bestBid) / mid) * 10_000);
    }
  }

  return null;
}

function getYesProbability(market: PolymarketMarket): number | null {
  const { outcomes, outcomePrices } = market;

  if (outcomePrices.length === 0) {
    return null;
  }

  const yesIndex = outcomes.findIndex(
    (outcome) => outcome.trim().toUpperCase() === "YES",
  );

  const index = yesIndex >= 0 ? yesIndex : 0;
  const candidate = outcomePrices[index] ?? null;
  if (candidate === null) {
    return null;
  }

  return clampProbability(candidate);
}

function computeMomentumDislocation(
  market: PolymarketMarket,
  timeHorizonHours: number,
): {
  score: number;
  fairAdjustment: number;
  hasData: boolean;
} {
  const oneHour = market.oneHourPriceChange;
  const oneDay = market.oneDayPriceChange;

  if (oneHour === null && oneDay === null) {
    return {
      score: 0,
      fairAdjustment: 0,
      hasData: false,
    };
  }

  const horizon = clamp(timeHorizonHours, 1, 168);
  const hourWeight = clamp(0.8 - (horizon - 1) / 120, 0.2, 0.8);
  const dayWeight = 1 - hourWeight;

  const composite =
    (oneHour ?? 0) * hourWeight + (oneDay ?? oneHour ?? 0) * dayWeight;

  return {
    score: clamp(Math.abs(composite) / 0.06, 0, 1),
    fairAdjustment: clamp(-composite * 0.35, -0.12, 0.12),
    hasData: true,
  };
}

function computePartitionConsistency(
  market: PolymarketMarket,
  marketProb: number,
  relatedMarkets: PolymarketMarket[],
): PartitionConsistency {
  const peers = dedupeById([market, ...relatedMarkets]).filter(
    (item) => item.active && !item.closed,
  );

  if (peers.length < 3) {
    return {
      score: 0,
      fairAdjustment: 0,
      partitionDislocation: null,
      peerCount: Math.max(0, peers.length - 1),
    };
  }

  const probabilities = peers.map(getYesProbability).filter(notNull);
  if (probabilities.length < 3) {
    return {
      score: 0,
      fairAdjustment: 0,
      partitionDislocation: null,
      peerCount: Math.max(0, peers.length - 1),
    };
  }

  const sum = probabilities.reduce((acc, value) => acc + value, 0);

  if (sum < 0.6 || sum > 1.4) {
    return {
      score: 0,
      fairAdjustment: 0,
      partitionDislocation: null,
      peerCount: Math.max(0, peers.length - 1),
    };
  }

  const dislocation = 1 - sum;
  const share = clamp(marketProb / Math.max(sum, SCORE_EPSILON), 0.05, 0.95);

  return {
    score: clamp(Math.abs(dislocation) / 0.25, 0, 1),
    fairAdjustment: clamp(dislocation * share * 0.75, -0.2, 0.2),
    partitionDislocation: dislocation,
    peerCount: Math.max(0, peers.length - 1),
  };
}

function scoreSpreadQuality(spreadBps: number | null): number {
  if (spreadBps === null) {
    return 0.2;
  }

  return 1 - clamp((spreadBps - 25) / 475, 0, 1);
}

function scoreLiquidityDepthQuality(
  market: PolymarketMarket,
  orderbook: OrderbookSnapshot | null,
): number {
  const liquidityScore =
    market.liquidity === null
      ? 0
      : clamp(Math.log10(market.liquidity + 1) / 5, 0, 1);
  const volumeScore =
    market.volume24hr === null
      ? 0
      : clamp(Math.log10(market.volume24hr + 1) / 6, 0, 1);

  const twoSided =
    (orderbook?.bestBid !== null && orderbook?.bestAsk !== null) ||
    (market.bestBid !== null && market.bestAsk !== null)
      ? 1
      : 0;

  return clamp(
    liquidityScore * 0.55 + volumeScore * 0.3 + twoSided * 0.15,
    0,
    1,
  );
}

function computePenalties(
  market: PolymarketMarket,
  orderbook: OrderbookSnapshot | null,
  nowIso: string,
  thresholds: ScoringThresholds,
): MispricingPenalties {
  let lowActivityPenalty = 0;
  if (
    market.volume24hr === null ||
    market.volume24hr < thresholds.lowVolume24h
  ) {
    lowActivityPenalty = 0.16;
  } else if (market.volume24hr < thresholds.moderateVolume24h) {
    lowActivityPenalty = 0.08;
  }

  const ageMinutes = computeOrderbookAgeMinutes(orderbook, nowIso);
  let stalePenalty = 0;
  if (ageMinutes === null) {
    stalePenalty = 0.04;
  } else if (ageMinutes >= thresholds.veryStaleAfterMinutes) {
    stalePenalty = 0.14;
  } else if (ageMinutes >= thresholds.staleAfterMinutes) {
    stalePenalty = 0.07;
  }

  return {
    stalePenalty,
    lowActivityPenalty,
  };
}

function computeOrderbookAgeMinutes(
  orderbook: OrderbookSnapshot | null,
  nowIso: string,
): number | null {
  if (!orderbook) {
    return null;
  }

  const orderbookTime = Date.parse(orderbook.timestamp);
  const nowTime = Date.parse(nowIso);
  if (!Number.isFinite(orderbookTime) || !Number.isFinite(nowTime)) {
    return null;
  }

  return round2(Math.max(0, (nowTime - orderbookTime) / 60_000));
}

function determineConfidence(
  score: number,
  edgePct: number,
  penalties: number,
): MispricingConfidence {
  if (score >= 70 && edgePct >= 1.5 && penalties < 0.09) {
    return "high";
  }

  if (score >= 45 && edgePct >= 0.75) {
    return "medium";
  }

  return "low";
}

function buildRationale(input: {
  edgePct: number;
  spreadBps: number | null;
  componentScores: MispricingComponentScores;
  partitionDislocation: number | null;
}): string[] {
  const { edgePct, spreadBps, componentScores, partitionDislocation } = input;

  const rationale: string[] = [];

  if (edgePct >= 0.75) {
    rationale.push(
      `Fair-value proxy diverges from market by ${round2(edgePct)}%.`,
    );
  }

  if (spreadBps !== null && componentScores.spreadQuality >= 0.65) {
    rationale.push(`Spread quality is favorable (${round0(spreadBps)} bps).`);
  }

  if (componentScores.liquidityDepthQuality >= 0.6) {
    rationale.push("Liquidity and two-sided depth support executable pricing.");
  }

  if (componentScores.momentumDislocation >= 0.45) {
    rationale.push(
      "Recent short-term move looks dislocated versus microstructure baseline.",
    );
  }

  if (
    partitionDislocation !== null &&
    componentScores.relatedMarketConsistency >= 0.35
  ) {
    rationale.push(
      `Related market partition drift is ${round2(Math.abs(partitionDislocation) * 100)}%.`,
    );
  }

  if (rationale.length === 0) {
    rationale.push(
      "Composite microstructure signals indicate a modest opportunity.",
    );
  }

  return rationale;
}

function buildRiskFlags(input: {
  spreadBps: number | null;
  market: PolymarketMarket;
  orderbook: OrderbookSnapshot | null;
  nowIso: string;
  confidence: MispricingConfidence;
  thresholds: ScoringThresholds;
  hasMomentumData: boolean;
}): string[] {
  const {
    spreadBps,
    market,
    orderbook,
    nowIso,
    confidence,
    thresholds,
    hasMomentumData,
  } = input;

  const riskFlags: string[] = [];

  if (spreadBps === null) {
    riskFlags.push("missing spread data");
  } else if (spreadBps > 400) {
    riskFlags.push("wide spread execution risk");
  }

  if (market.liquidity === null || market.liquidity < 1_000) {
    riskFlags.push("thin liquidity");
  }

  if (
    market.volume24hr === null ||
    market.volume24hr < thresholds.lowVolume24h
  ) {
    riskFlags.push("low 24h activity");
  }

  const ageMinutes = computeOrderbookAgeMinutes(orderbook, nowIso);
  if (ageMinutes !== null && ageMinutes >= thresholds.veryStaleAfterMinutes) {
    riskFlags.push("stale orderbook snapshot");
  }

  if (!hasMomentumData) {
    riskFlags.push("limited momentum history");
  }

  if (confidence === "low") {
    riskFlags.push("low confidence signal");
  }

  if (riskFlags.length === 0) {
    riskFlags.push("educational signal only");
  }

  return riskFlags;
}

function dedupeById(markets: PolymarketMarket[]): PolymarketMarket[] {
  const seen = new Set<string>();
  const output: PolymarketMarket[] = [];

  for (const market of markets) {
    if (seen.has(market.id)) {
      continue;
    }
    seen.add(market.id);
    output.push(market);
  }

  return output;
}

function blend(left: number, right: number, leftWeight: number): number {
  return left * leftWeight + right * (1 - leftWeight);
}

function clampProbability(value: number): number {
  return clamp(value, 0.01, 0.99);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round0(value: number): number {
  return Math.round(value);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

function notNull<T>(value: T | null): value is T {
  return value !== null;
}
