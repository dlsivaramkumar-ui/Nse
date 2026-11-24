import {
  AdaptiveBrainDecision,
  Candle,
  EarlyAccumulationRadar,
  FiveDayBaseProfile,
  FiveDayPriorityTier,
  HardFilterStatus,
  HistoricalDaySummary,
  MarketRegime,
  OverallScoreBreakdown,
  PersistenceScoreBreakdown,
  PivotPoints,
  QualificationMetadata,
  SignalStage,
  SituationalArchetypeCode,
  SituationalIntelligenceProfile,
  StockIndicatorData,
  TradePlan
} from '../types';
import { getISTCurrentMinutes, isNSEMarketOpenNow, parseISTTimeToMinutes, getSessionElapsedFraction } from '../utils/istTime';
import { formatIndianVolume, formatAdvShort } from '../utils/volumeUtils';

// Standard Exponential Moving Average calculation
export function calculateEMA(prices: number[], period: number): number[] {
  if (prices.length === 0) return [];
  const k = 2 / (period + 1);
  const emaArray: number[] = [prices[0]];
  for (let i = 1; i < prices.length; i++) {
    const val = prices[i] * k + emaArray[i - 1] * (1 - k);
    emaArray.push(val);
  }
  return emaArray;
}

// Average True Range (ATR)
export function calculateATR(candles: Candle[], period = 14): number {
  if (candles.length < 2) return 1.0;
  const trueRanges: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const high = candles[i].high;
    const low = candles[i].low;
    const prevClose = candles[i - 1].close;
    const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
    trueRanges.push(tr);
  }
  const slice = trueRanges.slice(-period);
  const sum = slice.reduce((a, b) => a + b, 0);
  return Number((sum / slice.length).toFixed(2));
}

/**
 * Calculates RVOL with precision and sanity checks.
 * currentVolume: Current cumulative volume
 * historicalVolumes: List of daily volume data
 * period: Average period (e.g., 20 days)
 */
export function calculateRvol(currentVolume: number, historicalVolumes: number[], period: number = 20): number {
  // 1. Zero division check
  if (!historicalVolumes || historicalVolumes.length === 0 || period === 0) {
    return 0.0;
  }

  // 2. Average volume calculation
  const slice = historicalVolumes.slice(0, period);
  const sum = slice.reduce((acc, vol) => acc + vol, 0);
  const avgVolume = sum / slice.length;

  if (avgVolume === 0) {
    return 0.0;
  }

  // 3. RVOL calculation
  let rvol = currentVolume / avgVolume;

  // 4. Sanity check (to avoid outliers)
  // Cap RVOL at 50.0 if it exceeds it
  if (rvol > 50.0) {
    rvol = 50.0;
  }

  return Number(rvol.toFixed(2));
}

/**
 * Calculates Intraday RVOL using TradingView style.
 * currentCumulativeVolume: Cumulative volume since market open
 * historicalTimeOfDayVolumes: List of cumulative volumes up to the same time of day in previous 20 days
 */
export function calculateIntradayRvol(
  currentCumulativeVolume: number,
  historicalTimeOfDayVolumes: number[]
): number {
  // 1. Check for empty list
  if (!historicalTimeOfDayVolumes || historicalTimeOfDayVolumes.length === 0) {
    return 0.0;
  }

  // 2. Average volume calculation (np.mean)
  const sum = historicalTimeOfDayVolumes.reduce((acc, vol) => acc + vol, 0);
  const avgVolume = sum / historicalTimeOfDayVolumes.length;

  if (avgVolume === 0) {
    return 0.0;
  }

  // 3. RVOL calculation
  let rvol = currentCumulativeVolume / avgVolume;

  // 4. Sanity check (Cap at 50.0)
  if (rvol > 50.0) {
    rvol = 50.0;
  }

  return Number(rvol.toFixed(2));
}

// ==========================================
// 1. కాన్ఫిగరేషన్ & యూనిట్ ఫ్యాక్టర్స్
// ==========================================
export const UNIT_FACTORS: Record<string, number> = {
  shares: 1.0,
  L: 100000.0,
  M: 1000000.0,
  Cr: 10000000.0,
};

/**
 * ఇంట్రాడే స్కానర్ల కోసం కచ్చితమైన Time-of-Day RVOL ఇంజిన్.
 * (Accurate Time-of-Day RVOL Engine for Intraday Scanners)
 */
export function calculateIntradayRvolEngine(params: {
  currentCumulativeVolume: number;
  historicalTimeOfDayVolumes: number[];
  currentUnit?: string;
  historicalUnit?: string;
  minPeriods?: number;
  capLimit?: number;
}) {
  const {
    currentCumulativeVolume,
    historicalTimeOfDayVolumes,
    currentUnit = 'shares',
    historicalUnit = 'shares',
    minPeriods = 20,
    capLimit = 50.0,
  } = params;

  if (historicalTimeOfDayVolumes.length < minPeriods) {
    return {
      raw_rvol: null,
      capped_rvol: null,
      status: 'INSUFFICIENT_HISTORY',
      available_periods: historicalTimeOfDayVolumes.length,
      required_periods: minPeriods,
    };
  }

  const currentFactor = UNIT_FACTORS[currentUnit] || 1.0;
  const historicalFactor = UNIT_FACTORS[historicalUnit] || 1.0;

  const currentShares = currentCumulativeVolume * currentFactor;
  const historicalShares = historicalTimeOfDayVolumes.map(v => v * historicalFactor);
  
  const sum = historicalShares.reduce((acc, vol) => acc + vol, 0);
  const avgBaselineShares = sum / historicalShares.length;

  if (avgBaselineShares === 0) {
    return {
      raw_rvol: null,
      capped_rvol: null,
      status: 'ZERO_BASELINE',
      available_periods: historicalTimeOfDayVolumes.length,
      required_periods: minPeriods,
    };
  }

  const raw_rvol = currentShares / avgBaselineShares;
  const capped_rvol = Math.min(raw_rvol, capLimit);

  return {
    raw_rvol: Number(raw_rvol.toFixed(2)),
    capped_rvol: Number(capped_rvol.toFixed(2)),
    status: 'OK',
    current_shares: Math.round(currentShares),
    avg_baseline_shares: Math.round(avgBaselineShares),
    available_periods: historicalTimeOfDayVolumes.length,
    required_periods: minPeriods,
    is_capped: raw_rvol > capLimit,
  };
}

/**
 * BAHUBALI ట్రేడ్ ఫిల్టర్ & ఎగ్జిక్యూషన్ లాజిక్
 * (BAHUBALI Trade Filter & Execution Logic)
 * RVOL, ధర స్ట్రక్చర్, విక్ ప్రెజర్ మరియు రిస్క్-రివార్డ్ ఆధారంగా ట్రేడ్ నిర్ణయం.
 */
export function evaluateBahubaliSignal(params: {
  rvolStatus: string;
  rawRvol: number | null;
  ltp: number;
  vwap: number;
  dayOpen: number;
  dayHigh: number;
  candleOpen: number;
  candleHigh: number;
  candleLow: number;
  candleClose: number;
  atr14: number;
  dayTurnoverCr: number;
  minTurnoverCr?: number;
}) {
  const {
    rvolStatus,
    rawRvol,
    ltp,
    vwap,
    dayOpen,
    dayHigh,
    candleOpen,
    candleHigh,
    candleLow,
    candleClose,
    atr14,
    dayTurnoverCr,
    minTurnoverCr = 5.0,
  } = params;

  if (rvolStatus !== 'OK' || rawRvol === null) {
    return { decision: 'REJECT' as const, reason: `RVOL_${rvolStatus}` };
  }

  if (dayTurnoverCr < minTurnoverCr) {
    return { decision: 'REJECT' as const, reason: 'LOW_LIQUIDITY' };
  }

  if (ltp <= vwap || ltp <= dayOpen) {
    return { decision: 'REJECT' as const, reason: 'BELOW_VWAP_OR_OPEN' };
  }

  const candleRange = candleHigh - candleLow;
  if (candleRange > 0) {
    const upperWick = candleHigh - Math.max(candleOpen, candleClose);
    if (upperWick / candleRange > 0.35) {
      return { decision: 'REJECT' as const, reason: 'HIGH_SELLING_WICK' };
    }
  }

  if ((dayHigh - ltp) / dayHigh > 0.015) {
    return { decision: 'REJECT' as const, reason: 'FAR_FROM_DAY_HIGH' };
  }

  const stopLoss = Number(Math.max(vwap - 0.2 * atr14, ltp - 1.5 * atr14).toFixed(2));
  const risk = ltp - stopLoss;

  if (risk <= 0) {
    return { decision: 'REJECT' as const, reason: 'INVALID_RISK_PROFILE' };
  }

  if (rawRvol < 1.3) {
    return { decision: 'REJECT' as const, reason: 'INSUFFICIENT_RVOL' };
  }

  const setup = rawRvol <= 10.0 ? 'CONFIRMED_INSTITUTIONAL_BREAKOUT' : 'EXPLOSIVE_MOMENTUM_RUNNER';

  return {
    decision: 'STRONG_BUY' as const,
    setup,
    entry_price: ltp,
    stop_loss: stopLoss,
    target_1: Number((ltp + 1.5 * risk).toFixed(2)),
    target_2: Number((ltp + 2.5 * risk).toFixed(2)),
    rvol: rawRvol,
  };
}

// Pivot Points (Classic and Fibonacci)
export function calculatePivotPoints(high: number, low: number, close: number): PivotPoints {
  const p = (high + low + close) / 3;
  const range = high - low;

  // Classic
  const r1 = 2 * p - low;
  const s1 = 2 * p - high;
  const r2 = p + range;
  const s2 = p - range;
  const r3 = high + 2 * (p - low);
  const s3 = low - 2 * (high - p);

  // Fibonacci
  const fibR1 = p + 0.382 * range;
  const fibR2 = p + 0.618 * range;
  const fibR3 = p + 1.0 * range;
  const fibS1 = p - 0.382 * range;
  const fibS2 = p - 0.618 * range;
  const fibS3 = p - 1.0 * range;

  return {
    pivot: Number(p.toFixed(2)),
    r1: Number(r1.toFixed(2)),
    r2: Number(r2.toFixed(2)),
    r3: Number(r3.toFixed(2)),
    s1: Number(s1.toFixed(2)),
    s2: Number(s2.toFixed(2)),
    s3: Number(s3.toFixed(2)),
    fibR1: Number(fibR1.toFixed(2)),
    fibR2: Number(fibR2.toFixed(2)),
    fibR3: Number(fibR3.toFixed(2)),
    fibS1: Number(fibS1.toFixed(2)),
    fibS2: Number(fibS2.toFixed(2)),
    fibS3: Number(fibS3.toFixed(2)),
  };
}

// Market Efficiency / Choppiness Filter
// Returns value from 0 (very choppy) to 1 (clean directional momentum)
export function calculateEfficiencyRatio(candles: Candle[], lookback = 10): number {
  if (candles.length < lookback) return 0.7;
  const slice = candles.slice(-lookback);
  const netDisplacement = Math.abs(slice[slice.length - 1].close - slice[0].close);
  let totalPath = 0;
  for (let i = 1; i < slice.length; i++) {
    totalPath += Math.abs(slice[i].close - slice[i - 1].close);
  }
  if (totalPath === 0) return 0.5;
  return Math.min(1.0, netDisplacement / totalPath);
}

// Check for Higher Low Structure in 5M chart (supports both recent swing lows and full-session staircase progression)
export function checkHigherLowStructure(candles: Candle[]): boolean {
  if (candles.length < 8) return true;
  // 1. Check multi-segment session progression (if intraday segments show rising lows across the day)
  if (candles.length >= 20) {
    const qLen = Math.floor(candles.length / 4);
    const segLows = [0, 1, 2, 3].map((q) => {
      const sl = candles.slice(q * qLen, q === 3 ? candles.length : (q + 1) * qLen);
      return Math.min(...sl.map((c) => c.low));
    });
    if (segLows[3] >= segLows[2] * 0.994 && segLows[2] >= segLows[1] * 0.994 && segLows[1] >= segLows[0]) {
      return true;
    }
  }
  // 2. Look at recent 12-bar troughs
  const recent = candles.slice(-12);
  const lows: number[] = [];
  for (let i = 1; i < recent.length - 1; i++) {
    if (recent[i].low <= recent[i - 1].low && recent[i].low <= recent[i + 1].low) {
      lows.push(recent[i].low);
    }
  }
  if (lows.length >= 2) {
    return lows[lows.length - 1] >= lows[lows.length - 2] * 0.996;
  }
  return recent[recent.length - 1].low >= recent[0].low * 0.996;
}

//Deterministic helper to synthesize realistic 5-day prior history when live Yahoo 3mo daily bars are not yet loaded
function buildDefaultLast5Days(
  symbol: string,
  prevClose: number,
  effectiveAdv: number,
  currentVolume: number,
  rvol: number
): HistoricalDaySummary[] {
  let seed = (symbol || 'STOCK').split('').reduce((acc, ch, i) => acc + ch.charCodeAt(0) * (i + 1), 17);
  const nextRand = () => {
    const x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
  };

  // Distribute realistic 5-day prior profiles across the universe so Tier 1, Tier 2, Tier 3 are accurately represented
  const bucket = seed % 10;
  const days: HistoricalDaySummary[] = [];
  let runningClose = prevClose > 0 ? prevClose * 0.96 : 100;

  for (let d = 0; d < 5; d++) {
    const r = nextRand();
    let chgPct = 0;
    if (bucket <= 3) {
      // Tier 1 archetype: all 5 days < 2% price gain (-1.2% to +1.85%)
      chgPct = Number((-1.1 + r * 2.9).toFixed(2));
      if (chgPct >= 2.0) chgPct = 1.85;
    } else if (bucket <= 6) {
      // Tier 2 archetype: 4 days < 2%, 1 day > 2% (e.g. +2.3% to +3.4%)
      if (d === 2) {
        chgPct = Number((2.15 + r * 1.35).toFixed(2));
      } else {
        chgPct = Number((-0.9 + r * 2.65).toFixed(2));
        if (chgPct >= 2.0) chgPct = 1.75;
      }
    } else if (bucket <= 8) {
      // Tier 3 archetype: 1 day > 3%, 1 day 2%..3% (e.g. 2.5%), remaining 3 days < 2%
      if (d === 1) {
        chgPct = Number((3.15 + r * 1.4).toFixed(2));
      } else if (d === 3) {
        chgPct = Number((2.15 + r * 0.75).toFixed(2)); // ~2.5% (< 3%)
      } else {
        chgPct = Number((-0.8 + r * 2.5).toFixed(2));
        if (chgPct >= 2.0) chgPct = 1.65;
      }
    } else {
      // Standard / multi-day extended runner
      chgPct = Number((1.2 + r * 3.5).toFixed(2));
    }

    const dayPrev = Number(runningClose.toFixed(2));
    const dayClose = Number((dayPrev * (1 + chgPct / 100)).toFixed(2));
    runningClose = dayClose;

    // Prior 5 days volume: quiet accumulation base (55% to 88% of ADV, or lower than today's breakout volume)
    const volFactor = 0.55 + nextRand() * 0.32;
    const dayVol = Math.max(1000, Math.round(effectiveAdv * volFactor));

    days.push({
      dateStr: `D-${5 - d}`,
      close: dayClose,
      prevClose: dayPrev,
      changePercent: chgPct,
      volume: dayVol,
      isVerifiedReal: false,
    });
  }

  return days;
}

/**
 * Evaluates the User's 5-Day Low Volume + Price Change Priority System for Qualified Stocks:
 * - Volume Condition (Common to P1, P2, P3): Last 5 days volume is low comparative to today's breakout volume.
 * - Priority 1 (1st Priority): All 5 days price gain < 2.0%
 * - Priority 2 (2nd Priority): 4 days price gain < 2.0%, and 1 day > 2.0%
 * - Priority 3 (3rd Priority): 3 days price gain < 2.0%, 1 day between 2.0% and 3.0% (e.g. 2.5%), and 1 day > 3.0% (i.e. 4 days <= 3.0% and 1 day > 3.0%)
 */
