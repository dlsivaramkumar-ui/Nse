import { Candle, Timeframe } from '../types';
import { calculateEMA } from './technicalIndicators';

// Deterministic seed helper
function pseudoRandom(seed: number) {
  const x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
}

export interface StockArchetype {
  type: 'STRONG_TREND' | 'PRE_BREAKOUT_COMPRESSION' | 'HEALTHY_PULLBACK' | 'CHOPPY_RANGE' | 'MOMENTUM_TRAP';
}

// Fast IST time string calculation for candles
function formatISTTime(minutesFromMidnight: number): string {
  const h = Math.floor(minutesFromMidnight / 60) % 24;
  const m = minutesFromMidnight % 60;
  const h12 = h % 12 || 12;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hStr = h12 < 10 ? '0' + h12 : '' + h12;
  const mStr = m < 10 ? '0' + m : '' + m;
  return `${hStr}:${mStr} ${ampm}`;
}

// Cached IST date parts to avoid calling Intl repeatedly
let cachedISTParts: { year: number; month: number; day: number; hour: number; minute: number; expiresAt: number } | null = null;

export function getISTDateParts(): { year: number; month: number; day: number; hour: number; minute: number } {
  const now = Date.now();
  if (cachedISTParts && cachedISTParts.expiresAt > now) {
    return cachedISTParts;
  }
  const nowDate = new Date(now);
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  });
  const parts = formatter.formatToParts(nowDate);
  const getPart = (type: string) => parseInt(parts.find((p) => p.type === type)?.value || '0', 10);
  const result = {
    year: getPart('year') || nowDate.getFullYear(),
    month: getPart('month') || (nowDate.getMonth() + 1),
    day: getPart('day') || nowDate.getDate(),
    hour: getPart('hour') || 9,
    minute: getPart('minute') || 15,
    expiresAt: now + 30000, // cache 30s
  };
  cachedISTParts = result;
  return result;
}

