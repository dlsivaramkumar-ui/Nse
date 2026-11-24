import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { NSE_UNIVERSE } from './src/data/nseUniverse';
import fullUniverseData from './src/data/nseFullUniverse.json';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface LiveQuote {
  symbol: string;
  price: number;
  prevClose: number;
  change: number;
  changePercent: number;
  dayHigh: number;
  dayLow: number;
  volume: number;
  adv?: number; // 3-month Average Daily Volume
  adv3m?: number; // Explicit 3-month Average Daily Volume
  rvol?: number; // Session Time-of-Day RVOL = volume / expectedTimeOfDayVolume
  fullDayRvol?: number; // Full day volume / adv
  expectedSessionVolume?: number; // Expected volume up to current IST minute
  dayOpen?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  last5Days?: HistoricalDaySummary[];
  candles5M?: any[];
  timestamp: number;
  marketState?: string;
  currency?: string;
  exchange?: string;
}

function getCurrentISTDateKey(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

// In-memory cache for high-frequency requests (auto-invalidates on IST trading date rollover)
const quoteCache = new Map<string, { data: LiveQuote; expiresAt: number; cachedIstDate?: string }>();
const candleCache = new Map<string, { data: any; expiresAt: number }>();

export interface HistoricalDaySummary {
  dateStr: string;
  open?: number;
  high?: number;
  low?: number;
  close: number;
  prevClose: number;
  changePercent: number;
  volume: number;
  upperWickRatio?: number;
  intradaySpikePct?: number;
  isVerifiedReal?: boolean;
}

const advCache = new Map<
  string,
  {
    adv: number;
    last5Days?: HistoricalDaySummary[];
    expiresAt: number;
    cachedIstDate?: string;
    isSeeded?: boolean;
  }
>();

const SYMBOL_ALIAS_MAP: Record<string, string> = {
  TATAMOTORS: 'TMPV.NS',
  TMPV: 'TMPV.NS',
  TMCV: 'TMCV.NS',
  NIFTY: '^NSEI',
  BANKNIFTY: '^NSEBANK',
  PINELABS: 'PINELABS.NS',
  HBLPOWER: 'HBLENGINE.NS',
  HBL: 'HBLENGINE.NS',
  HBLENGINE: 'HBLENGINE.NS',
  ZOMATO: 'ETERNAL.NS',
  ETERNAL: 'ETERNAL.NS',
  MUKAND: 'MUKANDLTD.NS',
  MUKANDLTD: 'MUKANDLTD.NS',
  SWANENERGY: 'SWANCORP.NS',
  SWANCORP: 'SWANCORP.NS',
  SWAN: 'SWANCORP.NS',
  TIPSINDLTD: 'TIPSMUSIC.NS',
  TIPSINDIA: 'TIPSMUSIC.NS',
  TIPSMUSIC: 'TIPSMUSIC.NS',
  TATAMTRDVR: 'TMPV.NS',
  AEGISCHEM: 'AEGISLOG.NS',
  AEGISLOG: 'AEGISLOG.NS',
  MCDOWELL: 'UNITDSPR.NS',
  'MCDOWELL-N': 'UNITDSPR.NS',
  UNITDSPR: 'UNITDSPR.NS',
  GUJGASLTD: 'GUJGAS.NS',
  GUJGAS: 'GUJGAS.NS',
  ATFL: 'SUNDROP.NS',
  SUNDROP: 'SUNDROP.NS',
  MMFIN: 'M&MFIN.NS',
  MNMFIN: 'M&MFIN.NS',
  'M&MFIN': 'M&MFIN.NS',
  'M&M': 'M&M.NS',
  MM: 'M&M.NS',
  M_M: 'M&M.NS',
  GROWW: 'GROWW.NS',
  GOWW: 'GROWW.NS',
  IXIGO: 'IXIGO.NS',
  TRAVENUES: 'IXIGO.NS',
  GYFTR: 'GYFTR.NS',
  GIFTR: 'GYFTR.NS',
  A1STEELS: 'AONESTEELS.NS',
  A1STEEL: 'AONESTEELS.NS',
  AONESTEEL: 'AONESTEELS.NS',
  AONESTEELS: 'AONESTEELS.NS',
  SSRETAILS: 'SSRETAIL.NS',
  SSRETAIL: 'SSRETAIL.NS',
  TSFINV: 'TSFINV.NS',
  MSTC: 'MSTCLTD.NS',
  MSTCLTD: 'MSTCLTD.NS',
};

const EXPLICIT_DELISTED_SYMBOLS = new Set([
  'TCNSBRANDS',
  'JCHAC',
  'SUNDARMHLD',
  'IDFC',
  'ISEC',
  'ADORWELD',
  'ALLSEC',
  'BANKNIFTY1',
  'EQUAL50ADD',
  'HDFCGROWTH',
  'HDFCSML250',
  'HDFCVALUE',
  'HEALTHADD',
  'MIDCAP',
  'NIFMID150',
  'LIQUID1',
  'LIQUIDADD',
  'LIQUIDCASE',
  'LIQUIDSBI',
  'LOWVOL',
  'MAKEINDIA',
  'MANGCHEFER',
  'MIDQ50ADD',
  'MOM50',
  'MON100',
  'MOQUALITY',
  'MOREALTY',
  'MOVALUE',
  'NEXT50',
  'NPBET',
  'NV20',
  'PSUBANK',
]);

function getYahooTicker(symbol: string): string {
  const trimmed = symbol.trim().toUpperCase();
  if (SYMBOL_ALIAS_MAP[trimmed]) {
    return SYMBOL_ALIAS_MAP[trimmed];
  }
  // Allow '&' in symbols (e.g. M&MFIN, M&M, etc.)
  const clean = trimmed.replace(/[^A-Z0-9-&]/g, '');
  if (SYMBOL_ALIAS_MAP[clean]) {
    return SYMBOL_ALIAS_MAP[clean];
  }
  const noAmp = clean.replace(/&/g, '');
  if (SYMBOL_ALIAS_MAP[noAmp]) {
    return SYMBOL_ALIAS_MAP[noAmp];
  }
  if (clean.endsWith('.NS') || clean.endsWith('.BO') || clean.startsWith('^')) {
    return clean;
  }
  return `${clean}.NS`;
}

// Calculate expected fraction of total daily volume elapsed based on IST market hours (09:15 to 15:30 = 375 minutes)
function getNSEMarketElapsedFraction(): number {
  const now = new Date();
  const istFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
    weekday: 'short',
  });
  const parts = istFormatter.formatToParts(now);
  const weekday = parts.find((p) => p.type === 'weekday')?.value;
  const isWeekend = weekday === 'Sat' || weekday === 'Sun';
  const hour = parseInt(parts.find((p) => p.type === 'hour')?.value || '9', 10);
  const minute = parseInt(parts.find((p) => p.type === 'minute')?.value || '15', 10);
  const currentMin = hour * 60 + minute;

  const MARKET_OPEN = 555; // 09:15 AM
  const MARKET_CLOSE = 930; // 03:30 PM
  const TOTAL_SESSION = 375; // 6 hours 15 mins

  if (isWeekend || currentMin >= MARKET_CLOSE || currentMin < MARKET_OPEN) {
    // Outside active trading hours or completed session: full session comparison
    return 1.0;
  }

  const elapsed = currentMin - MARKET_OPEN;
  const t = Math.max(0.01, Math.min(1.0, elapsed / TOTAL_SESSION));
  // Authentic NSE U-shaped cumulative volume curve:
  // heavier at opening (~18% in first 45 mins), steady midday, pickup at close
  const profile = 0.65 * t + 0.35 * Math.pow(t, 0.75);
  return Math.max(0.04, Math.min(1.0, Number(profile.toFixed(3))));
}