export function evaluateFiveDayBaseProfile(params: {
  symbol: string;
  prevClose: number;
  currentVolume: number;
  effectiveAdv: number;
  expectedSessionVolume: number;
  rvol: number;
  rawSessionRvol?: number;
  totalScore?: number;
  changePercent?: number;
  isQualified: boolean;
  inputLast5Days?: HistoricalDaySummary[];
  isMorningSpikeAndStagnate?: boolean;
  isSmoothStaircaseUptrend?: boolean;
  isFirstHourHyperSpike?: boolean;
  total5MCandles?: number;
  buyerPressurePercent?: number;
  cvdTrend?: 'RISING' | 'NEUTRAL' | 'FALLING';
}): FiveDayBaseProfile {
  const {
    symbol,
    prevClose,
    currentVolume,
    effectiveAdv,
    expectedSessionVolume,
    rvol,
    rawSessionRvol,
    totalScore = 85,
    changePercent = 0,
    isQualified,
    inputLast5Days,
    isMorningSpikeAndStagnate = false,
    isSmoothStaircaseUptrend = false,
    isFirstHourHyperSpike = false,
    total5MCandles = 30,
    buyerPressurePercent = 55,
    cvdTrend = 'RISING',
  } = params;

  // Strict Verification Gate: Only real historical OHLCV bars (not synthetic D-1..D-5 placeholders) count as verified!
  const hasVerified5DayData = Boolean(
    inputLast5Days &&
      inputLast5Days.length >= 3 &&
      inputLast5Days.every((d) => d.isVerifiedReal !== false && !String(d.dateStr || '').startsWith('D-'))
  );
  const rawDays = hasVerified5DayData
    ? inputLast5Days!.slice(-5)
    : buildDefaultLast5Days(symbol, prevClose, effectiveAdv, currentVolume, rvol);

  const avg5DayVolume =
    rawDays.length > 0
      ? Math.round(rawDays.reduce((sum, d) => sum + (d.volume || 0), 0) / rawDays.length)
      : effectiveAdv;

  // Context-Aware 5-Day Max Volume:
  // Exclude bearish shakeout days (changePercent <= -1.0%) AND flat accumulation days (<= +1.2%)
  const bullishRallyDays = rawDays.filter((d) => {
    const effPct =
      d.intradaySpikePct !== undefined && d.upperWickRatio !== undefined && d.intradaySpikePct >= 4.5 && d.upperWickRatio >= 0.55
        ? Math.max(d.changePercent || 0, d.intradaySpikePct * 0.72)
        : d.changePercent || 0;
    return effPct >= 2.0;
  });
  const maxBullishRally5DVol =
    bullishRallyDays.length > 0
      ? bullishRallyDays.reduce((maxV, d) => Math.max(maxV, d.volume || 0), 0)
      : 0;
  const bullishOrNeutralDays = rawDays.filter((d) => (d.changePercent || 0) > -1.2);
  const max5DayVolume =
    bullishOrNeutralDays.length > 0
      ? bullishOrNeutralDays.reduce((maxV, d) => Math.max(maxV, d.volume || 0), 0)
      : rawDays.length > 0
      ? rawDays.reduce((maxV, d) => Math.max(maxV, d.volume || 0), 0)
      : effectiveAdv;

  // Use safe time-pro-rated volume projection (floor expFrac at 0.16 early morning so 09:15-09:35 AM doesn't inflate 12.5x!)
  const trueRvol =
    rawSessionRvol !== undefined
      ? rawSessionRvol
      : expectedSessionVolume > 0
      ? Number((currentVolume / expectedSessionVolume).toFixed(2))
      : rvol;
  const isMarketLive = isNSEMarketOpenNow();
  const isEarlyOrMidSession = isMarketLive || total5MCandles < 55;
  const tFrac = Math.min(1, Math.max(0.08, total5MCandles / 75));
  const rawExpFrac = 0.65 * tFrac + 0.35 * Math.pow(tFrac, 0.75);
  const safeExpFrac = total5MCandles <= 8 ? Math.max(0.16, rawExpFrac) : Math.max(0.12, Math.min(1, rawExpFrac));
  const projectedTodayVolume = isEarlyOrMidSession
    ? Math.max(currentVolume, Math.round(currentVolume / safeExpFrac), Math.round(effectiveAdv * trueRvol))
    : currentVolume;
  const volumeVsTodayRatio = avg5DayVolume > 0 ? Number((projectedTodayVolume / avg5DayVolume).toFixed(2)) : 1.0;

  // STRICT 5-DAY LOW VOLUME CONDITION (Fixes OR-loophole):
  // 1. Must have verified 5-day real history & 3M ADV > 25,000
  // 2. Projected today volume MUST genuinely exceed the 5-day average volume (ratio >= 1.20x/1.45x AND > avg5DayVolume * 1.15)
  // 3. No un-exceeded extreme >5x ADV rally blow-off day & today clears 90% of prior rally peak
  const hasPriorBlowoffVolume =
    effectiveAdv > 0 && maxBullishRally5DVol > effectiveAdv * 5.0 && projectedTodayVolume < maxBullishRally5DVol * 1.5;
  const hasMinInstitutionalLiquidity =
    effectiveAdv > 25000 && (projectedTodayVolume >= 30000 || projectedTodayVolume * prevClose >= 10000000);
  const min5DRatioRequired = total5MCandles <= 24 ? 1.20 : 1.45;
  const isLowVolume5D =
    hasVerified5DayData &&
    !hasPriorBlowoffVolume &&
    hasMinInstitutionalLiquidity &&
    volumeVsTodayRatio >= min5DRatioRequired &&
    projectedTodayVolume >= avg5DayVolume * 1.15 &&
    (trueRvol >= 1.05 || rvol >= 1.15 || volumeVsTodayRatio >= 1.55) &&
    (maxBullishRally5DVol === 0 || projectedTodayVolume >= maxBullishRally5DVol * 0.90);

  // Historically Verified Pattern (Sub-3M-ADV Rule)
  const isAll5DaysBelow3MAdv =
    hasVerified5DayData &&
    effectiveAdv > 0 &&
    max5DayVolume < effectiveAdv * 1.05;

  // Inspect each of the last 5 days rigorously (catching both crash days < -2.5% AND pump-and-dump upper-wick traps!)
  let daysUnder2Pct = 0;
  let daysBetween2And3Pct = 0;
  let daysAbove2Pct = 0;
  let daysAbove3Pct = 0;
  let daysAbove45Pct = 0;
  let severeDownDays = 0;
  let max5DayGainPct = -999;
  const dailyChangesPct: number[] = [];

  for (const d of rawDays) {
    const closePct = Number((d.changePercent || 0).toFixed(2));
    // Pump-and-dump guard: if stock spiked >= +4.5% intraday and dumped with large upper wick (>= 55%), count effective swing!
    const hasPumpDumpWick =
      d.intradaySpikePct !== undefined &&
      d.upperWickRatio !== undefined &&
      d.intradaySpikePct >= 4.5 &&
      d.upperWickRatio >= 0.55;
    const effectivePct = hasPumpDumpWick
      ? Number(Math.max(closePct, d.intradaySpikePct! * 0.72).toFixed(2))
      : closePct;

    dailyChangesPct.push(closePct);
    if (effectivePct > max5DayGainPct) max5DayGainPct = effectivePct;

    if (closePct < -2.5) {
      severeDownDays++;
    }

    if (effectivePct <= 2.0 && closePct >= -2.5) {
      daysUnder2Pct++;
    } else if (effectivePct > 2.0) {
      daysAbove2Pct++;
      if (effectivePct <= 3.0) {
        daysBetween2And3Pct++;
      } else {
        daysAbove3Pct++;
        if (effectivePct > 4.5) {
          daysAbove45Pct++;
        }
      }
    }
  }

  if (max5DayGainPct === -999) max5DayGainPct = 0;

  const avg5DayChangePct =
    dailyChangesPct.length > 0
      ? Number((dailyChangesPct.reduce((a, b) => a + b, 0) / dailyChangesPct.length).toFixed(2))
      : 0;
  const yesterdayVolume =
    rawDays.length > 0 && rawDays[rawDays.length - 1].volume > 0
      ? rawDays[rawDays.length - 1].volume
      : avg5DayVolume;
  const todayVsYesterdayVolRatio =
    yesterdayVolume > 0 ? Number((projectedTodayVolume / yesterdayVolume).toFixed(2)) : volumeVsTodayRatio;
  const max5DayVolPctOfAdv =
    effectiveAdv > 0 ? Number(((max5DayVolume / effectiveAdv) * 100).toFixed(1)) : 100;

  const totalDays = rawDays.length || 5;

  // Step 1: Pure Historical 5-Day Tier (Stable, free of rule-drift, rejects crash days & pump-dump traps)
  let historicalPriorityTier: FiveDayPriorityTier = 4;
  if (hasVerified5DayData) {
    if (daysAbove2Pct === 0 && severeDownDays === 0) {
      // Priority 1: All 5 days calm (-2.5% to +2.0%), zero crashes, zero pump-and-dump traps
      historicalPriorityTier = 1;
    } else if (
      (daysAbove2Pct === 1 && daysUnder2Pct >= totalDays - 1 && severeDownDays === 0 && daysAbove45Pct === 0) ||
      (isAll5DaysBelow3MAdv && severeDownDays === 0 && daysAbove3Pct === 0 && daysAbove2Pct <= 2 && volumeVsTodayRatio >= 1.8)
    ) {
      // Priority 2: Strictly 1 day > 2% (4 days <= 2%) OR <=2 mild (2-3%) days with ALL 5D vol < 3M ADV
      historicalPriorityTier = 2;
    } else if (
      (daysAbove3Pct <= 1 &&
        daysBetween2And3Pct <= 1 &&
        daysUnder2Pct >= Math.max(3, totalDays - 2) &&
        severeDownDays <= 1 &&
        max5DayGainPct <= 5.5) ||
      (isAll5DaysBelow3MAdv && daysAbove45Pct === 0 && daysAbove2Pct <= 3 && severeDownDays === 0)
    ) {
      // Priority 3: 3 days < 2%, 1 day ~2.5% (<3%), 1 day > 3% (<= 5.5%)
      historicalPriorityTier = 3;
    }
  }

  // Step 2: Mandatory Core Activation with anti-flip-flop hysteresis
  const minMandatoryGainForTime = total5MCandles <= 16 ? 1.25 : total5MCandles <= 32 ? 1.50 : 1.75;
  const hasOrderBookSupport = buyerPressurePercent >= 48 && cvdTrend !== 'FALLING';
  const isTodayBreakoutActive =
    effectiveAdv > 25000 &&
    !isMorningSpikeAndStagnate &&
    !isFirstHourHyperSpike &&
    hasOrderBookSupport &&
    (changePercent >= minMandatoryGainForTime || (changePercent >= 1.0 && (rvol >= 1.65 || trueRvol >= 1.65))) &&
    (isQualified || totalScore >= 56);

  let priorityTier: FiveDayPriorityTier = 4;
  let tierLabel = 'Non-Priority (Avoided in Top 10)';
  let tierLabelTe = 'ప్రయారిటీ-యేతర స్టాక్ (టాప్ 10 లో అవాయిడ్)';
  let tierDescriptionTe = !hasVerified5DayData
    ? 'నిజమైన 5-రోజుల చారిత్రక డేటా ఇంకా లోడ్ కాలేదు — నకిలీ డేటాకు ప్రయారిటీ ఇవ్వబడదు.'
    : max5DayVolume > projectedTodayVolume
    ? `5-రోజుల వాల్యూమ్ కండిషన్: గత 5 రోజుల్లో గరిష్ట వాల్యూమ్ (${formatAdvShort(max5DayVolume)}) నేటి ప్రొజెక్టెడ్ వాల్యూమ్ (${formatAdvShort(projectedTodayVolume)}) కంటే ఎక్కువగా ఉంది.`
    : severeDownDays > 0
    ? `గత 5 రోజుల్లో ${severeDownDays} రోజు(లు) -2.5% కంటే ఎక్కువగా పడిపోయిన సెల్లింగ్ ఉన్నందున క్వైట్ బేస్‌లో చేర్చబడలేదు.`
    : 'ప్రయారిటీ 1, 2, 3 బేస్ ప్రమాణాలు పూర్తిగా సరిపోలని స్టాక్ (టాప్ 10 లో చేర్చబడదు)';

  if (hasVerified5DayData && isLowVolume5D && isTodayBreakoutActive && historicalPriorityTier <= 3) {
    priorityTier = historicalPriorityTier;
    if (priorityTier === 1) {
      tierLabel = '1st Priority (5D <2% & Low Vol)';
      tierLabelTe = '🥇 1వ ప్రయారిటీ (5 రోజులు <2% & లో వాల్యూమ్)';
      tierDescriptionTe = `గత 5 రోజుల్లో వాల్యూమ్ తక్కువగా ఉండి (5D సగటు: ${formatAdvShort(avg5DayVolume)}, నిన్న: ${formatAdvShort(yesterdayVolume)}), 5 రోజుల్లో ఏ ఒక్క రోజూ +2% దాటకుండా (-2.5%..+2% క్వైట్ బేస్), నేడు ${volumeVsTodayRatio}x (నిన్నటి కంటే ${todayVsYesterdayVolRatio}x) వాల్యూమ్ పేస్‌తో బ్రేక్‌అవుట్ అయింది!`;
    } else if (priorityTier === 2) {
      if (daysAbove2Pct === 1 && daysUnder2Pct >= totalDays - 1) {
        tierLabel = '2nd Priority (1D >2%, 4D <2% & Low Vol)';
        tierLabelTe = '🥈 2వ ప్రయారిటీ (ఒక రోజు >2%, 4 రోజులు <2%)';
        tierDescriptionTe = `గత 5 రోజుల్లో వాల్యూమ్ తక్కువగా ఉండి (${formatAdvShort(avg5DayVolume)}), ఒకే ఒక్క రోజు 2% కన్నా ఎక్కువ (${max5DayGainPct >= 0 ? '+' : ''}${max5DayGainPct}%) మరియు మిగిలిన 4 రోజులు <2% లోపే ఉంది. నేడు ${volumeVsTodayRatio}x వాల్యూమ్ పేస్!`;
      } else {
        tierLabel = '2nd Priority (5D Vol < 3M ADV & Base Breakout)';
        tierLabelTe = '🥈 2వ ప్రయారిటీ (5D వాల్యూమ్ < 3M ADV & బేస్ బ్రేక్‌అవుట్)';
        tierDescriptionTe = `గత 5 రోజుల వాల్యూమ్ 3M ADV (${formatAdvShort(effectiveAdv)}) లోపే (${max5DayVolPctOfAdv}%) ఉండి గరిష్టంగా +3% లోపు కన్సాలిడేట్ అయింది. నేడు ${volumeVsTodayRatio}x వాల్యూమ్ సర్జ్!`;
      }
    } else if (priorityTier === 3) {
      tierLabel = isAll5DaysBelow3MAdv
        ? '3rd Priority (5D Vol < 3M ADV & <=4.5% Base)'
        : '3rd Priority (3D <2%, 1D ~2.5%, 1D >3% & Low Vol)';
      tierLabelTe = isAll5DaysBelow3MAdv
        ? '🥉 3వ ప్రయారిటీ (5D వాల్యూమ్ < 3M ADV & <=4.5% బేస్)'
        : '🥉 3వ ప్రయారిటీ (3 రోజులు <2%, 1D ~2.5%, 1D >3%)';
      tierDescriptionTe = `గత 5 రోజుల సగటు వాల్యూమ్ (${formatAdvShort(avg5DayVolume)}) కంటే నేడు ${volumeVsTodayRatio}x వాల్యూమ్ పేస్‌తో బ్రేక్‌అవుట్ సాధించింది (టాప్ 10 లో P1 & P2 తర్వాత స్థానం).`;
    }
  }

  return {
    priorityTier,
    historicalPriorityTier,
    isTodayBreakoutActive,
    isVerifiedHistoricalData: hasVerified5DayData,
    tierLabel,
    tierLabelTe,
    tierDescriptionTe,
    isLowVolume5D,
    isAll5DaysBelow3MAdv,
    avg5DayVolume,
    volumeVsTodayRatio,
    daysUnder2Pct,
    daysBetween2And3Pct,
    daysAbove2Pct,
    daysAbove3Pct,
    max5DayGainPct,
    dailyChangesPct,
    last5DaysData: rawDays,
  };
}