export function generateCandlesForStock(
  symbol: string,
  basePrice: number,
  timeframe: Timeframe,
  prevClose?: number,
  dayHigh?: number,
  dayLow?: number,
  totalVolume?: number,
  avgVolume?: number,
  archetype?: StockArchetype['type']
): Candle[] {
  const istParts = getISTDateParts();
  const currentMinutesFromMidnight = istParts.hour * 60 + istParts.minute;
  const isMarketOpenNow = currentMinutesFromMidnight >= 555 && currentMinutesFromMidnight <= 930;

  let count = 50; // default session candles
  let minutesPerCandle = 5;
  if (timeframe === '15M') {
    minutesPerCandle = 15;
    count = isMarketOpenNow
      ? Math.max(1, Math.min(25, Math.floor((currentMinutesFromMidnight - 555) / 15) + 1))
      : 25;
  } else if (timeframe === '1H') {
    minutesPerCandle = 60;
    count = isMarketOpenNow
      ? Math.max(1, Math.min(7, Math.floor((currentMinutesFromMidnight - 555) / 60) + 1))
      : 7;
  } else {
    // 5M timeframe: market open 09:15 AM IST (555 mins)
    // STRICT INVARIANT: Exactly the number of 5M candles elapsed since 09:15 AM up to current live minute!
    // NEVER generate future candles (e.g. 10:10 AM when current time is 09:40 AM)
    count = isMarketOpenNow
      ? Math.max(1, Math.min(75, Math.floor((currentMinutesFromMidnight - 555) / 5) + 1))
      : 75;
  }

  // Symbol seed
  let seed = symbol.split('').reduce((acc, c) => acc + c.charCodeAt(0), 100);

  const startPrice = prevClose || basePrice * 0.992;
  const targetPrice = basePrice;
  const priceGainPercent = startPrice > 0 ? ((targetPrice - startPrice) / startPrice) * 100 : 0;

  // Decide archetype if not provided: ground directly in authentic price action
  const chosenArchetype =
    archetype ||
    (priceGainPercent >= 1.5
      ? 'STRONG_TREND'
      : priceGainPercent >= 0.4 && priceGainPercent < 1.5
      ? (seed % 2 === 0 ? 'STRONG_TREND' : 'PRE_BREAKOUT_COMPRESSION')
      : Math.abs(priceGainPercent) < 0.4
      ? 'PRE_BREAKOUT_COMPRESSION'
      : priceGainPercent <= -1.8
      ? 'CHOPPY_RANGE'
      : seed % 3 === 0
      ? 'HEALTHY_PULLBACK'
      : 'STRONG_TREND');
  const minPrice = dayLow || Math.min(startPrice, targetPrice) * 0.995;
  const maxPrice = dayHigh || Math.max(startPrice, targetPrice) * 1.005;

  const rawCandleData: Array<{
    timeStr: string;
    timestamp: number;
    open: number;
    high: number;
    low: number;
    close: number;
    rawVolWeight: number;
    buyerRatio: number;
  }> = [];

  let currentClose = startPrice;

  // Market opens at 09:15 AM IST. In UTC: 03:45 AM UTC
  const marketOpenMs = Date.UTC(istParts.year, istParts.month - 1, istParts.day, 3, 45, 0);

  for (let i = 0; i < count; i++) {
    const candleMinute = 555 + i * minutesPerCandle;
    // Strict invariant: during live market session, never allow any candle timestamp in the future!
    if (isMarketOpenNow && candleMinute > currentMinutesFromMidnight) {
      break;
    }
    const candleTimestamp = marketOpenMs + i * minutesPerCandle * 60 * 1000;
    const timeStr = formatISTTime(candleMinute);
    const r1 = pseudoRandom(seed++);
    const r2 = pseudoRandom(seed++);
    const r3 = pseudoRandom(seed++);

    const progress = i / (count - 1 || 1);

    // Dynamic stock-specific breakout timing (between 10% and 55% of session)
    const breakoutProgress = 0.10 + ((seed % 13) / 12) * 0.45;
    const isPostBreakout = progress >= breakoutProgress;

    const isUpTrend = priceGainPercent >= 0.4;
    const isDownTrend = priceGainPercent <= -0.4;

    // Authentic Price-Action Candle Direction:
    // When a stock is up (+1% to +15%), real charts have 68% - 78% GREEN candles!
    // When a stock is down, real charts have 68% - 78% RED candles.
    // In choppy sideways action, green and red are ~50/50.
    let isBullishCandle = false;
    if (isUpTrend) {
      // In uptrend: ~72% green candles, ~28% red pullback candles
      const pullbackThreshold = isPostBreakout ? 0.24 : 0.32;
      isBullishCandle = r1 > pullbackThreshold;
    } else if (isDownTrend) {
      // In downtrend: ~72% red candles, ~28% green bounce candles
      const bounceThreshold = 0.28;
      isBullishCandle = r1 < bounceThreshold;
    } else {
      isBullishCandle = r1 >= 0.50;
    }

    const open = Number(currentClose.toFixed(2));
    const totalRemaining = targetPrice - open;
    const remainingSteps = Math.max(1, count - i);
    const avgStepDelta = totalRemaining / remainingSteps;
    const volatility = basePrice * 0.0012;

    let close = open;
    if (i === count - 1) {
      close = targetPrice;
    } else if (isBullishCandle) {
      // Green candle: close strictly > open
      const gainStep = Math.max(0.05, Math.abs(avgStepDelta) * (1.1 + 0.7 * r2) + volatility * 0.3 * r3);
      close = Number((open + (isUpTrend ? gainStep : gainStep * 0.5)).toFixed(2));
      if (close <= open) close = Number((open + 0.05).toFixed(2));
    } else {
      // Red candle: close strictly < open
      const dropStep = Math.max(0.05, Math.abs(avgStepDelta) * (0.5 + 0.6 * r2) + volatility * 0.3 * r3);
      close = Number((open - (isDownTrend ? dropStep * 1.2 : dropStep * 0.7)).toFixed(2));
      if (close >= open) close = Number((open - 0.05).toFixed(2));
    }

    // Clamp within bounds
    close = Math.max(minPrice, Math.min(maxPrice, close));

    // High & Low
    let high = Number((Math.max(open, close) + r2 * volatility * 0.6).toFixed(2));
    let low = Number((Math.min(open, close) - r3 * volatility * 0.6).toFixed(2));

    if (dayHigh && high > dayHigh) high = dayHigh;
    if (dayLow && low < dayLow) low = dayLow;
    if (high < Math.max(open, close)) high = Math.max(open, close);
    if (low > Math.min(open, close)) low = Math.min(open, close);

    currentClose = close;

    // Intraday volume curve: Morning rush + Midday lull + Afternoon breakout
    const intradayCurve = 1.6 - 0.9 * Math.sin(progress * Math.PI); // U-curve
    let baseVolWeight = 1.0;
    if (chosenArchetype === 'STRONG_TREND') {
      // Massive volume spike right at the breakout candle
      if (Math.abs(progress - breakoutProgress) < (1.5 / count)) {
        baseVolWeight = 3.2 + 1.2 * r1; // Breakout surge candle!
      } else if (isPostBreakout) {
        baseVolWeight = 1.5 + 0.6 * progress;
      } else {
        baseVolWeight = 0.8 + 0.3 * progress;
      }
    } else if (chosenArchetype === 'PRE_BREAKOUT_COMPRESSION' && progress > 0.75) {
      baseVolWeight = 1.8;
    } else if (chosenArchetype === 'HEALTHY_PULLBACK' && progress >= 0.4 && progress < 0.75) {
      baseVolWeight = 0.5;
    }

    const rawVolWeight = Math.max(0.1, baseVolWeight * intradayCurve * (0.75 + r1 * 0.5));

    // Price-action grounded buyer/seller volume ratio
    const candleRange = Math.max(0.01, high - low);
    const closePos = (close - low) / candleRange;
    const bodyDir = (close - open) / candleRange;
    const upperWick = (high - Math.max(open, close)) / candleRange;
    const lowerWick = (Math.min(open, close) - low) / candleRange;
    let buyerRatio = 0.50 + 0.30 * bodyDir + 0.12 * (closePos - 0.5) + 0.08 * (lowerWick - upperWick);
    buyerRatio = Math.max(0.12, Math.min(0.88, Number(buyerRatio.toFixed(3))));

    rawCandleData.push({
      timeStr,
      timestamp: candleTimestamp,
      open,
      high,
      low,
      close,
      rawVolWeight,
      buyerRatio,
    });
  }

  // Volume Calibration: accurately distribute real totalVolume across candles
  const totalWeight = rawCandleData.reduce((acc, c) => acc + c.rawVolWeight, 0) || 1;
  const targetTotalVolume = totalVolume && totalVolume > 0 ? totalVolume : 1500000;

  const candles: Candle[] = [];
  let cumVol = 0;
  let cumTypicalVol = 0;
  let cumCvd = 0;

  for (let i = 0; i < rawCandleData.length; i++) {
    const raw = rawCandleData[i];
    let vol = Math.max(10, Math.round((raw.rawVolWeight / totalWeight) * targetTotalVolume));
    if (i === rawCandleData.length - 1 && totalVolume && totalVolume > 0) {
      // Ensure the sum matches totalVolume exactly on the final bar
      const diff = targetTotalVolume - (cumVol + vol);
      vol = Math.max(10, vol + diff);
    }

    const buyerVolume = Math.round(vol * raw.buyerRatio);
    const sellerVolume = vol - buyerVolume;
    const delta = buyerVolume - sellerVolume;

    cumVol += vol;
    const typicalPrice = (raw.high + raw.low + raw.close) / 3;
    cumTypicalVol += typicalPrice * vol;
    const vwap = Number((cumTypicalVol / (cumVol || 1)).toFixed(2));
    cumCvd += delta;

    candles.push({
      time: raw.timeStr,
      timestamp: raw.timestamp,
      open: raw.open,
      high: raw.high,
      low: raw.low,
      close: raw.close,
      volume: vol,
      buyerVolume,
      sellerVolume,
      barDelta: delta,
      vwap,
      cvd: cumCvd,
    });
  }

  // Calculate EMA 9 & EMA 21 on the candles, plus 20-period Volume MA for RVOL
  const closes = candles.map((c) => c.close);
  const ema9Arr = calculateEMA(closes, 9);
  const ema21Arr = calculateEMA(closes, 21);

  for (let j = 0; j < candles.length; j++) {
    candles[j].ema9 = Number(ema9Arr[j].toFixed(2));
    candles[j].ema21 = Number(ema21Arr[j].toFixed(2));

    const startIdx = Math.max(0, j - 19);
    const window = candles.slice(startIdx, j + 1);
    const sumVol = window.reduce((s, c) => s + c.volume, 0);
    const avgVol = sumVol / (window.length || 1);
    candles[j].rvol = Number((candles[j].volume / (avgVol || 1)).toFixed(2));
  }

  return candles;
}