// Pre-seed ADV cache with verified 3-Month Average Daily Volumes from NSE universe
function initAdvCache() {
  const now = Date.now();
  (fullUniverseData as any[]).forEach((s) => {
    // Ignore placeholder 100,000 values so they get dynamically fetched from 3-Month daily history
    if (s.avgVolume && s.avgVolume > 0 && s.avgVolume !== 100000) {
      const ticker = getYahooTicker(s.symbol);
      advCache.set(ticker, { adv: s.avgVolume, expiresAt: now + 86400000, isSeeded: true });
      advCache.set(s.symbol, { adv: s.avgVolume, expiresAt: now + 86400000, isSeeded: true });
    }
  });
}
initAdvCache();

// Data-Scientist Outlier-Resistant & Post-Listing Regime-Aware 3-Month ADV Calculator:
// Prevents 1-off IPO listing-week spikes (e.g. SSRETAIL 45M listing week vs 4.1L-8.9L normal regime)
// or single-day block-deal outliers from distorting a stock's true institutional daily volume baseline!
function calculateAdaptive3MonthADV(historicalBars: { volume: number }[], fallbackAdv: number): number {
  const nonZero = historicalBars.filter((b) => typeof b.volume === 'number' && b.volume > 0);
  if (nonZero.length === 0) return fallbackAdv;

  const vols = nonZero.map((b) => b.volume);
  const rawMean = Math.round(vols.reduce((a, b) => a + b, 0) / vols.length);
  if (vols.length < 6) return rawMean > 0 ? rawMean : fallbackAdv;

  const sorted = [...vols].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const medianVol = sorted.length % 2 !== 0 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);

  // Windsorize extreme 1-off listing/block-deal outlier days at 3.2x median volume
  const windsorCap = Math.max(medianVol * 3.2, 50000);
  const trimmedVols = vols.map((v) => Math.min(v, windsorCap));
  const trimmedMean = Math.round(trimmedVols.reduce((a, b) => a + b, 0) / trimmedVols.length);

  // Recent 10-day and 15-day post-stabilization regime volume
  const recent10 = vols.slice(-10);
  const recent15 = vols.slice(-15);
  const recent10Mean = Math.round(recent10.reduce((a, b) => a + b, 0) / recent10.length);
  const recent15Mean = Math.round(recent15.reduce((a, b) => a + b, 0) / recent15.length);

  // If rawMean is > 2.5x the recent 15-day mean (e.g. recent IPO like SSRETAIL where listing week was 30M-45M
  // and post-listing settled regime is 4L-9L), blend recent 15-day regime with median/trimmed baseline
  if (rawMean > recent15Mean * 2.5 && recent10Mean > 25000) {
    const regimeBlended = Math.round(recent15Mean * 0.55 + recent10Mean * 0.25 + Math.min(medianVol, trimmedMean) * 0.20);
    return Math.max(25001, regimeBlended);
  }

  return Math.max(1, rawMean);
}