// Analyze entire technical profile for a stock based on user's exact specification
export function analyzeStockData(params: {
  symbol: string;
  name: string;
  nameTe?: string;
  sector: string;
  marketCapCr: number;
  currentPrice: number;
  prevClose: number;
  dayOpen: number;
  dayHigh: number;
  dayLow: number;
  candles5M: Candle[];
  candles15M: Candle[];
  candles1H: Candle[];
  avgVolume: number;
  currentVolume?: number;
  rvol?: number;
  adv3M?: number;
  fullDayRvol?: number;
  last5Days?: HistoricalDaySummary[];
  marketRegime?: MarketRegime;
  prevNormalizedScore?: number;
}): StockIndicatorData {
  const {
    symbol,
    name,
    nameTe,
    sector,
    marketCapCr,
    currentPrice,
    prevClose,
    dayOpen,
    dayHigh,
    dayLow,
    candles5M: rawCandles5M = [],
    candles15M: rawCandles15M = [],
    candles1H: rawCandles1H = [],
    avgVolume,
    adv3M,
    last5Days: inputLast5Days,
    marketRegime: inputMarketRegime,
    prevNormalizedScore,
  } = params;

  const clampVal = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  const lerpRamp = (x: number, x0: number, x1: number, y0: number, y1: number) => {
    if (x <= x0) return y0;
    if (x >= x1) return y1;
    return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
  };
  const smoothStep = (x: number, e0: number, e1: number) => {
    const t = clampVal((x - e0) / Math.max(1e-6, e1 - e0), 0, 1);
    return t * t * (3 - 2 * t);
  };

  const candles5M = rawCandles5M || [];
  const candles15M = rawCandles15M || [];
  const candles1H = rawCandles1H || [];
  // Closed candles exclude the active incomplete forming 5M bar once >= 4 bars exist, eliminating 8-second live flicker
  const closedCandles5M = candles5M.length >= 4 ? candles5M.slice(0, -1) : candles5M;

  const last5M: Candle = candles5M[candles5M.length - 1] || {
    time: '09:15',
    timestamp: Date.now(),
    close: currentPrice,
    open: currentPrice,
    high: currentPrice,
    low: currentPrice,
    volume: 10000,
    buyerVolume: 6000,
    sellerVolume: 4000,
    barDelta: 2000,
    rvol: 1.0,
    vwap: currentPrice * 0.996,
    ema9: currentPrice * 0.998,
    ema21: currentPrice * 0.993,
    cvd: 50000,
  };

  const stableLast5M: Candle = closedCandles5M[closedCandles5M.length - 1] || last5M;
  const prev5M = closedCandles5M.length > 1 ? closedCandles5M[closedCandles5M.length - 2] : stableLast5M;
  const prev3_5M = closedCandles5M.length > 3 ? closedCandles5M[closedCandles5M.length - 4] : prev5M;

  const currentVolume =
    params.currentVolume && params.currentVolume > 0
      ? params.currentVolume
      : candles5M.reduce((acc, c) => acc + c.volume, 0);
  const change = Number((currentPrice - prevClose).toFixed(2));
  const changePercent = Number(((change / prevClose) * 100).toFixed(2));

  // ATR
  const atr = calculateATR(candles5M, 14);

  // Pivots (Standard daily floor pivots based on High, Low, and PrevClose)
  const pivots = calculatePivotPoints(dayHigh, dayLow, prevClose);

  // VWAP (slope stabilized on closed candles; priceVsVWAP uses live currentPrice)
  const vwap = last5M.vwap ?? currentPrice * 0.995;
  const stableVwap = stableLast5M.vwap ?? vwap;
  const prevVwap = prev3_5M.vwap ?? stableVwap;
  const midSessionVwap =
    closedCandles5M.length >= 10
      ? (closedCandles5M[Math.floor(closedCandles5M.length * 0.35)]?.vwap ?? prevVwap)
      : prevVwap;
  const vwapSlopePct = prevVwap > 0 ? ((stableVwap - prevVwap) / prevVwap) * 100 : 0;
  const vwapSlope: 'RISING' | 'FLAT' | 'FALLING' =
    stableVwap > prevVwap * 1.0001 || (currentPrice > vwap && stableVwap > midSessionVwap * 1.002)
      ? 'RISING'
      : stableVwap < prevVwap * 0.9992 && currentPrice < vwap
      ? 'FALLING'
      : 'FLAT';
  const priceVsVWAP: 'ABOVE' | 'BELOW' = currentPrice >= vwap ? 'ABOVE' : 'BELOW';

  // EMA 9 & 21 (slope stabilized on closed bars so unfinished candle ticks don't flicker EXPANDING/CONVERGING)
  const ema9 = last5M.ema9 ?? currentPrice * 0.998;
  const ema21 = last5M.ema21 ?? currentPrice * 0.994;
  const stableEma9 = stableLast5M.ema9 ?? ema9;
  const stableEma21 = stableLast5M.ema21 ?? ema21;
  const prevEma9 = prev3_5M.ema9 ?? stableEma9;
  const prevEma21 = prev3_5M.ema21 ?? stableEma21;

  const currentDiff = stableEma9 - stableEma21;
  const prevDiff = prevEma9 - prevEma21;
  const emaDistancePercent = Number((((ema9 - ema21) / (ema21 || 1)) * 100).toFixed(2));
  const isTightBullishFlagPinch =
    emaDistancePercent >= -0.25 &&
    priceVsVWAP === 'ABOVE' &&
    currentPrice >= ema21 * 0.998 &&
    currentPrice > vwap * 1.004 &&
    changePercent >= 4.5;
  const isEmaBullishAligned = ema9 > ema21 || isTightBullishFlagPinch;
  const isEmaExpanding =
    isEmaBullishAligned &&
    (currentDiff >= prevDiff * 0.96 || emaDistancePercent >= 0.25 || currentPrice >= ema9);
  const emaSlope: 'EXPANDING' | 'CONVERGING' | 'PARALLEL' =
    isEmaExpanding
      ? 'EXPANDING'
      : currentDiff < prevDiff * 0.92 && !isEmaBullishAligned
      ? 'CONVERGING'
      : isTightBullishFlagPinch
      ? 'PARALLEL'
      : currentDiff < prevDiff * 0.90
      ? 'CONVERGING'
      : 'PARALLEL';

  // 15M Trend alignment (also confirmed if 5M EMA9/21 bullish aligned and price > VWAP with positive gain)
  const last15M = candles15M[candles15M.length - 1];
  const is15MBullish =
    (isEmaBullishAligned && priceVsVWAP === 'ABOVE' && changePercent >= 2.0) ||
    (last15M ? last15M.close > (last15M.ema21 ?? last15M.close * 0.995) : true);
  const trend15M: 'BULLISH' | 'NEUTRAL' | 'BEARISH' = is15MBullish
    ? 'BULLISH'
    : currentPrice < (last15M?.vwap ?? currentPrice) && priceVsVWAP === 'BELOW'
    ? 'BEARISH'
    : 'NEUTRAL';

  // Order flow & CVD stabilized over closed candles to avoid forming-bar flip-flops
  const getSafeBuyerVol = (c: Candle) =>
    typeof c.buyerVolume === 'number' && !Number.isNaN(c.buyerVolume)
      ? c.buyerVolume
      : Math.round((c.volume || 0) * (c.close >= c.open ? 0.62 : 0.38));
  const getSafeSellerVol = (c: Candle) =>
    typeof c.sellerVolume === 'number' && !Number.isNaN(c.sellerVolume)
      ? c.sellerVolume
      : Math.max(0, (c.volume || 0) - getSafeBuyerVol(c));

  const recent10 = closedCandles5M.slice(-10);
  const recentBuyerVol = recent10.reduce((acc, c) => acc + getSafeBuyerVol(c), 0);
  const recentTotalVol = recent10.reduce((acc, c) => acc + (c.volume || 0), 0) || 1;
  const sessionBuyerVol = closedCandles5M.reduce((acc, c) => acc + getSafeBuyerVol(c), 0);
  const sessionTotalVol = closedCandles5M.reduce((acc, c) => acc + (c.volume || 0), 0) || 1;
  const blendedBuyerRatio =
    closedCandles5M.length >= 10
      ? (sessionBuyerVol / sessionTotalVol) * 0.65 + (recentBuyerVol / recentTotalVol) * 0.35
      : recentBuyerVol / recentTotalVol;
  const rawBuyerPressure = (Number.isNaN(blendedBuyerRatio) ? 0.55 : blendedBuyerRatio) * 100;
  const smoothGainPressureBoost =
    priceVsVWAP === 'ABOVE' && isEmaBullishAligned ? smoothStep(changePercent, 2.5, 6.0) * 9 : 0;
  const buyerPressurePercent = Math.min(
    95,
    Math.max(15, Math.round(rawBuyerPressure + smoothGainPressureBoost))
  );
  const sellerPressurePercent = 100 - buyerPressurePercent;

  const cvd = stableLast5M.cvd ?? last5M.cvd ?? 0;
  const recentCvdArr = recent10.map((c) => c.cvd ?? 0);
  const cvdSlope = recentCvdArr.length >= 2 ? recentCvdArr[recentCvdArr.length - 1] - recentCvdArr[0] : 0;
  const last10DeltaSum = recent10.reduce((acc, c) => acc + (c.barDelta ?? (getSafeBuyerVol(c) - getSafeSellerVol(c))), 0);

  let cvdTrend: 'RISING' | 'NEUTRAL' | 'FALLING' = 'NEUTRAL';
  if ((cvd > 0 && priceVsVWAP === 'ABOVE' && isEmaBullishAligned) || (last10DeltaSum > 0 && cvdSlope >= 0)) {
    cvdTrend = 'RISING';
  } else if (last10DeltaSum < 0 && cvdSlope <= 0 && cvd <= 0) {
    cvdTrend = 'FALLING';
  } else if (buyerPressurePercent >= 55) {
    cvdTrend = 'RISING';
  } else if (buyerPressurePercent <= 44) {
    cvdTrend = 'FALLING';
  }

  // CVD Divergence Detection (closed-bar stabilized)
  const priceChangeRecent = stableLast5M.close - (closedCandles5M[Math.max(0, closedCandles5M.length - 5)]?.close ?? stableLast5M.close);
  let cvdDivergence: 'BULLISH_DIVERGENCE' | 'BEARISH_DIVERGENCE' | 'ALIGNED' = 'ALIGNED';
  if (priceChangeRecent <= 0 && last10DeltaSum > 0 && cvdTrend === 'RISING') {
    cvdDivergence = 'BULLISH_DIVERGENCE';
  } else if (priceChangeRecent > 0 && last10DeltaSum < 0 && cvdTrend === 'FALLING') {
    cvdDivergence = 'BEARISH_DIVERGENCE';
  }

  // --- DATA-SCIENTIST ADAPTIVE VOLUME REGIME & MULTI-TIMEFRAME RVOL SYSTEM ---
  // 1. Detect if raw 3M ADV is heavily distorted by an old IPO listing-week or block-deal outlier (e.g. SSRETAIL raw 8.46M vs 5D avg 4.12L)
  const rawInputAdv = adv3M && adv3M > 0 ? adv3M : (avgVolume > 0 ? avgVolume : 25000);
  const valid5DForAdv = inputLast5Days && inputLast5Days.length >= 3 ? inputLast5Days.slice(-5).filter(d => (d.volume || 0) > 0) : [];
  const avg5DVolForRegime =
    valid5DForAdv.length >= 3
      ? Math.round(valid5DForAdv.reduce((s, d) => s + d.volume, 0) / valid5DForAdv.length)
      : rawInputAdv;
  const isAdvOutlierAdjusted =
    valid5DForAdv.length >= 4 &&
    avg5DVolForRegime > 25000 &&
    rawInputAdv > avg5DVolForRegime * 4.5;
  const effectiveAdv = isAdvOutlierAdjusted
    ? Math.round(Math.max(28000, avg5DVolForRegime * 2.15))
    : rawInputAdv;

  const elapsedFraction = getSessionElapsedFraction();
  const expectedSessionVolume = Math.max(10, Math.round(effectiveAdv * elapsedFraction));
  const sessionRvol = Number((currentVolume / expectedSessionVolume).toFixed(2));
  
  // 2. Intraday Momentum RVOL (Last 15 minutes vs expected 15m volume)
  // Expected volume per 5-minute candle = effectiveAdv / 75 (assuming 375 mins / 5 mins = 75 candles)
  const expectedBarVol = Math.max(1, effectiveAdv / 75);
  const last3Candles = candles5M.slice(-3);
  const recent15MVol = last3Candles.reduce((acc, c) => acc + (c.volume || 0), 0);
  const momentumRvol = Number((recent15MVol / (expectedBarVol * 3 || 1)).toFixed(2));

  // 3. Ultra-Short Surge (Last 5 mins vs 20-period candle average)
  const recent20_5M = candles5M.slice(-20);
  const avg20BarVol = recent20_5M.reduce((acc, c) => acc + (c.volume || 0), 0) / (recent20_5M.length || 1);
  const surgeRvol = Number((last5M.volume / (avg20BarVol || 1)).toFixed(2));

  // 4. Final Verified RVOL (100% faithful to real NSE/Yahoo Time-of-Day Session RVOL & Regime-Calibrated 3M ADV RVOL)
  let calculatedFullDayRvol = Number((currentVolume / Math.max(1, effectiveAdv)).toFixed(2));
  if (calculatedFullDayRvol > 50.0) calculatedFullDayRvol = 50.0;
  
  // Keep weightedRvol only as internal diagnostic reference, never to inflate displayed rvol
  let weightedRvol = Number((sessionRvol * 0.5 + momentumRvol * 0.3 + surgeRvol * 0.2).toFixed(2));
  if (weightedRvol > 50.0) weightedRvol = 50.0;
  
  // Final RVOL used for ranking and display: exact Time-of-Day sessionRvol (or full-day 3M ADV ratio at EOD)
  let rvol = Math.max(sessionRvol, calculatedFullDayRvol);
  if (rvol > 50.0) rvol = 50.0;
  rvol = Number(rvol.toFixed(2));

  let fullDayRvol = isAdvOutlierAdjusted ? calculatedFullDayRvol : (params.fullDayRvol || calculatedFullDayRvol);
  if (fullDayRvol > 50.0) fullDayRvol = 50.0;
  fullDayRvol = Number(fullDayRvol.toFixed(2));

  // ADX & DMI
  const diffDI = changePercent > 0 ? 15 : -10;
  const plusDI = Math.min(80, Math.max(10, Math.round(35 + diffDI + (buyerPressurePercent - 50) * 0.4)));
  const minusDI = Math.min(80, Math.max(10, Math.round(25 - diffDI + (sellerPressurePercent - 50) * 0.4)));
  const adx = Math.min(75, Math.max(12, Math.round(18 + Math.abs(plusDI - minusDI) * 0.75)));
  const adxSlope: 'RISING' | 'FALLING' = plusDI > minusDI && adx > 22 ? 'RISING' : 'FALLING';

  // Compression detection (genuine consolidation squeeze before breakout)
  const isEmaPinch = Math.abs(ema9 - ema21) / currentPrice < 0.0014;
  const isTightRange = Math.abs(changePercent) < 1.3 && rvol < 1.7 && adx < 24;
  const isCompression = isEmaPinch && isTightRange;

  // Higher Low Structure (evaluated on closed bars so running bar wick doesn't jitter structure)
  const hasHigherLowStructure = checkHigherLowStructure(closedCandles5M);

  // Breakout Room Check vs overhead pivot resistances strictly above currentPrice
  const overheadResistances = [pivots.r1, pivots.r2, pivots.r3].filter((r) => r > currentPrice);
  let breakoutRoomStatus: 'EXCELLENT' | 'GOOD' | 'TIGHT' | 'BLOCKED' = 'EXCELLENT';
  let roomRatio = 99.0;
  let nearestResistance = 0;
  let roomToResistance = 0;

  if (overheadResistances.length > 0) {
    nearestResistance = Math.min(...overheadResistances);
    roomToResistance = nearestResistance - currentPrice;
    roomRatio = Number((roomToResistance / (atr || 1)).toFixed(2));

    if (roomRatio <= 0.35) {
      breakoutRoomStatus = 'BLOCKED'; // Immediate pivot resistance right in front
    } else if (roomRatio < 0.9) {
      breakoutRoomStatus = 'TIGHT';
    } else if (roomRatio >= 1.6) {
      breakoutRoomStatus = 'EXCELLENT';
    } else {
      breakoutRoomStatus = 'GOOD';
    }
  } else {
    // Current price is above R1, R2, and R3: Blue Sky Breakout / Open Runway!
    nearestResistance = Number((currentPrice + atr * 2.5).toFixed(2));
    roomToResistance = Number((atr * 2.5).toFixed(2));
    breakoutRoomStatus = 'EXCELLENT';
    roomRatio = 3.5;
  }

  // Trap / Fake Breakout filter:
  // Only true if candle opened high, dumped sharply with massive upper wick (rejection > 55%), closed RED below open, and CVD is negative.
  const candleRange = last5M.high - last5M.low;
  const upperWick = last5M.high - Math.max(last5M.open, last5M.close);
  const upperWickRatio = candleRange > 0 ? upperWick / candleRange : 0;
  const isSpikeTrap =
    last5M.close < last5M.open &&
    upperWickRatio > 0.55 &&
    cvdTrend === 'FALLING' &&
    breakoutRoomStatus === 'BLOCKED';

  // Session Candle Color Analysis & Closed-Candle Stabilization:
  // Computed over closedCandles5M (when >= 4 bars exist) so an unfinished forming 5M candle flipping red/green every tick
  // never oscillates redCandlePercent back and forth across activeRedThreshold!
  const total5MCandles = candles5M.length;
  const evalCandlesCount = closedCandles5M.length;
  let redCandlesCount = 0;
  let greenCandlesCount = 0;
  let dojiCandlesCount = 0;

  for (let i = 0; i < evalCandlesCount; i++) {
    const c = closedCandles5M[i];
    if (c.close > c.open) {
      greenCandlesCount++;
    } else if (c.close < c.open) {
      redCandlesCount++;
    } else {
      dojiCandlesCount++;
    }
  }

  const redCandlePercent = evalCandlesCount > 0 ? Number(((redCandlesCount / evalCandlesCount) * 100).toFixed(1)) : 0;
  const greenCandlePercent = evalCandlesCount > 0 ? Number(((greenCandlesCount / evalCandlesCount) * 100).toFixed(1)) : 0;
  const dojiCandlePercent = evalCandlesCount > 0 ? Number(((dojiCandlesCount / evalCandlesCount) * 100).toFixed(1)) : 0;

  // Dynamic Market Regime Threshold per User Instruction:
  // "బుల్లిష్ మార్కెట్లో ఇది 30% గానూ న్యూట్రల్ మార్కెట్లో ఇది ఫార్టీ పర్సెంట్ గాను అదే బెరీష్ మార్కెట్లో అయితే 50% గానూ నియమించండి"
  const marketRegime: MarketRegime = inputMarketRegime || 'NEUTRAL';
  const activeRedThreshold =
    marketRegime === 'BULLISH' ? 30 : marketRegime === 'BEARISH' ? 50 : 40;

  // Hyper-Volatility & Intraday Staircase vs Morning Spike-and-Stagnate Analysis
  // (Distinguishes smooth all-day staircase runners like PARAGMILK, APOLLO, HINDCOPPER, VRLLOG, IFBAGRO, REDINGTON
  //  from morning spike-and-stagnate / upper-circuit traps like RSYSTEMS, PRINCEPIPE, ARROWGREEN, FAZE3Q)
  let max5MBarJumpPercent = 0;
  let max5MBarJumpAfterOpen = 0;
  let totalWickRatio = 0;
  let flatCircuitBarsCount = 0;
  for (let i = 0; i < candles5M.length; i++) {
    const c = candles5M[i];
    const range = c.high - c.low;
    const body = Math.abs(c.close - c.open);
    const barJump = c.open > 0 ? Math.abs((c.high - c.low) / c.open) * 100 : 0;
    if (barJump > max5MBarJumpPercent) {
      max5MBarJumpPercent = Number(barJump.toFixed(2));
    }
    if (i >= 1 && barJump > max5MBarJumpAfterOpen) {
      max5MBarJumpAfterOpen = Number(barJump.toFixed(2));
    }
    if (c.low > 0 && Math.abs(c.high - c.low) / c.low < 0.0005) {
      flatCircuitBarsCount++;
    }
    const wick = range - body;
    const wickRatio = range > 0 ? wick / range : 0;
    totalWickRatio += wickRatio;
  }
  const avgWickRatio = total5MCandles > 0 ? Number((totalWickRatio / total5MCandles).toFixed(3)) : 0;

  // 5-Segment Intraday Progression & Post-10:30 AM Continuity Check
  const idx1030 = Math.min(Math.max(0, total5MCandles - 1), 14); // 10:30 AM 5m candle
  const priceAt1030 = total5MCandles > 0 ? candles5M[idx1030].close : prevClose;
  const gainAfter1030Pct = prevClose > 0 ? Number((((currentPrice - priceAt1030) / prevClose) * 100).toFixed(2)) : 0;
  const after1030Share = changePercent > 0 ? Number(((gainAfter1030Pct / changePercent) * 100).toFixed(1)) : 0;

  const segSize = Math.max(1, Math.floor(total5MCandles / 5));
  const segAvgs: number[] = [];
  if (total5MCandles >= 10 && prevClose > 0) {
    for (let s = 0; s < 5; s++) {
      const sl = candles5M.slice(s * segSize, s === 4 ? total5MCandles : (s + 1) * segSize);
      const avgC = sl.length > 0 ? sl.reduce((sum, b) => sum + b.close, 0) / sl.length : currentPrice;
      segAvgs.push(Number((((avgC - prevClose) / prevClose) * 100).toFixed(2)));
    }
  } else {
    segAvgs.push(changePercent, changePercent, changePercent, changePercent, changePercent);
  }

  let risingSegsCount = 0;
  for (let s = 1; s < 5; s++) {
    if (segAvgs[s] >= segAvgs[s - 1] - 0.15) {
      risingSegsCount++;
    }
  }

  const maxCandleHigh = total5MCandles > 0 ? Math.max(...candles5M.map((c) => c.high), dayHigh) : dayHigh;
  const firstNearHodIdx =
    total5MCandles > 0 ? candles5M.findIndex((c) => c.high >= maxCandleHigh * 0.992) : 0;
  const firstHodFrac = total5MCandles > 0 && firstNearHodIdx >= 0 ? Number((firstNearHodIdx / total5MCandles).toFixed(2)) : 0.8;

  // Detect Morning Spike & Stagnate / Upper-Circuit Dead Lock / Sudden Single-Bar Pump:
  // Catches RSYSTEMS (after1030: -2.42%, firstHodFrac: 0.09), PRINCEPIPE (after1030: +1.72%, afterShare: 22%, firstHodFrac: 0.13),
  // ARROWGREEN (after1030: +1.25%, afterShare: 17%, firstHodFrac: 0.26), FAZE3Q (flatCircuitBarsCount: 35/75), APLLTD (max5MBarJumpAfterOpen: 9.81%)
  // CRITICAL TIME-PRO-RATED FIX: Never demand a full +2.2% post-10:30 AM gain at 10:55 AM - 11:30 AM (total5MCandles = 20..28)!
  // At 11:00 AM - 12:30 PM, only flag stagnation if the stock has genuinely bled >= 1.5% after 10:30 AM OR dropped >= 2.2% from Day High,
  // OR locked in flat circuit bars / violent 1-bar pump. Full +2.2% post-10:30 continuity check applies in mature afternoon sessions (total5MCandles >= 42, i.e. after 12:45 PM).
  const distFromHodNowPct = dayHigh > 0 ? ((dayHigh - currentPrice) / dayHigh) * 100 : 0;
  const isHoldingNearHodAboveVwap = distFromHodNowPct <= 1.35 && currentPrice >= vwap;
  const isMidMorningPost1030Bleed =
    total5MCandles >= 24 &&
    total5MCandles < 42 &&
    gainAfter1030Pct <= -1.2 &&
    distFromHodNowPct >= 2.0;
  const isAfternoonPost1030Stagnation =
    total5MCandles >= 42 &&
    !isHoldingNearHodAboveVwap &&
    (gainAfter1030Pct < 2.2 ||
      (after1030Share < 23 && gainAfter1030Pct < 3.0) ||
      (firstHodFrac <= 0.30 && segAvgs[4] <= segAvgs[1] + 1.0));

  const isMorningSpikeAndStagnate =
    total5MCandles >= 20 &&
    changePercent >= 3.5 &&
    (isMidMorningPost1030Bleed ||
      isAfternoonPost1030Stagnation ||
      flatCircuitBarsCount >= 18 ||
      max5MBarJumpAfterOpen >= 6.5);

  // USER MANDATE: FIRST-HOUR HYPER-VOLATILITY & EXHAUSTION SPIKE DETECTOR:
  // "మొదటి గంటలో 8 నుండి 20% పెరిగిన స్టాక్స్‌ను అవాయిడ్ చెయ్యాలి. ఎందుకంటే సాధారణంగా ఇంట్రాడేలో గరిష్ట ప్రైస్ చేంజ్ 20% మాత్రమే...
  // దాదాపు సగం లేదా అంతకన్నా ఎక్కువ మొదటి గంటలోనే పెరిగితే మిగిలిన మార్కెట్ సమయంలో ఇంకా పెరిగే అవకాశం ఉండదు, ఆ రేంజ్‌లోనే కొనసాగుతుంది లేదా డౌన్‌ఫాల్ అవుతుంది."
  // CRITICAL TIME-OF-DAY & ACTIVE UPTREND FIX (INOXINDIA Forensic Fix):
  // 1. During the first hour itself (09:15 - 10:15 AM, total5MCandles <= 12) or early second hour (total5MCandles < 24, before 11:15 AM),
  //    firstHourHigh IS dayHigh (so firstHourShareOfDayPeak is naturally 100% and gainAfterFirstHourPct is ~0%)!
  //    Never falsely flag a stock that is actively climbing in a step-by-step green staircase (like INOXINDIA at +7.13% with 10/10 green bars)
  //    just because its morning gain crossed +6.0%!
  // 2. A stock is ONLY a First-Hour Exhaustion Spike Trap if:
  //    (a) It made an extreme runaway circuit spike (>= 13.5% in the first hour), OR
  //    (b) It made a violent single-bar jump (>= 5.8%) in the first hour and rejected off highs (distFromHodNowPct >= 2.0%), OR
  //    (c) Enough post-first-hour session time has elapsed (total5MCandles >= 24, after 11:15 AM) to prove the stock actually
  //        stagnated or bled after its first-hour spike!
  const first12Candles = candles5M.slice(0, Math.min(12, total5MCandles));
  const firstHourHigh = first12Candles.length > 0 ? Math.max(...first12Candles.map((c) => c.high)) : dayHigh;
  const firstHourClose = first12Candles.length > 0 ? first12Candles[first12Candles.length - 1].close : currentPrice;
  const firstHourMaxGainPct = prevClose > 0 ? Number((((firstHourHigh - prevClose) / prevClose) * 100).toFixed(2)) : 0;
  const gainAfterFirstHourPct = prevClose > 0 && total5MCandles > 12 ? Number((((currentPrice - firstHourClose) / prevClose) * 100).toFixed(2)) : 0;
  const gainFromFirstHourHighPct = prevClose > 0 ? Number((((currentPrice - firstHourHigh) / prevClose) * 100).toFixed(2)) : 0;
  const dayMaxGainPct = prevClose > 0 ? Number((((dayHigh - prevClose) / prevClose) * 100).toFixed(2)) : changePercent;
  const firstHourShareOfDayPeak = dayMaxGainPct > 0 ? Number(((firstHourMaxGainPct / dayMaxGainPct) * 100).toFixed(1)) : 0;

  const candlesAfterFirstHour = Math.max(0, total5MCandles - 12);
  const proRatedPostFirstHourTarget = Number(Math.min(2.2, (candlesAfterFirstHour / 36) * 2.2).toFixed(2));
  const isActivelyTrendingAtHighs =
    distFromHodNowPct <= 1.5 &&
    currentPrice >= vwap &&
    currentPrice >= ema9 * 0.998 &&
    max5MBarJumpAfterOpen < 5.5 &&
    redCandlePercent <= 35;

  const isFirstHourHyperSpike =
    firstHourMaxGainPct >= 13.5 || // Extreme runaway spike >= 13.5% in first hour
    (total5MCandles <= 24 &&
      firstHourMaxGainPct >= 8.5 &&
      !isActivelyTrendingAtHighs &&
      (distFromHodNowPct >= 2.2 || max5MBarJumpAfterOpen >= 5.8 || currentPrice < ema9)) ||
    (total5MCandles > 24 &&
      total5MCandles < 42 &&
      firstHourMaxGainPct >= 7.5 &&
      !isActivelyTrendingAtHighs &&
      (gainAfterFirstHourPct < proRatedPostFirstHourTarget * 0.6 || gainFromFirstHourHighPct <= -0.4)) ||
    (total5MCandles >= 42 &&
      ((firstHourMaxGainPct >= 8.0 && (gainAfterFirstHourPct < 2.5 || gainFromFirstHourHighPct < 0.5)) ||
        (firstHourMaxGainPct >= 6.0 && firstHourShareOfDayPeak >= 80 && (gainAfterFirstHourPct < 2.2 || gainFromFirstHourHighPct <= 0.35))));

  // Detect Ideal All-Day Smooth Staircase Uptrend (5-Minute & Hourly Velocity Model):
  // Rewards GROWW (+8.04%), IXIGO (+13.23%), GYFTR (+15.67%), PARAGMILK, APOLLO, HINDCOPPER, VRLLOG, IFBAGRO, REDINGTON, DALMIASUG, XPROINDIA, CAPACITE
  // Time-pro-rated post-10:30 AM gain requirement so steady morning staircase runners (AARTIIND, RVNL, STLTECH, RAILTEL, IRCON, BANKBARODA) are recognized during 10:15 AM - 12:30 PM!
  const candlesAfter1030 = Math.max(0, total5MCandles - 14);
  const proRatedAfter1030Target = Number(Math.min(2.2, Math.max(0.25, (candlesAfter1030 / 42) * 2.2)).toFixed(2));
  const proRatedAfter1030ShareTarget = Math.min(25, Math.max(8, Math.round((candlesAfter1030 / 42) * 25)));
  const isSmoothStaircaseUptrend =
    !isMorningSpikeAndStagnate &&
    !isFirstHourHyperSpike &&
    total5MCandles >= 10 &&
    risingSegsCount >= 3 &&
    (total5MCandles <= 16
      ? changePercent >= 2.8 && distFromHodNowPct <= 1.2
      : gainAfter1030Pct >= proRatedAfter1030Target * 1.25 ||
        (gainAfter1030Pct >= proRatedAfter1030Target && risingSegsCount >= 3 && after1030Share >= proRatedAfter1030ShareTarget) ||
        (total5MCandles < 42 && isHoldingNearHodAboveVwap && gainAfter1030Pct >= -0.15 && changePercent >= 3.2)) &&
    firstHodFrac >= (total5MCandles < 30 ? 0.38 : 0.52) &&
    max5MBarJumpAfterOpen <= 5.8 &&
    flatCircuitBarsCount <= 16;

  // Smooth all-day staircase runners on real 5M data naturally have ~35-49% minor pullback 5M bars during healthy consolidation steps;
  // do not penalize verified smooth staircase runners unless red candles exceed 50%.
  const isExcessiveRedCandles =
    total5MCandles >= 4 &&
    redCandlePercent > activeRedThreshold &&
    !(isSmoothStaircaseUptrend && redCandlePercent <= 50);

  // Hyper-Volatile Spike Trap identification (never flags verified Smooth Staircase Uptrends):
  const isSingleBarViolentSpike = max5MBarJumpAfterOpen >= 6.5; // Extreme post-open single 5M bar surge >= 6.5%
  const isErraticWickPump =
    !isSmoothStaircaseUptrend &&
    Math.abs(changePercent) >= 8.0 &&
    avgWickRatio >= 0.62 &&
    redCandlePercent >= 48.0;
  const isFiftyPercentRedSelloff =
    !isSmoothStaircaseUptrend &&
    redCandlePercent >= 54.0 &&
    Math.abs(changePercent) >= 5.0 &&
    avgWickRatio >= 0.55;

  const isHyperVolatileSpike = isSingleBarViolentSpike || isErraticWickPump || isFiftyPercentRedSelloff || isFirstHourHyperSpike;

  // --- INTRADAY FAKE-DOWN vs CONFIRMED BREAKDOWN ENGINE (User Mandate) ---
  // "Intraday మార్కెట్ లొ ఈ తాత్కాలిక ఒడిదుడుకులను ఎనాలిసిస్ చేసి fake డౌన్ లేద కొంత సేపు ఏర్పడే ఈ హెచ్చుతగ్గులు నీ ఫిల్టర్ చేసే స్ట్రాటజీ నీ సిస్టమ్ లొ develop చెయ్యాలి...
  //  ఎంట్రీ ఎర్లీ గా ఉండాలి కాని ఎగ్జిట్ మాత్రం చిన్న చిన్న down ఫాల్స్ కీ trap అవ్వకుండా టెక్నికల్ కన్ఫర్మేషన్ తీసుకోవాలి"
  // Analyzes whether a mid-session pullback/dip (even slightly below VWAP or EMA9) is a Healthy Low-Volume Support Retest ("Fake Down")
  // vs a Genuine Multi-Factor Structural Breakdown.
  const greenImpulseBars = candles5M.filter(c => c.close >= c.open);
  const redPullbackBars = candles5M.filter(c => c.close < c.open);
  const avgGreenImpulseVol =
    greenImpulseBars.length > 0
      ? greenImpulseBars.reduce((s, c) => s + (c.volume || 0), 0) / greenImpulseBars.length
      : Math.max(1, currentVolume / Math.max(1, total5MCandles));
  const last4PullbackBars = candles5M.slice(-4).filter(c => c.close < c.open);
  const avgRecentPullbackVol =
    last4PullbackBars.length > 0
      ? last4PullbackBars.reduce((s, c) => s + (c.volume || 0), 0) / last4PullbackBars.length
      : redPullbackBars.length > 0
      ? redPullbackBars.reduce((s, c) => s + (c.volume || 0), 0) / redPullbackBars.length
      : 0;
  const pullbackVolumeRatio = Number((avgRecentPullbackVol / Math.max(1, avgGreenImpulseVol)).toFixed(2));

  // Fibonacci 61.8% retracement support floor of the day's impulse from prevClose to dayHigh
  const dayImpulseSpan = Math.max(0.01, dayHigh - Math.min(prevClose, dayOpen));
  const fib618SupportFloor = Math.min(prevClose, dayOpen) + dayImpulseSpan * 0.36;
  const heldFibAndPivotSupport =
    currentPrice >= pivots.pivot &&
    currentPrice >= fib618SupportFloor &&
    changePercent >= 2.5;
  const isWithinElasticVwapSupport =
    vwap > 0 ? currentPrice >= vwap * 0.968 : true; // Up to ~3.2% elastic support band during low-volume retest of high-gain stocks
  const hasLowVolumeRetestAbsorption =
    pullbackVolumeRatio <= 0.72 || buyerPressurePercent >= 48 || cvdTrend !== 'FALLING';

  // A stock is in a Healthy Intraday Retest ("Fake Down") if it already proved morning strength (dayMaxGainPct >= 3.5%, rvol >= 1.35),
  // holds above Central Pivot + Fib 61.8% retracement floor, stays within the elastic support zone, and pullback volume is absorbed!
  const isHealthyIntradayRetest =
    !isFirstHourHyperSpike &&
    !isHyperVolatileSpike &&
    dayMaxGainPct >= 3.5 &&
    rvol >= 1.35 &&
    heldFibAndPivotSupport &&
    isWithinElasticVwapSupport &&
    hasLowVolumeRetestAbsorption;

  // Hard Filters (Protected by Anti-Fake-Down Retest Shield so healthy retests are NOT falsely blocked or thrown to Rank #100+)
  const is15MBearish = trend15M === 'BEARISH' && !isHealthyIntradayRetest;
  const isBelowVWAP = priceVsVWAP === 'BELOW' && !isHealthyIntradayRetest;
  const isEMA9Below21 = !isEmaBullishAligned && !isHealthyIntradayRetest;
  const isCVDFalling = cvdTrend === 'FALLING' && !(isHealthyIntradayRetest && buyerPressurePercent >= 48);
  const isADXFallingWeak = (adx < 20 || minusDI > plusDI) && !isHealthyIntradayRetest;
  // Exempt high-RVOL breakout candidates approaching R1 resistance (e.g. INDUSINDBK @ 10:15 AM with 4.8x RVOL)
  const isResistanceTooClose =
    breakoutRoomStatus === 'BLOCKED' &&
    changePercent < 3.5 &&
    !(rvol >= 2.0 && changePercent >= 2.0 && priceVsVWAP === 'ABOVE');
  const isBearishAbsorption = sellerPressurePercent > 65 && last5M.close < last5M.open && pullbackVolumeRatio > 0.85;
  const isLiquiditySweepFailed =
    !isHealthyIntradayRetest &&
    last5M.high > dayHigh * 0.999 &&
    last5M.close < last5M.open &&
    (dayHigh - currentPrice) / Math.max(1, dayHigh) > 0.018;

  const blockReasons: string[] = [];
  if (is15MBearish) blockReasons.push('15M Trend Bearish');
  if (isBelowVWAP) blockReasons.push('Price below VWAP (Confirmed Breakdown)');
  if (isEMA9Below21) blockReasons.push('EMA 9 < EMA 21');
  if (isCVDFalling) blockReasons.push('CVD strongly falling');
  if (isADXFallingWeak) blockReasons.push('ADX weak or -DI dominates');
  if (isResistanceTooClose) blockReasons.push('Immediate resistance too close (Room < 0.35 ATR)');
  if (isBearishAbsorption) blockReasons.push('Large bearish absorption');
  if (isLiquiditySweepFailed) blockReasons.push('Liquidity sweep failed');
  if (isSpikeTrap && !isHealthyIntradayRetest) blockReasons.push('Momentum trap / fake breakout spike');
  if (isFirstHourHyperSpike) {
    blockReasons.push(
      `మొదటి గంట హై-వాలటాలిటీ ఎగ్జాస్టన్: మొదటి 60 నిమిషాల్లోనే +${firstHourMaxGainPct}% విపరీతంగా పెరిగి పొటెన్షియల్ ముగిసింది (${firstHourShareOfDayPeak}% డే-పీక్ ఉదయమే). మిగిలిన సమయానికి అప్‌సైడ్ లేదు.`
    );
  } else if (isHyperVolatileSpike) {
    blockReasons.push(`హై వాలటాలిటీ స్పైక్ ట్రాప్: 5M బార్ ${max5MBarJumpAfterOpen}% జంప్, భారీ విక్స్ (${(avgWickRatio * 100).toFixed(0)}% విక్స్) & రిస్క్`);
  }
  // Strict User Mandate: "3 మంత్స్ యావరేజ్ వాల్యూం నీ 25000 కీ మార్చండి" (> 25,000 3M ADV required)
  const isLow3MAdvAvoided = effectiveAdv <= 25000;
  if (isLow3MAdvAvoided) {
    blockReasons.push(
      `3M సగటు వాల్యూమ్ <= 25,000 (${formatIndianVolume(effectiveAdv)}): 3-నెలల సగటు వాల్యూమ్ 25,000 కన్నా ఎక్కువ ఉన్న స్టాక్స్ మాత్రమే క్వాలిఫై అవుతాయి (అవాయిడ్ చేయబడింది)`
    );
  }
  // If red candles are overwhelmingly dominant (>= 58%), it represents structural distribution
  if (redCandlePercent >= 58.0 && total5MCandles >= 8 && !isHealthyIntradayRetest) {
    blockReasons.push(`తీవ్ర సెల్లింగ్ డిస్ట్రిబ్యూషన్: ${redCandlePercent}% రెడ్ క్యాండిల్స్ (సెల్లర్ ఆధిపత్యం)`);
  }

  const hasHardFilterBlock = blockReasons.length > 0;

  const hardFilters: HardFilterStatus = {
    is15MBearish,
    isBelowVWAP,
    isEMA9Below21,
    isCVDFalling,
    isADXFallingWeak,
    isResistanceTooClose,
    isBearishAbsorption,
    isLiquiditySweepFailed,
    isSpikeTrap,
    isExcessiveRedCandles,
    isHyperVolatileSpike,
    isMorningSpikeAndStagnate,
    isFirstHourHyperSpike,
    activeRedThreshold,
    marketRegime,
    hasHardFilterBlock,
    blockReasons,
  };

  // --- SCORING ENGINE v2: ANTI-FLICKER SMOOTH PERSISTENCE + CONTINUOUS RAMPS + BOUNDED CALIBRATION ---
  // 1. Non-Redundant Multi-Bar Closed-Candle Persistence (15 pts max in composite; 20 pts normalized in breakdown)
  // Measures genuine 12-bar holding consistency instead of double-counting instantaneous VWAP/EMA/CVD booleans!
  const recent12Closed = closedCandles5M.slice(-12);
  const nRecent12 = Math.max(1, recent12Closed.length);
  const barsAboveVwapRate =
    recent12Closed.filter((c) => c.close >= (c.vwap ?? vwap) * 0.999).length / nRecent12;
  const barsGreenOrFirmRate =
    recent12Closed.filter((c) => {
      const rng = Math.max(0.0001, c.high - c.low);
      return c.close >= c.open || (c.close - c.low) / rng >= 0.55;
    }).length / nRecent12;
  const barsEmaAlignedRate =
    recent12Closed.filter((c) => (c.ema9 ?? ema9) >= (c.ema21 ?? ema21) * 0.9985).length / nRecent12;

  const p15M = trend15M === 'BULLISH';
  const pEMA =
    ((emaSlope === 'EXPANDING' || (ema9 > ema21 && emaDistancePercent >= 0.4)) && ema9 > ema21) ||
    (isEmaBullishAligned && isSmoothStaircaseUptrend);
  const pVWAP = vwapSlope === 'RISING' && priceVsVWAP === 'ABOVE';
  const pADX = adxSlope === 'RISING' && adx >= 22;
  const pCVD = cvdTrend === 'RISING';
  const pVol = rvol >= 1.2;
  const pHL = hasHigherLowStructure;

  // Continuous 0..15 persistence score from multi-bar consistency & higher-low structure
  const rawPersistence = clampVal(
    barsAboveVwapRate * 5.0 +
      barsGreenOrFirmRate * 4.0 +
      barsEmaAlignedRate * 3.0 +
      (pHL ? 1.8 : 0.4) +
      lerpRamp(rvol, 0.7, 2.0, 0, 1.2),
    0,
    15
  );
  const pScore = Math.round((rawPersistence / 15) * 20);
  const persistencePercent = Math.round((rawPersistence / 15) * 100);
  const persistenceLevel: 'HIGH' | 'MEDIUM' | 'LOW' =
    persistencePercent >= 75 ? 'HIGH' : persistencePercent >= 50 ? 'MEDIUM' : 'LOW';

  const persistenceScore: PersistenceScoreBreakdown = {
    is15MBullish: p15M,
    isEMAExpanding: pEMA,
    isVWAPRising: pVWAP,
    isADXRising: pADX,
    isCVDPersistent: pCVD,
    hasVolumeParticipation: pVol,
    hasHigherLowStructure: pHL,
    totalPersistenceScore: pScore,
    persistencePercent,
    persistenceLevel,
  };

  // 100-Point Composite Score with Smooth Continuous Piecewise Ramps (Zero Binary Step Cliffs):
  // 1. Price Momentum & HOD Proximity (20 max)
  const distFromHighPercent = dayHigh > 0 ? Math.max(0, ((dayHigh - currentPrice) / dayHigh) * 100) : 0;

  let gainScore = 0;
  if (changePercent <= 0) {
    gainScore = 0;
  } else if (changePercent < 0.5) {
    gainScore = lerpRamp(changePercent, 0, 0.5, 0, 2.4);
  } else if (changePercent < 1.5) {
    gainScore = lerpRamp(changePercent, 0.5, 1.5, 2.4, 5.0);
  } else if (changePercent < 3.0) {
    gainScore = lerpRamp(changePercent, 1.5, 3.0, 5.0, 7.6);
  } else if (changePercent < 5.5) {
    gainScore = lerpRamp(changePercent, 3.0, 5.5, 7.6, 9.6);
  } else if (changePercent < 8.5) {
    gainScore = lerpRamp(changePercent, 5.5, 8.5, 9.6, 10.6);
  } else {
    gainScore = lerpRamp(changePercent, 8.5, 12.0, 10.6, 11.0);
  }

  // Smooth HOD retention curve weighted cleanly by gain strength (eliminates 4.49% -> 4.50% jump)
  const dayRange = Math.max(0.01, dayHigh - dayLow);
  const rangeRetained = clampVal((currentPrice - dayLow) / dayRange, 0, 1);
  const gainStrengthBoost = smoothStep(changePercent, 2.0, 7.0) * 1.4;
  let hodScore = 0;
  if (distFromHighPercent <= 0.35) {
    hodScore = 9.0;
  } else if (distFromHighPercent <= 1.2) {
    hodScore = lerpRamp(distFromHighPercent, 0.35, 1.2, 9.0, 7.8 + gainStrengthBoost * 0.45);
  } else if (distFromHighPercent <= 3.0) {
    const startHod = 7.8 + gainStrengthBoost * 0.45;
    const endHod = 4.8 + gainStrengthBoost * 0.9;
    hodScore = lerpRamp(distFromHighPercent, 1.2, 3.0, startHod, endHod);
  } else if (distFromHighPercent <= 5.5) {
    const startHod = 4.8 + gainStrengthBoost * 0.9;
    hodScore = lerpRamp(distFromHighPercent, 3.0, 5.5, startHod, rangeRetained * 3.2);
  } else {
    hodScore = rangeRetained * 3.2;
  }
  const rawMomentum = clampVal(Number((gainScore + hodScore).toFixed(2)), 0, 20);

  // 2. Volume & RVOL Surge (15 max) - Smooth ramp
  let rawVolume = 0;
  if (rvol >= 3.5) {
    rawVolume = lerpRamp(rvol, 3.5, 6.5, 14.4, 15.0);
  } else if (rvol >= 2.0) {
    rawVolume = lerpRamp(rvol, 2.0, 3.5, 12.6, 14.4);
  } else if (rvol >= 1.2) {
    rawVolume = lerpRamp(rvol, 1.2, 2.0, 8.5, 12.6);
  } else if (rvol >= 0.7) {
    rawVolume = lerpRamp(rvol, 0.7, 1.2, 4.0, 8.5);
  } else {
    rawVolume = Math.max(0.5, lerpRamp(rvol, 0, 0.7, 0.5, 4.0));
  }
  rawVolume = clampVal(Number(rawVolume.toFixed(2)), 0, 15);

  // 3. Trend & EMA Expansion (15 max) - Smooth ramp
  const emaSpreadScore = lerpRamp(emaDistancePercent, -0.4, 0.9, 0, 6.2);
  const trend15mScore =
    trend15M === 'BULLISH'
      ? 5.5 + smoothStep(changePercent, 1.5, 5.0) * 0.8
      : trend15M === 'NEUTRAL'
      ? 2.8
      : 0.4;
  const expansionSlopeScore =
    emaSlope === 'EXPANDING' || (isSmoothStaircaseUptrend && isEmaBullishAligned)
      ? 2.5
      : emaSlope === 'PARALLEL'
      ? 1.5
      : 0.3;
  const rawTrend = clampVal(Number((emaSpreadScore + trend15mScore + expansionSlopeScore).toFixed(2)), 0, 15);

  // 4. Persistence (15 max) already computed above from closed-bar consistency

  // 5. Order Flow & CVD (15 max) - Smooth buyer pressure + delta continuity
  const bpScore = lerpRamp(buyerPressurePercent, 44, 78, 0, 8.5);
  const deltaStrength = clampVal((blendedBuyerRatio - 0.45) / 0.25, 0, 1);
  const cvdBase = cvdTrend === 'RISING' ? 5.0 + deltaStrength * 1.5 : cvdTrend === 'NEUTRAL' ? 2.5 + deltaStrength * 1.2 : deltaStrength * 1.0;
  const rawOrderFlow = clampVal(Number((bpScore + cvdBase).toFixed(2)), 0, 15);

  // 6. VWAP Alignment (10 max) - Continuous distance + VWAP slope
  const priceVwapDistPct = vwap > 0 ? ((currentPrice - vwap) / vwap) * 100 : 0;
  const vwapPosScore = lerpRamp(priceVwapDistPct, -0.6, 1.6, 0, 6.0);
  const vwapSlopeScore =
    vwapSlope === 'RISING'
      ? lerpRamp(vwapSlopePct, 0, 0.3, 2.8, 4.0)
      : vwapSlope === 'FLAT'
      ? 2.0
      : 0.2;
  const rawVwap = clampVal(Number((vwapPosScore + vwapSlopeScore).toFixed(2)), 0, 10);

  // 7. Liquidity / Breakout Room to Resistance (5 max) - Continuous roomRatio ramp
  const rawLiquidity = clampVal(Number(lerpRamp(roomRatio, 0.2, 1.8, 0.5, 5.0).toFixed(2)), 0, 5);

  // 8. Candle Structure & Higher Lows (5 max) - Closed-bar structure
  const closedLastFirm = stableLast5M.close >= stableLast5M.open || (isSmoothStaircaseUptrend && currentPrice >= vwap);
  const rawCandle = clampVal(
    Number(((hasHigherLowStructure ? 2.6 : 0.8) + (closedLastFirm ? 1.8 : 0.4) + barsGreenOrFirmRate * 0.6).toFixed(2)),
    0,
    5
  );

  const rawTotal = rawMomentum + rawVolume + rawTrend + rawPersistence + rawOrderFlow + rawVwap + rawLiquidity + rawCandle;

  // Smooth Weightage Penalties (zero cliff edges)
  let penaltyPoints = 0;
  let redPenalty = 0;
  if (isExcessiveRedCandles) {
    const excess = Math.max(0, redCandlePercent - activeRedThreshold);
    redPenalty = Math.min(18, Number(((excess / 10) * 5.0 + smoothStep(excess, 0, 4.0) * 2.0).toFixed(2)));
    penaltyPoints += redPenalty;
  }

  if (isHyperVolatileSpike) {
    penaltyPoints += 20;
  }

  if (isMorningSpikeAndStagnate && !isHyperVolatileSpike) {
    penaltyPoints += 12;
  }

  // Smooth Time-of-Day Price-Growth Adequacy Curve (eliminates 11:15 AM bar 24 & 12:45 PM bar 42 sudden crashes!)
  const maturityFactor = smoothStep(total5MCandles, 18, 48);
  const maturityGainTarget = 2.2 + maturityFactor * 2.6; // 2.2% at 10:45 AM -> 4.8% by 1:15 PM
  const maturityShortfall = Math.max(0, maturityGainTarget - changePercent);
  if (maturityFactor > 0.05 && maturityShortfall > 0 && !isHealthyIntradayRetest) {
    penaltyPoints += Number((maturityFactor * Math.min(14, maturityShortfall * 3.2)).toFixed(2));
  }

  if (isLow3MAdvAvoided) {
    penaltyPoints += 25;
  }

  // 6. DATA-SCIENTIST CONTEXT-AWARE 5-DAY VOLUME ANALYSIS
  const recent5DaysCheck =
    inputLast5Days &&
    inputLast5Days.length >= 3 &&
    inputLast5Days.every((d) => d && d.isVerifiedReal !== false && !/^D-\d+$/.test(String(d.dateStr || '')))
      ? inputLast5Days.slice(-5)
      : [];
  const days5DAbove3PctCheck = recent5DaysCheck.filter((d) => (d.changePercent || 0) > 3.0).length;
  const tFracClimax = Math.min(1, Math.max(0.10, total5MCandles / 75));
  const expFracClimax = Math.min(1, Math.max(0.16, 0.65 * tFracClimax + 0.35 * Math.pow(tFracClimax, 0.75)));
  const projTodayVolCheck =
    isNSEMarketOpenNow() || total5MCandles < 55
      ? Math.max(currentVolume, Math.round(currentVolume / expFracClimax), Math.round(effectiveAdv * sessionRvol))
      : currentVolume;

  let maxBullish5DVol = 0;
  let maxBullish5DIdx = -1;
  let hadShakeoutDay = false;
  recent5DaysCheck.forEach((d, idx) => {
    const v = d.volume || 0;
    const chg = d.changePercent || 0;
    if (chg <= -1.0 && v > effectiveAdv * 1.4) {
      hadShakeoutDay = true;
    }
    if (chg >= 2.5 && v > maxBullish5DVol) {
      maxBullish5DVol = v;
      maxBullish5DIdx = idx;
    }
  });
  const isShakeoutAbsorbed = hadShakeoutDay && changePercent >= 2.5 && priceVsVWAP === 'ABOVE';

  const daysSincePeakBullishVol = maxBullish5DIdx >= 0 ? recent5DaysCheck.length - 1 - maxBullish5DIdx : 0;
  const trailingDaysAfterPeak = maxBullish5DIdx >= 0 ? recent5DaysCheck.slice(maxBullish5DIdx + 1) : [];
  const trailingAvgVol =
    trailingDaysAfterPeak.length > 0
      ? trailingDaysAfterPeak.reduce((s, d) => s + (d.volume || 0), 0) / trailingDaysAfterPeak.length
      : maxBullish5DVol;
  const trailingMaxGain =
    trailingDaysAfterPeak.length > 0
      ? Math.max(...trailingDaysAfterPeak.map((d) => d.changePercent || 0))
      : 99;
  const isFlagResetAfterImpulse =
    daysSincePeakBullishVol >= 2 &&
    trailingDaysAfterPeak.length >= 2 &&
    trailingAvgVol <= maxBullish5DVol * 0.68 &&
    trailingMaxGain <= 2.2 &&
    changePercent >= 2.2 &&
    (rvol >= 1.4 || currentVolume >= effectiveAdv * 0.5) &&
    priceVsVWAP === 'ABOVE';

  // --- 5-PILLAR FULL-DAY POTENTIALITY & MULTI-FACTOR SYNERGY ENGINE (Smoothly Calibrated) ---
  const potPricePillar = Math.min(25, Math.max(0, changePercent * 3.2 + (dayMaxGainPct >= 5.0 ? 4 : 0)));
  const potVolumePillar = Math.min(
    25,
    lerpRamp(rvol, 0.8, 3.2, 2, 15) +
      (currentVolume >= effectiveAdv ? 6 : lerpRamp(sessionRvol, 1.0, 2.0, 0, 5)) +
      lerpRamp(0.8 - pullbackVolumeRatio, 0, 0.35, 0, 4)
  );
  const potMaPivotPillar = Math.min(
    20,
    (currentPrice >= pivots.pivot ? 6 : 0) +
      (currentPrice >= pivots.r1 ? 4 : 0) +
      (isEmaBullishAligned ? 5 : isHealthyIntradayRetest ? 3.5 : 0) +
      (trend15M === 'BULLISH' ? 5 : trend15M === 'NEUTRAL' ? 2.5 : 0)
  );
  const potOrderBookPillar = Math.min(
    15,
    lerpRamp(buyerPressurePercent, 46, 65, 0, 9) +
      (cvdTrend === 'RISING' ? 6 : cvdTrend === 'NEUTRAL' ? 3 : 0)
  );
  const potBasePillar = Math.min(
    15,
    (isFlagResetAfterImpulse || isShakeoutAbsorbed ? 10 : 0) +
      (hasHigherLowStructure ? 4 : 0) +
      (isSmoothStaircaseUptrend ? 5 : isHealthyIntradayRetest ? 3.5 : 0)
  );
  const fullDayPotentialityScore = Number(
    Math.min(100, potPricePillar + potVolumePillar + potMaPivotPillar + potOrderBookPillar + potBasePillar).toFixed(1)
  );

  const isHighPotentialityOverride =
    !isLow3MAdvAvoided &&
    !isFirstHourHyperSpike &&
    !isHyperVolatileSpike &&
    fullDayPotentialityScore >= 76 &&
    changePercent >= 3.5 &&
    rvol >= 1.65 &&
    currentPrice >= pivots.pivot &&
    buyerPressurePercent >= 52 &&
    (priceVsVWAP === 'ABOVE' || isHealthyIntradayRetest);

  const hasPrior5DVolumeClimax =
    recent5DaysCheck.length >= 3 &&
    !isFlagResetAfterImpulse &&
    !isHighPotentialityOverride &&
    maxBullish5DVol > effectiveAdv * 1.8 &&
    maxBullish5DVol > projTodayVolCheck * 1.05;

  if (hasPrior5DVolumeClimax) {
    penaltyPoints += days5DAbove3PctCheck >= 2 ? 18 : 14;
  }

  // Healthy Intraday Retest Support Cushion (bounded up to +6.0)
  let retestSupportCushion = 0;
  if (isHealthyIntradayRetest && (priceVsVWAP === 'BELOW' || !isEmaBullishAligned)) {
    retestSupportCushion = Math.min(
      6.0,
      (priceVsVWAP === 'BELOW' ? 3.2 : 0) +
        (!isEmaBullishAligned ? 1.8 : 0) +
        lerpRamp(0.75 - pullbackVolumeRatio, 0, 0.35, 0.5, 1.5)
    );
  }

  // Bounded Institutional Synergy Bonus (strictly <= +6.0 max, smooth ramps so scores don't crowd at 99-100)
  let synergyBonus = 0;
  if (
    !isLow3MAdvAvoided &&
    !hasPrior5DVolumeClimax &&
    (priceVsVWAP === 'ABOVE' || isHealthyIntradayRetest) &&
    !isHyperVolatileSpike &&
    !isMorningSpikeAndStagnate
  ) {
    const breakoutStrength = smoothStep(changePercent, 3.8, 8.5) * smoothStep(rvol, 1.4, 3.2) * 3.0;
    const staircaseStrength = isSmoothStaircaseUptrend ? smoothStep(rvol, 1.3, 2.5) * 2.0 : 0;
    const archetypeStrength =
      (isFlagResetAfterImpulse || isShakeoutAbsorbed || isAdvOutlierAdjusted || isHighPotentialityOverride)
        ? smoothStep(changePercent, 3.0, 5.5) * 1.5
        : 0;
    synergyBonus = Math.min(6.0, breakoutStrength + staircaseStrength + archetypeStrength);
  }

  // Active 30-Minute Price-Volume Thrust vs Midday EMA-9 Drift Check (closed-bar stabilized)
  const last6Bars = closedCandles5M.slice(-6);
  const price30MinAgo = last6Bars.length > 0 ? last6Bars[0].open : currentPrice;
  const gainLast30MinPct = prevClose > 0 ? ((stableLast5M.close - price30MinAgo) / prevClose) * 100 : 0;
  const volLast30Min = last6Bars.reduce((s, c) => s + (c.volume || 0), 0);
  const totalCandleVol = closedCandles5M.reduce((s, c) => s + (c.volume || 0), 0);
  const volShareLast30MinPct = totalCandleVol > 0 ? (volLast30Min / totalCandleVol) * 100 : 0;
  const emaSpreadNowPct = ema21 > 0 ? ((ema9 - ema21) / ema21) * 100 : 0;

  if (total5MCandles >= 22 && !isLow3MAdvAvoided && !hasPrior5DVolumeClimax) {
    if (stableLast5M.close < ema9 && gainLast30MinPct <= -0.10 && volShareLast30MinPct < 22 && !isHealthyIntradayRetest) {
      penaltyPoints += 3.0;
    } else if (total5MCandles >= 32 && Math.abs(gainLast30MinPct) <= 0.15 && emaSpreadNowPct < 0.30 && changePercent < 5.0 && !isHealthyIntradayRetest) {
      penaltyPoints += 2.2;
    } else if (
      currentPrice >= ema9 &&
      ema9 > ema21 &&
      priceVsVWAP === 'ABOVE' &&
      gainLast30MinPct >= 1.1 &&
      volShareLast30MinPct >= 20 &&
      emaSpreadNowPct >= 0.65
    ) {
      synergyBonus = Math.min(6.5, synergyBonus + 1.5);
    }
  }

  const institutionalBreakoutBonus = Number((retestSupportCushion + synergyBonus).toFixed(2));
  let penalizedTotal = Math.max(0, rawTotal + institutionalBreakoutBonus - penaltyPoints);

  // Smooth Maturity Ceiling + Hard Safety Caps
  if (isLow3MAdvAvoided) {
    penalizedTotal = Math.min(60.0, penalizedTotal);
  } else if (hasPrior5DVolumeClimax) {
    penalizedTotal = Math.min(82.0, penalizedTotal);
  } else if (maturityFactor > 0.15 && maturityShortfall > 0 && !isHealthyIntradayRetest) {
    const smoothCap = 98.0 - maturityFactor * Math.min(11.5, maturityShortfall * 4.5);
    penalizedTotal = Math.min(smoothCap, penalizedTotal);
  }

  const targetNormalizedScore = Number(Math.min(100, Math.max(0, penalizedTotal)).toFixed(2));

  // Stateful EMA Damping + Deadband Stabilizer (Audit 1 Flaw #7)
  const hasSevereTrapFlip =
    isLow3MAdvAvoided ||
    hasPrior5DVolumeClimax ||
    isHyperVolatileSpike ||
    isSpikeTrap;
  let normalizedScore = targetNormalizedScore;
  if (typeof prevNormalizedScore === 'number' && Number.isFinite(prevNormalizedScore)) {
    const delta = targetNormalizedScore - prevNormalizedScore;
    if (hasSevereTrapFlip) {
      // Allow swift response if a real structural trap or liquidity block triggers
      normalizedScore = Number(clampVal(prevNormalizedScore + clampVal(delta * 0.80, -12, 12), 0, 100).toFixed(2));
    } else if (Math.abs(delta) <= 1.15) {
      // Tiny deadband nudge to eliminate tick jitter
      normalizedScore = Number(clampVal(prevNormalizedScore + delta * 0.20, 0, 100).toFixed(2));
    } else {
      // Adaptive EMA damping with max tick excursion limit
      normalizedScore = Number(clampVal(prevNormalizedScore + clampVal(delta * 0.48, -4.5, 4.5), 0, 100).toFixed(2));
    }
  }
  const totalScore = Math.round(normalizedScore);

  // Tie-breaker priority metrics for stocks with identical scores:
  // 1. Momentum Velocity: Net upward velocity (speed of gain + proximity to Day High + ADX momentum)
  const momentumVelocity = Number(
    (changePercent * 3.0 + Math.max(0, 10 - distFromHighPercent * 2.0) + (adxSlope === 'RISING' ? 3 : 0)).toFixed(2)
  );
  // 2. RVOL Consistency: Relative volume surge multiple + volume participation ratio
  // Enhanced for Birla Cable scenario: prioritize Full Day RVOL surge (institutional buying)
  const rvolConsistency = Number(
    (rvol * 12 + fullDayRvol * 8 + Math.min(50, (currentVolume / (effectiveAdv || 1)) * 15)).toFixed(2)
  );
  // 3. Order Flow Metrics: Net buyer dominance + CVD expansion
  const orderFlowDominance = Number(
    ((buyerPressurePercent - sellerPressurePercent) * 1.5 + (cvdTrend === 'RISING' ? 10 : cvdTrend === 'NEUTRAL' ? 3 : -10)).toFixed(2)
  );

  const overallScore: OverallScoreBreakdown = {
    trend: Math.round(rawTrend),
    persistence: Math.round(rawPersistence),
    orderFlow: Math.round(rawOrderFlow),
    volume: Math.round(rawVolume),
    vwap: Math.round(rawVwap),
    momentum: Math.round(rawMomentum),
    liquidityLevels: Math.round(rawLiquidity),
    candleStructure: Math.round(rawCandle),
    totalScore,
    normalizedScore,
    tieBreakers: {
      momentumVelocity,
      rvolConsistency,
      orderFlowDominance,
    },
  };

  // Determine Market State
  let marketState: 'TRENDING' | 'COMPRESSION' | 'EXPANSION' | 'PULLBACK' | 'CHOPPY' = 'CHOPPY';
  const efficiency = calculateEfficiencyRatio(candles5M);
  if (efficiency < 0.25 && adx < 20 && Math.abs(changePercent) < 0.8) {
    marketState = 'CHOPPY';
  } else if (rvol >= 1.8 && (emaSlope === 'EXPANDING' || Math.abs(changePercent) >= 2.0)) {
    marketState = 'EXPANSION';
  } else if (isCompression && adx < 25 && Math.abs(changePercent) < 1.4) {
    marketState = 'COMPRESSION';
  } else if (last5M.close < last5M.open && priceVsVWAP === 'ABOVE' && ema9 > ema21 && changePercent > 0.8) {
    marketState = 'PULLBACK';
  } else if (totalScore >= 70 || adx >= 25 || emaSlope === 'EXPANDING') {
    marketState = 'TRENDING';
  }

  // Signal Stage Determination with Strict Safety Guards:
  // 1. MOMENTUM TRAP: Hyper-volatile spike or erratic wick fakeout
  // 2. NO TRADE: Hard filter blocked, or excessive red candles (>= 46%)
  // 3. STRONG LONG BUY: Score >= 78, NO blocks, persistence >= 55%
  // 4. PRE-BREAKOUT WATCH: Compression building
  // 5. DIP RECOVERY: Healthy Pullback
  let signalStage: SignalStage = 'NO_TRADE';
  let category: 'ALREADY_STRONG' | 'PRE_BREAKOUT' | 'DIP_RECOVERY' | 'OTHER' = 'OTHER';

  if (isHyperVolatileSpike || isSpikeTrap) {
    signalStage = 'MOMENTUM_TRAP';
    category = 'OTHER';
  } else if (hasHardFilterBlock || redCandlePercent >= 58.0) {
    signalStage = 'NO_TRADE';
    category = 'OTHER';
  } else if (totalScore >= 85) {
    signalStage = 'STRONG_LONG';
    category = 'ALREADY_STRONG';
  } else if (!hasHardFilterBlock && totalScore >= 75 && persistenceScore.persistencePercent >= 55) {
    signalStage = 'STRONG_LONG';
    category = 'ALREADY_STRONG';
  } else if (!hasHardFilterBlock && isCompression && totalScore >= 64 && roomRatio >= 0.8) {
    signalStage = 'PRE_BREAKOUT_WATCH';
    category = 'PRE_BREAKOUT';
  } else if (
    marketState === 'PULLBACK' &&
    priceVsVWAP === 'ABOVE' &&
    ema9 >= ema21 &&
    buyerPressurePercent >= 50 &&
    !isCVDFalling
  ) {
    signalStage = 'DIP_RECOVERY';
    category = 'DIP_RECOVERY';
  } else if (totalScore >= 65 && !hasHardFilterBlock) {
    signalStage = 'EARLY_SETUP';
    category = 'PRE_BREAKOUT';
  } else if (totalScore >= 72 && priceVsVWAP === 'ABOVE') {
    signalStage = 'STRONG_LONG';
    category = 'ALREADY_STRONG';
  } else {
    signalStage = 'NO_TRADE';
    category = 'OTHER';
  }

  // If healthy pullback is happening on an existing strong stock, mark it DIP_RECOVERY
  if (category === 'OTHER' && totalScore >= 66 && last5M.close <= last5M.open && priceVsVWAP === 'ABOVE') {
    category = 'DIP_RECOVERY';
    signalStage = 'DIP_RECOVERY';
  }

  // Trade Plan Construction:
  // Entry: Current price or slightly above for breakout
  const entryPrice = Number(currentPrice.toFixed(2));
  // SL: Below recent swing low or 1.5 ATR / below EMA21
  const calculatedSL = Math.max(ema21 * 0.997, currentPrice - 1.4 * atr);
  const stopLoss = Number(calculatedSL.toFixed(2));
  const risk = Math.max(0.5, currentPrice - stopLoss);

  // Targets (T1 = 1:1.5, T2 = 1:2.5, T3 = 1:3.5)
  const target1 = Number((currentPrice + risk * 1.5).toFixed(2));
  const target2 = Number((currentPrice + risk * 2.5).toFixed(2));
  const target3 = Number((currentPrice + risk * 3.5).toFixed(2));
  const riskRewardRatio = Number(((target2 - entryPrice) / risk).toFixed(1));

  const tradePlan: TradePlan = {
    entryPrice,
    stopLoss,
    target1,
    target2,
    target3,
    riskRewardRatio: riskRewardRatio > 0 ? riskRewardRatio : 2.5,
    breakoutRoomPips: Number(roomToResistance.toFixed(2)),
    breakoutRoomStatus,
    roomRatio,
  };

  // Strengths & Weaknesses (Telugu + English for pristine bilingual clarity)
  const strengths: string[] = [];
  const strengthsTe: string[] = [];
  const weaknesses: string[] = [];
  const weaknessesTe: string[] = [];

  if (is15MBullish) {
    strengths.push('15M higher timeframe trend is strongly bullish');
    strengthsTe.push('15 నిమిషాల హైయర్ టైమ్‌ఫ్రేమ్ ట్రెండ్ బుల్లిష్‌గా ఉంది');
  } else {
    weaknesses.push('15M higher timeframe lacks bullish confirmation');
    weaknessesTe.push('15M టైమ్‌ఫ్రేమ్‌లో బుల్లిష్ కన్ఫర్మేషన్ లేదు');
  }

  if (priceVsVWAP === 'ABOVE' && vwapSlope === 'RISING') {
    strengths.push('Price comfortably trading above rising VWAP');
    strengthsTe.push('ధర పెరుగుతున్న VWAP కంటే ఎగువన ట్రేడ్ అవుతోంది');
  } else if (priceVsVWAP === 'BELOW') {
    weaknesses.push('Price trading below VWAP (Institutional selling zone)');
    weaknessesTe.push('ధర VWAP కంటే దిగువన ఉంది (ఇన్స్టిట్యూషనల్ సెల్లింగ్ ప్రెషర్)');
  }

  if (isSmoothStaircaseUptrend) {
    const avg5mPct = total5MCandles > 0 ? Number((changePercent / total5MCandles).toFixed(2)) : 0;
    strengths.push(`Ideal All-Day Smooth Staircase Uptrend (+${changePercent}% total, ~+${avg5mPct}% per 5M bar across ${risingSegsCount}/4 rising segments)`);
    strengthsTe.push(`ఐడియల్ ఆల్-డే స్మూత్ స్టెయిర్‌కేస్ అప్‌ట్రెండ్ (+${changePercent}% పెరుగుదల, 5M సగటు +${avg5mPct}%, రోజంతా స్థిరమైన అప్‌ట్రెండ్)`);
  }

  if (isEmaBullishAligned && (emaSlope === 'EXPANDING' || isSmoothStaircaseUptrend)) {
    strengths.push('5M EMA 9/21 bullish trend structure aligned above VWAP');
    strengthsTe.push('5M EMA 9/21 బుల్లిష్ ట్రెండ్ అలైన్‌మెంట్ (మొమెంటమ్ బలంగా ఉంది)');
  } else if (!isEmaBullishAligned) {
    weaknesses.push('5M EMA 9 crossed below EMA 21');
    weaknessesTe.push('EMA 9 EMA 21 కంటే క్రిందకు పడిపోయింది');
  }

  if (buyerPressurePercent >= 65) {
    strengths.push(`Aggressive buyers dominant (${buyerPressurePercent}% buy pressure)`);
    strengthsTe.push(`కొనుగోలుదారులు ఆధిపత్యం వహిస్తున్నారు (${buyerPressurePercent}% బయ్యర్ ప్రెషర్)`);
  } else if (buyerPressurePercent < 45) {
    weaknesses.push(`Sellers controlling order flow (${sellerPressurePercent}% sell pressure)`);
    weaknessesTe.push(`అమ్మకందారులు ఎక్కువగా ఉన్నారు (${sellerPressurePercent}% సెల్లర్ ప్రెషర్)`);
  }

  if (cvdTrend === 'RISING') {
    strengths.push('Cumulative Volume Delta (CVD) rising persistently');
    strengthsTe.push('CVD స్థిరంగా పెరుగుతోంది (నిరంతర అక్యుమ్యులేషన్)');
  } else if (cvdTrend === 'FALLING') {
    weaknesses.push('CVD falling — aggressive market order distribution');
    weaknessesTe.push('CVD పడిపోతోంది — తీవ్రమైన మార్కెట్ ఆర్డర్ డిస్ట్రిబ్యూషన్');
  }

  if (breakoutRoomStatus === 'EXCELLENT' || breakoutRoomStatus === 'GOOD') {
    strengths.push(`Good upside breakout room to R1 (${roomRatio}x ATR)`);
    strengthsTe.push(`R1 రెసిస్టెన్స్ వరకు మంచి అప్‌సైడ్ రూమ్ ఉంది (${roomRatio}x ATR)`);
  } else if (breakoutRoomStatus === 'BLOCKED') {
    weaknesses.push('Immediate resistance is too close (<0.6 ATR). High risk/reward clamp');
    weaknessesTe.push('తక్షణ రెసిస్టెన్స్ చాలా దగ్గరలో ఉంది (<0.6 ATR), రిస్క్/రివార్డ్ తక్కువ');
  }

  if (isSpikeTrap) {
    weaknesses.push('High upper wick spike detected — Momentum trap risk');
    weaknessesTe.push('పై విక్ పెద్దదిగా ఉంది — మొమెంటమ్ ట్రాప్ / ఫేక్ బ్రేక్‌అవుట్ ప్రమాదం');
  }

  if (isExcessiveRedCandles) {
    const regimeTe = marketRegime === 'BULLISH' ? 'బుల్లిష్' : marketRegime === 'BEARISH' ? 'బేరిష్' : 'న్యూట్రల్';
    weaknesses.push(`Excessive Red Candles: ${redCandlePercent}% red candles exceeded ${marketRegime} market limit of ${activeRedThreshold}% (-${redPenalty} pts weightage deducted)`);
    weaknessesTe.push(`అధిక రెడ్ క్యాండిల్స్: ${regimeTe} మార్కెట్‌లో ${activeRedThreshold}% పరిమితిని దాటి ${redCandlePercent}% రెడ్ క్యాండిల్స్ ఉన్నాయి (-${redPenalty} పాయింట్ల వెయిటేజ్ తగ్గించబడింది)`);
  }

  if (isFirstHourHyperSpike) {
    weaknesses.push(`First-Hour Exhaustion Trap: Surged heavily in first 60 minutes and depleted further upside potential`);
    weaknessesTe.push(`మొదటి గంట హై-వాలటాలిటీ ఎగ్జాస్టన్: మొదటి 60 నిమిషాల్లోనే ప్రైస్ విపరీతంగా పెరిగి పొటెన్షియల్ ముగిసింది (మిగిలిన సమయంలో అప్‌సైడ్ లేదు)`);
  } else if (isHyperVolatileSpike) {
    weaknesses.push(`Hyper-Volatile Spike Trap: Rapid ${max5MBarJumpPercent}% 5M jump with heavy wicks (${(avgWickRatio * 100).toFixed(0)}% wicks) — Extremely dangerous pump trap`);
    weaknessesTe.push(`ప్రమాదకరమైన హై వాలటాలిటీ స్పైక్: 5 నిమిషాల్లో ${max5MBarJumpPercent}% భారీ జంప్, భారీ విక్స్ & సెల్లింగ్ ట్రాప్ (ఫిల్టర్ చేయబడింది)`);
  }

  if (isLow3MAdvAvoided) {
    weaknesses.push(`Low 3-Month Average Volume (${formatIndianVolume(effectiveAdv)} <= 25,000) — Avoided per minimum >25,000 3M ADV mandate`);
    weaknessesTe.push(`3-నెలల సగటు వాల్యూమ్ (${formatIndianVolume(effectiveAdv)}) 25,000 కన్నా తక్కువగా ఉంది — 25,000 కన్నా ఎక్కువ 3M ADV ఉన్న స్టాక్స్ మాత్రమే క్వాలిఫై అవుతాయి (అవాయిడ్ చేయబడింది)`);
  }

  if (hasPrior5DVolumeClimax) {
    weaknesses.push(
      `5-Day Volume Condition Failed: Prior 5-day peak volume (${formatIndianVolume(maxBullish5DVol)}) exceeded today's volume (${formatIndianVolume(currentVolume)})`
    );
    weaknessesTe.push(
      `5-రోజుల వాల్యూమ్ కండిషన్ విఫలం: గత 5 రోజుల్లో గరిష్ట వాల్యూమ్ (${formatIndianVolume(maxBullish5DVol)}) నేటి వాల్యూమ్ (${formatIndianVolume(currentVolume)}) కంటే ఎక్కువగా ఉంది (${days5DAbove3PctCheck} రోజులు >3% పెరుగుదల)`
    );
  }

  const timeStr = new Date().toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).toUpperCase();

  // Strict User Mandate: Only stocks above Central Pivot Point (or R1/R2/R3) qualify!
  // If price is below central pivot point (in bearish S1/S2/S3 territory), it CANNOT qualify.
  const isAbovePivot = currentPrice >= pivots.pivot;

  // --- EARLY MORNING INSTITUTIONAL ACCUMULATION & FAKE-GAP DETECTOR ---
  // Analyzes the first 15-30 minutes (09:15 AM - 09:45 AM) to separate:
  // 1) True EOD Top-10 Breakouts (Pocket Pivot volume surge + VWAP tight hold + High range retention + Rising CVD)
  // 2) Fake Morning Gap-Ups (Opening gap followed by red candles, upper wick rejection, VWAP loss, and falling CVD)
  // Compensate for Yahoo/NSE 5M feed reporting BarV = 0 on the 09:15 AM opening candle:
  // Take the first 3 active non-zero opening candles (within the first 5 bars) so early breakouts like INDUSINDBK are never under-counted!
  const firstActiveOpeningCandles = candles5M.slice(0, 5).filter(c => (c.volume || 0) > 0).slice(0, 3);
  const opening15MinVol =
    firstActiveOpeningCandles.length > 0
      ? firstActiveOpeningCandles.reduce((acc, c) => acc + (c.volume || 0), 0)
      : candles5M.slice(0, 3).reduce((acc, c) => acc + (c.volume || 0), 0);
  const expected15MinAdvSlice = Math.max(100, Math.round(effectiveAdv * 0.14)); // First 15 mins = ~14% of daily volume
  const opening15MinVolumeMultiple = Number((opening15MinVol / expected15MinAdvSlice).toFixed(2));

  const earlyCandles = candles5M.slice(0, Math.min(8, candles5M.length));
  const earlyAboveVwapCount = earlyCandles.filter(c => c.close >= (c.vwap ?? vwap)).length;
  const vwapTightHoldPercent = earlyCandles.length > 0 ? Math.round((earlyAboveVwapCount / earlyCandles.length) * 100) : 100;

  const sessionRange = Math.max(0.05, dayHigh - dayLow);
  const rangeRetentionPercent = Math.min(100, Math.max(0, Math.round(((currentPrice - dayLow) / sessionRange) * 100)));

  // Pocket Pivot Detection: Any bullish 5M candle whose volume exceeds the max volume of up to 10 preceding candles
  let pocketPivotDetected = false;
  for (let i = 1; i < candles5M.length; i++) {
    const c = candles5M[i];
    if (c.close > c.open && c.close >= (c.vwap ?? vwap)) {
      const lookbackSlice = candles5M.slice(Math.max(0, i - 10), i);
      const maxPriorVol = lookbackSlice.reduce((m, p) => Math.max(m, p.volume || 0), 0);
      if (c.volume > maxPriorVol * 1.25 && (c.rvol ?? 1) >= 1.5) {
        pocketPivotDetected = true;
        break;
      }
    }
  }

  // Detect Fake Morning Gap-Up / Exhaustion Trap (Why morning #1-#100 failed by EOD):
  // Note: Never flag a verified Healthy Intraday Retest (low-volume support retest above Pivot & Fib 61.8% floor) as a fake morning gap trap!
  const isFakeMorningGapTrap =
    !isHealthyIntradayRetest &&
    ((changePercent > 0.5 && rangeRetentionPercent < 36) ||
      (priceVsVWAP === 'BELOW' && cvdTrend === 'FALLING' && pullbackVolumeRatio > 0.75) ||
      (redCandlePercent > activeRedThreshold && vwapSlope === 'FALLING' && pullbackVolumeRatio > 0.75) ||
      isSpikeTrap);

  // Early Detection Score (0 - 100) measuring institutional footprint right at 09:30 - 10:15 AM
  let earlyDetectionScore = 0;
  if (opening15MinVolumeMultiple >= 2.0) earlyDetectionScore += 28;
  else if (opening15MinVolumeMultiple >= 1.3) earlyDetectionScore += 20;
  else if (opening15MinVolumeMultiple >= 0.9) earlyDetectionScore += 12;

  if (vwapTightHoldPercent >= 85 && (priceVsVWAP === 'ABOVE' || isHealthyIntradayRetest)) earlyDetectionScore += 24;
  else if (vwapTightHoldPercent >= 65 && (priceVsVWAP === 'ABOVE' || isHealthyIntradayRetest)) earlyDetectionScore += 16;

  if (rangeRetentionPercent >= 80) earlyDetectionScore += 20;
  else if (rangeRetentionPercent >= 60 || isHealthyIntradayRetest) earlyDetectionScore += 14;

  if (pocketPivotDetected || surgeRvol >= 2.0) earlyDetectionScore += 16;
  if ((cvdTrend === 'RISING' && buyerPressurePercent >= 58) || (isHealthyIntradayRetest && pullbackVolumeRatio <= 0.65)) earlyDetectionScore += 12;
  if (isFakeMorningGapTrap) earlyDetectionScore = Math.max(10, earlyDetectionScore - 40);
  earlyDetectionScore = Math.min(100, Math.round(earlyDetectionScore));

  const isEarlyBreakoutCandidate =
    !isFakeMorningGapTrap &&
    isAbovePivot &&
    (priceVsVWAP === 'ABOVE' || isHealthyIntradayRetest) &&
    earlyDetectionScore >= 65 &&
    (rvol >= 1.4 || opening15MinVolumeMultiple >= 1.30 || pocketPivotDetected);

  // Strict User Mandate: Only stocks that cross 3 Months Average Daily Volume (3M ADV) OR demonstrate verified Institutional 3M ADV Pace qualify!
  // 1) Morning Institutional Pace (09:15 - 10:15 AM): opening15MinVolumeMultiple >= 1.25 with sessionRvol >= 1.65 (e.g. AONESTEELS, TEXRAIL, APOLLO, SSRETAIL, ALICON)
  // 2) Rolling Mid-Session Ignition Pace (10:15 AM - 02:30 PM): quiet opening followed by sudden 5M/15M institutional ignition bar >= 2.5x RVOL (e.g. MSTCLTD at 11:20 AM, TSFINV at 10:30 AM)
  const hasEarlyInstitutionalAdvPace =
    isEarlyBreakoutCandidate &&
    sessionRvol >= 1.55 &&
    opening15MinVolumeMultiple >= 1.20 &&
    (vwapTightHoldPercent >= 65 || isHealthyIntradayRetest) &&
    (rangeRetentionPercent >= 55 || isHealthyIntradayRetest);

  // Detect Rolling Intraday Ignition (for stocks that consolidated quietly in the first 30-90 mins and ignited later, like MSTCLTD at 11:20 AM or TSFINV at 10:30 AM)
  let midSessionIgnitionCandle: Candle | undefined = undefined;
  let maxIgnitionBarRvol = 0;
  const sum5MVolForIgnition = candles5M.reduce((acc, item) => acc + (item.volume || 0), 0);
  const volScaleForIgnition = sum5MVolForIgnition > 0 && currentVolume > sum5MVolForIgnition ? currentVolume / sum5MVolForIgnition : 1.0;
  let runningVolForIgnition = 0;
  for (let i = 1; i < candles5M.length; i++) {
    const c = candles5M[i];
    runningVolForIgnition += c.volume || 0;
    const scaledCum = runningVolForIgnition * volScaleForIgnition;
    const cGain = prevClose > 0 ? ((c.close - prevClose) / prevClose) * 100 : 0;
    const cRvol = c.rvol ?? 1.0;
    const win3Vol = candles5M.slice(Math.max(0, i - 2), i + 1).reduce((s, b) => s + (b.volume || 0), 0) * volScaleForIgnition;
    if (
      c.close > c.open &&
      c.close >= (c.vwap ?? vwap) &&
      c.close >= pivots.pivot &&
      cGain >= 3.0 &&
      (cRvol >= 2.2 || win3Vol >= effectiveAdv * 0.15) &&
      scaledCum >= effectiveAdv * 0.20
    ) {
      if (!midSessionIgnitionCandle) {
        midSessionIgnitionCandle = c;
      }
      if (cRvol > maxIgnitionBarRvol) {
        maxIgnitionBarRvol = cRvol;
      }
    }
  }

  const hasRollingIntradayIgnitionPace =
    !isFakeMorningGapTrap &&
    isAbovePivot &&
    (priceVsVWAP === 'ABOVE' || isHealthyIntradayRetest) &&
    Boolean(midSessionIgnitionCandle) &&
    rvol >= 1.40 &&
    (rangeRetentionPercent >= 58 || isHealthyIntradayRetest);

  // ADAPTIVE 3M ADV & 5-DAY VOLUME PACE (Non-Blocking Early Capture):
  // User Insight: More than half of genuine morning leaders (first 60-90 mins) do NOT cross 100% of full-day 3M ADV early!
  // Therefore:
  // - Minimum liquidity floor (3M ADV > 25,000) remains strictly enforced.
  // - Crossing 100% of full-day 3M ADV is NO LONGER a rigid blocker! Instead it acts as a high-conviction Parallel Weight & Progressive Layer bonus in the Adaptive Brain.
  // - Stocks beating their 5-Day pro-rated volume pace (>= 1.25x) OR showing positive intraday RVOL pace qualify immediately in the first 60-90 mins!
  const hasStrict3MAdvCross =
    !isLow3MAdvAvoided &&
    effectiveAdv > 25000 &&
    (currentVolume >= effectiveAdv || (fullDayRvol !== undefined && fullDayRvol >= 1.0));

  const verified5DDaysForQual = inputLast5Days && inputLast5Days.length >= 3 ? inputLast5Days.slice(-5) : [];
  const avg5DVolForQual =
    verified5DDaysForQual.length > 0
      ? Math.max(1, Math.round(verified5DDaysForQual.reduce((s, d) => s + (d.volume || 0), 0) / verified5DDaysForQual.length))
      : effectiveAdv;
  const currentTFrac = Math.min(1, Math.max(0.06, total5MCandles / 75));
  const currentExpFrac = Math.min(1, Math.max(0.08, 0.65 * currentTFrac + 0.35 * Math.pow(currentTFrac, 0.75)));
  const expected5DVolByNow = Math.max(1, Math.round(avg5DVolForQual * currentExpFrac));
  const fiveDayPaceMultipleNow = Number((currentVolume / expected5DVolByNow).toFixed(2));

  const hasAdaptive5DOrIntradayVolumePace =
    !isLow3MAdvAvoided &&
    effectiveAdv > 25000 &&
    currentVolume > 0 &&
    buyerPressurePercent >= 48 &&
    cvdTrend !== 'FALLING' &&
    (fiveDayPaceMultipleNow >= 1.25 || sessionRvol >= 1.12 || rvol >= 1.25 || opening15MinVolumeMultiple >= 1.15);

  const hasCrossed3MAdv =
    !isLow3MAdvAvoided &&
    effectiveAdv > 25000 &&
    (hasStrict3MAdvCross ||
      hasEarlyInstitutionalAdvPace ||
      hasRollingIntradayIgnitionPace ||
      hasAdaptive5DOrIntradayVolumePace);

  // Compute Qualification Metadata (Exact time & trigger price where stock genuinely met technical breakout criteria)
  // Adaptive: First 60-90 min leaders with strong Price + Order Book + 5D Volume Pace qualify early without being blocked by full-day 3M ADV!
  const isFirst90MinWindow = total5MCandles <= 20;
  const minQualScore = isFirst90MinWindow ? 68 : 74;
  const minQualGain = isFirst90MinWindow ? 1.5 : 2.0;

  let qualification: QualificationMetadata | undefined = undefined;
  if (
    (signalStage === 'STRONG_LONG' ||
     signalStage === 'PRE_BREAKOUT_WATCH' ||
     signalStage === 'DIP_RECOVERY') &&
    overallScore.normalizedScore >= minQualScore &&
    currentVolume > 0 &&
    effectiveAdv > 25000 &&
    !isLow3MAdvAvoided &&
    changePercent >= minQualGain &&
    (rvol >= 1.0 || fiveDayPaceMultipleNow >= 1.25) &&
    isAbovePivot &&
    hasCrossed3MAdv &&
    !isFakeMorningGapTrap &&
    !isFirstHourHyperSpike &&
    !isMorningSpikeAndStagnate
  ) {
    // Scan 5M candles to identify the genuine breakout/qualification trigger candle
    let triggerCandle: Candle | undefined = undefined;
    let firstQualifiedBaseCandle: Candle | undefined = undefined;
    let maxVolumeThrust = -1;
    let fallbackThrustCandle: Candle | undefined = undefined;

    const sum5MVol = candles5M.reduce((acc, item) => acc + (item.volume || 0), 0);
    const volScale = sum5MVol > 0 && currentVolume > sum5MVol ? currentVolume / sum5MVol : 1.0;
    const minBreakoutGainPct = isFirst90MinWindow ? 1.5 : changePercent >= 3.0 ? 2.2 : 1.8;

    let runningCumVol = 0;

    for (let i = 0; i < candles5M.length; i++) {
      const c = candles5M[i];
      runningCumVol += c.volume || 0;
      const scaledCumVol = runningCumVol * volScale;

      const candleVWAP = c.vwap ?? vwap;
      const isAboveVWAP = c.close >= candleVWAP;
      const isGreen = c.close >= c.open;
      const prevC = i > 0 ? candles5M[i - 1] : undefined;

      if (i === 0 && candles5M.length > 3) continue;

      // 1. Price at this candle MUST be in genuine positive breakout territory vs prevClose (never negative/flat!)
      const candleGainPct = prevClose > 0 ? ((c.close - prevClose) / prevClose) * 100 : 0;
      const isCandleGainQualified = candleGainPct >= minBreakoutGainPct;

      // 2. Price at this candle MUST be above Central Pivot (PP)
      const isCandleAbovePivot = c.close >= pivots.pivot;

      // 3. Situational Time-of-Day, 5-Day Volume Pace & 3M ADV Ignition Qualification at this candle:
      const tFrac = Math.max(0.02, (i + 1) / 75);
      const expectedCumFracAtCandle = Math.max(0.05, 0.65 * tFrac + 0.35 * Math.pow(tFrac, 0.75));
      const candlePaceMultiple = scaledCumVol / Math.max(1, effectiveAdv * expectedCumFracAtCandle);
      const candle5DPaceMultiple = scaledCumVol / Math.max(1, avg5DVolForQual * expectedCumFracAtCandle);
      const candleRvol = c.rvol ?? 1.0;

      // EARLY ENTRY + ANTI-FAKE-DOWN RETEST STRUCTURE VERIFICATION:
      const subsequentCandles = candles5M.slice(i + 1);
      const heldStructureAfterCandle = subsequentCandles.every(sub => {
        const subGainPct = prevClose > 0 ? ((sub.close - prevClose) / prevClose) * 100 : 0;
        const subVwap = sub.vwap ?? candleVWAP;
        const heldAbovePivotAndMinGain = sub.close >= pivots.pivot * 0.998 && subGainPct >= 1.2;
        const heldWithinElasticRetestBand = sub.close >= subVwap * 0.958;
        return heldAbovePivotAndMinGain && heldWithinElasticRetestBand;
      });

      const hasUnoverridden5DHurdle = hasPrior5DVolumeClimax && !isHighPotentialityOverride;

      // A) First 90-min Adaptive 5-Day Volume / Pro-Rated Pace Breakout (Does NOT wait for 100% full-day 3M ADV!)
      const isMorningAdaptiveBreakout =
        i <= 20 &&
        !hasUnoverridden5DHurdle &&
        candleGainPct >= 1.6 &&
        (candle5DPaceMultiple >= 1.30 || candlePaceMultiple >= 1.25 || candleRvol >= 1.5 || opening15MinVolumeMultiple >= 1.20) &&
        heldStructureAfterCandle;

      // B) Classic Institutional Ignition or Full 3M ADV Cross
      const isFullAdvOrPaceQualified =
        (scaledCumVol >= effectiveAdv * 0.85 ||
          (!hasUnoverridden5DHurdle && (candlePaceMultiple >= 1.50 || candle5DPaceMultiple >= 1.55))) &&
        heldStructureAfterCandle;

      const isCandleAdvQualified =
        isMorningAdaptiveBreakout || isFullAdvOrPaceQualified;

      const isVolumeSurge =
        candleRvol >= 1.35 || candle5DPaceMultiple >= 1.30 || (prevC && prevC.volume > 0 ? c.volume > prevC.volume * 1.3 : false);
      const isPriceSurge = prevC ? c.close >= prevC.high : isGreen;

      if (isAboveVWAP && isCandleAbovePivot && isCandleGainQualified && isCandleAdvQualified) {
        if (!firstQualifiedBaseCandle) {
          firstQualifiedBaseCandle = c;
        }
        if (isGreen && (isVolumeSurge || isPriceSurge)) {
          triggerCandle = c;
          break; // Locks the EARLY morning institutional breakout candle without waiting for full 3M ADV!
        }
      }

      // Track the highest volume-thrust bullish candle ONLY among positive, above-pivot candles that held structure afterwards
      if (isAboveVWAP && isCandleAbovePivot && candleGainPct >= 2.0 && heldStructureAfterCandle) {
        const bodyGain = Math.max(0.001, (c.close - c.open) / (c.open || 1));
        const thrust = (c.volume || 1) * bodyGain;
        if (thrust > maxVolumeThrust) {
          maxVolumeThrust = thrust;
          fallbackThrustCandle = c;
        }
      }
    }

    if (!triggerCandle) {
      triggerCandle = firstQualifiedBaseCandle || fallbackThrustCandle;
    }

    const currentISTMin = getISTCurrentMinutes();
    const isMarketLive = isNSEMarketOpenNow();

    // Valid past candles strictly up to current IST minute during live market
    const validPastCandles = isMarketLive
      ? candles5M.filter(c => {
          const m = parseISTTimeToMinutes(c.time);
          return m === null || m <= currentISTMin;
        })
      : candles5M;

    if (!triggerCandle || (isMarketLive && (parseISTTimeToMinutes(triggerCandle.time) || 0) > currentISTMin)) {
      triggerCandle =
        firstQualifiedBaseCandle && (!isMarketLive || (parseISTTimeToMinutes(firstQualifiedBaseCandle.time) || 0) <= currentISTMin)
          ? firstQualifiedBaseCandle
          : fallbackThrustCandle && (!isMarketLive || (parseISTTimeToMinutes(fallbackThrustCandle.time) || 0) <= currentISTMin)
          ? fallbackThrustCandle
          : validPastCandles[validPastCandles.length - 1] || candles5M[candles5M.length - 1] || candles5M[0];
    }

    let finalQualifiedTime = triggerCandle?.time || timeStr;
    const finalMin = parseISTTimeToMinutes(finalQualifiedTime);
    if (isMarketLive && finalMin !== null && finalMin > currentISTMin) {
      // Future timestamp detected - strictly clamp to current live time!
      finalQualifiedTime = timeStr;
    }

    const pivotZoneDesc = currentPrice >= pivots.r3
      ? `పివోట్ జోన్: R3 పైన సూపర్ బుల్లిష్ (₹${pivots.r3})`
      : currentPrice >= pivots.r2
      ? `పివోట్ జోన్: R2 పైన స్ట్రాంగ్ మొమెంటమ్ (₹${pivots.r2})`
      : currentPrice >= pivots.r1
      ? `పివోట్ జోన్: R1 పైన బ్రేక్‌అవుట్ (₹${pivots.r1})`
      : `పివోట్ జోన్: సెంట్రల్ పివోట్ (PP: ₹${pivots.pivot}) పైన స్థిరత్వం`;

    const advRatio = (fullDayRvol || (currentVolume / (effectiveAdv || 1))).toFixed(2);
    const advCrossDesc = hasStrict3MAdvCross
      ? `3M ADV క్రాస్: ${formatIndianVolume(currentVolume)} / ${formatAdvShort(effectiveAdv)} (${advRatio}x ADV)`
      : `అడాప్టివ్ 5D వాల్యూమ్ పేస్: ${fiveDayPaceMultipleNow}x (3M ADV: ${Math.round(Number(advRatio) * 100)}% — ఎర్లీ క్యాప్చర్)`;

    const keyDrivers: string[] = [
      advCrossDesc,
      pivotZoneDesc,
      `RVOL: ${rvol}x (${rvol >= 2.0 ? 'ఇన్స్టిట్యూషనల్ వాల్యూమ్' : 'యాక్టివ్ వాల్యూమ్'})`,
      `డే గెయిన్: ${changePercent >= 0 ? '+' : ''}${changePercent}% (${changePercent >= 3 ? 'స్ట్రాంగ్ రన్నర్' : 'కన్ఫర్మ్డ్ మూవ్'})`,
      `20M పర్సిస్టెన్స్: ${persistenceScore.persistencePercent}% (${persistenceScore.persistenceLevel})`,
      `ఆర్డర్ ఫ్లో: ${buyerPressurePercent}% బయర్స్ (CVD: ${cvdTrend})`,
      `VWAP: ₹${vwap.toFixed(2)} కంటే ఎగువన స్థిరత్వం`,
    ];

    const volTagEn = hasStrict3MAdvCross ? '3M ADV Cross' : `Adaptive 5D Vol Pace (${fiveDayPaceMultipleNow}x)`;
    const volTagTe = hasStrict3MAdvCross ? '3M ADV వాల్యూమ్ క్రాస్' : `అడాప్టివ్ 5D వాల్యూమ్ పేస్ (${fiveDayPaceMultipleNow}x)`;

    let triggerCondition = currentPrice >= pivots.r1
      ? `${volTagEn} & R1/R2 Pivot Resistance Breakout`
      : `${volTagEn} above Central Pivot & VWAP`;
    let triggerConditionTe = currentPrice >= pivots.r1
      ? `${volTagTe} & R1/R2 పివోట్ రెసిస్టెన్స్ బ్రేక్‌అవుట్`
      : `${volTagTe} & సెంట్రల్ పివోట్ (PP) పైన బుల్లిష్ బ్రేక్‌అవుట్`;

    if (signalStage === 'STRONG_LONG') {
      if (rvol >= 3.0) {
        triggerCondition = currentPrice >= pivots.r1
          ? `${volTagEn} (${rvol}x RVOL) & R1/R2 Pivot Breakout`
          : `${volTagEn} (${rvol}x RVOL) & Central Pivot (PP) Expansion`;
        triggerConditionTe = currentPrice >= pivots.r1
          ? `${volTagTe}, ${rvol}x RVOL & R1/R2 పివోట్ బ్రేక్‌అవుట్`
          : `${volTagTe}, ${rvol}x RVOL & పివోట్ పాయింట్ (PP) పైన విస్తరణ`;
      } else {
        triggerCondition = `${volTagEn} & Multi-Factor Bullish Confirmation above Pivot (Score: ${overallScore.normalizedScore})`;
        triggerConditionTe = `${volTagTe} & పివోట్ పాయింట్ పైన బుల్లిష్ కన్ఫర్మేషన్ (స్కోర్: ${overallScore.normalizedScore})`;
      }
    } else if (signalStage === 'PRE_BREAKOUT_WATCH') {
      triggerCondition = `${volTagEn} & Pre-Breakout Base Compression above Pivot`;
      triggerConditionTe = `${volTagTe} & పివోట్ పాయింట్ (PP) వద్ద స్థిరమైన కంప్రెషన్ బేస్`;
    } else if (signalStage === 'DIP_RECOVERY') {
      triggerCondition = `Healthy Pullback Absorption above Rising VWAP, Pivot & ${volTagEn}`;
      triggerConditionTe = `${volTagTe}, సెంట్రల్ పివోట్ & పెరుగుతున్న VWAP వద్ద బయర్స్ అబ్జార్ప్షన్`;
    }

    qualification = {
      qualifiedTime: finalQualifiedTime,
      qualifiedPrice: triggerCandle ? Number(triggerCandle.close.toFixed(2)) : currentPrice,
      qualifiedScore: overallScore.normalizedScore,
      triggerCondition,
      triggerConditionTe,
      keyDrivers,
    };
  }

  const fiveDayBaseProfile = evaluateFiveDayBaseProfile({
    symbol,
    prevClose,
    currentVolume,
    effectiveAdv,
    expectedSessionVolume,
    rvol,
    rawSessionRvol: sessionRvol,
    totalScore: overallScore.totalScore,
    changePercent,
    isQualified: Boolean(qualification),
    inputLast5Days,
    isMorningSpikeAndStagnate,
    isSmoothStaircaseUptrend,
    isFirstHourHyperSpike,
    total5MCandles,
    buyerPressurePercent,
    cvdTrend,
  });

  if (qualification && fiveDayBaseProfile.priorityTier <= 3) {
    qualification.keyDrivers.unshift(fiveDayBaseProfile.tierLabelTe);
  }

  const earlySignalsTe: string[] = [];
  if (opening15MinVolumeMultiple >= 1.3) {
    earlySignalsTe.push(`ఉదయం 15-నిమిషాల ఓపెనింగ్ వాల్యూమ్ బరస్ట్: ${opening15MinVolumeMultiple}x ADV పేస్`);
  }
  if (vwapTightHoldPercent >= 75 && priceVsVWAP === 'ABOVE') {
    earlySignalsTe.push(`VWAP టైట్ హోల్డ్: ${vwapTightHoldPercent}% క్యాండిల్స్ VWAP (₹${vwap.toFixed(2)}) పైనే స్థిరత్వం`);
  }
  if (pocketPivotDetected) {
    earlySignalsTe.push(`పాకెట్ పివోట్ (Pocket Pivot): 5M క్యాండిల్ వాల్యూమ్ గత 10 బార్ల గరిష్టాన్ని దాటింది`);
  }
  if (rangeRetentionPercent >= 75) {
    earlySignalsTe.push(`డే-హై రిటెన్షన్: ఇంట్రాడే రేంజ్‌లో ${rangeRetentionPercent}% పైన బయ్యర్ల పట్టు`);
  }
  if (fiveDayBaseProfile.priorityTier <= 3) {
    earlySignalsTe.push(`5-రోజుల క్వైట్ అక్యుమ్యులేషన్ బేస్: ${fiveDayBaseProfile.tierLabelTe}`);
  }

  const earlyAccumulationRadar: EarlyAccumulationRadar = {
    earlyDetectionScore,
    isEarlyBreakoutCandidate,
    isFakeMorningGapTrap,
    opening15MinVolumeMultiple,
    vwapTightHoldPercent,
    rangeRetentionPercent,
    pocketPivotDetected,
    estimatedTrueMorningRank: isEarlyBreakoutCandidate ? Math.max(1, Math.min(15, Math.round((100 - earlyDetectionScore) / 2.5) + 1)) : 50,
    forensicWhyMissedMorningTe:
      `1) కోల్డ్-స్టార్ట్ అల్ఫాబెటికల్ ర్యాంక్ బగ్: 1,104 స్టాక్స్‌లో లైవ్ కోట్ వచ్చేలోపు 0% ఫ్లాట్ స్టాక్స్‌కు #1-#700 ర్యాంకులు ఇచ్చేయడం వల్ల ${symbol} లాంటి నిజమైన స్టాక్స్ క్వాలిఫై సమయానికి #400-#1045 ర్యాంక్ వద్ద నమోదయ్యాయి. 2) ఉదయం 09:40 కి పూర్తి 3M ADV (100% వాల్యూమ్) పూర్తవ్వాలనే నిబంధన వల్ల ఉదయం ${opening15MinVolumeMultiple}x పేస్ ఉన్నప్పటికీ మధ్యాహ్నం వరకు ఆలస్యమైంది (ఇప్పుడు Pro-Rated 3M ADV Pace ద్వారా ఉదయమే గుర్తించబడుతుంది).`,
    forensicWhyFakeMorningFailedTe:
      `ఉదయం టాప్-100 లో కనిపించిన ఫేక్ స్టాక్స్ (1) 0-వాల్యూమ్ అన్‌వెరిఫైడ్ కోల్డ్-స్టార్ట్ బేస్‌లైన్ స్టాక్స్ (ఇప్పుడు పూర్తిగా తొలగించబడ్డాయి), లేదా (2) ఓపెనింగ్ 5-నిమిషాల గ్యాప్-అప్ తర్వాత VWAP కోల్పోయి, రెడ్ క్యాండిల్స్ & ఫాలింగ్ CVD తో ఇన్స్టిట్యూషనల్ సెల్లింగ్ జరిగి సాయంత్రానికి పడిపోయిన 'ఓపెనింగ్ గ్యాప్ ట్రాప్స్'.`,
    earlySignalsTe,
  };

  // --- DATA-SCIENTIST SITUATIONAL INTELLIGENCE & ARCHETYPE ENGINE ---
  // Classifies the stock into one of the core institutional price-volume movement archetypes
  // and records all situational rule calibrations applied to this stock.
  let archetypeCode: SituationalArchetypeCode = 'STANDARD_PARTICIPATION';
  let archetypeName = 'Standard Institutional Participation';
  let archetypeNameTe = 'సాధారణ ఇన్స్టిట్యూషనల్ పార్టిసిపేషన్';
  let predictedTrajectoryTe = 'VWAP మరియు సెంట్రల్ పివోట్ పైన ఉన్నంత వరకు సాధారణ బుల్లిష్ ట్రెండ్ కొనసాగుతుంది.';

  const ignitionCandleRef =
    qualification && candles5M.find(c => c.time === qualification?.qualifiedTime)
      ? candles5M.find(c => c.time === qualification?.qualifiedTime)
      : midSessionIgnitionCandle || candles5M.find(c => (c.rvol ?? 1) >= 2.0 && c.close > c.open) || last5M;
  const ignitionTime = qualification?.qualifiedTime || ignitionCandleRef?.time || '09:30 AM';
  const ignitionPrice = qualification?.qualifiedPrice || ignitionCandleRef?.close || currentPrice;
  const ignitionBarRvol = Number((ignitionCandleRef?.rvol || rvol || 1.0).toFixed(2));
  const ignitionMin = parseISTTimeToMinutes(ignitionTime) ?? 585;

  if (hasPrior5DVolumeClimax || isFirstHourHyperSpike || isHyperVolatileSpike || isMorningSpikeAndStagnate) {
    archetypeCode = 'EXHAUSTION_OR_CHOP_TRAP';
    archetypeName = '5D Volume Climax / Volatility Exhaustion Trap';
    archetypeNameTe = '⚠️ 5D వాల్యూమ్ క్లైమాక్స్ / హై-వాలటాలిటీ ఎగ్జాస్టన్ ట్రాప్';
    predictedTrajectoryTe = 'గత 5 రోజుల్లోనే వాల్యూమ్ క్లైమాక్స్ ముగిసింది లేదా మొదటి గంటలో హై-వాలటాలిటీ స్పైక్ వచ్చింది; తదుపరి అప్‌సైడ్ పరిమితం.';
  } else if (fiveDayBaseProfile.priorityTier === 1 && fiveDayBaseProfile.volumeVsTodayRatio >= 2.5 && changePercent >= 4.0) {
    archetypeCode = 'SILENT_COIL_IGNITION';
    archetypeName = '5-Day Silent Coil Compression Ignition';
    archetypeNameTe = '🚀 1. నిశ్శబ్ద 5D కాయిల్ బేస్ నుండి ఆకస్మిక వాల్యూమ్ విস্ফोटనం (Silent Coil Ignition)';
    predictedTrajectoryTe = `గత 5 రోజులు <2% అతి తక్కువ రేంజ్‌లో కన్సాలిడేట్ అయి, నేడు 5D సగటు కంటే ${fiveDayBaseProfile.volumeVsTodayRatio}x భారీ వాల్యూమ్‌తో బ్రేక్‌అవుట్ అయింది — రోజంతా స్థిరమైన అప్‌ట్రెండ్ కొనసాగే అవకాశం అత్యధికం!`;
  } else if (isFlagResetAfterImpulse || isShakeoutAbsorbed) {
    archetypeCode = 'FLAG_RESET_SECOND_WAVE';
    archetypeName = 'Impulse -> Pullback Flag Reset -> 2nd Wave Breakout';
    archetypeNameTe = '🌊 2. ఇంపల్స్ తర్వాత పుల్‌బ్యాక్ రీసెట్ & 2వ వేవ్ బ్రేక్‌అవుట్ (Flag Reset Second Wave)';
    predictedTrajectoryTe = isFlagResetAfterImpulse
      ? '3-4 రోజుల క్రితం వచ్చిన ఇంపల్స్ తర్వాత వాల్యూమ్ తగ్గుతూ (Volume Contraction) హెల్తీ పుల్‌బ్యాక్ పూర్తి చేసుకుని, నేడు 2వ ఇన్స్టిట్యూషనల్ వేవ్ ప్రారంభమైంది!'
      : 'గత 5 రోజుల్లో వచ్చిన షేక్అవుట్ (Shakeout) సెల్లింగ్‌ను ఇన్స్టిట్యూషనల్ బయ్యర్లు పూర్తిగా అబ్జార్బ్ చేసుకుని కొత్త హైస్ వైపు నడిపిస్తున్నారు!';
  } else if (ignitionMin >= 610 && hasRollingIntradayIgnitionPace && changePercent >= 4.0) {
    archetypeCode = 'MID_SESSION_IGNITION_BREAKOUT';
    archetypeName = 'Quiet Morning Base -> Mid-Session Institutional Ignition';
    archetypeNameTe = '⚡ 3. ఉదయం కన్సాలిడేషన్ తర్వాత మిడ్-సెషన్ ఇగ్నిషన్ బ్రేక్‌అవుట్ (Mid-Session Ignition)';
    predictedTrajectoryTe = `ఉదయం మొదటి గంటలో నిశ్శబ్దంగా VWAP వద్ద బేస్ నిర్మించుకుని, ${ignitionTime} వద్ద ${ignitionBarRvol}x బార్ RVOL తో ఆకస్మిక ఇన్స్టిట్యూషనల్ బ్రేక్‌అవుట్ సాధించింది!`;
  } else if (opening15MinVolumeMultiple >= 1.35 && ignitionMin <= 605 && changePercent >= 3.5 && priceVsVWAP === 'ABOVE') {
    archetypeCode = 'MORNING_INSTITUTIONAL_DRIVE';
    archetypeName = 'Opening Institutional Drive & VWAP Hold';
    archetypeNameTe = '🔥 4. ఓపెనింగ్ ఇన్స్టిట్యూషనల్ డ్రైవ్ & స్టెయిర్‌కేస్ (Morning Institutional Drive)';
    predictedTrajectoryTe = `మార్కెట్ ప్రారంభమైన మొదటి 15-30 నిమిషాల్లోనే ${opening15MinVolumeMultiple}x వాల్యూమ్ పేస్‌తో ఇన్స్టిట్యూషనల్ బయ్యర్లు ఎంట్రీ ఇచ్చి రోజంతా VWAP పైన పట్టు నిలుపుకున్నారు!`;
  } else if (isSmoothStaircaseUptrend && changePercent >= 4.5) {
    archetypeCode = 'ALL_DAY_ACCUMULATION_STAIRCASE';
    archetypeName = 'All-Day Institutional Staircase Accumulation';
    archetypeNameTe = '📈 5. రోజంతా నిరంతర ఇన్స్టిట్యూషనల్ స్టెయిర్‌కేస్ అక్యుములేషన్ (Smooth Staircase)';
    predictedTrajectoryTe = 'ఎలాంటి ఆకస్మిక స్పైక్ ట్రాప్ లేకుండా ప్రతి గంటకూ మెట్లు ఎక్కినట్లు (Staircase) VWAP పైన నిరంతర కొనుగోళ్లతో పెరుగుతోంది.';
  }

  const situationalAdaptationsTe: string[] = [];
  if (isAdvOutlierAdjusted) {
    situationalAdaptationsTe.push(
      `📊 అడాప్టివ్ వాల్యూమ్ బేస్‌లైన్ (Regime Calibration): పాత లిస్టింగ్/బ్లాక్-డీల్ అవుట్‌లయర్ సగటు (${formatAdvShort(rawInputAdv)}) కు బదులుగా ప్రస్తుత యాక్టివ్ 5D/15D ట్రేడింగ్ బేస్‌లైన్ (${formatAdvShort(effectiveAdv)}) ఆధారంగా RVOL (${rvol}x) ఖచ్చితంగా గణించబడింది.`
    );
  }
  if (isFlagResetAfterImpulse) {
    situationalAdaptationsTe.push(
      `🔄 ఫ్లాగ్-రీసెట్ గుర్తింపు (Flag Reset Intelligence): గత 5 రోజుల్లోని గరిష్ట వాల్యూమ్ తర్వాత 2+ రోజుల పాటు వాల్యూమ్ తగ్గుతూ (Contraction) ధర కన్సాలిడేట్ అయినందున, దీనిని ఎగ్జాస్టన్‌గా కాకుండా '2వ వేవ్ బ్రేక్‌అవుట్'గా గుర్తించి పెనాల్టీ నుండి మినహాయించబడింది.`
    );
  }
  if (isShakeoutAbsorbed) {
    situationalAdaptationsTe.push(
      `🛡️ షేక్అవుట్ అబ్జార్ప్షన్ (Shakeout Absorption): గత 5 రోజుల్లో రెడ్ క్యాండిల్‌పై వచ్చిన సెల్లింగ్ వాల్యూమ్‌ను నేడు బయ్యర్లు పూర్తిగా అధిగమించినందున 5D Climax పెనాల్టీ తొలగించబడింది.`
    );
  }
  if (hasRollingIntradayIgnitionPace && ignitionMin >= 605) {
    situationalAdaptationsTe.push(
      `⚡ రోలింగ్ 15M మిడ్-సెషన్ ఇగ్నిషన్: మొదటి 15 నిమిషాల్లో వాల్యూమ్ తక్కువగా ఉన్నప్పటికీ, ${ignitionTime} వద్ద ₹${ignitionPrice.toFixed(2)} దగ్గర ${ignitionBarRvol}x RVOL బరస్ట్ రాగానే తక్షణమే క్వాలిఫై చేయబడింది.`
    );
  }
  if (isHealthyIntradayRetest) {
    situationalAdaptationsTe.push(
      `🛡️ ఫేక్-డౌన్ & రీ-టెస్ట్ ఫిల్టర్ (Fake-Down Shield): మధ్యలో తాత్కాలిక పుల్‌బ్యాక్ వచ్చినప్పటికీ రెడ్ క్యాండిల్ వాల్యూమ్ కేవలం ${(pullbackVolumeRatio * 100).toFixed(0)}% మాత్రమే ఉంది మరియు పివోట్/Fib 61.8% సపోర్ట్ నిలబెట్టుకుంది — అందువల్ల ఉదయం ఎర్లీ ఎంట్రీ (${ignitionTime}) మరియు టాప్ ర్యాంక్ చెక్కుచెదరకుండా రక్షించబడ్డాయి!`
    );
  }
  if (isHighPotentialityOverride) {
    situationalAdaptationsTe.push(
      `🔥 ఆల్-డే పొటెన్షియాలిటీ సినర్జీ (5-Pillar Potentiality ${fullDayPotentialityScore}/100): 1-2 పాత కండిషన్లు (5D వాల్యూమ్/తాత్కాలిక పుల్‌బ్యాక్) పూర్తిగా మ్యాచ్ కాకపోయినా, నేటి ప్రైస్ వెలాసిటీ + ఇంట్రాడే వాల్యూమ్ పేస్ + మూవింగ్ యావరేజ్ + ఆర్డర్ బుక్ బయ్యర్ సపోర్ట్ అత్యంత బలంగా ఉండటంతో టాప్ లీడర్‌గా గుర్తించబడింది!`
    );
  }
  if (qualification) {
    situationalAdaptationsTe.push(
      `🎯 ఎర్లీ ఎంట్రీ బ్రేక్‌అవుట్ లాక్: నిజమైన ఇన్స్టిట్యూషనల్ మొమెంటమ్ & టైమ్-ఆఫ్-డే వాల్యూమ్ పేస్ కలిసిన ${qualification.qualifiedTime} (₹${qualification.qualifiedPrice.toFixed(2)}) క్యాండిల్ వద్దే ఎర్లీ ఎంట్రీ లాక్ చేయబడింది.`
    );
  }

  const situationalIntelligence: SituationalIntelligenceProfile = {
    archetypeCode,
    archetypeName,
    archetypeNameTe,
    confidenceScore: Math.min(100, Math.max(25, Math.round(overallScore.normalizedScore))),
    ignitionTime,
    ignitionPrice,
    ignitionBarRvol,
    rawAdv3M: rawInputAdv,
    regimeAdjustedAdv: effectiveAdv,
    isAdvOutlierAdjusted,
    isFlagResetAfterImpulse,
    isShakeoutAbsorbed,
    hasMidSessionIgnition: hasRollingIntradayIgnitionPace,
    isHealthyIntradayRetest,
    isHighPotentialityOverride,
    fullDayPotentialityScore,
    pullbackVolumeRatio,
    fiveDayToTodayVolMultiple: fiveDayBaseProfile.volumeVsTodayRatio,
    predictedTrajectoryTe,
    situationalAdaptationsTe,
  };

  const baseResult = {
    symbol,
    name,
    nameTe: nameTe || name,
    sector,
    marketCapCr,
    currentPrice,
    change,
    changePercent,
    dayHigh,
    dayLow,
    dayOpen,
    prevClose,
    currentVolume,
    avgVolume: effectiveAdv,
    adv: effectiveAdv,
    adv3M: effectiveAdv,
    rvol,
    fullDayRvol,
    expectedSessionVolume,
    sessionRvol,
    vwap: Number(vwap.toFixed(2)),
    vwapSlope,
    priceVsVWAP,
    ema9: Number(ema9.toFixed(2)),
    ema21: Number(ema21.toFixed(2)),
    emaDistancePercent,
    emaSlope,
    trend15M,
    adx,
    adxSlope,
    plusDI,
    minusDI,
    buyerPressurePercent,
    sellerPressurePercent,
    cvd: Math.round(cvd),
    cvdTrend,
    cvdDivergence,
    atr,
    isCompression,
    marketState,
    signalStage,
    category,
    persistenceScore,
    overallScore,
    qualification,
    fiveDayBaseProfile,
    earlyAccumulationRadar,
    situationalIntelligence,
    last5Days: fiveDayBaseProfile.isVerifiedHistoricalData ? fiveDayBaseProfile.last5DaysData : undefined,
    hardFilters,
    tradePlan,
    pivots,
    strengths,
    strengthsTe,
    weaknesses,
    weaknessesTe,
    candles5M,
    candles15M,
    candles1H,
    greenCandlesCount,
    redCandlesCount,
    dojiCandlesCount,
    totalCandlesCount: total5MCandles,
    greenCandlePercent,
    redCandlePercent,
    dojiCandlePercent,
    activeRedThreshold,
    marketRegime,
    redCandleRatio: total5MCandles > 0 ? Number((redCandlesCount / total5MCandles).toFixed(3)) : 0,
    max5MBarJumpPercent,
    avgWickRatio,
    isExcessiveRedCandles,
    isHyperVolatileSpike,
    isFirstHourHyperSpike,
    penaltyPoints,
    redPenaltyPoints: redPenalty,
    lastUpdated: timeStr,
    momentumRvol,
    surgeRvol,
  };

  // --- BAHUBALI TRADE FILTER INTEGRATION ---
  const dayTurnoverCr = Number(((currentPrice * currentVolume) / 10000000).toFixed(2));
  
  // Calculate historical baseline using the new engine logic
  const rvolRes = calculateIntradayRvolEngine({
    currentCumulativeVolume: currentVolume,
    historicalTimeOfDayVolumes: [effectiveAdv], // Fallback if full hist not available
    minPeriods: 1, // Using current context as simplified history
  });

  const bahubali = evaluateBahubaliSignal({
    rvolStatus: rvolRes.status,
    rawRvol: rvolRes.raw_rvol,
    ltp: currentPrice,
    vwap,
    dayOpen,
    dayHigh,
    candleOpen: last5M.open,
    candleHigh: last5M.high,
    candleLow: last5M.low,
    candleClose: last5M.close,
    atr14: atr,
    dayTurnoverCr,
  });

  // Override Signal Stage if Bahubali confirms a STRONG_BUY
  let finalSignalStage = signalStage;
  if (bahubali.decision === 'STRONG_BUY' && signalStage !== 'MOMENTUM_TRAP') {
    finalSignalStage = 'STRONG_LONG';
  }

  return {
    ...baseResult,
    dayTurnoverCr,
    signalStage: finalSignalStage,
    bahubaliResult: bahubali,
  };
}

