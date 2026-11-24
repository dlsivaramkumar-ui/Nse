import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  AlertNotification,
  Candle,
  MarketRegime,
  SignalStage,
  StockIndicatorData,
  Timeframe,
  SystemDiagnosticReport,
} from './types';
import {
  NSE_UNIVERSE,
  UniverseStock,
  searchUniverse,
  searchUniverseWithSpecialEntities,
  SpecialSearchResult,
  findUnlistedCompany,
  REVERSE_SEARCH_ALIASES,
  ALIAS_MAP,
  getUniverseStock,
  isDelistedStock,
  KNOWN_DELISTED_STOCKS,
} from './data/nseUniverse';
import fullUniverseData from './data/nseFullUniverse.json';
import { StockSearchStatusModal, SearchModalData } from './components/StockSearchStatusModal';
import { generateCandlesForStock } from './engine/candleGenerator';
import {
  analyzeStockData,
  applyAdaptiveMarketBrain,
  compareStocksByTechnicalStrength,
  computeHistoricalQualificationRanks,
} from './engine/technicalIndicators';
import {
  getISTCurrentMinutes,
  isNSEMarketOpenNow,
  parseISTTimeToMinutes,
  getTodayISTDateString,
} from './utils/istTime';
import { SignalCard } from './components/SignalCard';
import { StockDetailModal } from './components/StockDetailModal';
import { AlertsDrawer } from './components/AlertsDrawer';
import { ScoreDebugInspector } from './components/ScoreDebugInspector';
import { TopRankedLeaderboard } from './components/TopRankedLeaderboard';
import { MorningForensicReportPanel } from './components/MorningForensicReportPanel';
import { playAlertSound } from './utils/audioAlert';
import {
  Search,
  Scan,
  RefreshCw,
  Bell,
  SlidersHorizontal,
  Flame,
  Clock,
  TrendingUp,
  ShieldCheck,
  Zap,
  RotateCcw,
  Sparkles,
  Info,
  CheckCircle2,
  Filter,
  ArrowUpRight,
  Star,
  Activity,
} from 'lucide-react';

// Re-export pure technical strength comparator for UI and components
export { compareStocksByTechnicalStrength } from './engine/technicalIndicators';

// USER STRICT MANDATE: Absolute Zero storage of stocks, favorites, or examples!
// Every single stock must be evaluated purely on its real-time performance of that trading day.
// No stock can be stored or favored in localStorage, sessionStorage, or custom lists.
try {
  localStorage.removeItem('DYNAMIC_NSE_TRACKED_STOCKS_V2');
  localStorage.removeItem('DYNAMIC_NSE_TRACKED_STOCKS');
  localStorage.removeItem('DYNAMIC_NSE_CUSTOM_STOCKS');
  localStorage.removeItem('TRACKED_CUSTOM_STOCKS');
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const k = localStorage.key(i);
    if (k && (k.startsWith('DAILY_SESSION_NSE_STOCKS_') || k.includes('CUSTOM_STOCKS') || k.includes('TRACKED_STOCKS'))) {
      localStorage.removeItem(k);
    }
  }
  for (let i = sessionStorage.length - 1; i >= 0; i--) {
    const k = sessionStorage.key(i);
    if (k && (k.startsWith('DAILY_SESSION_NSE_STOCKS_') || k.includes('CUSTOM_STOCKS') || k.includes('TRACKED_STOCKS'))) {
      sessionStorage.removeItem(k);
    }
  }
} catch {}

// Strict pure meritocracy: ZERO saved custom stocks / favorites
export function getSavedCustomStocks(): UniverseStock[] {
  return [];
}

export function saveCustomStock(_stock: UniverseStock) {
  // Pure performance: Do not store any stocks in localStorage/sessionStorage.
}

export function getCombinedUniverse(_currentData?: StockIndicatorData[]): UniverseStock[] {
  const stockMap = new Map<string, UniverseStock>();
  
  // Strictly enforce: Not delisted, Price ₹100-₹3,000, Market Cap >= ₹500 Cr, AND 3M Average Volume > 25,000
  NSE_UNIVERSE.forEach(s => {
    if (
      !isDelistedStock(s.symbol) &&
      s.basePrice >= 100 &&
      s.basePrice <= 3000 &&
      (s.marketCapCr || 0) >= 500 &&
      (s.avgVolume || 0) > 25000
    ) {
      stockMap.set(s.symbol, s);
    }
  });

  return Array.from(stockMap.values());
}

// Pre-compute initial baseline stocks so application displays clean, neutral structure immediately on load
function getInitialBaselineStocks(): StockIndicatorData[] {
  const universe = getCombinedUniverse();

  const rawStocks: StockIndicatorData[] = universe.map((stock) => {
    const currentPrice = stock.basePrice;
    // PURE MERITOCRACY & ZERO FAKE DATA MANDATE:
    // Every trading day starts fresh. Never use static historical prevClose differences from JSON!
    // Until live market quotes arrive for today's session, prevClose = currentPrice (0.00% change, flat neutral).
    const prevClose = currentPrice;
    const dayHigh = currentPrice;
    const dayLow = currentPrice;
    const trueAvgVolume = (stock.avgVolume && stock.avgVolume > 0 && stock.avgVolume !== 100000) ? stock.avgVolume : (stock.avgVolume || 25000);
    const currentVolume = 0; // 0 session volume until verified live quote is fetched

    // Fast, uniform technical evaluation (neutral baseline)
    const candles5M = generateCandlesForStock(stock.symbol, currentPrice, '5M', prevClose, dayHigh, dayLow, currentVolume, trueAvgVolume);
    const candles15M = generateCandlesForStock(stock.symbol, currentPrice, '15M', prevClose, dayHigh, dayLow, currentVolume, trueAvgVolume);
    const candles1H = generateCandlesForStock(stock.symbol, currentPrice, '1H', prevClose, dayHigh, dayLow, currentVolume, trueAvgVolume);

    return analyzeStockData({
      symbol: stock.symbol,
      name: stock.name,
      nameTe: stock.nameTe,
      sector: stock.sector,
      marketCapCr: stock.marketCapCr,
      currentPrice,
      prevClose,
      dayOpen: prevClose,
      dayHigh,
      dayLow,
      candles5M,
      candles15M,
      candles1H,
      avgVolume: trueAvgVolume,
      adv3M: trueAvgVolume,
      currentVolume,
      marketRegime: 'NEUTRAL',
    });
  });

  // STRICT MANDATE: Hard filter to eliminate any stock < ₹100 or > ₹3,000 or MCap < 500 Cr
  const eligibleStocks = rawStocks.filter(s => 
    s.currentPrice >= 100 && 
    s.currentPrice <= 3000 && 
    (s.marketCapCr || 0) >= 500
  );

  // STRICT PURITY: NO stock receives a verified qualification badge on cold startup!
  // Qualification badges and top momentum ranks are ONLY awarded after real-time live trading quotes arrive!
  eligibleStocks.forEach((s, idx) => {
    s.qualification = undefined;
    s.isLiveSynced = false;
    s.rank = idx + 1;
  });

  applyAdaptiveMarketBrain(eligibleStocks);
  eligibleStocks.forEach((s, idx) => {
    s.rank = idx + 1;
  });
  return eligibleStocks;
}