// Fetch accurate 3-Month Average Daily Volume (ADV) and Last 5 Days history from historical daily bars
async function fetchTicker3MonthADV(ticker: string, cleanSymbol?: string): Promise<number> {
  const now = Date.now();
  const cached = advCache.get(ticker) || (cleanSymbol ? advCache.get(cleanSymbol) : undefined);
  
  const todayIstDate = getCurrentISTDateKey();
  // MANDATE: Seeded values from JSON are often wrong by 10x (Lakh vs Million).
  // ONLY trust cached values if they were fetched from Yahoo (!isSeeded), match today's IST trading date, and have verified last5Days.
  if (
    cached &&
    !cached.isSeeded &&
    cached.cachedIstDate === todayIstDate &&
    cached.expiresAt > now &&
    cached.adv > 0 &&
    cached.adv !== 100000 &&
    cached.adv !== 5000000 &&
    cached.last5Days &&
    cached.last5Days.length > 0
  ) {
    return cached.adv;
  }

  // Fetch true 3-Month daily volume & price history from Yahoo Finance v8 chart
  try {
    let res: Response | null = null;
    const url2 = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=3mo`;
    try {
      res = await fetch(url2, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(2400),
      });
    } catch {
      try {
        const url1 = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=3mo`;
        res = await fetch(url1, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            Accept: 'application/json',
          },
          signal: AbortSignal.timeout(2400),
        });
      } catch {}
    }

    if (res && res.ok) {
      const json = (await res.json()) as any;
      const result = json?.chart?.result?.[0];
      const timestamps: number[] = result?.timestamp || [];
      const quoteObj = result?.indicators?.quote?.[0] || {};
      const rawVols: any[] = quoteObj.volume || [];
      const rawCloses: any[] = quoteObj.close || [];
      const rawOpens: any[] = quoteObj.open || [];
      const rawHighs: any[] = quoteObj.high || [];
      const rawLows: any[] = quoteObj.low || [];

      const validDailyBars: { dateStr: string; open: number; high: number; low: number; close: number; volume: number }[] = [];
      for (let i = 0; i < timestamps.length; i++) {
        const v = rawVols[i];
        const c = rawCloses[i];
        if (typeof v === 'number' && v > 0 && typeof c === 'number' && c > 0) {
          const dStr = new Date(timestamps[i] * 1000).toLocaleDateString('en-IN', {
            timeZone: 'Asia/Kolkata',
            day: '2-digit',
            month: 'short',
          });
          validDailyBars.push({
            dateStr: dStr,
            open: Number((rawOpens[i] ?? c).toFixed(2)),
            high: Number((rawHighs[i] ?? c).toFixed(2)),
            low: Number((rawLows[i] ?? c).toFixed(2)),
            close: Number(c.toFixed(2)),
            volume: Math.round(v),
          });
        }
      }

      if (validDailyBars.length > 0) {
        // Exclude today's partial/latest bar so historical baseline & last 5 prior days are strictly prior completed sessions
        const historicalBars = validDailyBars.length > 1 ? validDailyBars.slice(0, -1) : validDailyBars;
        const calculatedAdv = calculateAdaptive3MonthADV(historicalBars, 25000);

        // Extract last 5 completed trading days (with daily % change, OHLC wick profile & volume)
        const last5Days: HistoricalDaySummary[] = [];
        const startIdx = Math.max(0, historicalBars.length - 5);
        for (let idx = startIdx; idx < historicalBars.length; idx++) {
          const bar = historicalBars[idx];
          const prevBar = idx > 0 ? historicalBars[idx - 1] : bar;
          const pClose = prevBar.close > 0 ? prevBar.close : bar.close;
          const chgPct = pClose > 0 ? Number((((bar.close - pClose) / pClose) * 100).toFixed(2)) : 0;
          const barRange = Math.max(0.01, bar.high - bar.low);
          const upperWick = Math.max(0, bar.high - Math.max(bar.open, bar.close));
          const upperWickRatio = Number((upperWick / barRange).toFixed(2));
          const intradaySpikePct = pClose > 0 ? Number((((bar.high - pClose) / pClose) * 100).toFixed(2)) : chgPct;
          last5Days.push({
            dateStr: bar.dateStr,
            open: bar.open,
            high: bar.high,
            low: bar.low,
            close: bar.close,
            prevClose: pClose,
            changePercent: chgPct,
            volume: bar.volume,
            upperWickRatio,
            intradaySpikePct,
            isVerifiedReal: true,
          });
        }

        if (calculatedAdv > 0) {
          const cacheEntry = {
            adv: calculatedAdv,
            last5Days,
            expiresAt: now + 86400000,
            cachedIstDate: todayIstDate,
            isSeeded: false,
          };
          advCache.set(ticker, cacheEntry);
          if (cleanSymbol) advCache.set(cleanSymbol, cacheEntry);
          return calculatedAdv;
        }
      }
    }
  } catch (err) {
    // Non-blocking fallback
  }

  // Fallback to existing valid cache or universe baseline
  if (cached && cached.adv > 0) return cached.adv;
  const sym = cleanSymbol || ticker.replace(/\.NS$|\.BO$/, '');
  const uStock = NSE_UNIVERSE.find((u) => u.symbol === sym);
  const baseline = (uStock?.avgVolume && uStock.avgVolume !== 100000) ? uStock.avgVolume : 25000;
  advCache.set(ticker, { adv: baseline, expiresAt: now + 3600000 });
  return baseline;
}