// STRICT PRIORITY-FIRST + ADAPTIVE BRAIN RANKING COMPARATOR (User Supreme Mandate):
// "ఇప్పటినుంచి కూడా స్టాక్ స్కోర్ ఎంతైనప్పటికీ కూడా టాప్ లిస్టులో ఎప్పుడు కూడా ప్రయారిటీ 1, ప్రయారిటీ 2 ఉండాలి —
//  మిగతా స్టాక్స్ అన్నిటిని కూడా అవాయిడ్ చేసేయండి! ప్రయారిటీ 1, ప్రయారిటీ 2 ఎన్ని స్టాక్స్ అయితే మ్యాచ్ అవుతాయో
//  వాటన్నింటికీ మొదటి ప్రాధాన్యత ఇవ్వాలి, ఆ తర్వాత లాస్ట్ లో స్పేస్ ఉంటే ప్రయారిటీ 3!
//  టెక్నికల్ స్కోర్ ఇవన్నీ కూడా తర్వాత — ముందు ప్రయారిటీ 1 -> ప్రయారిటీ 2 -> ప్రయారిటీ 3,
//  వీటిలో ఏవైతే మన మిగతా స్ట్రాటజీస్ కి సూట్ అవుతాయో వాటికి వెయిటేజ్/స్కోరింగ్ ఇస్తూ 1, 2, 3, 4, 5, 6 ర్యాంకులు కేటాయించాలి!"
export const compareStocksByTechnicalStrength = (a: StockIndicatorData, b: StockIndicatorData): number => {
  // -1. ZERO-FAKE-SIGNAL GUARD: Verified active trading volume vs 0-volume cold-start placeholder
  const aActive = a.currentVolume > 0 && (a.isLiveSynced !== false || a.changePercent !== 0);
  const bActive = b.currentVolume > 0 && (b.isLiveSynced !== false || b.changePercent !== 0);
  if (aActive !== bActive) {
    return aActive ? -1 : 1;
  }

  // -0.5. STRICT 3-MONTH AVERAGE VOLUME > 25,000 MANDATE
  const aAdvOk = (a.adv3M || a.adv || a.avgVolume || 0) > 25000;
  const bAdvOk = (b.adv3M || b.adv || b.avgVolume || 0) > 25000;
  if (aAdvOk !== bAdvOk) {
    return aAdvOk ? -1 : 1;
  }

  // 1. SUPREME PRIORITY-FIRST HIERARCHY (BEFORE TECHNICAL SCORE!):
  // Priority 1 (Tier 1) ALWAYS beats Priority 2 (Tier 2) ALWAYS beats Priority 3 (Tier 3) ALWAYS beats Tier 4!
  const tierA = a.fiveDayBaseProfile?.priorityTier ?? 4;
  const tierB = b.fiveDayBaseProfile?.priorityTier ?? 4;
  if (tierA !== tierB) {
    return tierA - tierB;
  }

  // 2. WITHIN THE SAME PRIORITY TIER (e.g. among all Priority 1 stocks, or among all Priority 2 stocks):
  // Demote genuine fake morning traps / exhaustion spikes below clean runners
  const aExhaustedTrap =
    Boolean(a.hardFilters?.isMorningSpikeAndStagnate) ||
    Boolean(a.hardFilters?.isFirstHourHyperSpike) ||
    Boolean(a.hardFilters?.isHyperVolatileSpike) ||
    Boolean(a.earlyAccumulationRadar?.isFakeMorningGapTrap);
  const bExhaustedTrap =
    Boolean(b.hardFilters?.isMorningSpikeAndStagnate) ||
    Boolean(b.hardFilters?.isFirstHourHyperSpike) ||
    Boolean(b.hardFilters?.isHyperVolatileSpike) ||
    Boolean(b.earlyAccumulationRadar?.isFakeMorningGapTrap);
  if (aExhaustedTrap !== bExhaustedTrap) {
    return aExhaustedTrap ? 1 : -1;
  }

  // 3. ADAPTIVE BRAIN PROGRESSIVE FUNNEL APEX (Top 3-5 Survivors of today's dynamic tightening layers)
  const aApex = Boolean(a.adaptiveBrain?.isTopApexLeader);
  const bApex = Boolean(b.adaptiveBrain?.isTopApexLeader);
  if (aApex !== bApex) {
    return aApex ? -1 : 1;
  }

  // 4. QUALIFIED BREAKOUT STATUS (Within same Priority Tier)
  const aQualified = Boolean(a.qualification);
  const bQualified = Boolean(b.qualification);
  if (aQualified !== bQualified) {
    return aQualified ? -1 : 1;
  }

  // 5. ADAPTIVE PARALLEL WEIGHTED SCORE + TECHNICAL SCORE COMPOSITE (Continuous multi-strategy suitability)
  const aParallel = a.adaptiveBrain?.parallelWeightScore ?? (a.overallScore?.normalizedScore ?? 0);
  const bParallel = b.adaptiveBrain?.parallelWeightScore ?? (b.overallScore?.normalizedScore ?? 0);
  const aComposite = aParallel * 0.55 + (a.overallScore?.normalizedScore ?? a.overallScore?.totalScore ?? 0) * 0.45;
  const bComposite = bParallel * 0.55 + (b.overallScore?.normalizedScore ?? b.overallScore?.totalScore ?? 0) * 0.45;
  if (Math.abs(bComposite - aComposite) >= 0.25) {
    return bComposite - aComposite;
  }

  // 6. TOTAL TECHNICAL SCORE
  const totalA = a.overallScore?.totalScore ?? 0;
  const totalB = b.overallScore?.totalScore ?? 0;
  if (totalB !== totalA) {
    return totalB - totalA;
  }

  // 7. RVOL (Higher Relative Volume multiple ranks higher)
  const aRvol = a.rvol || 0;
  const bRvol = b.rvol || 0;
  const rvolDiff = bRvol - aRvol;
  if (Math.abs(rvolDiff) >= 0.1) {
    return rvolDiff;
  }

  // 8. MOMENTUM VELOCITY & EARLY DETECTION BONUS
  const aDistToHOD = a.dayHigh > 0 ? Math.max(0, ((a.dayHigh - a.currentPrice) / a.dayHigh) * 100) : 999;
  const bDistToHOD = b.dayHigh > 0 ? Math.max(0, ((b.dayHigh - b.currentPrice) / b.dayHigh) * 100) : 999;
  const aEarlyBonus = (a.earlyAccumulationRadar?.earlyDetectionScore ?? 0) * 0.15;
  const bEarlyBonus = (b.earlyAccumulationRadar?.earlyDetectionScore ?? 0) * 0.15;
  const aMomVel = (a.overallScore?.tieBreakers?.momentumVelocity ?? (a.changePercent * 2.5 + Math.max(0, 10 - aDistToHOD * 3.5))) + aEarlyBonus;
  const bMomVel = (b.overallScore?.tieBreakers?.momentumVelocity ?? (b.changePercent * 2.5 + Math.max(0, 10 - bDistToHOD * 3.5))) + bEarlyBonus;
  if (Math.abs(bMomVel - aMomVel) > 0.01) {
    return bMomVel - aMomVel;
  }

  // 9. ORDER FLOW DOMINANCE
  const aOF = a.overallScore?.tieBreakers?.orderFlowDominance ?? (a.buyerPressurePercent - a.sellerPressurePercent);
  const bOF = b.overallScore?.tieBreakers?.orderFlowDominance ?? (b.buyerPressurePercent - b.sellerPressurePercent);
  if (Math.abs(bOF - aOF) > 0.01) {
    return bOF - aOF;
  }

  return (b.persistenceScore?.persistencePercent ?? 0) - (a.persistenceScore?.persistencePercent ?? 0);
};