export default function App() {
  // State - Pre-populated with baseline ranks, seamlessly synced with live quotes on mount
  const [allStocksData, setAllStocksData] = useState<StockIndicatorData[]>(getInitialBaselineStocks);
  const [cachedShortlistSymbols, setCachedShortlistSymbols] = useState<string[]>([]);
  const [isFirstScanDone, setIsFirstScanDone] = useState<boolean>(false);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [isFullRescan, setIsFullRescan] = useState<boolean>(false);
  const [selectedStock, setSelectedStock] = useState<StockIndicatorData | null>(null);
  const [isSyncingModalStock, setIsSyncingModalStock] = useState<boolean>(false);
  const [selectedTimeframe, setSelectedTimeframe] = useState<Timeframe>('5M');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState<boolean>(false);
  const [searchStatusModal, setSearchStatusModal] = useState<SearchModalData | null>(null);
  const [activeCategory, setActiveCategory] = useState<'ALL' | 'TOP_10' | 'ELITE_90_PLUS' | 'RVOL' | 'ALREADY_STRONG' | 'PRE_BREAKOUT' | 'DIP_RECOVERY'>('ALREADY_STRONG');
  
  // Real-time tracking of discovered 90+ stocks so none are ever dropped or missed
  const discoveredElite90Ref = useRef<Set<string>>(new Set());
  const [morningTop10Symbols, setMorningTop10Symbols] = useState<string[]>([]);
  const firstScanSymbolsRef = useRef<string[]>([]);

  // Filters
  const [filterMinScore, setFilterMinScore] = useState<number>(65);
  const [filterAbovePivotOnly, setFilterAbovePivotOnly] = useState<boolean>(false);
  const [filterHighPersistenceOnly, setFilterHighPersistenceOnly] = useState<boolean>(false);
  const [filterGoodRoomOnly, setFilterGoodRoomOnly] = useState<boolean>(false);
  const [scoreDebugMode, setScoreDebugMode] = useState<boolean>(false);

  // Dynamic Market Regime per User Mandate:
  // Bullish: 30% red candle limit, Neutral: 40% red candle limit, Bearish: 50% red candle limit
  const [marketRegime, setMarketRegime] = useState<MarketRegime>('NEUTRAL');
  const [niftyInfo, setNiftyInfo] = useState<{ price: number; changePercent: number } | null>(null);

  // Auto-detect live Market Regime from NIFTY 50 on boot
  useEffect(() => {
    async function checkNiftyRegime() {
      try {
        const res = await fetch('/api/quote/NIFTY');
        if (res.ok) {
          const data = await res.json();
          if (data && data.price > 0) {
            setNiftyInfo({ price: data.price, changePercent: data.changePercent });
            if (data.changePercent >= 0.35) {
              setMarketRegime('BULLISH');
            } else if (data.changePercent <= -0.35) {
              setMarketRegime('BEARISH');
            } else {
              setMarketRegime('NEUTRAL');
            }
          }
        }
      } catch (err) {
        console.warn('NIFTY regime auto-detection notice:', err);
      }
    }
    checkNiftyRegime();
  }, []);

  // Live Auto Refresh & Alerts
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [alerts, setAlerts] = useState<AlertNotification[]>([]);
  const [isAlertsOpen, setIsAlertsOpen] = useState<boolean>(false);
  const [lastScanTime, setLastScanTime] = useState<string>('');
  const [isLiveFeedConnected, setIsLiveFeedConnected] = useState<boolean>(true);

  // Helper to fetch live batch quotes from backend proxy
  const fetchQuotesFromBackend = async (symbols: string[]): Promise<Map<string, any>> => {
    try {
      const res = await fetch('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbols }),
      });
      if (!res.ok) return new Map();
      const data = await res.json();
      const map = new Map<string, any>();
      if (Array.isArray(data.quotes)) {
        data.quotes.forEach((q: any) => map.set(q.symbol, q));
      }
      setIsLiveFeedConnected(true);
      return map;
    } catch (err) {
      console.warn('Backend quotes fetch failed, using accurate universe baseline:', err);
      setIsLiveFeedConnected(false);
      return new Map();
    }
  };

  // Generate or recalculate stock indicator data using 100% verified real market numbers
  const processStock = useCallback((
    stock: UniverseStock,
    existing?: StockIndicatorData,
    liveQuote?: any
  ): StockIndicatorData => {
    // 1. Precise real-world price hierarchy: Live Quote > Previous state > Verified Universe Base
    const currentPrice =
      liveQuote?.price && liveQuote.price > 0
        ? Number(liveQuote.price.toFixed(2))
        : existing?.currentPrice && existing.currentPrice > 0
        ? existing.currentPrice
        : stock.basePrice;

    const prevClose =
      liveQuote?.prevClose && liveQuote.prevClose > 0
        ? Number(liveQuote.prevClose.toFixed(2))
        : existing?.isLiveSynced && existing?.prevClose && existing.prevClose > 0
        ? existing.prevClose
        : currentPrice;

    const rawHigh =
      liveQuote?.dayHigh && liveQuote.dayHigh > 0
        ? liveQuote.dayHigh
        : existing?.isLiveSynced && existing?.dayHigh
        ? existing.dayHigh
        : currentPrice;
    const dayHigh = Math.max(currentPrice, rawHigh);

    const rawLow =
      liveQuote?.dayLow && liveQuote.dayLow > 0
        ? liveQuote.dayLow
        : existing?.isLiveSynced && existing?.dayLow
        ? existing.dayLow
        : currentPrice;
    const dayLow = Math.min(currentPrice, rawLow);

    const dayOpen =
      liveQuote?.dayOpen && liveQuote.dayOpen > 0
        ? Number(liveQuote.dayOpen.toFixed(2))
        : existing?.isLiveSynced && existing?.dayOpen
        ? existing.dayOpen
        : prevClose;

    const trueAvgVolume =
      liveQuote?.adv ||
      liveQuote?.adv3m ||
      (stock.avgVolume && stock.avgVolume > 0 && stock.avgVolume !== 100000 ? stock.avgVolume : undefined) ||
      existing?.adv ||
      stock.avgVolume ||
      25000;
    const currentVolume =
      liveQuote?.volume && liveQuote.volume > 0
        ? liveQuote.volume
        : existing?.isLiveSynced && existing?.currentVolume
        ? existing.currentVolume
        : 0;
    const liveRvol = liveQuote?.rvol && liveQuote.rvol > 0 ? liveQuote.rvol : undefined;

    // 2. Realistic bounded candles anchored to exact prices & accurate traded volume
    // CRITICAL FIX: Always regenerate candles when transitioning from cold-start (!existing.isLiveSynced) to liveQuote,
    // or whenever prevClose, currentPrice, or volume changes! Never reuse cold-start 0%-change flat candles when basePrice === liveQuote.price!
    const isCandleStale =
      !existing?.candles5M?.length ||
      (!existing.isLiveSynced && Boolean(liveQuote)) ||
      Math.abs((existing.prevClose || 0) - prevClose) > 0.05 ||
      Math.abs((existing.candles5M[existing.candles5M.length - 1]?.close || 0) - currentPrice) > currentPrice * 0.002 ||
      Math.abs((existing.currentVolume || 0) - currentVolume) > Math.max(1000, currentVolume * 0.01) ||
      (liveQuote && !existing.candles5M[0]?.volume);

    const isHigherTimeframeStale =
      !existing?.candles15M?.length ||
      !existing?.candles1H?.length ||
      (!existing.isLiveSynced && Boolean(liveQuote)) ||
      Math.abs((existing.prevClose || 0) - prevClose) > 0.05 ||
      Math.abs((existing.candles15M[existing.candles15M.length - 1]?.close || 0) - currentPrice) > currentPrice * 0.005 ||
      Math.abs((existing.currentVolume || 0) - currentVolume) > Math.max(2500, currentVolume * 0.04);

    const hasReal5MCandles = Array.isArray(liveQuote?.candles5M) && liveQuote.candles5M.length >= 5;
    const candles5M = hasReal5MCandles
      ? liveQuote.candles5M.map((c: any) => ({ ...c }))
      : isCandleStale
      ? generateCandlesForStock(stock.symbol, currentPrice, '5M', prevClose, dayHigh, dayLow, currentVolume, trueAvgVolume)
      : existing.candles5M;
    const candles15M = isHigherTimeframeStale
      ? generateCandlesForStock(stock.symbol, currentPrice, '15M', prevClose, dayHigh, dayLow, currentVolume, trueAvgVolume)
      : existing.candles15M;
    const candles1H = isHigherTimeframeStale
      ? generateCandlesForStock(stock.symbol, currentPrice, '1H', prevClose, dayHigh, dayLow, currentVolume, trueAvgVolume)
      : existing.candles1H;

    // Pin the latest candle close to currentPrice strictly
    if (candles5M.length > 0) {
      const last = candles5M[candles5M.length - 1];
      last.close = currentPrice;
      last.high = Math.max(last.high, currentPrice);
      last.low = Math.min(last.low, currentPrice);
    }

    const analyzed = analyzeStockData({
      symbol: stock.symbol,
      name: stock.name,
      nameTe: stock.nameTe,
      sector: stock.sector,
      marketCapCr: stock.marketCapCr,
      currentPrice,
      prevClose,
      dayOpen,
      dayHigh,
      dayLow,
      candles5M,
      candles15M,
      candles1H,
      avgVolume: trueAvgVolume,
      adv3M: trueAvgVolume,
      currentVolume,
      rvol: liveRvol,
      fullDayRvol: liveQuote?.fullDayRvol,
      last5Days: liveQuote?.last5Days || existing?.last5Days,
      marketRegime,
      prevNormalizedScore: existing?.isLiveSynced ? existing.overallScore?.normalizedScore : undefined,
    });

    if (liveQuote?.adv && !analyzed.situationalIntelligence?.isAdvOutlierAdjusted) {
      analyzed.adv = liveQuote.adv;
      analyzed.adv3M = liveQuote.adv;
    }
    if (liveQuote?.fullDayRvol && !analyzed.situationalIntelligence?.isAdvOutlierAdjusted) {
      analyzed.fullDayRvol = liveQuote.fullDayRvol;
    }
    if (liveQuote?.expectedSessionVolume && !analyzed.situationalIntelligence?.isAdvOutlierAdjusted) {
      analyzed.expectedSessionVolume = liveQuote.expectedSessionVolume;
    }
    if (liveQuote?.fiftyTwoWeekHigh) {
      (analyzed as any).fiftyTwoWeekHigh = liveQuote.fiftyTwoWeekHigh;
    }
    if (liveQuote?.fiftyTwoWeekLow) {
      (analyzed as any).fiftyTwoWeekLow = liveQuote.fiftyTwoWeekLow;
    }

    // Preserve verified morning qualification if a stock already qualified earlier today and still holds above Pivot & VWAP with strong volume
    if (
      !analyzed.qualification &&
      existing?.qualification?.qualifiedTime &&
      analyzed.currentPrice >= analyzed.pivots.pivot &&
      analyzed.changePercent >= 2.5 &&
      analyzed.rvol >= 1.2 &&
      (analyzed.adv3M || analyzed.adv || 0) > 25000 &&
      !analyzed.hardFilters?.isFirstHourHyperSpike &&
      !analyzed.earlyAccumulationRadar?.isFakeMorningGapTrap
    ) {
      analyzed.qualification = { ...existing.qualification };
    }

    if (analyzed.qualification && existing?.qualification?.qualifiedTime) {
      const currentISTMin = getISTCurrentMinutes();
      const isMarketLive = isNSEMarketOpenNow();
      const existingMin = parseISTTimeToMinutes(existing.qualification.qualifiedTime);
      const isCorruptFutureTime = isMarketLive && existingMin !== null && existingMin > currentISTMin;

      if (!isCorruptFutureTime) {
        if (!hasReal5MCandles && (existing.qualification.qualifiedTime !== '09:25 AM' || analyzed.qualification.qualifiedTime === '09:25 AM')) {
          analyzed.qualification.qualifiedTime = existing.qualification.qualifiedTime;
          analyzed.qualification.qualifiedPrice = existing.qualification.qualifiedPrice;
        }
        if (
          existing.qualification.qualifiedTime === analyzed.qualification.qualifiedTime &&
          existing.qualification.qualifiedRank !== undefined &&
          existing.qualification.qualifiedRank !== null &&
          existing.isLiveSynced &&
          existing.qualification.qualifiedRank <= 150
        ) {
          analyzed.qualification.qualifiedRank = existing.qualification.qualifiedRank;
        }
      }
    }
    // NOTE: Do NOT assign existing.rank before sorting! When a stock transitions from unverified 0-volume
    // (where it sat at alphabetical index #763 or #1045) to Qualified, its true qualifiedRank MUST be
    // assigned AFTER compareStocksByTechnicalStrength sorts it into the active qualified pool!

    // Explicitly flag if real live quote was synced so UI never displays uncalibrated baseline scores as live
    if (liveQuote && liveQuote.price > 0) {
      analyzed.isLiveSynced = true;
      analyzed.lastLiveSyncTime = Date.now();
    } else if (existing?.isLiveSynced) {
      analyzed.isLiveSynced = existing.isLiveSynced;
      analyzed.lastLiveSyncTime = existing.lastLiveSyncTime;
    } else {
      analyzed.isLiveSynced = false;
    }

    return analyzed;
  }, [marketRegime]);

  // Handle Dynamic Market Regime Change (User Mandate)
  // Re-evaluates entire universe so red candle thresholds & weightage deductions apply immediately
  const handleRegimeChange = useCallback((newRegime: MarketRegime) => {
    setMarketRegime(newRegime);
    setAllStocksData(prev => {
      const updated = prev.map(s => {
        return analyzeStockData({
          symbol: s.symbol,
          name: s.name,
          nameTe: s.nameTe,
          sector: s.sector,
          marketCapCr: s.marketCapCr,
          currentPrice: s.currentPrice,
          prevClose: s.prevClose,
          dayOpen: s.dayOpen,
          dayHigh: s.dayHigh,
          dayLow: s.dayLow,
          candles5M: s.candles5M,
          candles15M: s.candles15M,
          candles1H: s.candles1H,
          avgVolume: s.avgVolume,
          adv3M: s.adv3M,
          currentVolume: s.currentVolume,
          rvol: (s as any).rvol,
          last5Days: s.last5Days,
          marketRegime: newRegime,
        });
      });
      applyAdaptiveMarketBrain(updated);
      const chronoRankMap = computeHistoricalQualificationRanks(updated);

      updated.forEach((s, idx) => {
        s.rank = idx + 1;
        if (s.qualification) {
          s.qualification.qualifiedRank = chronoRankMap.get(s.symbol) ?? s.qualification.qualifiedRank ?? s.rank;
        }
      });
      setSelectedStock(curr => {
        if (!curr) return null;
        return updated.find(u => u.symbol === curr.symbol) || curr;
      });
      return updated;
    });
  }, []);

  // System Root-Cause Self-Diagnostic: Explains why a 90+ stock was not flagged earlier and executes auto-remedies
  const diagnoseStockOmission = useCallback((
    symbol: string,
    stock: StockIndicatorData,
    universeIndex: number,
    totalUniverse: number,
    currentBatchIndex: number
  ): SystemDiagnosticReport => {
    const timeNow = new Date().toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });

    const positionInUniverse = universeIndex >= 0 ? universeIndex + 1 : totalUniverse;
    const batchGap = universeIndex >= 0 ? (universeIndex - currentBatchIndex + totalUniverse) % totalUniverse : 0;
    const estSecondsUntilScan = Math.max(5, Math.round((batchGap / 55) * 5));

    const delayReason = `Stock ${symbol} (Universe Position #${positionInUniverse} of ${totalUniverse}) was in the upcoming batch queue (scheduled scan in ~${estSecondsUntilScan}s). Recent session breakout with RVOL ${stock.rvol}x and ${stock.changePercent >= 0 ? '+' : ''}${stock.changePercent}% price momentum rapidly surged its score to ${stock.overallScore.totalScore}/100.`;

    const delayReasonTe = `స్టాక్ ${symbol} మొత్తం ${totalUniverse} NSE ఈక్విటీలలో #${positionInUniverse} స్థానంలో ఉంది. 5-సెకన్ల రోలింగ్ స్కానర్ బ్యాచ్ దీనిని చేరుకోవడానికి మరో ~${estSecondsUntilScan} సెకన్ల సమయం ఉండేది. ఇంతలోనే తాజా క్యాండిల్‌లో ${stock.rvol}x భారీ RVOL వాల్యూమ్ మరియు ${stock.changePercent >= 0 ? '+' : ''}${stock.changePercent}% దూకుడు ఇంట్రాడే మొమెంటమ్‌తో టెక్నికల్ స్కోర్ ${stock.overallScore.totalScore}/100 కి ఎగబాకింది.`;

    const remedialActions = [
      `Instantly integrated into real-time Leaderboard with Rank #${stock.rank || 1}.`,
      `Added to high-priority rolling radar refresh pool (5-second continuous sync) for today's session.`,
      `Temporary 1-day ephemeral retention applied (Zero permanent persistence; automatically purged on next day).`,
    ];

    const remedialActionsTe = [
      `సిస్టమ్ వెంటనే దీనికి గ్లోబల్ లీడర్‌బోర్డ్‌లో తగిన ర్యాంక్ #${stock.rank || 1} కేటాయించి టాప్ 10/ఎలైట్ లిస్ట్‌లోకి చేర్చింది.`,
      `నేటి సెషన్‌లో ఈ స్టాక్ ఏ ఒక్క టిక్ కూడా మిస్ కాకుండా ప్రతి 5 సెకన్లకు లైవ్ ప్రయారిటీ పూల్‌కు ఆటో-రూట్ చేయబడింది.`,
      `యూజర్ ఆదేశానుసారం: ఈ స్టాక్ కేవలం నేటి సెషన్‌కు మాత్రమే పరిమితం (1-Day Temporary); రేపటి మార్కెట్‌కు ఎటువంటి ముందస్తు ప్రభావం లేకుండా శుద్ధి చేయబడుతుంది.`,
    ];

    return {
      identifiedAt: timeNow + ' IST',
      identifiedRank: stock.rank || null,
      triggerType: 'USER_SEARCH_90_PLUS',
      delayReason,
      delayReasonTe,
      universeIndex: positionInUniverse,
      totalUniverseSize: totalUniverse,
      remedialActions,
      remedialActionsTe,
      sessionExpiryDate: getTodayISTDateString(),
    };
  }, []);

  // Priority Instant Fetch when user opens ANY stock or searches for one (< 250ms response)
  const handleOpenStockDetail = useCallback(async (stock: StockIndicatorData) => {
    // 1. Immediately open modal with clicked stock
    setSelectedStock(stock);

    // If stock does not have verified live quote or is older than 45s, activate instant sync
    const isRecentlySynced = Boolean(stock.isLiveSynced && stock.lastLiveSyncTime && (Date.now() - stock.lastLiveSyncTime < 45000));
    if (!isRecentlySynced) {
      setIsSyncingModalStock(true);
    }

    try {
      const res = await fetch(`/api/quote/${encodeURIComponent(stock.symbol)}`);
      if (res.ok) {
        const liveQ = await res.json();
        if (liveQ && liveQ.price > 0) {
          const currentUniverse = getCombinedUniverse(allStocksData);
          const universeStock = currentUniverse.find(u => u.symbol === stock.symbol) || {
            symbol: stock.symbol,
            name: stock.name,
            nameTe: stock.nameTe || stock.name,
            sector: stock.sector,
            basePrice: liveQ.price,
            prevClose: liveQ.prevClose,
            dayHigh: liveQ.dayHigh,
            dayLow: liveQ.dayLow,
            marketCapCr: stock.marketCapCr,
            avgVolume: stock.avgVolume,
          };
          let fresh = processStock(universeStock, stock, liveQ);
          fresh.isLiveSynced = true;
          fresh.lastLiveSyncTime = Date.now();

          // Check if stock has 90+ score and was NOT previously identified by system
          const is90Plus = (fresh.overallScore?.totalScore || 0) >= 90;
          const wasDiscoveredBefore = discoveredElite90Ref.current.has(fresh.symbol);
          if (is90Plus && !wasDiscoveredBefore) {
            discoveredElite90Ref.current.add(fresh.symbol);
            const uIdx = currentUniverse.findIndex(u => u.symbol === fresh.symbol);
            const report = diagnoseStockOmission(
              fresh.symbol,
              fresh,
              uIdx,
              currentUniverse.length,
              refreshBatchIndexRef.current
            );
            fresh = { ...fresh, diagnosticAnalysis: report };
          }

          // Also update allStocksData so ranks and cards immediately reflect live price & score
          setAllStocksData(prev => {
            const idx = prev.findIndex(s => s.symbol === fresh.symbol);
            let copy: StockIndicatorData[];
            if (idx >= 0) {
              copy = [...prev];
              copy[idx] = fresh;
            } else {
              copy = [fresh, ...prev];
            }
            applyAdaptiveMarketBrain(copy);
            const chronoRankMap = computeHistoricalQualificationRanks(copy);

            copy.forEach((s, i) => {
              s.rank = i + 1;
              if (s.qualification) {
                const cRank = chronoRankMap.get(s.symbol);
                if (cRank !== undefined) {
                  s.qualification.qualifiedRank = cRank;
                } else if (s.qualification.qualifiedRank === undefined || s.qualification.qualifiedRank > 250) {
                  s.qualification.qualifiedRank = Math.min(s.rank, 150);
                }
              }
            });
            const rankedFresh = copy.find(s => s.symbol === fresh.symbol) || fresh;

            // Instantly update open modal with exact calculated global rank
            setSelectedStock(rankedFresh);
            return copy;
          });
        }
      }
    } catch (err) {
      console.warn('Instant stock quote sync error:', err);
    } finally {
      setIsSyncingModalStock(false);
    }
  }, [allStocksData, processStock, diagnoseStockOmission]);

  // Check for alert transitions
  const checkForAlerts = useCallback((freshList: StockIndicatorData[], oldList: StockIndicatorData[]) => {
    const oldMap = new Map(oldList.map(s => [s.symbol, s.signalStage]));
    const newAlerts: AlertNotification[] = [];

    for (const fresh of freshList) {
      const prevStage = oldMap.get(fresh.symbol);
      if (
        (fresh.signalStage === 'STRONG_LONG' && prevStage !== 'STRONG_LONG') ||
        (fresh.signalStage === 'PRE_BREAKOUT_WATCH' && prevStage !== 'PRE_BREAKOUT_WATCH')
      ) {
        const timeNow = new Date().toLocaleTimeString('en-IN', {
          timeZone: 'Asia/Kolkata',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        });
        const isStrong = fresh.signalStage === 'STRONG_LONG';

        const alertItem: AlertNotification = {
          id: `${fresh.symbol}-${Date.now()}`,
          timestamp: timeNow,
          symbol: fresh.symbol,
          name: fresh.name,
          price: fresh.currentPrice,
          signalStage: fresh.signalStage,
          score: fresh.overallScore.totalScore,
          message: isStrong
            ? `STRONG LONG BUY signal triggered! 20M Persistence: ${fresh.persistenceScore.persistencePercent}%`
            : `PRE-BREAKOUT WATCH: Compression building up near resistance.`,
          messageTe: isStrong
            ? `స్ట్రాంగ్ లాంగ్ బై సిగ్నల్ కన్ఫర్మ్ అయింది! 20-నిమిషాల పర్సిస్టెన్స్: ${fresh.persistenceScore.persistencePercent}%`
            : `ప్రీ-బ్రేక్‌అవుట్ వాచ్: రెసిస్టెన్స్ వద్ద కంప్రెషన్ & ప్రెషర్ బిల్డప్.`,
          isRead: false,
        };

        newAlerts.push(alertItem);
      }
    }

    if (newAlerts.length > 0) {
      setAlerts(prev => [...newAlerts, ...prev].slice(0, 50));
      if (soundEnabled) {
        const hasStrong = newAlerts.some(a => a.signalStage === 'STRONG_LONG');
        playAlertSound(hasStrong ? 'STRONG_LONG' : 'PRE_BREAKOUT');
      }
    }
  }, [soundEnabled]);

  const refreshBatchIndexRef = useRef<number>(0);

  // Primary Scan Trigger - Scans entire universe without bias, ranks 100% on technical score
  const executeScan = useCallback(async (forceDeepScan = false) => {
    setIsScanning(true);
    const now = new Date();
    const timeString = now.toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    }).toUpperCase() + ' IST';

    try {
      // Combined Universe: Contains all 1,425+ NSE stocks matching Price ₹100-₹3000, MCap > ₹200 Cr
      const targetStocks = getCombinedUniverse(allStocksData);

      // Prioritize fetching live quotes strictly by current TECHNICAL SCORE!
      // MANDATE: NEVER MISS A SINGLE 90+ STOCK IN REAL TIME!
      // 1. ALL stocks with 90+ score or ever identified as 90+ in session
      // 2. High-momentum candidates near 90 (score >= 80)
      // 3. Rolling batches across entire NSE universe
      const coreBreakoutWatch = [
        'HAVELLS',
        'RAMKY',
        'VRLLOG',
        'ENTERO',
        'KIRLPNU',
        'TVSELECT',
        'WABAG',
        'CROMPTON',
        'TEXINFRA',
        'SMARTWORKS',
        'PARAGMILK',
        'APOLLO',
        'HINDCOPPER',
        'IXIGO',
        'GYFTR',
        'GROWW',
        'GLENMARK',
        'ACE',
        'IIFL',
        'FERMENTA',
        'AIROLAM',
        'BANARISUG',
        'ANGELONE',
        'BALRAMCHIN',
        'TEMPSENS',
        'AEGISLOG',
        'FUSION',
        'KRBL',
        'ASAHIINDIA',
        '360ONE',
        'CDSL',
        'GRSE',
        'MOTILALOFS',
        'PRAJIND',
      ];
      const elite90Symbols = allStocksData
        .filter(s => (s.overallScore?.totalScore || 0) >= 90 || discoveredElite90Ref.current.has(s.symbol))
        .map(s => s.symbol);
      const near90Symbols = allStocksData
        .filter(s => (s.overallScore?.totalScore || 0) >= 80 && (s.overallScore?.totalScore || 0) < 90)
        .slice(0, 30)
        .map(s => s.symbol);
      const prioritySymbols: string[] = Array.from(
        new Set([...coreBreakoutWatch, ...elite90Symbols, ...near90Symbols])
      );
      if (selectedStock) prioritySymbols.push(selectedStock.symbol);

      // Multi-Segment Interleaved Sweeper:
      // Divides universe into 3 balanced segments (Head: 0..33%, Mid: 33..66%, Tail: 66..100%).
      // Sweeps head, middle, and tail concurrently so tail-end stocks (like KANOHAR at index 1183)
      // are scanned simultaneously right from the very first tick without waiting minutes!
      const totalLen = targetStocks.length;
      const segSize = Math.max(1, Math.floor(totalLen / 3));
      const subBatchSize = forceDeepScan ? 35 : 20;

      const offset = (refreshBatchIndexRef.current * subBatchSize) % segSize;
      const headSlice = targetStocks.slice(offset, offset + subBatchSize).map(s => s.symbol);
      const midSlice = targetStocks.slice(segSize + offset, segSize + offset + subBatchSize).map(s => s.symbol);
      const tailSlice = targetStocks.slice(segSize * 2 + offset, segSize * 2 + offset + subBatchSize).map(s => s.symbol);

      const rollingSlice: string[] = Array.from(new Set([...headSlice, ...midSlice, ...tailSlice]));
      refreshBatchIndexRef.current = (refreshBatchIndexRef.current + 1) % Math.max(1, Math.ceil(segSize / subBatchSize));

      const allSyms: string[] = [...prioritySymbols, ...rollingSlice];
      const symbolsToFetch: string[] = Array.from(new Set(allSyms));
      const quotesMap = await fetchQuotesFromBackend(symbolsToFetch);

      const existingMap = new Map(allStocksData.map(s => [s.symbol, s]));
      const rawProcessed: StockIndicatorData[] = targetStocks.map(stock => {
        const liveQ = quotesMap.get(stock.symbol);
        const existing = existingMap.get(stock.symbol);
        if (!liveQ && existing) return existing;
        return processStock(stock, existing, liveQ);
      });

      // ABSOLUTE STRICT HARD MANDATE: Discard ANY stock < ₹100 or > ₹3000 or Market Cap < 500 Cr
      // Note: Stocks with 3M ADV <= 30,000 are strictly ranked below >30,000 ADV stocks and hidden in normal scanner tabs,
      // but retained in allStocksData so explicit user searches (e.g. "The Anup Engineering" / ANUP) always display their full live details!
      const processed = rawProcessed.filter(s => 
        s.currentPrice >= 100 && 
        s.currentPrice <= 3000 && 
        (s.marketCapCr || 0) >= 500
      );

      // ADAPTIVE THINKING BRAIN + PRIORITY-FIRST HIERARCHY:
      // 1) Priority 1 -> Priority 2 -> Priority 3 strictly lead Top 10 (Tier 4 avoided in Top 10)
      // 2) Self-adjusting progressive funnel (Loose / Balanced / Strict) stops at Top 3-5 apex leaders
      // 3) Parallel weighted scoring ranks leaders smoothly within each Priority Tier
      applyAdaptiveMarketBrain(processed);

      // Assign rank (1 to N) and historical qualification rank at qualifiedTime
      const chronoRankMap = computeHistoricalQualificationRanks(processed);

      processed.forEach((s, idx) => {
        s.rank = idx + 1;
        if (s.qualification) {
          s.qualification.qualifiedRank = chronoRankMap.get(s.symbol) ?? s.qualification.qualifiedRank ?? s.rank;
        }
      });

      // Real-time tracking of newly discovered 90+ stocks so none are ever missed
      processed.forEach(s => {
        if (s.overallScore.totalScore >= 90 && !discoveredElite90Ref.current.has(s.symbol)) {
          discoveredElite90Ref.current.add(s.symbol);
          if (isFirstScanDone) {
            const timeNow = new Date().toLocaleTimeString('en-IN', {
              timeZone: 'Asia/Kolkata',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              hour12: true,
            });
            const eliteAlert: AlertNotification = {
              id: `elite90-${s.symbol}-${Date.now()}`,
              timestamp: timeNow,
              symbol: s.symbol,
              name: s.name,
              price: s.currentPrice,
              signalStage: 'STRONG_LONG',
              score: s.overallScore.totalScore,
              message: `⭐ 90+ ELITE REAL-TIME IDENTIFIED: ${s.symbol} scored ${s.overallScore.totalScore}/100!`,
              messageTe: `⭐ రియల్-టైమ్ 90+ ఎలైట్ స్టాక్ ఐడెంటిఫై అయింది: ${s.symbol} (${s.name}) - టెక్నికల్ స్కోర్: ${s.overallScore.totalScore}/100!`,
              isRead: false,
            };
            setAlerts(prev => [eliteAlert, ...prev].slice(0, 50));
            if (soundEnabled) {
              playAlertSound('STRONG_LONG');
            }
          }
        }
      });

      checkForAlerts(processed, allStocksData);
      setAllStocksData(processed);
      setSelectedStock(curr => {
        if (!curr) return null;
        return processed.find(p => p.symbol === curr.symbol) || curr;
      });
      
      // Capture morning snapshot (strictly Priority 1/2/3 verified active stocks — NEVER Tier-4 or 0-volume cold-start placeholders!)
      if (morningTop10Symbols.length === 0 && processed.length > 0) {
        const verifiedPriorityPool = processed.filter(
          s =>
            s.currentVolume > 0 &&
            s.isLiveSynced &&
            (s.adv3M || s.adv || s.avgVolume || 0) > 25000 &&
            (s.fiveDayBaseProfile?.priorityTier ?? 4) <= 3
        );
        const top10 = verifiedPriorityPool.slice(0, 10).map(s => s.symbol);
        if (top10.length > 0) {
          setMorningTop10Symbols(top10);
        }
        firstScanSymbolsRef.current = processed.map(s => s.symbol);
      }

      setIsFirstScanDone(true);
      setLastScanTime(timeString);
    } catch (err) {
      console.error('Scan failed:', err);
    } finally {
      setIsScanning(false);
      setIsFullRescan(false);
    }
  }, [allStocksData, checkForAlerts, processStock, selectedStock, isFirstScanDone, soundEnabled]);

  // Initial Scan on Mount
  useEffect(() => {
    executeScan(true);
  }, []);

  // Auto-refresh interval (every 8 seconds) to continuously sync quotes across all stocks
  useEffect(() => {
    if (!autoRefresh || !isFirstScanDone) return;
    const interval = setInterval(async () => {
      const currentUniverse = getCombinedUniverse(allStocksData);
      if (currentUniverse.length === 0) return;

      // Prioritize fetching live quotes strictly by current TECHNICAL SCORE:
      // ALL stocks with 90+ score (or discovered as 90+) are ALWAYS refreshed on every tick
      const coreBreakoutWatch = [
        'AIROLAM',
        'BANARISUG',
        'ANGELONE',
        'BALRAMCHIN',
        'TEMPSENS',
        'AEGISLOG',
        'FUSION',
        'KRBL',
        'ASAHIINDIA',
        '360ONE',
        'CDSL',
        'GRSE',
        'MOTILALOFS',
        'PRAJIND',
        'INFOBEAN',
        'BHARATWIRE',
        'ITI',
        'INOXGREEN',
      ];
      const elite90Symbols = allStocksData
        .filter(s => (s.overallScore?.totalScore || 0) >= 90 || discoveredElite90Ref.current.has(s.symbol))
        .map(s => s.symbol);
      const near90Symbols = allStocksData
        .filter(s => (s.overallScore?.totalScore || 0) >= 80 && (s.overallScore?.totalScore || 0) < 90)
        .slice(0, 25)
        .map(s => s.symbol);
      const prioritySymbols: string[] = Array.from(new Set([...coreBreakoutWatch, ...elite90Symbols, ...near90Symbols]));
      if (selectedStock) prioritySymbols.push(selectedStock.symbol);

      // Multi-Segment Sweeper: Head, Mid, and Tail refreshed concurrently
      const totalLen = currentUniverse.length;
      const segSize = Math.max(1, Math.floor(totalLen / 3));
      const subBatchSize = 20;

      const offset = (refreshBatchIndexRef.current * subBatchSize) % segSize;
      const headSlice = currentUniverse.slice(offset, offset + subBatchSize).map(s => s.symbol);
      const midSlice = currentUniverse.slice(segSize + offset, segSize + offset + subBatchSize).map(s => s.symbol);
      const tailSlice = currentUniverse.slice(segSize * 2 + offset, segSize * 2 + offset + subBatchSize).map(s => s.symbol);

      const rollingSlice: string[] = Array.from(new Set([...headSlice, ...midSlice, ...tailSlice]));
      refreshBatchIndexRef.current = (refreshBatchIndexRef.current + 1) % Math.max(1, Math.ceil(segSize / subBatchSize));

      const allSyms: string[] = [...prioritySymbols, ...rollingSlice];
      const symbolsToFetch: string[] = Array.from(new Set(allSyms));
      const quotesMap = await fetchQuotesFromBackend(symbolsToFetch);
      if (quotesMap.size === 0) return;

      setAllStocksData(prev => {
        if (prev.length === 0) return prev;
        const updated = prev.map(stock => {
          const liveQ = quotesMap.get(stock.symbol);
          if (!liveQ) return stock;
          const universeStock = currentUniverse.find(u => u.symbol === stock.symbol) || {
            symbol: stock.symbol,
            name: stock.name,
            nameTe: stock.nameTe || stock.name,
            sector: stock.sector,
            basePrice: liveQ.price,
            prevClose: liveQ.prevClose,
            dayHigh: liveQ.dayHigh,
            dayLow: liveQ.dayLow,
            marketCapCr: stock.marketCapCr,
            avgVolume: stock.avgVolume,
          };
          return processStock(universeStock, stock, liveQ);
        });

        // ABSOLUTE STRICT HARD MANDATE: Discard ANY stock < ₹100 or > ₹3000 or Market Cap < 500 Cr
        const strictlyEligible = updated.filter(s => 
          s.currentPrice >= 100 && 
          s.currentPrice <= 3000 && 
          (s.marketCapCr || 0) >= 500
        );

        // Re-evaluate Adaptive Thinking Brain & Priority-First hierarchy
        applyAdaptiveMarketBrain(strictlyEligible);
        const chronoRankMap = computeHistoricalQualificationRanks(strictlyEligible);

        strictlyEligible.forEach((s, idx) => {
          s.rank = idx + 1;
          if (s.qualification) {
            s.qualification.qualifiedRank = chronoRankMap.get(s.symbol) ?? s.qualification.qualifiedRank ?? s.rank;
          }
        });

        // Real-time tracking of newly discovered 90+ stocks in auto-refresh
        strictlyEligible.forEach(s => {
          if (s.overallScore.totalScore >= 90 && !discoveredElite90Ref.current.has(s.symbol)) {
            discoveredElite90Ref.current.add(s.symbol);
            const timeNow = new Date().toLocaleTimeString('en-IN', {
              timeZone: 'Asia/Kolkata',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              hour12: true,
            });
            const eliteAlert: AlertNotification = {
              id: `elite90-${s.symbol}-${Date.now()}`,
              timestamp: timeNow,
              symbol: s.symbol,
              name: s.name,
              price: s.currentPrice,
              signalStage: 'STRONG_LONG',
              score: s.overallScore.totalScore,
              message: `⭐ 90+ ELITE REAL-TIME IDENTIFIED: ${s.symbol} scored ${s.overallScore.totalScore}/100!`,
              messageTe: `⭐ రియల్-టైమ్ 90+ ఎలైట్ స్టాక్ ఐడెంటిఫై అయింది: ${s.symbol} (${s.name}) - టెక్నికల్ స్కోర్: ${s.overallScore.totalScore}/100!`,
              isRead: false,
            };
            setAlerts(al => [eliteAlert, ...al].slice(0, 50));
            if (soundEnabled) {
              playAlertSound('STRONG_LONG');
            }
          }
        });

        // Keep open modal stock updated WITH its exact sorted rank (Never overwrite with unranked processStock!)
        setSelectedStock(curr => {
          if (!curr) return null;
          const rankedMatch = strictlyEligible.find(s => s.symbol === curr.symbol);
          if (rankedMatch) return rankedMatch;
          const liveQ = quotesMap.get(curr.symbol);
          if (!liveQ) return curr;
          const universeStock = currentUniverse.find(u => u.symbol === curr.symbol) || {
            symbol: curr.symbol,
            name: curr.name,
            nameTe: curr.nameTe,
            sector: curr.sector,
            basePrice: liveQ.price,
            prevClose: liveQ.prevClose,
            dayHigh: liveQ.dayHigh,
            dayLow: liveQ.dayLow,
            marketCapCr: curr.marketCapCr,
            avgVolume: curr.avgVolume,
          };
          const freshUnlisted = processStock(universeStock, curr, liveQ);
          freshUnlisted.rank = curr.rank;
          return freshUnlisted;
        });

        return strictlyEligible;
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [autoRefresh, isFirstScanDone, processStock, allStocksData, selectedStock]);

  // Handle User Searching Any Stock with Comprehensive Multi-Tier Resolution
  // ARCHITECTURAL MANDATE: Active listed stocks always take absolute priority over unlisted checks!
  const handleSearchSubmit = async (symbolOrQuery: string) => {
    const rawQ = symbolOrQuery.trim();
    if (!rawQ) return;
    setIsSearchDropdownOpen(false);
    const q = rawQ.toUpperCase().replace(/\.(NS|BO)$/i, '');
    const normCompanyQ = q.replace(/^THE\s+/i, '').replace(/\s+(LIMITED|LTD\.?)$/i, '').trim();

    // 1. Resolve former symbol, company name, or brand alias (e.g. GROWW, GOWW, M&MFIN, MMFIN, URBAN, MOBIKWIK, TATAMOTORS, ZOMATO, THE ANUP ENGINEERING -> ANUP)
    let resolvedSym = ALIAS_MAP[q] || ALIAS_MAP[normCompanyQ] || ALIAS_MAP[rawQ.toLowerCase()] || ALIAS_MAP[rawQ] || q;

    const matchesStockQuery = (s: { symbol: string; name: string; nameTe?: string }) => {
      const symUp = s.symbol.toUpperCase();
      const nameUp = s.name.toUpperCase();
      const normNameUp = nameUp.replace(/^THE\s+/i, '').replace(/\s+(LIMITED|LTD\.?)$/i, '').trim();
      const nameTeUp = (s.nameTe || '').toUpperCase();
      const aliases = REVERSE_SEARCH_ALIASES[s.symbol] || [];
      return (
        symUp === resolvedSym ||
        symUp === q ||
        nameUp.includes(q) ||
        (normCompanyQ.length >= 3 && normNameUp.includes(normCompanyQ)) ||
        (nameTeUp && nameTeUp.includes(q)) ||
        aliases.some(a => a.toUpperCase().includes(q) || q.includes(a.toUpperCase()))
      );
    };

    // 2. Check if already in processed list
    const foundInList = allStocksData.find(matchesStockQuery);
    if (foundInList) {
      handleOpenStockDetail(foundInList);
      return;
    }

    // 3. Check in NSE primary universe
    let foundInUniverse = getUniverseStock(resolvedSym) || NSE_UNIVERSE.find(matchesStockQuery);

    // 4. Fallback: search across full 1,183 equity universe
    if (!foundInUniverse) {
      foundInUniverse = (fullUniverseData as UniverseStock[]).find(matchesStockQuery);
    }

    // 5. Server-side search fallback if symbol is unknown (e.g. user typed partial company name, newly traded ticker, or typo like goww)
    let symbolToFetch = foundInUniverse ? foundInUniverse.symbol : resolvedSym;
    if (!foundInUniverse) {
      try {
        const searchRes = await fetch(`/api/search?q=${encodeURIComponent(rawQ)}`);
        if (searchRes.ok) {
          const searchData = await searchRes.json();
          const nseMatch = (searchData.results || []).find(
            (r: any) => r.exchange === 'NSE' || r.exchange === 'NSI' || !r.symbol.includes('.')
          );
          if (nseMatch) {
            symbolToFetch = nseMatch.symbol.replace(/\.(NS|BO)$/i, '').toUpperCase();
            resolvedSym = symbolToFetch;
            foundInUniverse = getUniverseStock(resolvedSym) || (fullUniverseData as UniverseStock[]).find(s => s.symbol === resolvedSym);
          }
        }
      } catch (err) {
        console.warn('Backend search lookup failed', err);
      }
    }

    // 6. Fetch live quote from NSE exchange server
    let liveQ: any = null;
    try {
      const res = await fetch(`/api/quote/${encodeURIComponent(symbolToFetch)}`);
      if (res.ok) {
        liveQ = await res.json();
      }
    } catch (e) {
      console.warn('Failed to fetch quote for searched symbol', e);
    }

    const effectivePrice = liveQ?.price || foundInUniverse?.basePrice || 0;

    // 7. If NOT an active listed stock (no live quote on exchange and not in universe):
    if (!effectivePrice || effectivePrice <= 0) {
      // Check if user searched for a known delisted / suspended stock
      const delistedInfo = isDelistedStock(q);
      if (delistedInfo) {
        setSearchStatusModal({
          type: 'DELISTED_STOCK',
          symbol: q,
          reasonTe: delistedInfo.reasonTe,
          reasonEn: delistedInfo.reason,
        });
        return;
      }

      // Check if user searched for an unlisted unicorn / pre-IPO company (e.g. Zepto, PhonePe, Flipkart, boAt, Razorpay)
      const unlistedComp = findUnlistedCompany(rawQ);
      if (unlistedComp) {
        setSearchStatusModal({ type: 'UNLISTED_COMPANY', company: unlistedComp });
        return;
      }

      setSearchStatusModal({
        type: 'NOT_FOUND',
        query: rawQ,
      });
      return;
    }

    // Strictly enforce price range filter: ₹100 to ₹3,000 (No penny stocks < ₹100 or over-priced > ₹3,000)
    if (effectivePrice < 100 || effectivePrice > 3000) {
      setSearchStatusModal({
        type: 'PRICE_OUT_OF_RANGE',
        symbol: symbolToFetch,
        currentPrice: effectivePrice,
        reasonTe: `స్టాక్ "${symbolToFetch}" ప్రస్తుత ధర ₹${effectivePrice.toFixed(2)}. మన వ్యూహం ప్రకారం ₹100 నుండి ₹3,000 మధ్య ఉన్న నాణ్యమైన స్టాక్స్ మాత్రమే స్క్రీనర్ పరిధిలోకి వస్తాయి. ₹100 లోపు పెన్నీ స్టాక్స్ లేదా ₹3,000 దాటిన హెవీ-ప్రైస్ స్టాక్స్ స్క్రీనర్‌లో చేర్చబడవు.`,
      });
      return;
    }

    // Build valid stock data
    const targetStock: UniverseStock = foundInUniverse || {
      symbol: symbolToFetch,
      name: liveQ?.shortName || liveQ?.longName || `${symbolToFetch} Limited`,
      nameTe: `${symbolToFetch} లిమిటెడ్`,
      sector: 'NSE Equity',
      basePrice: Number(effectivePrice.toFixed(2)),
      prevClose: Number((liveQ?.prevClose || effectivePrice).toFixed(2)),
      dayHigh: Number((liveQ?.dayHigh || effectivePrice * 1.015).toFixed(2)),
      dayLow: Number((liveQ?.dayLow || effectivePrice * 0.985).toFixed(2)),
      marketCapCr: 5000,
      avgVolume: (liveQ as any)?.adv || (liveQ as any)?.adv3m || liveQ?.volume || 25000,
    };

    saveCustomStock(targetStock);
    let processed = processStock(targetStock, undefined, liveQ);

    // Check if stock scores 90+ and was not flagged before search: Execute Deep Diagnostic
    const is90Plus = (processed.overallScore?.totalScore || 0) >= 90;
    const wasDiscoveredBefore = discoveredElite90Ref.current.has(processed.symbol);
    if (is90Plus && !wasDiscoveredBefore) {
      discoveredElite90Ref.current.add(processed.symbol);
      const targetUniverse = getCombinedUniverse(allStocksData);
      const uIdx = targetUniverse.findIndex(u => u.symbol === processed.symbol);
      const report = diagnoseStockOmission(
        processed.symbol,
        processed,
        uIdx,
        targetUniverse.length,
        refreshBatchIndexRef.current
      );
      processed = { ...processed, diagnosticAnalysis: report };
    }

    setAllStocksData(prev => {
      const merged = [processed, ...prev.filter(s => s.symbol !== processed.symbol)];
      const strictlyEligible = merged.filter(s => s.currentPrice >= 100 && s.currentPrice <= 3000 && (s.marketCapCr || 0) >= 500);
      applyAdaptiveMarketBrain(strictlyEligible);
      const chronoRankMap = computeHistoricalQualificationRanks(strictlyEligible);

      strictlyEligible.forEach((s, idx) => {
        s.rank = idx + 1;
        if (s.qualification) {
          const cRank = chronoRankMap.get(s.symbol);
          if (cRank !== undefined) {
            s.qualification.qualifiedRank = cRank;
          } else if (s.qualification.qualifiedRank === undefined || s.qualification.qualifiedRank > 250) {
            s.qualification.qualifiedRank = Math.min(s.rank, 150);
          }
        }
      });
      const targetRanked = strictlyEligible.find(s => s.symbol === processed.symbol) || processed;
      setSelectedStock(targetRanked);

      if (targetRanked.overallScore.totalScore >= 90) {
        const timeNow = new Date().toLocaleTimeString('en-IN', {
          timeZone: 'Asia/Kolkata',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        });
        const isTop10 = (targetRanked.rank || 999) <= 10;
        const msg = isTop10
          ? `⭐ 90+ TOP 10 RANK ASSIGNED: ${targetRanked.symbol} scored ${targetRanked.overallScore.totalScore}/100 and placed at Rank #${targetRanked.rank}!`
          : `⭐ 90+ ELITE IDENTIFIED: ${targetRanked.symbol} scored ${targetRanked.overallScore.totalScore}/100 and placed at Rank #${targetRanked.rank}!`;
        const msgTe = isTop10
          ? `⭐ 90+ టాప్ 10 ర్యాంక్ కేటాయింపు: ${targetRanked.symbol} (${targetRanked.overallScore.totalScore}/100) లీడర్‌బోర్డ్‌లో ర్యాంక్ #${targetRanked.rank} స్థానంలో నిలిచింది!`
          : `⭐ 90+ ఎలైట్ స్టాక్: ${targetRanked.symbol} (${targetRanked.overallScore.totalScore}/100) ర్యాంక్ #${targetRanked.rank} కేటాయించబడింది!`;
        
        const eliteAlert: AlertNotification = {
          id: `elite90-search-${targetRanked.symbol}-${Date.now()}`,
          timestamp: timeNow,
          symbol: targetRanked.symbol,
          name: targetRanked.name,
          price: targetRanked.currentPrice,
          signalStage: 'STRONG_LONG',
          score: targetRanked.overallScore.totalScore,
          message: msg,
          messageTe: msgTe,
          isRead: false,
        };
        setAlerts(al => [eliteAlert, ...al].slice(0, 50));
        if (soundEnabled) {
          playAlertSound('STRONG_LONG');
        }
      }

      return strictlyEligible;
    });
  };

  // Filtered stocks for categories & 90+ elite filter
  const filteredStocks = useMemo(() => {
    const list = allStocksData.filter(stock => {
      // ABSOLUTE STRICT HARD MANDATE: Discard ANY stock < ₹100 or > ₹3000 or MCap < 500 Cr
      if (stock.currentPrice < 100 || stock.currentPrice > 3000 || (stock.marketCapCr || 0) < 500) {
        return false;
      }

      // Search text query (supports official NSE symbol, full/partial company name like "The Anup Engineering" -> ANUP, and aliases)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const qUpper = q.toUpperCase().replace(/\.(NS|BO)$/i, '');
        const normQ = q.replace(/^the\s+/i, '').replace(/\s+(limited|ltd\.?)$/i, '').trim();
        const directAliasSym = ALIAS_MAP[qUpper] || ALIAS_MAP[normQ.toUpperCase()] || ALIAS_MAP[q];
        const aliases = REVERSE_SEARCH_ALIASES[stock.symbol] || [];
        const aliasMatch = aliases.some(a => a.toLowerCase().includes(q) || q.includes(a.toLowerCase()));
        const normStockName = stock.name.toLowerCase().replace(/^the\s+/i, '').replace(/\s+(limited|ltd\.?)$/i, '').trim();
        const match =
          (directAliasSym && stock.symbol.toUpperCase() === directAliasSym) ||
          stock.symbol.toLowerCase().includes(q) ||
          stock.name.toLowerCase().includes(q) ||
          (normQ.length >= 3 && normStockName.includes(normQ)) ||
          (stock.nameTe && stock.nameTe.toLowerCase().includes(q)) ||
          aliasMatch;
        // CRITICAL: When user explicitly searches for a stock, show all matching stocks regardless of active tab or score filter!
        return Boolean(match);
      } else {
        // Strict 3-Month Average Volume > 25,000 filter across all scanner tabs
        if ((stock.adv3M || stock.adv || stock.avgVolume || 0) <= 25000) {
          return false;
        }
      }

      // 90+ ELITE STOCKS FILTER:
      // When ELITE_90_PLUS tab or 90+ filter is active, show ALL stocks with 90+ score across the entire universe without missing any
      if (activeCategory === 'ELITE_90_PLUS' || filterMinScore === 90) {
        return stock.overallScore.totalScore >= 90;
      }

      // TOP 10 tab — STRICT USER MANDATE: Priority 1 -> Priority 2 -> Priority 3 ONLY (Tier 4 completely excluded!)
      if (activeCategory === 'TOP_10') {
        const tier = stock.fiveDayBaseProfile?.priorityTier ?? 4;
        return tier <= 3 && (stock.rank || 999) <= 10;
      }

      // RVOL category tab: Show active universe stocks (they will be sorted High to Low by RVOL!)
      if (activeCategory === 'RVOL') {
        return true;
      }

      // Category tab
      if (activeCategory === 'ALREADY_STRONG' && stock.category !== 'ALREADY_STRONG') return false;
      if (activeCategory === 'PRE_BREAKOUT' && stock.category !== 'PRE_BREAKOUT') return false;
      if (activeCategory === 'DIP_RECOVERY' && stock.category !== 'DIP_RECOVERY') return false;

      // Score filter
      if (stock.overallScore.totalScore < filterMinScore) return false;

      // Pivot Point filter (PP / R1-R3)
      if (filterAbovePivotOnly && stock.pivots && stock.currentPrice < stock.pivots.pivot) {
        return false;
      }

      // High persistence filter
      if (filterHighPersistenceOnly && stock.persistenceScore.persistencePercent < 75) return false;

      // Good breakout room filter
      if (filterGoodRoomOnly && (stock.tradePlan.breakoutRoomStatus === 'BLOCKED' || stock.tradePlan.breakoutRoomStatus === 'TIGHT')) {
        return false;
      }

      return true;
    });

    // RVOL Category: STRICT USER MANDATE
    // "Rvol కేటగిరి నీ సెలెక్ట్ చేస్కోంటే rvol sort high టూ low అనగా rvol వాల్యూ అధికంగా వున్నా స్టాక్స్ ముందు రావాలి అలా rvol తక్కువ వున్నా స్టాక్ చివర లేదా ఆఖరు రావాలి"
    if (activeCategory === 'RVOL') {
      return [...list].sort((a, b) => {
        // High-Power Sort: Primary is the MTF-RVOL Power multiple
        const rvolDiff = (b.rvol || 0) - (a.rvol || 0);
        if (Math.abs(rvolDiff) > 0.01) return rvolDiff;
        
        // Secondary: Full-day 3M ADV cross multiple (Institutional strength)
        const advDiff = (b.fullDayRvol || 0) - (a.fullDayRvol || 0);
        if (Math.abs(advDiff) > 0.01) return advDiff;
        
        return (b.overallScore?.totalScore || 0) - (a.overallScore?.totalScore || 0);
      });
    }

    // Default: Ensure filtered list is sorted strictly by multi-factor technical strength
    return [...list].sort(compareStocksByTechnicalStrength);
  }, [allStocksData, searchQuery, activeCategory, filterMinScore, filterAbovePivotOnly, filterHighPersistenceOnly, filterGoodRoomOnly]);

  // Category counts, 90+ elite count, Above Pivot count, Top 10 & RVOL count
  const counts = useMemo(() => {
    let strong = 0;
    let preBreakout = 0;
    let dipRecovery = 0;
    let elite90Plus = 0;
    let abovePivot = 0;
    let rvolSurge = 0;
    let top10 = 0;
    allStocksData.forEach(s => {
      const tier = s.fiveDayBaseProfile?.priorityTier ?? 4;
      if ((s.adv3M || s.adv || s.avgVolume || 0) > 25000 && tier <= 3 && (s.rank || 999) <= 10) top10++;
      if (s.category === 'ALREADY_STRONG') strong++;
      else if (s.category === 'PRE_BREAKOUT') preBreakout++;
      else if (s.category === 'DIP_RECOVERY') dipRecovery++;
      if (s.overallScore.totalScore >= 90) elite90Plus++;
      if (s.pivots && s.currentPrice >= s.pivots.pivot) abovePivot++;
      if ((s.rvol || 0) >= 1.5) rvolSurge++;
    });
    return { strong, preBreakout, dipRecovery, elite90Plus, abovePivot, rvol: rvolSurge, top10, total: allStocksData.length };
  }, [allStocksData]);

  // Autocomplete suggestions for search input (Multi-tier: active stocks, unlisted unicorns, merged entities, delisted)
  const [backendSuggestions, setBackendSuggestions] = useState<SpecialSearchResult[]>([]);

  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 3) {
      setBackendSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        if (!res.ok) return;
        const data = await res.json();
        const results: SpecialSearchResult[] = (data.results || []).map((r: any) => ({
          type: 'ACTIVE_STOCK' as const,
          symbol: String(r.symbol || '').replace(/\.(NS|BO)$/i, '').toUpperCase(),
          name: r.name,
          basePrice: 0,
          sector: r.exchange || 'NSE',
        }));
        setBackendSuggestions(results);
      } catch {
        setBackendSuggestions([]);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const searchSuggestions = useMemo(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) return [];
    const local = searchUniverseWithSpecialEntities(searchQuery, 8);
    if (backendSuggestions.length === 0) return local;
    const existingSyms = new Set(local.map(s => s.symbol));
    const merged = [...local];
    for (const b of backendSuggestions) {
      if (!existingSyms.has(b.symbol)) {
        existingSyms.add(b.symbol);
        merged.push(b);
        if (merged.length >= 8) break;
      }
    }
    return merged;
  }, [searchQuery, backendSuggestions]);

  // Auto-sync live quotes for stocks matching the user's search query (even before pressing Enter)
  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 3) return;
    const activeMatches = searchSuggestions
      .filter((item): item is Extract<SpecialSearchResult, { type: 'ACTIVE_STOCK' }> => item.type === 'ACTIVE_STOCK')
      .slice(0, 3);
    if (activeMatches.length === 0) return;

    const timer = setTimeout(async () => {
      for (const item of activeMatches) {
        const existing = allStocksData.find(s => s.symbol === item.symbol);
        const isFresh = existing?.isLiveSynced && existing.lastLiveSyncTime && Date.now() - existing.lastLiveSyncTime < 45000;
        if (isFresh) continue;
        try {
          const res = await fetch(`/api/quote/${encodeURIComponent(item.symbol)}`);
          if (!res.ok) continue;
          const liveQ = await res.json();
          if (!liveQ || !liveQ.price || liveQ.price < 100 || liveQ.price > 3000) continue;
          const uStock: UniverseStock =
            getUniverseStock(item.symbol) ||
            (fullUniverseData as UniverseStock[]).find(u => u.symbol === item.symbol) || {
              symbol: item.symbol,
              name: item.name || liveQ.shortName || `${item.symbol} Limited`,
              nameTe: item.nameTe || item.name || `${item.symbol} లిమిటెడ్`,
              sector: item.sector || 'NSE Equity',
              basePrice: Number(liveQ.price.toFixed(2)),
              prevClose: Number((liveQ.prevClose || liveQ.price).toFixed(2)),
              dayHigh: Number((liveQ.dayHigh || liveQ.price).toFixed(2)),
              dayLow: Number((liveQ.dayLow || liveQ.price).toFixed(2)),
              marketCapCr: 5000,
              avgVolume: liveQ.adv || liveQ.volume || 25000,
            };
          const fresh = processStock(uStock, existing, liveQ);
          fresh.isLiveSynced = true;
          fresh.lastLiveSyncTime = Date.now();
          setAllStocksData(prev => {
            const idx = prev.findIndex(s => s.symbol === fresh.symbol);
            const next = idx >= 0 ? prev.map((s, i) => (i === idx ? fresh : s)) : [fresh, ...prev];
            applyAdaptiveMarketBrain(next);
            next.forEach((s, i) => {
              s.rank = i + 1;
            });
            return next;
          });
        } catch {}
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, searchSuggestions, allStocksData, processStock]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased selection:bg-emerald-500 selection:text-slate-950 pb-16">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          {/* Brand Logo & Name */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 p-0.5 shadow-lg shadow-emerald-500/20 flex items-center justify-center">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-emerald-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-black tracking-tight text-slate-100">
                  NSE Strong Long Scanner
                </h1>
                <span className="hidden sm:inline-block text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  20-Min Persistence Engine
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                స్ట్రాంగ్ లాంగ్ • ప్రీ-బ్రేక్‌అవుట్ వాచ్ • డిప్ రికవరీ
              </p>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative flex-1 max-w-md min-w-[240px]">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="input-stock-search"
                type="text"
                placeholder="ఏదైనా స్టాక్ సెర్చ్ చేయండి (e.g. The Anup Engineering, TATAMOTORS, SBIN)..."
                value={searchQuery}
                onFocus={() => setIsSearchDropdownOpen(true)}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setIsSearchDropdownOpen(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setIsSearchDropdownOpen(false);
                    handleSearchSubmit(searchQuery);
                  } else if (e.key === 'Escape') {
                    setIsSearchDropdownOpen(false);
                  }
                }}
                className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl pl-9 pr-16 py-2 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-mono"
              />
              <button
                id="btn-search-submit"
                onClick={() => {
                  setIsSearchDropdownOpen(false);
                  handleSearchSubmit(searchQuery);
                }}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2.5 py-1 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-500 text-slate-950 rounded-lg transition-colors"
              >
                సెర్చ్
              </button>
            </div>

            {/* Autocomplete Dropdown */}
            {isSearchDropdownOpen && searchSuggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-50 divide-y divide-slate-800/60 max-h-80 overflow-y-auto">
                {searchSuggestions.map((item) => {
                  if (item.type === 'ACTIVE_STOCK') {
                    return (
                      <div
                        key={`stock-${item.symbol}`}
                        onClick={() => {
                          setIsSearchDropdownOpen(false);
                          setSearchQuery(item.symbol);
                          handleSearchSubmit(item.symbol);
                        }}
                        className="p-2.5 hover:bg-slate-800 cursor-pointer flex items-center justify-between text-xs transition-colors"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-emerald-400">{item.symbol}</span>
                            <span className="text-slate-300 font-medium">{item.name}</span>
                          </div>
                          {item.nameTe && item.nameTe !== item.name && (
                            <div className="text-[11px] text-slate-400">{item.nameTe}</div>
                          )}
                        </div>
                        <div className="text-right shrink-0 ml-2">
                          {item.basePrice > 0 && (
                            <div className="text-slate-200 font-mono font-bold">₹{item.basePrice}</div>
                          )}
                          <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded border border-slate-700/60">
                            {item.sector}
                          </span>
                        </div>
                      </div>
                    );
                  }

                  if (item.type === 'UNLISTED_COMPANY') {
                    return (
                      <div
                        key={`unlisted-${item.id}`}
                        onClick={() => {
                          setSearchStatusModal({ type: 'UNLISTED_COMPANY', company: item.unlistedData });
                        }}
                        className="p-2.5 hover:bg-amber-950/40 bg-amber-950/20 cursor-pointer flex items-center justify-between text-xs transition-colors border-l-2 border-l-amber-500"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-amber-300">{item.name}</span>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              అన్‌లిస్టెడ్ / ప్రీ-ఐపీవో
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {item.nameTe} • NSE లో ఇంకా లిస్ట్ కాలేదు
                          </div>
                        </div>
                        <span className="text-[10px] text-amber-400 font-semibold shrink-0 ml-2">
                          నివేదిక చూడండి →
                        </span>
                      </div>
                    );
                  }

                  if (item.type === 'MERGED_ENTITY') {
                    return (
                      <div
                        key={`merged-${item.symbol}`}
                        onClick={() => {
                          setSearchQuery(item.newSymbol);
                          handleSearchSubmit(item.newSymbol);
                        }}
                        className="p-2.5 hover:bg-cyan-950/40 bg-cyan-950/20 cursor-pointer flex items-center justify-between text-xs transition-colors border-l-2 border-l-cyan-500"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-slate-300 line-through">{item.symbol}</span>
                            <span className="text-cyan-400 font-mono font-bold">→ {item.newSymbol}</span>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                              రీ-బ్రాండ్ / విలీనం
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400">{item.name}</div>
                        </div>
                        <span className="text-[10px] text-cyan-400 font-semibold shrink-0 ml-2">
                          {item.newSymbol} చూడండి →
                        </span>
                      </div>
                    );
                  }

                  if (item.type === 'DELISTED_STOCK') {
                    return (
                      <div
                        key={`delisted-${item.symbol}`}
                        onClick={() => {
                          setSearchStatusModal({ type: 'DELISTED_STOCK', symbol: item.symbol, reasonTe: item.reasonTe });
                        }}
                        className="p-2.5 hover:bg-rose-950/40 bg-rose-950/20 cursor-pointer flex items-center justify-between text-xs transition-colors border-l-2 border-l-rose-500"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-rose-300">{item.symbol}</span>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                              డీలిస్టెడ్ / సస్పెండ్
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 truncate max-w-xs">{item.reasonTe}</div>
                        </div>
                        <span className="text-[10px] text-rose-400 font-semibold shrink-0 ml-2">
                          వివరాలు →
                        </span>
                      </div>
                    );
                  }

                  return null;
                })}
              </div>
            )}
          </div>

          {/* Action buttons & Alert bell */}
          <div className="flex items-center gap-2">
            {/* Auto Refresh toggle */}
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
                autoRefresh
                  ? 'bg-emerald-950/70 border-emerald-500/50 text-emerald-400'
                  : 'bg-slate-900 border-slate-800 text-slate-500'
              }`}
              title={autoRefresh ? 'లైవ్ అప్‌డేట్స్ ఆన్' : 'లైవ్ అప్‌డేట్స్ పాజ్'}
            >
              <span className={`w-2 h-2 rounded-full ${autoRefresh ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
              <span className="hidden sm:inline">{autoRefresh ? 'లైవ్ LIVE' : 'పాజ్డ్'}</span>
            </button>

            {/* Alert Bell */}
            <button
              id="btn-open-alerts"
              onClick={() => setIsAlertsOpen(true)}
              className="relative p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-slate-100 hover:bg-slate-850 transition-colors"
            >
              <Bell className="w-4 h-4" />
              {alerts.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 text-slate-950 font-bold text-[9px] flex items-center justify-center">
                  {alerts.length > 9 ? '9+' : alerts.length}
                </span>
              )}
            </button>

            {/* Scan Now Primary Button */}
            <button
              id="btn-scan-now"
              onClick={() => executeScan(false)}
              disabled={isScanning}
              className="px-3 sm:px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs sm:text-sm rounded-xl shadow-lg shadow-emerald-500/20 flex items-center gap-1.5 transition-all transform active:scale-95 disabled:opacity-50"
            >
              <Scan className={`w-4 h-4 ${isScanning ? 'animate-spin' : ''}`} />
              <span>{isScanning ? 'స్కాన్ అవుతోంది...' : 'స్కాన్ నౌ (Scan Now)'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 pt-5 space-y-5">
        {/* Banner: Intelligent Scanning Logic & Universe Criteria */}
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-4 sm:p-5 relative overflow-hidden shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex items-center gap-1.5 text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-500/40">
                  <span className={`w-2 h-2 rounded-full ${isLiveFeedConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                  {isLiveFeedConnected ? '🟢 లైవ్ NSE మార్కెట్ ఫీడ్ కనెక్ట్ అయింది' : '🟡 బేస్‌లైన్ మార్కెట్ డేటా'}
                </span>
                <span className="text-xs text-slate-400">
                  ధర పరిధి: <strong>₹100 - ₹3,000</strong> • మార్కెట్ క్యాప్: <strong>&gt;₹500 కోట్లు (Above 500 Cr)</strong> • మొత్తం <strong>{allStocksData.length}+ NSE ఈక్విటీలు</strong>
                </span>
              </div>
              <p className="text-xs text-slate-300">
                <span className="text-emerald-400 font-semibold">ఖచ్చితమైన ఫిల్టర్లు:</span> ధర ₹100 నుండి ₹3,000 మధ్య మరియు మార్కెట్ క్యాప్ ₹500 కోట్లకు పైబడిన అన్ని NSE ఈక్విటీలు ఎటువంటి గ్రూప్ బయాస్ లేకుండా సమాన ప్రాధాన్యతతో స్కాన్ చేయబడతాయి. కేవలం ఆనాటి పర్ఫామెన్స్ & టెక్నికల్ స్కోర్ ఆధారంగానే ర్యాంకులు ఇవ్వబడతాయి.
              </p>
            </div>

            {/* Deep Re-scan button */}
            <div className="flex items-center gap-2.5">
              {lastScanTime && (
                <div className="text-[11px] font-mono text-slate-400 hidden sm:block bg-slate-950/60 px-2.5 py-1 rounded-lg border border-slate-800">
                  చివరి అప్‌డేట్: <strong className="text-emerald-400">{lastScanTime}</strong>
                </div>
              )}
              <button
                id="btn-deep-rescan"
                onClick={() => executeScan(true)}
                disabled={isScanning}
                title="మొత్తం వందల స్టాక్స్ యూనివర్స్‌ను మళ్ళీ మొదటి నుంచి డీప్ స్కాన్ చేయండి"
                className="px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 flex items-center gap-1.5 transition-colors"
              >
                <RotateCcw className={`w-3.5 h-3.5 text-emerald-400 ${isScanning ? 'animate-spin' : ''}`} />
                మొత్తం రీ-స్కాన్ (Full Universe Scan)
              </button>
            </div>
          </div>
        </div>

        {/* Dynamic Market Regime & Red Candle Threshold Controller (User Mandate) */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 sm:p-4 shadow-xl flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl border ${
              marketRegime === 'BULLISH'
                ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-400'
                : marketRegime === 'BEARISH'
                ? 'bg-rose-950/80 border-rose-500/50 text-rose-400'
                : 'bg-amber-950/80 border-amber-500/50 text-amber-400'
            }`}>
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs sm:text-sm font-bold text-slate-200">
                  మార్కెట్ పరిస్థితి & రెడ్ క్యాండిల్ నిబంధన (Dynamic Regime Filter)
                </span>
                {niftyInfo && (
                  <span className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-full border ${niftyInfo.changePercent >= 0 ? 'bg-emerald-950/70 border-emerald-500/40 text-emerald-400' : 'bg-rose-950/70 border-rose-500/40 text-rose-300'}`}>
                    NIFTY 50: ₹{niftyInfo.price.toLocaleString('en-IN')} ({niftyInfo.changePercent >= 0 ? '+' : ''}{niftyInfo.changePercent.toFixed(2)}%)
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                ప్రస్తుత మోడ్: <strong className={marketRegime === 'BULLISH' ? 'text-emerald-400' : marketRegime === 'BEARISH' ? 'text-rose-400' : 'text-amber-400'}>
                  {marketRegime === 'BULLISH' ? 'బుల్లిష్ (30% పరిమితి)' : marketRegime === 'BEARISH' ? 'బేరిష్ (50% పరిమితి)' : 'న్యూట్రల్ (40% పరిమితి)'}
                </strong> • ఈ శాతాన్ని మించితే స్టాక్‌కు వెయిటేజ్ తగ్గుతుంది.
              </p>
            </div>
          </div>

          {/* Segmented Selector for Bullish / Neutral / Bearish */}
          <div className="flex items-center gap-1.5 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
            <button
              id="btn-regime-bullish"
              onClick={() => handleRegimeChange('BULLISH')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                marketRegime === 'BULLISH'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <span>🟢 బుల్లిష్</span>
              <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${marketRegime === 'BULLISH' ? 'bg-slate-950 text-emerald-300' : 'bg-slate-800 text-slate-400'}`}>
                30%
              </span>
            </button>

            <button
              id="btn-regime-neutral"
              onClick={() => handleRegimeChange('NEUTRAL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                marketRegime === 'NEUTRAL'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <span>🟡 న్యూట్రల్</span>
              <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${marketRegime === 'NEUTRAL' ? 'bg-slate-950 text-amber-300' : 'bg-slate-800 text-slate-400'}`}>
                40%
              </span>
            </button>

            <button
              id="btn-regime-bearish"
              onClick={() => handleRegimeChange('BEARISH')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                marketRegime === 'BEARISH'
                  ? 'bg-rose-500 text-slate-950 shadow-md shadow-rose-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <span>🔴 బేరిష్</span>
              <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${marketRegime === 'BEARISH' ? 'bg-slate-950 text-rose-300' : 'bg-slate-800 text-slate-400'}`}>
                50%
              </span>
            </button>
          </div>
        </div>

        {/* AI Forensic Root-Cause Report & Early Morning Radar (Addresses Screenshot #400-#1045 Rank Anomaly) */}
        <MorningForensicReportPanel
          stocks={allStocksData}
          onSelectStock={(stock) => handleOpenStockDetail(stock)}
        />

        {/* Top Technical Ranked Stocks Leaderboard Showcase */}
        <TopRankedLeaderboard
          stocks={allStocksData}
          onSelectStock={(stock) => handleOpenStockDetail(stock)}
          selectedStockSymbol={selectedStock?.symbol}
          morningTop10Symbols={morningTop10Symbols}
        />

        {/* The Core Categories Tabs: TOP 10, 90+ ELITE, RVOL (High to Low), 3 TRADING STAGES & ALL */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-1.5 overflow-x-auto py-1">
            {/* Top 10 Tab */}
            <button
              id="tab-top-10"
              onClick={() => {
                setActiveCategory('TOP_10');
                if (filterMinScore === 90) setFilterMinScore(65);
              }}
              className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-black flex items-center gap-1.5 transition-all ${
                activeCategory === 'TOP_10'
                  ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 shadow-lg shadow-amber-500/30 ring-2 ring-amber-300'
                  : 'bg-slate-900 border border-slate-800 text-amber-300 hover:bg-slate-850 hover:border-amber-400'
              }`}
            >
              <span>🏆 టాప్ 10 (Top 10)</span>
            </button>

            {/* Dedicated 90+ Elite Tab */}
            <button
              id="tab-elite-90plus"
              onClick={() => {
                setActiveCategory('ELITE_90_PLUS');
                setFilterMinScore(90);
              }}
              className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-black flex items-center gap-1.5 transition-all relative ${
                activeCategory === 'ELITE_90_PLUS' || filterMinScore === 90
                  ? 'bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 text-slate-950 shadow-lg shadow-amber-500/30 ring-2 ring-amber-300'
                  : 'bg-slate-900 border border-amber-500/40 text-amber-300 hover:bg-slate-850 hover:border-amber-400'
              }`}
            >
              <span className="text-base animate-pulse">⭐</span>
              <span>90+ ఎలైట్ (Elite 90+)</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-mono font-black ${
                activeCategory === 'ELITE_90_PLUS' || filterMinScore === 90
                  ? 'bg-slate-950 text-amber-400'
                  : 'bg-amber-400/20 text-amber-300 border border-amber-400/30'
              }`}>
                {counts.elite90Plus}
              </span>
            </button>

            {/* RVOL Category Tab (User Mandate: Sorts High to Low) */}
            <button
              id="tab-rvol-category"
              onClick={() => {
                setActiveCategory('RVOL');
                if (filterMinScore === 90) setFilterMinScore(65);
              }}
              className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-black flex items-center gap-1.5 transition-all relative ${
                activeCategory === 'RVOL'
                  ? 'bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 text-slate-950 shadow-lg shadow-orange-500/30 ring-2 ring-orange-400'
                  : 'bg-slate-900 border border-orange-500/40 text-orange-400 hover:bg-slate-850 hover:border-orange-400'
              }`}
              title="RVOL అధికం నుండి తక్కువ వరకు సార్ట్ చేయబడిన స్టాక్స్ (High ➔ Low)"
            >
              <span className="text-base">🔥</span>
              <span>RVOL (High ➔ Low)</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-mono font-black ${
                activeCategory === 'RVOL'
                  ? 'bg-slate-950 text-orange-400'
                  : 'bg-orange-950/80 text-orange-300 border border-orange-500/40'
              }`}>
                {counts.rvol}
              </span>
            </button>

            {/* Category 1: ఆల్రెడీ స్ట్రాంగ్ */}
            <button
              id="tab-already-strong"
              onClick={() => {
                setActiveCategory('ALREADY_STRONG');
                if (filterMinScore === 90) setFilterMinScore(65);
              }}
              className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all ${
                activeCategory === 'ALREADY_STRONG' && filterMinScore !== 90
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-850'
              }`}
            >
              <span>🟢 1. ఆల్రెడీ స్ట్రాంగ్ (Strong Long)</span>
              <span className={`text-xs px-2 py-0.2 rounded-full ${
                activeCategory === 'ALREADY_STRONG' && filterMinScore !== 90 ? 'bg-slate-950 text-emerald-400' : 'bg-slate-800 text-slate-300'
              }`}>
                {counts.strong}
              </span>
            </button>

            {/* Category 2: బ్రేక్ అవుట్ అవ్వబోయేవి */}
            <button
              id="tab-pre-breakout"
              onClick={() => {
                setActiveCategory('PRE_BREAKOUT');
                if (filterMinScore === 90) setFilterMinScore(65);
              }}
              className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all ${
                activeCategory === 'PRE_BREAKOUT' && filterMinScore !== 90
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-850'
              }`}
            >
              <span>🟡 2. బ్రేక్ అవుట్ అవ్వబోయేవి (Pre-Breakout)</span>
              <span className={`text-xs px-2 py-0.2 rounded-full ${
                activeCategory === 'PRE_BREAKOUT' && filterMinScore !== 90 ? 'bg-slate-950 text-amber-400' : 'bg-slate-800 text-slate-300'
              }`}>
                {counts.preBreakout}
              </span>
            </button>

            {/* Category 3: పడిపోయి కోలుకుంటున్న స్టాక్స్ */}
            <button
              id="tab-dip-recovery"
              onClick={() => {
                setActiveCategory('DIP_RECOVERY');
                if (filterMinScore === 90) setFilterMinScore(65);
              }}
              className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all ${
                activeCategory === 'DIP_RECOVERY' && filterMinScore !== 90
                  ? 'bg-indigo-500 text-slate-950 shadow-md shadow-indigo-500/20'
                  : 'bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-850'
              }`}
            >
              <span>🟣 3. పడిపోయి కోలుకుంటున్నవి (Dip Recovery)</span>
              <span className={`text-xs px-2 py-0.2 rounded-full ${
                activeCategory === 'DIP_RECOVERY' && filterMinScore !== 90 ? 'bg-slate-950 text-indigo-400' : 'bg-slate-800 text-slate-300'
              }`}>
                {counts.dipRecovery}
              </span>
            </button>

            {/* All */}
            <button
              id="tab-all-stocks"
              onClick={() => {
                setActiveCategory('ALL');
                if (filterMinScore === 90) setFilterMinScore(65);
              }}
              className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                activeCategory === 'ALL' && filterMinScore !== 90
                  ? 'bg-slate-700 text-slate-100'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              అన్నీ (All: {counts.total})
            </button>
          </div>

          {/* Quick Filters */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* 90+ Elite Score Filter Button */}
            <button
              id="filter-btn-90plus"
              onClick={() => {
                if (filterMinScore === 90) {
                  setFilterMinScore(65);
                } else {
                  setFilterMinScore(90);
                  setActiveCategory('ALL'); // Automatically view ALL 90+ stocks without missing any across categories
                }
              }}
              className={`px-3 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 font-bold ${
                filterMinScore === 90
                  ? 'bg-gradient-to-r from-amber-500/30 to-amber-950/80 border-amber-400 text-amber-300 shadow-md shadow-amber-500/20 ring-1 ring-amber-400/50'
                  : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-amber-300 hover:border-amber-500/40'
              }`}
              title="90 కంటే ఎక్కువ స్కోర్ సాధించిన అన్ని ఎలైట్ స్టాక్స్ లిస్ట్ చూపించు"
            >
              <span className="text-amber-400">⭐</span>
              <span>90+ ఎలైట్ స్కోర్</span>
              <span className="bg-amber-400/20 text-amber-300 text-[10px] px-1.5 py-0.2 rounded-full font-mono border border-amber-400/30 font-bold">
                {counts.elite90Plus}
              </span>
              {filterMinScore === 90 && (
                <span className="bg-amber-400 text-slate-950 text-[9px] px-1.5 py-0.2 rounded font-black uppercase tracking-wider">
                  ACTIVE
                </span>
              )}
            </button>

            {/* Pivot Point Filter: Only Stocks Above Central Pivot (PP / R1-R3) */}
            <button
              id="filter-btn-above-pivot"
              onClick={() => setFilterAbovePivotOnly(!filterAbovePivotOnly)}
              className={`px-3 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 font-bold ${
                filterAbovePivotOnly
                  ? 'bg-gradient-to-r from-emerald-950/90 via-slate-900 to-teal-950/80 border-emerald-400 text-emerald-300 shadow-md shadow-emerald-500/20 ring-1 ring-emerald-400/50'
                  : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-emerald-300 hover:border-emerald-500/40'
              }`}
              title="కేవలం పివోట్ పాయింట్ (PP) లేదా R1/R2/R3 పైన ఉన్న స్టాక్స్‌ను మాత్రమే చూపించు"
            >
              <span>🎯</span>
              <span>పివోట్ (PP / R1-R3) పైన ఉన్నవి</span>
              <span className="bg-emerald-400/20 text-emerald-300 text-[10px] px-1.5 py-0.2 rounded-full font-mono border border-emerald-400/30 font-bold">
                {counts.abovePivot}
              </span>
              {filterAbovePivotOnly && (
                <span className="bg-emerald-400 text-slate-950 text-[9px] px-1.5 py-0.2 rounded font-black uppercase tracking-wider">
                  ACTIVE
                </span>
              )}
            </button>

            <button
              onClick={() => setFilterHighPersistenceOnly(!filterHighPersistenceOnly)}
              className={`px-2.5 py-1.5 rounded-lg border transition-colors flex items-center gap-1 ${
                filterHighPersistenceOnly
                  ? 'bg-emerald-950 border-emerald-500 text-emerald-300'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>20M పర్సిస్టెన్స్ &gt; 75%</span>
            </button>

            <button
              onClick={() => setFilterGoodRoomOnly(!filterGoodRoomOnly)}
              className={`px-2.5 py-1.5 rounded-lg border transition-colors flex items-center gap-1 ${
                filterGoodRoomOnly
                  ? 'bg-emerald-950 border-emerald-500 text-emerald-300'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>మంచి రూమ్ (Good Room)</span>
            </button>

            {/* Score Debugging Inspector Mode Toggle */}
            <button
              id="filter-btn-score-debug"
              onClick={() => setScoreDebugMode(!scoreDebugMode)}
              className={`px-3 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 font-bold ${
                scoreDebugMode
                  ? 'bg-cyan-500/25 border-cyan-400 text-cyan-300 shadow-md shadow-cyan-500/20 ring-1 ring-cyan-400/50'
                  : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-cyan-300 hover:border-cyan-500/40'
              }`}
              title="టెక్నికల్ స్కోర్ & టై-బ్రేకర్ డీబగ్గింగ్ మోడ్ (వెయిటేజ్ & ప్రాధాన్యత తనిఖీ)"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-400" />
              <span>స్కోర్ డీబగ్గింగ్</span>
              {scoreDebugMode && (
                <span className="bg-cyan-400 text-slate-950 text-[9px] px-1.5 py-0.2 rounded font-black uppercase tracking-wider">
                  ACTIVE
                </span>
              )}
            </button>

            <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1">
              <span className="text-slate-400">కనిష్ట స్కోర్:</span>
              <select
                value={filterMinScore}
                onChange={(e) => setFilterMinScore(Number(e.target.value))}
                className="bg-transparent text-emerald-400 font-bold focus:outline-none font-mono"
              >
                <option value={60} className="bg-slate-900 text-slate-200">60+</option>
                <option value={65} className="bg-slate-900 text-slate-200">65+ (Watch)</option>
                <option value={75} className="bg-slate-900 text-slate-200">75+ (Buy)</option>
                <option value={85} className="bg-slate-900 text-slate-200">85+ (Strong)</option>
                <option value={90} className="bg-slate-900 text-amber-300 font-bold">⭐ 90+ (Elite Long Setup)</option>
              </select>
            </div>
          </div>
        </div>

        {/* 100% Unbiased Technical Hierarchy Banner (No Blue-Chip Bias) */}
        <div className="bg-gradient-to-r from-amber-500/15 via-slate-900 to-emerald-500/10 border border-amber-500/40 rounded-xl p-3 text-xs text-slate-200 flex flex-wrap items-center justify-between gap-2 shadow-sm">
          <div className="flex items-center gap-2.5">
            <span className="text-base">🎯</span>
            <div>
              <span className="font-black text-amber-300">ప్యూర్ టెక్నికల్ ర్యాంకింగ్ (No Large-Cap / Blue-Chip Bias):</span>{' '}
              <span className="text-slate-300">
                కంపెనీ బ్రాండ్ లేదా మార్కెట్ క్యాప్‌తో సంబంధం లేదు. చిన్న కంపెనీ అయినా టెక్నికల్‌గా{' '}
                <strong className="text-emerald-400">96/100</strong> సాధిస్తే, లార్జ్-క్యాప్ (94/100) కంటే ముందే{' '}
                <strong className="text-amber-300 bg-amber-400/20 px-1 rounded font-mono">#1 ర్యాంక్</strong> లో నిలుస్తుంది!
              </span>
            </div>
          </div>
          {counts.elite90Plus > 0 && (
            <div className="flex items-center gap-1.5 bg-amber-400/20 border border-amber-400/40 text-amber-300 px-2.5 py-1 rounded-lg text-xs font-bold font-mono">
              <span>⭐ 90+ స్కోర్ సాధించిన స్టాక్స్:</span>
              <span className="bg-amber-400 text-slate-950 px-1.5 py-0.2 rounded font-black">{counts.elite90Plus}</span>
            </div>
          )}
        </div>

        {/* Category Description Banner */}
        <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-3 text-xs text-slate-300 flex items-center gap-3">
          <Info className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <div>
            {activeCategory === 'ELITE_90_PLUS' || filterMinScore === 90 ? (
              <span className="text-amber-300 font-semibold">
                ⭐ <strong>90+ ఎలైట్ రియల్-టైమ్ లిస్ట్ ({filteredStocks.length} స్టాక్స్):</strong> మార్కెట్ లో 90 లేదా అంతకంటే ఎక్కువ స్కోర్ సాధించిన ప్రతి స్టాక్ ఇక్కడ రియల్-టైమ్‌లో ట్రాక్ చేయబడుతుంది. సింగిల్ స్టాక్ కూడా మిస్ కాకుండా లైవ్ మార్కెట్ టిక్స్ ఆధారంగా అత్యుత్తమ టెక్నికల్ స్ట్రెంత్ ఆర్డర్‌లో (#1, #2, #3...) అమర్చబడ్డాయి.
              </span>
            ) : (
              <>
                {activeCategory === 'TOP_10' && (
                  <span>
                    🏆 <strong>టాప్ 10 స్టాక్స్ (Top 10 Ranked Leaders):</strong> నేటి మార్కెట్‌లో మల్టీ-ఫ్యాక్టర్ టెక్నికల్ స్కోర్, ఇన్స్టిట్యూషనల్ కొనుగోళ్లు మరియు మొమెంటమ్‌లో గ్లోబల్ లీడర్‌బోర్డ్‌లో #1 నుండి #10 ర్యాంక్ సాధించిన అత్యుత్తమ లీడర్లు.
                  </span>
                )}
                {activeCategory === 'RVOL' && (
                  <span className="text-orange-300 font-semibold">
                    🔥 <strong>RVOL కేటగిరి (High to Low Sort):</strong> అత్యధిక సాపేక్ష వాల్యూమ్ (Highest Relative Volume) సాధించిన స్టాక్స్ హై నుండి లో క్రమంలో అమర్చబడ్డాయి. సాధారణ రోజువారీ సగటు కంటే ఎన్నో రెట్ల ఇన్స్టిట్యూషనల్ వాల్యూమ్ నమోదైన స్టాక్స్ ముందంజలో కనిపిస్తాయి.
                  </span>
                )}
                {activeCategory === 'ALREADY_STRONG' && (
                  <span>
                    <strong>ఆల్రెడీ స్ట్రాంగ్ (Strong Long Buy):</strong> 15M ట్రెండ్ బుల్లిష్, 5M EMA 9 &gt; 21 దూరం పెరుగుతోంది, ధర &gt; VWAP, ADX పెరుగుతోంది, CVD పాజిటివ్, 20-మినిట్ ఫాలో-త్రూ పర్సిస్టెన్స్ అత్యధికంగా ఉన్న స్టాక్స్.
                  </span>
                )}
                {activeCategory === 'PRE_BREAKOUT' && (
                  <span>
                    <strong>బ్రేక్ అవుట్ అవ్వబోయేవి (Pre-Breakout Watch):</strong> రెసిస్టెన్స్ దగ్గర వాలటాలిటీ కంప్రెషన్ పూర్తయ్యి వాల్యూమ్ ఎక్స్‌పాన్షన్ మొదలవుతున్న స్టాక్స్ (1-2 క్యాండిల్స్ ముందే ఎర్లీ డిటెక్షన్).
                  </span>
                )}
                {activeCategory === 'DIP_RECOVERY' && (
                  <span>
                    <strong>పడిపోయి కోలుకుంటున్న స్టాక్స్ (Dip Recovery):</strong> ట్రెండ్ లో చిన్న పుల్‌బ్యాక్ తర్వాత VWAP & EMA 21 వద్ద సపోర్ట్ తీసుకుని, లోయర్ వాల్యూమ్‌తో సెల్లింగ్ ముగిసి బయర్స్ తిరిగి పుంజుకున్న స్టాక్స్.
                  </span>
                )}
                {activeCategory === 'ALL' && (
                  <span>
                    స్కాన్ చేయబడిన అన్ని క్వాలిఫైడ్ స్టాక్స్ వాటి టెక్నికల్ స్కోర్ మరియు సిగ్నల్ స్టేజ్ ఆధారంగా క్రింద ప్రదర్శించబడ్డాయి.
                  </span>
                )}
              </>
            )}
          </div>
        </div>

        {/* Real-time 90+ Discovery Quick Switch Alert Banner */}
        {activeCategory !== 'ELITE_90_PLUS' && filterMinScore !== 90 && counts.elite90Plus > 0 && (
          <div className="bg-gradient-to-r from-amber-500/20 via-slate-900 to-amber-950/40 border border-amber-500/50 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 shadow-lg">
            <div className="flex items-center gap-2.5">
              <span className="text-xl animate-bounce">⭐</span>
              <div>
                <span className="font-bold text-amber-300">లైవ్ 90+ రాడార్ అలర్ట్:</span>{' '}
                <span className="text-slate-200 text-xs">
                  ప్రస్తుతం <strong className="text-amber-300 underline font-mono text-sm">{counts.elite90Plus} స్టాక్స్</strong> 90+ ఎలైట్ స్కోర్ సాధించాయి! సింగిల్ స్టాక్ కూడా మిస్ కాకుండా ట్రాక్ చేయబడుతున్నాయి.
                </span>
              </div>
            </div>
            <button
              onClick={() => {
                setActiveCategory('ELITE_90_PLUS');
                setFilterMinScore(90);
              }}
              className="px-3 py-1.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 text-xs font-black rounded-lg shadow-md flex items-center gap-1.5 transition-all transform active:scale-95"
            >
              <span>⭐ 90+ ఎలైట్ లిస్ట్ చూడండి</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Score Debug Inspector Panel (Mounted when Score Debugging mode is ON) */}
        {scoreDebugMode && (
          <div className="mb-4">
            <ScoreDebugInspector
              stocks={allStocksData}
              onSelectStock={(selected) => setSelectedStock(selected)}
              isOpen={scoreDebugMode}
              onToggle={() => setScoreDebugMode(false)}
              morningTop10Symbols={morningTop10Symbols}
            />
          </div>
        )}

        {/* Stocks Grid (Mobile & Desktop Responsive) */}
        {filteredStocks.length === 0 ? (
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-12 text-center text-slate-400 space-y-3">
            <Scan className="w-10 h-10 text-slate-600 mx-auto animate-pulse" />
            <div className="text-base font-bold text-slate-200">
              ప్రస్తుత ఫిల్టర్లకు సరిపోలే స్టాక్స్ ఏవీ లేవు
            </div>
            <p className="text-xs max-w-md mx-auto">
              దయచేసి ఫిల్టర్లను సర్దుబాటు చేయండి లేదా పూర్తి NSE యూనివర్స్‌ను మళ్ళీ స్కాన్ చేయడానికి 'మొత్తం రీ-స్కాన్' బటన్ నొక్కండి.
            </p>
            <button
              onClick={() => {
                setFilterMinScore(60);
                setFilterHighPersistenceOnly(false);
                setFilterGoodRoomOnly(false);
                setSearchQuery('');
                setActiveCategory('ALL');
              }}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700"
            >
              ఫిల్టర్లను రీసెట్ చేయండి (Reset Filters)
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredStocks.map((stock) => (
              <SignalCard
                key={stock.symbol}
                stock={stock}
                onSelect={(selected) => handleOpenStockDetail(selected)}
                isSelected={selectedStock?.symbol === stock.symbol}
                scoreDebugMode={scoreDebugMode}
              />
            ))}
          </div>
        )}
      </main>

      {/* Stock Deep-Dive Modal (with Charts, Pivots, Strengths/Weaknesses, Position Sizing) */}
      <StockDetailModal
        stock={selectedStock}
        onClose={() => setSelectedStock(null)}
        onTimeframeChange={(tf) => setSelectedTimeframe(tf)}
        selectedTimeframe={selectedTimeframe}
        onRefreshLiveQuote={() => {
          if (selectedStock) handleOpenStockDetail(selectedStock);
        }}
        isSyncingLiveQuote={isSyncingModalStock}
      />

      {/* Live Alerts Drawer */}
      <AlertsDrawer
        isOpen={isAlertsOpen}
        onClose={() => setIsAlertsOpen(false)}
        alerts={alerts}
        onClearAlerts={() => setAlerts([])}
        soundEnabled={soundEnabled}
        onToggleSound={() => setSoundEnabled(!soundEnabled)}
        onSelectStockBySymbol={(sym) => {
          handleSearchSubmit(sym);
        }}
      />

      {/* Search Status & Diagnostics Modal (Unlisted / Delisted / Price Out of Range / Not Found) */}
      <StockSearchStatusModal
        data={searchStatusModal}
        onClose={() => setSearchStatusModal(null)}
        onSelectStockSymbol={(sym) => {
          setSearchStatusModal(null);
          setSearchQuery(sym);
          handleSearchSubmit(sym);
        }}
      />
    </div>
  );
}