// Fetch single quote + 3-Month ADV + Last 5 Days history from Yahoo Finance in ONE unified request
async function fetchYahooQuote(symbol: string): Promise<LiveQuote | null> {
  const cleanSymbol = symbol.trim().toUpperCase().replace(/\.NS$|\.BO$/, '');
  if (EXPLICIT_DELISTED_SYMBOLS.has(cleanSymbol)) {
    return null;
  }
  const ticker = getYahooTicker(cleanSymbol);
  const now = Date.now();
  const todayIst = getCurrentISTDateKey();
  const cached = quoteCache.get(ticker);
  if (
    cached &&
    cached.cachedIstDate === todayIst &&
    cached.expiresAt > now &&
    cached.data.last5Days &&
    cached.data.last5Days.length >= 3
  ) {
    if (cached.data.changePercent >= 2.5 && (!cached.data.candles5M || cached.data.candles5M.length < 5)) {
      try {
        const candlePayload = await fetchYahooCandles(cleanSymbol, '5M');
        if (candlePayload?.candles && candlePayload.candles.length >= 5) {
          cached.data.candles5M = candlePayload.candles;
        }
      } catch {}
    }
    return cached.data;
  }

  try {
    // Unified single-request 1d/3mo chart fetch: provides live regularMarketPrice, dayHigh, dayLow, volume,
    // 52W High/Low, exact prior-day prevClose, 3-Month ADV, AND Last 5 Days OHLCV in ONE HTTP call!
    let response: Response | null = null;
    try {
      response = await fetch(
        `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=3mo`,
        {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            Accept: 'application/json',
          },
          signal: AbortSignal.timeout(2500),
        }
      );
    } catch {
      try {
        response = await fetch(
          `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=3mo`,
          {
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
              Accept: 'application/json',
            },
            signal: AbortSignal.timeout(2500),
          }
        );
      } catch {}
    }

    if (!response || !response.ok) {
      if (cached) return cached.data;
      return null;
    }

    const json = (await response.json()) as any;
    const result = json?.chart?.result?.[0];
    if (!result || !result.meta) {
      if (cached) return cached.data;
      return null;
    }

    const meta = result.meta;
    const timestamps: number[] = result.timestamp || [];
    const quoteObj = result.indicators?.quote?.[0] || {};
    const rawVols: any[] = quoteObj.volume || [];
    const rawCloses: any[] = quoteObj.close || [];
    const rawOpens: any[] = quoteObj.open || [];
    const rawHighs: any[] = quoteObj.high || [];
    const rawLows: any[] = quoteObj.low || [];

    const regDateStr = meta.regularMarketTime
      ? new Date(meta.regularMarketTime * 1000).toLocaleDateString('en-IN', {
          timeZone: 'Asia/Kolkata',
          day: '2-digit',
          month: 'short',
        })
      : '';

    const validDailyBars: {
      dateStr: string;
      open: number;
      high: number;
      low: number;
      close: number;
      volume: number;
    }[] = [];

    for (let i = 0; i < timestamps.length; i++) {
      const dStr = new Date(timestamps[i] * 1000).toLocaleDateString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: 'short',
      });
      const isCurrentSessionBar = i === timestamps.length - 1 && (!regDateStr || dStr === regDateStr);
      const v = rawVols[i] ?? (isCurrentSessionBar ? meta.regularMarketVolume : null);
      const c = rawCloses[i] ?? (isCurrentSessionBar ? meta.regularMarketPrice : null);

      if (typeof v === 'number' && v >= 0 && typeof c === 'number' && c > 0) {
        const barEntry = {
          dateStr: dStr,
          open: Number((rawOpens[i] ?? c).toFixed(2)),
          high: Number((rawHighs[i] ?? (isCurrentSessionBar ? meta.regularMarketDayHigh : null) ?? c).toFixed(2)),
          low: Number((rawLows[i] ?? (isCurrentSessionBar ? meta.regularMarketDayLow : null) ?? c).toFixed(2)),
          close: Number(c.toFixed(2)),
          volume: Math.round(v),
        };
        if (validDailyBars.length > 0 && validDailyBars[validDailyBars.length - 1].dateStr === dStr) {
          validDailyBars[validDailyBars.length - 1] = barEntry;
        } else {
          validDailyBars.push(barEntry);
        }
      }
    }

    const lastValidBar = validDailyBars.length > 0 ? validDailyBars[validDailyBars.length - 1] : null;
    const hasTodayBarInArray = Boolean(lastValidBar && (!regDateStr || lastValidBar.dateStr === regDateStr));

    const todayBar = hasTodayBarInArray ? lastValidBar : null;
    const yesterdayBar = hasTodayBarInArray
      ? validDailyBars.length > 1
        ? validDailyBars[validDailyBars.length - 2]
        : lastValidBar
      : lastValidBar;

    const price = Number((meta.regularMarketPrice ?? todayBar?.close ?? yesterdayBar?.close ?? 0).toFixed(2));
    let prevClose = Number((yesterdayBar?.close ?? meta.previousClose ?? price).toFixed(2));
    const dayOpen = Number((todayBar?.open ?? meta.regularMarketOpen ?? prevClose).toFixed(2));
    const dayHigh = Number((meta.regularMarketDayHigh ?? todayBar?.high ?? Math.max(price, prevClose)).toFixed(2));
    const dayLow = Number((meta.regularMarketDayLow ?? todayBar?.low ?? Math.min(price, prevClose)).toFixed(2));
    let volume = meta.regularMarketVolume ?? todayBar?.volume ?? 0;
    if (todayBar && todayBar.volume > volume) {
      volume = todayBar.volume;
    }

    const fiftyTwoWeekHigh = meta.fiftyTwoWeekHigh;
    const fiftyTwoWeekLow = meta.fiftyTwoWeekLow;

    let change = Number((price - prevClose).toFixed(2));
    let changePercent = prevClose ? Number(((change / prevClose) * 100).toFixed(2)) : 0;

    // Extract 3-Month ADV & Last 5 Completed Prior Trading Days strictly from completed prior sessions (up to yesterday)
    const historicalBars = hasTodayBarInArray
      ? validDailyBars.length > 1
        ? validDailyBars.slice(0, -1)
        : validDailyBars
      : validDailyBars;
    const nonZeroHist = historicalBars.filter((b) => b.volume > 0);
    const uStock = NSE_UNIVERSE.find((u) => u.symbol === cleanSymbol);
    const fallbackAdv = uStock?.avgVolume && uStock.avgVolume !== 100000 ? uStock.avgVolume : 25000;
    const adv = calculateAdaptive3MonthADV(nonZeroHist, fallbackAdv);

    const last5Days: HistoricalDaySummary[] = [];
    const startIdx = Math.max(0, historicalBars.length - 5);
    for (let idx = startIdx; idx < historicalBars.length; idx++) {
      const bar = historicalBars[idx];
      const pBar = idx > 0 ? historicalBars[idx - 1] : bar;
      const pClose = pBar.close > 0 ? pBar.close : bar.close;
      const chgPct = pClose > 0 ? Number((((bar.close - pClose) / pClose) * 100).toFixed(2)) : 0;
      const barRange = Math.max(0.01, bar.high - bar.low);
      const upperWick = Math.max(0, bar.high - Math.max(bar.open, bar.close));
      const upperWickRatio = Number((upperWick / barRange).toFixed(2));
      const intradaySpikePct = pClose > 0 ? Number((((bar.high - pClose) / pClose) * 100).toFixed(2)) : chgPct;
      last5Days.push({
        dateStr: bar.dateStr,
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
        prevClose: pClose,
        changePercent: chgPct,
        volume: bar.volume,
        upperWickRatio,
        intradaySpikePct,
        isVerifiedReal: true,
      });
    }

    if (adv > 0 && last5Days.length > 0) {
      const cacheEntry = {
        adv,
        last5Days,
        expiresAt: now + 86400000,
        cachedIstDate: todayIst,
        isSeeded: false,
      };
      advCache.set(ticker, cacheEntry);
      advCache.set(cleanSymbol, cacheEntry);
    }

    const elapsedFraction = getNSEMarketElapsedFraction();
    const expectedSessionVolume = Math.max(10, Math.round(adv * elapsedFraction));
    const rvol = Number((volume / expectedSessionVolume).toFixed(2));
    const fullDayRvol = adv > 0 ? Number((volume / adv).toFixed(2)) : 1.0;

    // For active gainers (changePercent >= 2.0%), attach real 5-minute intraday candles AND cross-verify official prevClose
    let attachedCandles5M: any[] | undefined = undefined;
    if (changePercent >= 2.0) {
      try {
        const candlePayload = await fetchYahooCandles(cleanSymbol, '5M');
        if (candlePayload?.meta?.previousClose && candlePayload.meta.previousClose > 0) {
          prevClose = Number(candlePayload.meta.previousClose.toFixed(2));
          change = Number((price - prevClose).toFixed(2));
          changePercent = prevClose ? Number(((change / prevClose) * 100).toFixed(2)) : 0;
        }
        if (candlePayload?.candles && candlePayload.candles.length >= 5) {
          attachedCandles5M = candlePayload.candles;
        }
      } catch {
        // non-blocking
      }
    }

    const liveQuote: LiveQuote = {
      symbol: cleanSymbol,
      price,
      prevClose,
      dayOpen,
      change,
      changePercent,
      dayHigh,
      dayLow,
      volume,
      adv,
      adv3m: adv,
      rvol,
      fullDayRvol,
      expectedSessionVolume,
      fiftyTwoWeekHigh,
      fiftyTwoWeekLow,
      last5Days,
      candles5M: attachedCandles5M,
      timestamp: meta.regularMarketTime ? meta.regularMarketTime * 1000 : now,
      currency: meta.currency || 'INR',
      exchange: meta.exchangeName || 'NSE',
    };

    quoteCache.set(ticker, { data: liveQuote, expiresAt: now + 180000, cachedIstDate: todayIst }); // Cache for 180s with IST date guard
    return liveQuote;
  } catch (err) {
    if (cached) return cached.data;
    return null;
  }
}