/**
 * ADAPTIVE THINKING BRAIN ENGINE (Self-Adjusting Progressive Funnel + Parallel Weighted Scoring)
 *
 * Implements the user's exact adaptive decision philosophy:
 * 1. Mandatory Core Gate (Always enforced): Price Increase + Order Book Buyer Support + 5D Price & Volume Base (P1/P2/P3) + 3M ADV > 25,000.
 * 2. Dynamic Strategy Loosening vs Tightening:
 *    - Checks how many Priority 1 & Priority 2 stocks pass Mandatory Core in the live market right now.
 *    - If <= 5 candidates: LOOSENS secondary filters (LOOSE_EARLY_CAPTURE) so morning breakouts are never delayed.
 *    - If > 5 candidates: Progressively adds secondary technical layers ONE BY ONE (VWAP/Pivot -> RVOL/5D Vol -> EMA/15M Trend ->
 *      Order Flow & 20M Persistence -> Elite Smooth Staircase/HOD) and STOPS tightening as soon as the narrowed apex reaches Top 3-5!
 *    - Never over-filters a pool below 3 stocks (if a layer would reduce count below 3, skips that layer and stops).
 * 3. Parallel Weighted Scoring (0-100):
 *    - Every secondary strategy contributes continuous parallel weight so missing 1-2 optional conditions never disqualifies an EOD winner,
 *      while stocks matching MORE strategies cleanly take Ranks #1, #2, #3, #4, #5... within Priority 1 -> Priority 2 -> Priority 3!
 */
export const applyAdaptiveMarketBrain = (stocks: StockIndicatorData[]): StockIndicatorData[] => {
  if (stocks.length === 0) return stocks;

  // Step 1: Compute continuous Parallel Weighted Score (0-100) for every stock
  const computeParallelWeight = (s: StockIndicatorData): number => {
    const chg = Math.max(0, s.changePercent || 0);
    const rvol = Math.max(0, s.rvol || 0);
    const vol5dRatio = s.fiveDayBaseProfile?.volumeVsTodayRatio ?? 1.0;
    const bp = s.buyerPressurePercent ?? 50;
    const pers = s.persistenceScore?.persistencePercent ?? 0;
    const distHod = s.dayHigh > 0 ? Math.max(0, ((s.dayHigh - s.currentPrice) / s.dayHigh) * 100) : 5;

    // 1. Price Velocity & HOD Retention (20 pts)
    const wPrice = Math.min(20, chg * 2.2 + Math.max(0, 5 - distHod * 1.5));
    // 2. Volume RVOL, 5D Volume Surge & Non-Blocking 3M ADV Cross Bonus (20 pts)
    // 3M ADV crossing gives extra parallel weight, NEVER disqualifies early morning leaders!
    const advCrossBonus = (s.fullDayRvol ?? 0) >= 1.0 ? 4.0 : (s.sessionRvol ?? 0) >= 1.5 ? 2.5 : (s.sessionRvol ?? 0) >= 1.1 ? 1.2 : 0;
    const wVol = Math.min(20, Math.min(9.5, rvol * 2.1) + Math.min(6.5, vol5dRatio * 1.4) + advCrossBonus);
    // 3. Order Book & CVD Dominance (15 pts)
    const wOrderBook = Math.min(
      15,
      Math.max(0, (bp - 45) * 0.35) + (s.cvdTrend === 'RISING' ? 6 : s.cvdTrend === 'NEUTRAL' ? 2.5 : 0)
    );
    // 4. VWAP, Pivot & Multi-TF Moving Averages (15 pts)
    const wTrend = Math.min(
      15,
      (s.priceVsVWAP === 'ABOVE' ? 4.5 : s.situationalIntelligence?.isHealthyIntradayRetest ? 3.0 : 0) +
        (s.currentPrice >= (s.pivots?.pivot ?? 0) ? 3.0 : 0) +
        (s.ema9 > s.ema21 ? 4.0 : 0) +
        (s.trend15M === 'BULLISH' ? 3.5 : s.trend15M === 'NEUTRAL' ? 1.5 : 0)
    );
    // 5. 20M Persistence & Higher-Low Structure (12 pts)
    const wPers = Math.min(12, (pers / 100) * 9 + (s.persistenceScore?.hasHigherLowStructure ? 3 : 0));
    // 6. 5-Day Base Tightness Quality (10 pts)
    const tier = s.fiveDayBaseProfile?.priorityTier ?? 4;
    const wBase = tier === 1 ? 10 : tier === 2 ? 8 : tier === 3 ? 5.5 : 1;
    // 7. Smooth Uptrend / Retest Resilience / Early Detection (8 pts)
    const wResilience = Math.min(
      8,
      (s.situationalIntelligence?.isHealthyIntradayRetest ? 3 : 0) +
        (s.earlyAccumulationRadar?.pocketPivotDetected ? 2.5 : 0) +
        Math.min(4, ((s.earlyAccumulationRadar?.earlyDetectionScore ?? 0) / 100) * 4)
    );

    const trapDeduction =
      s.hardFilters?.isFirstHourHyperSpike || s.hardFilters?.isHyperVolatileSpike || s.hardFilters?.isMorningSpikeAndStagnate
        ? 25
        : 0;

    return Number(Math.max(0, Math.min(100, wPrice + wVol + wOrderBook + wTrend + wPers + wBase + wResilience - trapDeduction)).toFixed(2));
  };

  const parallelMap = new Map<string, number>();
  for (const s of stocks) {
    parallelMap.set(s.symbol, computeParallelWeight(s));
  }

  // Step 2: Identify Mandatory Core Pool among Priority 1 & Priority 2 stocks (and Priority 3 fallback)
  const isMandatoryCorePassed = (s: StockIndicatorData): boolean => {
    const active = s.currentVolume > 0 && (s.isLiveSynced !== false || s.changePercent !== 0);
    const advOk = (s.adv3M || s.adv || s.avgVolume || 0) > 25000;
    const tier = s.fiveDayBaseProfile?.priorityTier ?? 4;
    const notTrap =
      !s.hardFilters?.isFirstHourHyperSpike &&
      !s.hardFilters?.isHyperVolatileSpike &&
      !s.hardFilters?.isMorningSpikeAndStagnate;
    return active && advOk && tier <= 3 && s.changePercent > 0.5 && s.buyerPressurePercent >= 48 && notTrap;
  };

  const p12Pool = stocks.filter(s => isMandatoryCorePassed(s) && (s.fiveDayBaseProfile?.priorityTier ?? 4) <= 2);
  const p123Pool = stocks.filter(s => isMandatoryCorePassed(s));
  // If P1+P2 has at least 3 stocks, run the progressive tightening funnel strictly on P1+P2; else run on P1+P2+P3
  let workingPool = p12Pool.length >= 3 ? [...p12Pool] : [...p123Pool];

  const progressiveLayers: Array<{
    id: string;
    labelTe: string;
    predicate: (s: StockIndicatorData) => boolean;
  }> = [
    {
      id: 'L1_VWAP_PIVOT',
      labelTe: 'L1: VWAP & పివోట్ సపోర్ట్',
      predicate: s =>
        (s.priceVsVWAP === 'ABOVE' || Boolean(s.situationalIntelligence?.isHealthyIntradayRetest)) &&
        s.currentPrice >= (s.pivots?.pivot ?? 0),
    },
    {
      id: 'L2_3M_ADV_OR_5D_PACE',
      labelTe: 'L2: 3M ADV క్రాస్ / 5D వాల్యూమ్ పేస్',
      predicate: s =>
        (s.fullDayRvol ?? 0) >= 1.0 ||
        (s.rvol || 0) >= 1.65 ||
        (s.fiveDayBaseProfile?.volumeVsTodayRatio ?? 0) >= 2.0,
    },
    {
      id: 'L3_EMA_15M_TREND',
      labelTe: 'L3: EMA 9>21 & 15M అప్‌ట్రెండ్ (+2.0%)',
      predicate: s => s.ema9 >= s.ema21 && s.trend15M !== 'BEARISH' && s.changePercent >= 2.0,
    },
    {
      id: 'L4_ORDERBOOK_PERSISTENCE',
      labelTe: 'L4: ఆర్డర్ బుక్ (>=56%) & 20M పర్సిస్టెన్స్',
      predicate: s =>
        s.buyerPressurePercent >= 56 &&
        s.cvdTrend !== 'FALLING' &&
        (s.persistenceScore?.persistencePercent ?? 0) >= 65,
    },
    {
      id: 'L5_ELITE_CONVICTION',
      labelTe: 'L5: 3M ADV + ఎలైట్ స్కోర్ (>=90) & డే-హై సమీపం',
      predicate: s => {
        const distHod = s.dayHigh > 0 ? ((s.dayHigh - s.currentPrice) / s.dayHigh) * 100 : 99;
        return (s.overallScore?.totalScore ?? 0) >= 90 && distHod <= 2.5;
      },
    },
  ];

  const appliedIds: string[] = [];
  const appliedTe: string[] = [];
  let stoppedAtLayer = 0;

  // SELF-ADJUSTING SMART FUNNEL:
  // - If workingPool <= 5: LOOSE mode (stop immediately so early morning opportunities aren't blocked!)
  // - If workingPool > 5: Test layers one by one. If ANY individual layer (e.g. L2 3M ADV Cross in the first 60-90 mins)
  //   is too strict on that day (leaves < 3 stocks), AUTOMATICALLY BYPASS/LOOSEN that layer and evaluate the next layer!
  // - STOP tightening immediately once surviving candidates narrow to Top 3-5 apex leaders!
  if (workingPool.length > 5) {
    for (let idx = 0; idx < progressiveLayers.length; idx++) {
      const layer = progressiveLayers[idx];
      const narrowed = workingPool.filter(layer.predicate);
      // Never crush the pool below 3 stocks; bypass this specific layer if too strict today!
      if (narrowed.length < 3) {
        continue;
      }
      workingPool = narrowed;
      appliedIds.push(layer.id);
      appliedTe.push(layer.labelTe);
      stoppedAtLayer = appliedIds.length;
      if (workingPool.length <= 5) {
        break; // Reached Top 3-5 apex leaders — STOP tightening!
      }
    }
  }

  // If still > 5 even after all 5 layers, take Top 5 by Priority Tier -> Parallel Weight Score
  const apexRanked = [...workingPool].sort((a, b) => {
    const tA = a.fiveDayBaseProfile?.priorityTier ?? 4;
    const tB = b.fiveDayBaseProfile?.priorityTier ?? 4;
    if (tA !== tB) return tA - tB;
    return (parallelMap.get(b.symbol) ?? 0) - (parallelMap.get(a.symbol) ?? 0);
  });
  const apexSet = new Set(apexRanked.slice(0, 5).map(s => s.symbol));

  const brainRegime: AdaptiveBrainDecision['brainRegime'] =
    stoppedAtLayer === 0
      ? 'LOOSE_EARLY_CAPTURE'
      : stoppedAtLayer <= 3
      ? 'BALANCED_PROGRESSIVE'
      : 'STRICT_ELITE_SELECT';

  const brainRegimeLabelTe =
    brainRegime === 'LOOSE_EARLY_CAPTURE'
      ? '🟢 లూజ్ / ఎర్లీ క్యాప్చర్ మోడ్ (మార్కెట్ ప్రారంభ/తక్కువ స్టాక్స్ — తక్షణ ఎంట్రీ)'
      : brainRegime === 'BALANCED_PROGRESSIVE'
      ? `🟡 బ్యాలెన్స్‌డ్ ప్రోగ్రెసివ్ మోడ్ (${stoppedAtLayer} లేయర్లు అప్లై చేసి టాప్ ${apexSet.size} వద్ద ఆపబడింది)`
      : `🔥 స్ట్రిక్ట్ ఎలైట్ సెలెక్ట్ మోడ్ (అధిక బ్రేక్‌అవుట్ మార్కెట్ — 5 లేయర్లతో టాప్ ${apexSet.size} వడపోత)`;

  const brainSummaryTe =
    stoppedAtLayer === 0
      ? `ప్రస్తుతం ${p12Pool.length} ప్రయారిటీ 1 & 2 స్టాక్స్ మాత్రమే ఉన్నందున అదనపు కఠిన ఫిల్టర్లు ఆపివేసి నేరుగా ఎర్లీ ఎంట్రీకి అవకాశం ఇవ్వబడింది.`
      : `మొత్తం ${p12Pool.length} ప్రయారిటీ 1 & 2 స్టాక్స్ నుండి సిట్యువేషన్ బట్టి ${stoppedAtLayer} టెక్నికల్ లేయర్లు (${appliedTe.join(' → ')}) ఒక్కొక్కటిగా అప్లై చేసి టాప్ ${apexSet.size} అపెక్స్ లీడర్లు రాగానే ఆపివేయబడింది.`;

  for (const s of stocks) {
    const tier = s.fiveDayBaseProfile?.priorityTier ?? 4;
    const passedCore = isMandatoryCorePassed(s);
    s.adaptiveBrain = {
      brainRegime,
      brainRegimeLabelTe,
      passedMandatoryCore: passedCore,
      prioritySlotEligible: passedCore && tier <= 3,
      progressiveLayersApplied: appliedIds,
      progressiveLayersAppliedTe: appliedTe,
      stoppedAtLayer,
      isTopApexLeader: apexSet.has(s.symbol),
      parallelWeightScore: parallelMap.get(s.symbol) ?? 0,
      p12PoolCount: p12Pool.length,
      apexSurvivingCount: apexSet.size,
      brainSummaryTe,
    };
  }

  stocks.sort(compareStocksByTechnicalStrength);
  return stocks;
};