// Fetch historical candles and compute VWAP, EMA, Pivots
async function fetchYahooCandles(symbol: string, timeframe = '5M') {
  const ticker = getYahooTicker(symbol);
  const cacheKey = `${ticker}_${timeframe}`;
  const now = Date.now();
  const cached = candleCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  let interval = '5m';
  let range = '5d';
  if (timeframe === '15M') {
    interval = '15m';
    range = '5d';
  } else if (timeframe === '1H') {
    interval = '60m';
    range = '1mo';
  }

  try {
    let res = await fetch(
      `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=${interval}&range=${range}`,
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          Accept: 'application/json',
        },
      }
    );

    if (!res.ok) {
      res = await fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=${interval}&range=${range}`,
        {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            Accept: 'application/json',
          },
        }
      );
    }

    if (!res.ok) {
      if (cached) return cached.data;
      return null;
    }

    const data = (await res.json()) as any;
    const result = data?.chart?.result?.[0];
    if (!result || !result.timestamp || !result.indicators?.quote?.[0]) {
      if (cached) return cached.data;
      return null;
    }

    const meta = result.meta;
    const timestamps: number[] = result.timestamp;
    const quote = result.indicators.quote[0];

    // Fetch 3-Month ADV for this ticker to calibrate true session RVOL
    const adv = await fetchTicker3MonthADV(ticker, symbol);

    const rawCandles: any[] = [];
    let cumVol = 0;
    let cumTypicalVol = 0;
    let cumCvd = 0;
    let lastDateStr = '';

    for (let i = 0; i < timestamps.length; i++) {
      const open = quote.open?.[i];
      const high = quote.high?.[i];
      const low = quote.low?.[i];
      const close = quote.close?.[i];
      const vol = quote.volume?.[i] ?? 0;

      if (open == null || high == null || low == null || close == null) {
        continue;
      }

      const dateObj = new Date(timestamps[i] * 1000);
      const dateStr = dateObj.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
      const timeStr = dateObj.toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      }).toUpperCase();

      // Intraday Session Reset: Reset VWAP & CVD at the start of each new trading day (09:15 AM IST)
      if (dateStr !== lastDateStr) {
        cumVol = 0;
        cumTypicalVol = 0;
        cumCvd = 0;
        lastDateStr = dateStr;
      }

      // Price-action grounded volume delta modeling
      const candleRange = Math.max(0.01, high - low);
      const closePos = (close - low) / candleRange;
      const bodyDir = (close - open) / candleRange;
      const upperWick = (high - Math.max(open, close)) / candleRange;
      const lowerWick = (Math.min(open, close) - low) / candleRange;
      let buyerRatio = 0.50 + 0.30 * bodyDir + 0.12 * (closePos - 0.5) + 0.08 * (lowerWick - upperWick);
      buyerRatio = Math.max(0.12, Math.min(0.88, Number(buyerRatio.toFixed(3))));

      const buyerVolume = Math.round(vol * buyerRatio);
      const sellerVolume = vol - buyerVolume;
      const delta = buyerVolume - sellerVolume;

      cumVol += vol;
      const typicalPrice = (high + low + close) / 3;
      cumTypicalVol += typicalPrice * vol;
      const vwap = cumVol > 0 ? Number((cumTypicalVol / cumVol).toFixed(2)) : close;
      cumCvd += delta;

      rawCandles.push({
        dateStr,
        time: timeStr,
        timestamp: timestamps[i] * 1000,
        open: Number(open.toFixed(2)),
        high: Number(high.toFixed(2)),
        low: Number(low.toFixed(2)),
        close: Number(close.toFixed(2)),
        volume: vol,
        buyerVolume,
        sellerVolume,
        barDelta: delta,
        vwap,
        cvd: cumCvd,
      });
    }

    // Compute continuous EMA 9, EMA 21 across all available candles for maximum indicator maturity
    const closes = rawCandles.map((c) => c.close);
    const k9 = 2 / 10;
    const k21 = 2 / 22;

    if (closes.length > 0) {
      let e9 = closes[0];
      let e21 = closes[0];
      for (let i = 0; i < closes.length; i++) {
        e9 = closes[i] * k9 + e9 * (1 - k9);
        e21 = closes[i] * k21 + e21 * (1 - k21);
        rawCandles[i].ema9 = Number(e9.toFixed(2));
        rawCandles[i].ema21 = Number(e21.toFixed(2));

        // 20-period volume MA for candle RVOL
        const startIdx = Math.max(0, i - 19);
        const window = rawCandles.slice(startIdx, i + 1);
        const sumVol = window.reduce((s, c) => s + c.volume, 0);
        const avgVol = sumVol / (window.length || 1);
        rawCandles[i].rvol = Number((rawCandles[i].volume / (avgVol || 1)).toFixed(2));
      }
    }

    // Isolate ALL candles of the current active trading session (from 09:15 AM to 03:30 PM)
    // NEVER truncate morning candles (which would corrupt red/green candle counting)!
    let candles: any[] = [];
    if (rawCandles.length > 0) {
      const latestSessionDate = rawCandles[rawCandles.length - 1].dateStr;
      const activeSessionCandles = rawCandles.filter((c) => c.dateStr === latestSessionDate);
      
      if (timeframe === '5M') {
        // Return full intraday session (all 75 candles of today)
        candles = activeSessionCandles.length > 0 ? activeSessionCandles : rawCandles.slice(-75);
      } else if (timeframe === '15M') {
        // Return full intraday session (all 25 candles of today)
        candles = activeSessionCandles.length > 0 ? activeSessionCandles : rawCandles.slice(-25);
      } else {
        // 1H timeframe: return recent candles for trend analysis
        candles = rawCandles.slice(-30);
      }
    }

    let regularMarketPrice = meta.regularMarketPrice;
    let regularMarketDayHigh = meta.regularMarketDayHigh;
    let regularMarketDayLow = meta.regularMarketDayLow;
    let regularMarketVolume = meta.regularMarketVolume || cumVol;
    let fiftyTwoWeekHigh = meta.fiftyTwoWeekHigh;
    let fiftyTwoWeekLow = meta.fiftyTwoWeekLow;

    const elapsedFraction = getNSEMarketElapsedFraction();
    const expectedSessionVolume = Math.max(10, Math.round(adv * elapsedFraction));
    const sessionRvol = Number((regularMarketVolume / expectedSessionVolume).toFixed(2));
    const fullDayRvol = adv > 0 ? Number((regularMarketVolume / adv).toFixed(2)) : 1.0;

    const payload = {
      symbol: symbol.trim().toUpperCase(),
      timeframe,
      meta: {
        currency: meta.currency,
        exchange: meta.exchangeName,
        regularMarketPrice,
        previousClose: meta.previousClose ?? meta.chartPreviousClose,
        chartPreviousClose: meta.previousClose ?? meta.chartPreviousClose,
        regularMarketDayHigh,
        regularMarketDayLow,
        regularMarketVolume,
        fiftyTwoWeekHigh,
        fiftyTwoWeekLow,
        adv,
        adv3m: adv,
        sessionRvol,
        fullDayRvol,
        expectedSessionVolume,
      },
      candles,
    };

    candleCache.set(cacheKey, { data: payload, expiresAt: now + 30000 }); // Cache 30s
    return payload;
  } catch (err) {
    if (cached) return cached.data;
    return null;
  }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let currentIndex = 0;

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (currentIndex < items.length) {
      const idx = currentIndex++;
      try {
        results[idx] = await fn(items[idx]);
      } catch (e) {
        // ignore
      }
    }
  });

  await Promise.all(workers);
  return results;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // Single Quote endpoint
  app.get('/api/quote/:symbol', async (req, res) => {
    let symbol = req.params.symbol;
    // Defensive check: If raw URL contained unencoded & (e.g. /api/quote/M&MFIN) and Express split it
    if (symbol === 'M' && req.originalUrl.includes('M&MFIN')) {
      symbol = 'M&MFIN';
    } else if (symbol === 'M' && req.originalUrl.includes('M&M')) {
      symbol = 'M&M';
    }
    const quote = await fetchYahooQuote(symbol);
    if (!quote) {
      return res.status(404).json({ error: `Quote not found for ${symbol}` });
    }
    res.json(quote);
  });

  // Dedicated 3-Month ADV lookup endpoint
  app.get('/api/adv/:symbol', async (req, res) => {
    const symbol = req.params.symbol;
    const clean = symbol.trim().toUpperCase();
    const ticker = getYahooTicker(clean);
    const adv = await fetchTicker3MonthADV(ticker, clean);
    res.json({ symbol: clean, ticker, adv3m: adv, adv });
  });

  // Manual Live Tick Override / Update endpoint
  app.post('/api/quote/override', (req, res) => {
    const { symbol, price, volume, dayHigh, dayLow, prevClose } = req.body;
    if (!symbol || !price) {
      return res.status(400).json({ error: 'symbol and price required' });
    }
    const clean = symbol.trim().toUpperCase();
    const ticker = getYahooTicker(clean);
    const existing = quoteCache.get(ticker)?.data;
    const p = Number(price);
    const pc = prevClose ? Number(prevClose) : existing?.prevClose || p;
    const ch = Number((p - pc).toFixed(2));
    const chp = pc ? Number(((ch / pc) * 100).toFixed(2)) : 0;
    const vol = volume ? Number(volume) : existing?.volume || 100000;
    const adv = existing?.adv || advCache.get(ticker)?.adv || advCache.get(clean)?.adv || 25000;
    const elapsedFraction = getNSEMarketElapsedFraction();
    const expectedSessionVolume = Math.max(10, Math.round(adv * elapsedFraction));
    const rvol = Number((vol / expectedSessionVolume).toFixed(2));
    const fullDayRvol = adv > 0 ? Number((vol / adv).toFixed(2)) : 1.0;

    const updated: LiveQuote = {
      symbol: clean,
      price: p,
      prevClose: pc,
      change: ch,
      changePercent: chp,
      dayHigh: dayHigh ? Number(dayHigh) : Math.max(p, existing?.dayHigh || p),
      dayLow: dayLow ? Number(dayLow) : Math.min(p, existing?.dayLow || p),
      volume: vol,
      adv,
      adv3m: adv,
      rvol,
      fullDayRvol,
      expectedSessionVolume,
      fiftyTwoWeekHigh: existing?.fiftyTwoWeekHigh,
      fiftyTwoWeekLow: existing?.fiftyTwoWeekLow,
      timestamp: Date.now(),
      currency: 'INR',
      exchange: 'NSE',
    };
    quoteCache.set(ticker, { data: updated, expiresAt: Date.now() + 600000 }); // cache 10 min
    res.json(updated);
  });

  // Batch Quotes endpoint with fast worker concurrency + automatic inclusion of all server-warmed quotes
  app.post('/api/quotes', async (req, res) => {
    const symbols: string[] = req.body.symbols || [];
    const includeAllWarmed: boolean = req.body.includeAllWarmed !== false;

    const quotes =
      Array.isArray(symbols) && symbols.length > 0
        ? await mapWithConcurrency(symbols, 12, async (sym) => {
            return await fetchYahooQuote(sym);
          })
        : [];

    const quoteMap = new Map<string, LiveQuote>();
    for (const q of quotes) {
      if (q && q.symbol) {
        quoteMap.set(q.symbol, q);
      }
    }

    // Also include all quotes warmed in server memory so the client never misses breakouts in other segments!
    if (includeAllWarmed) {
      for (const [, entry] of quoteCache.entries()) {
        if (entry && entry.data && !quoteMap.has(entry.data.symbol)) {
          quoteMap.set(entry.data.symbol, entry.data);
        }
      }
    }

    res.json({ quotes: Array.from(quoteMap.values()), timestamp: Date.now() });
  });

  // Detailed Candles endpoint
  app.get('/api/candles/:symbol', async (req, res) => {
    const symbol = req.params.symbol;
    const timeframe = (req.query.timeframe as string) || '5M';
    const candleData = await fetchYahooCandles(symbol, timeframe);
    if (!candleData) {
      return res.status(404).json({ error: `Candles not found for ${symbol}` });
    }
    res.json(candleData);
  });

  // Symbol search
  app.get('/api/search', async (req, res) => {
    const rawQuery = (req.query.q as string || '').trim();
    if (!rawQuery) return res.json({ results: [] });
    const upper = rawQuery.toUpperCase();

    // Check custom aliases / typos (e.g. GOWW -> GROWW, MMFIN -> M&MFIN)
    let expandedQuery = rawQuery;
    const localTopMatches: Array<{ symbol: string; name: string; exchange: string }> = [];

    if (upper === 'GOWW' || upper === 'GROWW' || upper.includes('GROWW') || upper.includes('GOWW')) {
      expandedQuery = 'GROWW';
      localTopMatches.push({
        symbol: 'GROWW',
        name: 'Billionbrains Garage Ventures Ltd (Groww)',
        exchange: 'NSE',
      });
    } else if (upper === 'MMFIN' || upper === 'M&MFIN' || upper === 'MNMFIN' || upper.includes('MAHINDRA FIN')) {
      expandedQuery = 'M&MFIN';
      localTopMatches.push({
        symbol: 'M&MFIN',
        name: 'Mahindra & Mahindra Financial Services Limited',
        exchange: 'NSE',
      });
    } else if (upper === 'IXIGO' || upper.includes('TRAVENUES')) {
      expandedQuery = 'IXIGO';
      localTopMatches.push({
        symbol: 'IXIGO',
        name: 'Le Travenues Technology Limited (ixigo)',
        exchange: 'NSE',
      });
    } else if (upper === 'GYFTR' || upper === 'GIFTR' || upper.includes('VOUCHAGRAM')) {
      expandedQuery = 'GYFTR';
      localTopMatches.push({
        symbol: 'GYFTR',
        name: 'Gyftr Limited',
        exchange: 'NSE',
      });
    } else if (upper === 'A1STEELS' || upper === 'A1STEEL' || upper.includes('A1 STEEL') || upper.includes('A-ONE STEEL') || upper.includes('AONE STEEL')) {
      expandedQuery = 'AONESTEELS';
      localTopMatches.push({
        symbol: 'AONESTEELS',
        name: 'A-One Steels India Limited',
        exchange: 'NSE',
      });
    } else if (upper === 'SSRETAIL' || upper === 'SSRETAILS' || upper.includes('SS RETAIL')) {
      expandedQuery = 'SSRETAIL';
      localTopMatches.push({
        symbol: 'SSRETAIL',
        name: 'SS Retail Limited',
        exchange: 'NSE',
      });
    } else if (upper === 'MSTC' || upper === 'MSTCLTD' || upper.includes('MSTC LTD')) {
      expandedQuery = 'MSTCLTD';
      localTopMatches.push({
        symbol: 'MSTCLTD',
        name: 'MSTC Limited',
        exchange: 'NSE',
      });
    }

    try {
      const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(expandedQuery)}`;
      const resp = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        },
      });
      if (!resp.ok) return res.json({ results: localTopMatches });
      const data = (await resp.json()) as any;
      const quotes = data?.quotes || [];
      // Filter primarily Indian NSE/BSE quotes
      const filtered = quotes
        .filter((q: any) => q.exchange === 'NSI' || q.exchange === 'BSE' || q.symbol?.endsWith('.NS'))
        .slice(0, 10)
        .map((q: any) => ({
          symbol: q.symbol.replace('.NS', ''),
          name: q.shortname || q.longname || q.symbol,
          exchange: q.exchDisp || 'NSE',
        }));

      // Combine localTopMatches ahead of remote results
      const combined = [...localTopMatches];
      for (const item of filtered) {
        if (!combined.some((c) => c.symbol === item.symbol)) {
          combined.push(item);
        }
      }
      res.json({ results: combined.slice(0, 10) });
    } catch {
      res.json({ results: localTopMatches });
    }
  });

  // Universe info & stats endpoint
  app.get('/api/universe', (req, res) => {
    res.json({
      totalStocks: NSE_UNIVERSE.length,
      criteria: {
        exchange: 'NSE',
        series: 'EQ',
        priceRange: '₹100 - ₹3,000',
        minMarketCapCr: 500,
        groupBias: 'NONE (Equal priority for all stocks with Price ₹100-3000 and MCap > ₹500 Cr)',
      },
      sample: NSE_UNIVERSE.slice(0, 10),
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`NSE Scanner Server running on http://localhost:${PORT}`);
    
    // Proactively warm universe quotes on boot & refresh rolling batches continuously with Multi-Segment Sweeping
    let rollingIndex = 0;
    
    async function warmUniverseQuotes() {
      try {
        const allSymbols = NSE_UNIVERSE.map((s) => s.symbol);
        if (allSymbols.length === 0) return;
        const total = allSymbols.length;
        const seg = Math.floor(total / 5);
        const subSize = 35; // 35 * 5 = 175 stocks per pass across 5 parallel segments (warms all 1,567 stocks in ~18s!)

        const offset = rollingIndex % seg;
        const b1 = allSymbols.slice(offset, offset + subSize);
        const b2 = allSymbols.slice(seg + offset, seg + offset + subSize);
        const b3 = allSymbols.slice(seg * 2 + offset, seg * 2 + offset + subSize);
        const b4 = allSymbols.slice(seg * 3 + offset, seg * 3 + offset + subSize);
        const b5 = allSymbols.slice(seg * 4 + offset, seg * 4 + offset + subSize);

        const batch = Array.from(new Set([...b1, ...b2, ...b3, ...b4, ...b5]));
        rollingIndex = (rollingIndex + subSize) % seg;

        await mapWithConcurrency(batch, 22, async (sym) => {
          return await fetchYahooQuote(sym);
        });
      } catch (e) {
        // non-blocking
      }
    }
    warmUniverseQuotes();
    setInterval(warmUniverseQuotes, 2000);
  });
}

startServer();