/**
 * Computes each qualified stock's true technical rank AT THE EXACT MOMENT IT QUALIFIED (qualifiedTime),
 * evaluated against all stocks that were already qualified/active at or before that timestamp.
 *
 * Why this replaces naive chronological sorting:
 * - Naive chronological sorting gave Rank #1, #2, #3 purely to whichever stock had the earliest timestamp
 *   (e.g. giving Rank #2 to a 09:30 AM stock or Rank #3 to a 09:45 AM stock regardless of its 5D volume hurdle,
 *    priority tier, or actual breakout strength at that timestamp).
 * - Instead, at each stock's qualification minute T_qual, we reconstruct the intraday state of all stocks
 *   qualified by T_qual (using their 5M candles up to T_qual, price gain % at T_qual, cumulative volume vs
 *   3M ADV & 5D max volume at T_qual, and 5-Day Priority Tier) and compute the stock's true rank at T_qual.
 */
export const computeHistoricalQualificationRanks = (stocks: StockIndicatorData[]): Map<string, number> => {
  const rankMap = new Map<string, number>();
  const qualifiedStocks = stocks.filter(
    s => Boolean(s.qualification?.qualifiedTime) && (s.adv3M || s.adv || s.avgVolume || 0) > 25000
  );
  if (qualifiedStocks.length === 0) return rankMap;

  interface PrecomputedSnap {
    stock: StockIndicatorData;
    qualMin: number;
    priorityTier: number;
    effectiveAdv: number;
    max5DVol: number;
    volScale: number;
    candleMinutes: number[];
    candleCloses: number[];
    candleVwaps: number[];
    candleCumVols: number[];
  }

  const snaps: PrecomputedSnap[] = qualifiedStocks.map(stock => {
    const qualMin = parseISTTimeToMinutes(stock.qualification?.qualifiedTime || '15:30') ?? 930;
    const priorityTier = stock.fiveDayBaseProfile?.priorityTier ?? 4;
    const effectiveAdv = Math.max(1, stock.adv3M || stock.adv || stock.avgVolume || 25000);
    const max5DVol = Math.max(
      0,
      ...((stock.last5Days || []).map(d => d.volume || 0))
    );
    const candles = stock.candles5M || [];
    const sum5MVol = candles.reduce((acc, c) => acc + (c.volume || 0), 0);
    const volScale = sum5MVol > 0 && stock.currentVolume > sum5MVol ? stock.currentVolume / sum5MVol : 1.0;

    const candleMinutes: number[] = [];
    const candleCloses: number[] = [];
    const candleVwaps: number[] = [];
    const candleCumVols: number[] = [];
    let runningVol = 0;

    for (let i = 0; i < candles.length; i++) {
      const c = candles[i];
      runningVol += c.volume || 0;
      const cMin = parseISTTimeToMinutes(c.time) ?? (555 + i * 5);
      candleMinutes.push(cMin);
      candleCloses.push(c.close);
      candleVwaps.push(c.vwap ?? stock.vwap);
      candleCumVols.push(runningVol * volScale);
    }

    return {
      stock,
      qualMin,
      priorityTier,
      effectiveAdv,
      max5DVol,
      volScale,
      candleMinutes,
      candleCloses,
      candleVwaps,
      candleCumVols,
    };
  });

  // Helper to evaluate any stock's historical strength score at target minute T
  const getStrengthAtMinute = (snap: PrecomputedSnap, targetMin: number): number => {
    const { stock, qualMin, priorityTier, effectiveAdv, max5DVol, candleMinutes, candleCloses, candleVwaps, candleCumVols } = snap;
    const prevClose = stock.prevClose || 1;

    let priceAtT = stock.qualification?.qualifiedPrice || stock.currentPrice;
    let vwapAtT = stock.vwap || priceAtT;
    let cumVolAtT = stock.currentVolume * Math.min(1, Math.max(0.15, (targetMin - 555) / 375));

    if (candleMinutes.length >= 6) {
      let bestIdx = -1;
      for (let i = 0; i < candleMinutes.length; i++) {
        if (candleMinutes[i] <= targetMin) {
          bestIdx = i;
        } else {
          break;
        }
      }
      if (bestIdx >= 0) {
        priceAtT = candleCloses[bestIdx];
        vwapAtT = candleVwaps[bestIdx];
        cumVolAtT = candleCumVols[bestIdx];
      }
    } else if (targetMin === qualMin && stock.qualification?.qualifiedPrice) {
      priceAtT = stock.qualification.qualifiedPrice;
    }

    const gainPctAtT = prevClose > 0 ? ((priceAtT - prevClose) / prevClose) * 100 : 0;
    const isAboveVwapAtT = priceAtT >= vwapAtT * 0.999;
    const tFrac = Math.max(0.04, (targetMin - 555) / 375);
    const expectedAdvByT = effectiveAdv * Math.max(0.06, 0.65 * tFrac + 0.35 * Math.pow(tFrac, 0.75));
    const rvolAtT = cumVolAtT / Math.max(1, expectedAdvByT);
    const fullAdvMultipleAtT = cumVolAtT / effectiveAdv;
    const cleared5DVolAtT = max5DVol <= 0 || cumVolAtT >= max5DVol * 0.9;

    // Composite historical technical merit at minute T:
    // 1. Must be above VWAP at minute T (if a stock dipped below VWAP at minute T, penalize heavily)
    let scoreAtT = isAboveVwapAtT ? 100 : 30;

    // 2. Price gain % at minute T (ideal runner >= 5% in afternoon, >= 3.5% in morning)
    scoreAtT += Math.min(45, Math.max(0, gainPctAtT * 4.2));

    // 3. 5-Day Base Priority Tier bonus (Tier 1 > Tier 2 > Tier 3 > Tier 4)
    const tierBonus = priorityTier === 1 ? 18 : priorityTier === 2 ? 12 : priorityTier === 3 ? 7 : 0;
    scoreAtT += tierBonus;

    // 4. Volume & RVOL expansion at minute T + 5D max volume clearance
    scoreAtT += Math.min(25, rvolAtT * 3.2) + Math.min(15, fullAdvMultipleAtT * 2.5);
    if (cleared5DVolAtT) {
      scoreAtT += 10;
    } else if (max5DVol > effectiveAdv * 2.0 && cumVolAtT < max5DVol * 0.75) {
      scoreAtT -= 14; // Still below heavy 5D climax volume at minute T
    }

    // 5. Tie-breaker from overall technical quality
    scoreAtT += (stock.overallScore?.normalizedScore ?? stock.overallScore?.totalScore ?? 75) * 0.25;

    return scoreAtT;
  };

  for (const targetSnap of snaps) {
    const tQual = targetSnap.qualMin;
    // All stocks that had qualified at or before tQual (plus stocks already trading above +3.5% & VWAP at tQual)
    const activePeers = snaps.filter(peer => {
      if (peer.stock.symbol === targetSnap.stock.symbol) return true;
      if (peer.qualMin <= tQual) return true;
      // Also include peers that had real 5M candles and were already up >= 4% above VWAP with >= 100% ADV at tQual
      if (peer.candleMinutes.length >= 6) {
        let idx = -1;
        for (let i = 0; i < peer.candleMinutes.length; i++) {
          if (peer.candleMinutes[i] <= tQual) idx = i;
          else break;
        }
        if (idx >= 0) {
          const pClose = peer.candleCloses[idx];
          const pVwap = peer.candleVwaps[idx];
          const pCumVol = peer.candleCumVols[idx];
          const pGain = peer.stock.prevClose > 0 ? ((pClose - peer.stock.prevClose) / peer.stock.prevClose) * 100 : 0;
          if (pClose >= pVwap && pGain >= 4.0 && pCumVol >= peer.effectiveAdv) {
            return true;
          }
        }
      }
      return false;
    });

    const targetStrength = getStrengthAtMinute(targetSnap, tQual);
    let betterCount = 0;
    for (const peer of activePeers) {
      if (peer.stock.symbol === targetSnap.stock.symbol) continue;
      const peerStrength = getStrengthAtMinute(peer, tQual);
      if (peerStrength > targetStrength + 0.001) {
        betterCount++;
      } else if (
        Math.abs(peerStrength - targetStrength) <= 0.001 &&
        compareStocksByTechnicalStrength(peer.stock, targetSnap.stock) < 0
      ) {
        betterCount++;
      }
    }

    rankMap.set(targetSnap.stock.symbol, betterCount + 1);
  }

  return rankMap;
};


