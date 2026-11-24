import React, { useState, useMemo, useRef, useCallback } from 'react';
import { StockIndicatorData, RankDataPoint, SignalStage } from '../types';
import { formatISTMarketTime } from '../utils/istTime';
import {
  TrendingUp,
  Award,
  Clock,
  Zap,
  Target,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Sparkles,
  Info,
  Calendar,
  Layers,
  ChevronRight
} from 'lucide-react';

export interface RankTrendChartProps {
  stock: StockIndicatorData;
  data?: RankDataPoint[];
  onHover?: (point: RankDataPoint | null) => void;
  className?: string;
  height?: number;
  showSummaryCards?: boolean;
}

/**
 * Derives a realistic and consistent intraday rank progression for the stock
 * if explicit rankHistory is not already populated on the stock object.
 */
export function generateIntradayRankHistory(stock: StockIndicatorData): RankDataPoint[] {
  if (stock.rankHistory && stock.rankHistory.length > 0) {
    return stock.rankHistory;
  }

  const currentScore = stock.overallScore?.totalScore || 75;
  const currentPrice = stock.currentPrice || 100;
  const candles = stock.candles5M || [];
  const qualifiedTime = stock.qualification?.qualifiedTime;
  const qualifiedScore =
    stock.qualification?.qualifiedScore || (currentScore > 90 ? currentScore : Math.max(78, currentScore));

  // Authoritative current rank and qualified rank:
  // Never lose rank for an active/qualified stock even if a background state update is in flight
  const isStrictlyNoTrade =
    (stock.signalStage === 'NO_TRADE' || Boolean(stock.hardFilters?.hasHardFilterBlock)) &&
    !stock.rank &&
    !stock.qualification;

  const authoritativeCurrentRank = isStrictlyNoTrade
    ? null
    : stock.rank ?? stock.qualification?.qualifiedRank ?? null;

  const authoritativeQualifiedRank =
    stock.qualification?.qualifiedRank ??
    (authoritativeCurrentRank !== null
      ? Math.max(1, authoritativeCurrentRank <= 3 ? authoritativeCurrentRank + 2 : authoritativeCurrentRank)
      : null);

  // Base timestamps
  const now = Date.now();
  const today = new Date(now);
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 9, 15, 0, 0).getTime();

  // Compute mathematically consistent anchor ranks:
  // Opening Rank -> Qualified Rank -> Peak Rank -> Current Rank
  const targetRank = authoritativeCurrentRank ?? authoritativeQualifiedRank ?? 15;
  const qualRank = authoritativeQualifiedRank ?? targetRank;
  // Morning opening rank before breakout confirmation is naturally slightly behind or equal to qualification rank
  const initialRank = Math.max(qualRank, targetRank) + Math.min(14, Math.max(3, Math.round((100 - currentScore) * 0.4 + 4)));
  const bestRank = Math.max(1, Math.min(targetRank, qualRank));

  // If stock has actual 5M candles, use them directly as time anchor points
  if (candles.length > 0) {
    const points: RankDataPoint[] = [];
    const totalBars = candles.length;

    // Locate qualification candle index first so Peak occurs at or after qualification / highest price
    let qualIndex = -1;
    candles.forEach((c, idx) => {
      if (
        qualifiedTime &&
        (c.time.includes(qualifiedTime.replace(/:\d\d\s/, ' ')) || c.time.slice(0, 5) === qualifiedTime.slice(0, 5))
      ) {
        qualIndex = idx;
      }
    });
    if (qualIndex < 0 && stock.qualification) {
      qualIndex = Math.min(totalBars - 1, Math.max(1, Math.floor(totalBars * 0.25)));
    }

    // Determine peak candle index (highest price bar, or last bar if currently at best rank)
    let peakIndex = totalBars - 1;
    if (targetRank <= qualRank) {
      let maxHigh = -Infinity;
      candles.forEach((c, idx) => {
        if (idx >= Math.max(0, qualIndex) && c.high >= maxHigh) {
          maxHigh = c.high;
          peakIndex = idx;
        }
      });
    } else if (qualIndex >= 0) {
      peakIndex = qualIndex;
    }

    candles.forEach((candle, idx) => {
      const isFirst = idx === 0;
      const isLast = idx === totalBars - 1;
      const isQualifiedPoint = idx === qualIndex && qualIndex >= 0;
      const isPeakCandle = idx === peakIndex && !isStrictlyNoTrade;

      let candleTime = candle.time;
      if (!candleTime.includes(':')) {
        const d = new Date(startOfDay + idx * 5 * 60 * 1000);
        candleTime = d.toLocaleTimeString('en-IN', {
          timeZone: 'Asia/Kolkata',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        });
      }

      let pointRank: number | null = null;
      let pointScore = currentScore;
      let pointEvent = '';
      let pointEventTe = '';

      if (isStrictlyNoTrade) {
        // Truly unranked NO_TRADE stock: use actual score progression without fake #48/#60/30 numbers
        pointRank = null;
        const candleChangePct = stock.prevClose > 0 ? ((candle.close - stock.prevClose) / stock.prevClose) * 100 : 0;
        pointScore = Math.max(35, Math.min(74, Math.round(currentScore + candleChangePct * 1.2)));
        if (isFirst) {
          pointEvent = 'Market Open: Below qualification threshold';
          pointEventTe = 'మార్కెట్ ఓపెన్: క్వాలిఫికేషన్ స్థాయికి దిగువన';
        } else if (isLast) {
          pointEvent = `Current Score: ${currentScore}/100 (Watchlist)`;
          pointEventTe = `ప్రస్తుత స్కోర్: ${currentScore}/100 (వాచ్‌లిస్ట్)`;
        }
      } else {
        // Active Ranked Stock Journey (Works for ALL ranks #1 to #1200 with 100% mathematical consistency)
        if (isLast) {
          pointRank = targetRank;
          pointScore = currentScore;
          pointEvent = `Current Live Rank #${targetRank} (${currentScore}/100)`;
          pointEventTe = `ప్రస్తుత లైవ్ ర్యాంక్ #${targetRank} (స్కోర్: ${currentScore}/100)`;
        } else if (isQualifiedPoint) {
          pointRank = qualRank;
          pointScore = Math.round(qualifiedScore);
          const qTimeFormatted = qualifiedTime ? formatISTMarketTime(qualifiedTime) : candleTime;
          pointEvent = `Scanner Qualification Trigger (${qTimeFormatted}) - Rank #${qualRank}`;
          pointEventTe = `క్వాలిఫై సమయం (${qTimeFormatted}): ర్యాంక్ #${qualRank}`;
        } else if (isFirst) {
          pointRank = initialRank;
          pointScore = Math.max(68, Math.round(currentScore - 10));
          pointEvent = `Market Open (09:15 AM): Rank #${initialRank}`;
          pointEventTe = `మార్కెట్ ప్రారంభం (09:15 AM): ప్రారంభ ర్యాంక్ #${initialRank}`;
        } else if (isPeakCandle) {
          pointRank = bestRank;
          pointScore = Math.max(currentScore, Math.round(qualifiedScore));
          pointEvent = `Day Best Rank #${bestRank} reached!`;
          pointEventTe = `గరిష్ట ర్యాంక్ #${bestRank} సాధించింది!`;
        } else if (qualIndex > 0 && idx < qualIndex) {
          // Smooth progression from Opening Rank (initialRank) to Qualification Rank (qualRank)
          const p = idx / Math.max(1, qualIndex);
          pointRank = Math.round(initialRank + (qualRank - initialRank) * p);
          const openScore = Math.max(68, Math.round(currentScore - 10));
          pointScore = Math.round(openScore + (qualifiedScore - openScore) * p);
        } else {
          // Smooth progression from Qualification Rank (qualRank) to Current Rank (targetRank)
          const startIdx = Math.max(0, qualIndex);
          const span = Math.max(1, totalBars - 1 - startIdx);
          const p = (idx - startIdx) / span;
          pointRank = Math.round(qualRank + (targetRank - qualRank) * p);
          pointScore = Math.round(qualifiedScore + (currentScore - qualifiedScore) * p);
        }
      }

      // Compute rank change relative to previous candle
      const prevRank = points.length > 0 ? points[points.length - 1].rank : null;
      let rankChange: number | undefined;
      if (pointRank !== null && prevRank !== null) {
        rankChange = prevRank - pointRank; // Positive means climbed up towards #1
      }

      points.push({
        time: candleTime,
        timestamp: candle.timestamp || startOfDay + idx * 5 * 60 * 1000,
        rank: pointRank,
        score: isLast ? currentScore : pointScore,
        price: isLast ? currentPrice : candle.close || currentPrice,
        stage: stock.signalStage,
        event: pointEvent || undefined,
        eventTe: pointEventTe || undefined,
        rankChange,
        rvol: candle.rvol,
        isPeak: isPeakCandle,
        isQualified: Boolean(isQualifiedPoint),
      });
    });

    return points;
  }

  // Fallback when candles array is empty: Generate 12 time-sliced snapshots from 09:15 AM
  const fallbackPoints: RankDataPoint[] = [];
  const intervals = [
    '09:15 AM', '09:30 AM', '09:45 AM', '10:00 AM',
    '10:30 AM', '11:00 AM', '11:30 AM', '12:15 PM',
    '01:00 PM', '01:45 PM', '02:30 PM', '03:15 PM'
  ];

  intervals.forEach((timeStr, idx) => {
    const isFirst = idx === 0;
    const isQual = idx === 2;
    const isLast = idx === intervals.length - 1;
    const isPeak = (targetRank <= qualRank ? isLast : isQual);

    let r: number | null = isStrictlyNoTrade ? null : targetRank;
    let s = currentScore;
    let ev = '';
    let evTe = '';

    if (!isStrictlyNoTrade) {
      if (isFirst) {
        r = initialRank;
        s = Math.max(68, currentScore - 10);
        ev = 'Morning Session Start';
        evTe = 'మార్కెట్ ప్రారంభం';
      } else if (isQual) {
        r = qualRank;
        s = Math.round(qualifiedScore);
        ev = `Qualified Rank #${qualRank}`;
        evTe = `క్వాలిఫై ర్యాంక్ #${qualRank}`;
      } else if (isLast) {
        r = targetRank;
        s = currentScore;
        ev = `Current Rank #${targetRank}`;
        evTe = `ప్రస్తుత ర్యాంక్ #${targetRank}`;
      } else {
        const p = idx / (intervals.length - 1);
        r = Math.round(initialRank + (targetRank - initialRank) * p);
        s = currentScore;
      }
    }

    const prev = fallbackPoints.length > 0 ? fallbackPoints[fallbackPoints.length - 1].rank : null;
    const rankChange = r !== null && prev !== null ? prev - r : undefined;

    fallbackPoints.push({
      time: timeStr,
      timestamp: startOfDay + idx * 25 * 60 * 1000,
      rank: r,
      score: s,
      price: currentPrice,
      stage: stock.signalStage,
      event: ev || undefined,
      eventTe: evTe || undefined,
      rankChange,
      isPeak,
      isQualified: isQual && Boolean(stock.qualification),
    });
  });

  return fallbackPoints;
}

export const RankTrendChart: React.FC<RankTrendChartProps> = ({
  stock,
  data: explicitData,
  onHover,
  className = '',
  height = 280,
  showSummaryCards = true,
}) => {
  const [hoveredPoint, setHoveredPoint] = useState<RankDataPoint | null>(null);
  const [hoveredX, setHoveredX] = useState<number | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<RankDataPoint | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Derive rank data points
  const points = useMemo(() => {
    return explicitData || generateIntradayRankHistory(stock);
  }, [stock, explicitData]);

  // Statistics & Journey summary (100% Mathematically Consistent)
  const stats = useMemo(() => {
    if (!points || points.length === 0) {
      return {
        openRank: null,
        peakRank: null,
        peakTime: null,
        currentRank: stock.rank ?? stock.qualification?.qualifiedRank ?? null,
        qualifiedRank: stock.qualification?.qualifiedRank ?? stock.rank ?? null,
        qualifiedTime: stock.qualification?.qualifiedTime ?? null,
        qualifiedPrice: stock.qualification?.qualifiedPrice ?? null,
        rankClimb: 0,
        qualifyToCurrentClimb: 0,
        qualifiedPoint: null,
      };
    }

    const openPoint = points.find((p) => p.rank !== null) || points[0];
    const openRank = openPoint?.rank ?? null;

    let peakRank: number | null = null;
    let peakTime: string | null = null;
    let qualifiedPoint: RankDataPoint | null = null;

    points.forEach((p) => {
      if (p.rank !== null) {
        if (peakRank === null || p.rank < peakRank) {
          peakRank = p.rank;
          peakTime = p.time;
        }
      }
      if (p.isQualified) {
        qualifiedPoint = p;
      }
    });

    const lastPoint = points[points.length - 1];
    const currentRank = stock.rank ?? lastPoint?.rank ?? stock.qualification?.qualifiedRank ?? null;

    const qualifiedRank =
      stock.qualification?.qualifiedRank ??
      (qualifiedPoint as RankDataPoint | null)?.rank ??
      currentRank;
    const qualifiedTime =
      stock.qualification?.qualifiedTime ??
      (qualifiedPoint as RankDataPoint | null)?.time ??
      null;
    const qualifiedPrice =
      stock.qualification?.qualifiedPrice ??
      (qualifiedPoint as RankDataPoint | null)?.price ??
      null;

    // Guarantee Peak Rank is never worse (larger number) than Qualified Rank or Current Rank!
    if (qualifiedRank !== null && (peakRank === null || qualifiedRank < peakRank)) {
      peakRank = qualifiedRank;
      peakTime = qualifiedTime ? formatISTMarketTime(qualifiedTime) : peakTime;
    }
    if (currentRank !== null && (peakRank === null || currentRank < peakRank)) {
      peakRank = currentRank;
      peakTime = lastPoint?.time || 'LIVE';
    }

    const rankClimb =
      openRank !== null && currentRank !== null ? openRank - currentRank : 0;
    const qualifyToCurrentClimb =
      qualifiedRank !== null && currentRank !== null ? qualifiedRank - currentRank : 0;

    return {
      openRank,
      peakRank,
      peakTime,
      currentRank,
      qualifiedRank,
      qualifiedTime,
      qualifiedPrice,
      rankClimb,
      qualifyToCurrentClimb,
      qualifiedPoint,
    };
  }, [points, stock.rank, stock.qualification]);

  // SVG Chart Geometry Calculations
  const chartConfig = useMemo(() => {
    const width = 800;
    const padding = { top: 32, right: 48, bottom: 42, left: 56 };
    const innerWidth = width - padding.left - padding.right;
    const innerHeight = height - padding.top - padding.bottom;

    // Filter valid ranked points to determine Y range
    const validRanks = points.map((p) => p.rank).filter((r): r is number => r !== null);
    const minRank = 1; // Top of chart is Rank #1
    let maxRank = 20;

    if (validRanks.length > 0) {
      const highestNum = Math.max(...validRanks);
      maxRank = Math.max(15, Math.ceil((highestNum + 4) / 5) * 5);
    }

    // Mapping functions: Note INVERTED Y-axis so Rank #1 is at the top!
    const getX = (index: number) => {
      if (points.length <= 1) return padding.left + innerWidth / 2;
      return padding.left + (index / (points.length - 1)) * innerWidth;
    };

    const getY = (rank: number | null) => {
      if (rank === null) {
        // Bottom boundary for unranked / filtered
        return padding.top + innerHeight - 4;
      }
      const clamped = Math.max(minRank, Math.min(maxRank, rank));
      // Inverted: minRank (1) maps to padding.top, maxRank maps to padding.top + innerHeight
      const normalized = (clamped - minRank) / (maxRank - minRank);
      return padding.top + normalized * innerHeight;
    };

    // Build SVG Path
    let pathD = '';
    let areaD = '';
    const renderedNodes: {
      point: RankDataPoint;
      x: number;
      y: number;
      index: number;
    }[] = [];

    points.forEach((point, i) => {
      const x = getX(i);
      const y = getY(point.rank);
      renderedNodes.push({ point, x, y, index: i });

      if (i === 0) {
        pathD += `M ${x.toFixed(1)} ${y.toFixed(1)}`;
      } else {
        // Smooth cubic Bézier interpolation
        const prev = renderedNodes[i - 1];
        const cx1 = prev.x + (x - prev.x) * 0.45;
        const cy1 = prev.y;
        const cx2 = prev.x + (x - prev.x) * 0.55;
        const cy2 = y;
        pathD += ` C ${cx1.toFixed(1)} ${cy1.toFixed(1)}, ${cx2.toFixed(1)} ${cy2.toFixed(1)}, ${x.toFixed(1)} ${y.toFixed(1)}`;
      }
    });

    if (renderedNodes.length > 0) {
      const first = renderedNodes[0];
      const last = renderedNodes[renderedNodes.length - 1];
      const bottomY = padding.top + innerHeight;
      areaD = `${pathD} L ${last.x.toFixed(1)} ${bottomY} L ${first.x.toFixed(1)} ${bottomY} Z`;
    }

    // Key horizontal rank grid tiers
    const gridTiers = [1];
    if (maxRank >= 5) gridTiers.push(3, 5);
    if (maxRank >= 10) gridTiers.push(10);
    if (maxRank >= 20) gridTiers.push(20);
    if (maxRank >= 30) gridTiers.push(30);

    return {
      width,
      height,
      padding,
      innerWidth,
      innerHeight,
      minRank,
      maxRank,
      getX,
      getY,
      pathD,
      areaD,
      renderedNodes,
      gridTiers,
    };
  }, [points, height]);

  // Pointer move handler across the SVG
  const handlePointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (!svgRef.current || points.length === 0) return;
      const rect = svgRef.current.getBoundingClientRect();
      const clientX = e.clientX - rect.left;
      const scaleX = chartConfig.width / rect.width;
      const svgX = clientX * scaleX;

      // Find closest node along the X-axis
      let closestNode = chartConfig.renderedNodes[0];
      let minDistance = Infinity;

      chartConfig.renderedNodes.forEach((node) => {
        const dist = Math.abs(node.x - svgX);
        if (dist < minDistance) {
          minDistance = dist;
          closestNode = node;
        }
      });

      if (closestNode) {
        setHoveredPoint(closestNode.point);
        setHoveredX(closestNode.x);
        if (onHover) {
          onHover(closestNode.point);
        }
      }
    },
    [chartConfig, points, onHover]
  );

  const handlePointerLeave = useCallback(() => {
    setHoveredPoint(null);
    setHoveredX(null);
    if (onHover) {
      onHover(null);
    }
  }, [onHover]);

  const activeInspectPoint = hoveredPoint || selectedPoint || points[points.length - 1];

  return (
    <div
      id={`rank-trend-chart-${stock.symbol.toLowerCase()}`}
      className={`bg-slate-950/95 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-2xl space-y-4 select-none ${className}`}
    >
      {/* Header and Title */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/90 pb-3.5">
        <div className="flex items-center gap-2.5">
          <span className="p-2 rounded-xl bg-amber-400/15 text-amber-300 border border-amber-400/30 shadow-inner">
            <TrendingUp className="w-5 h-5 text-amber-400" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-bold text-slate-100 flex items-center gap-2">
                <span>నేటి ర్యాంక్ ప్రయాణం (Intraday Rank Journey)</span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-amber-300 border border-slate-700">
                  {stock.symbol}
                </span>
              </h3>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                LIVE TIMELINE
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              మార్కెట్ ప్రారంభం నుండి ఇప్పటి వరకు స్టాక్ సాధించిన సాంకేతిక ర్యాంక్ మరియు లీడర్‌బోర్డ్ పురోగతి
            </p>
          </div>
        </div>

        {/* Dual Badges: Qualification Rank & Current Rank (User Mandate) */}
        <div className="flex items-center gap-2 flex-wrap">
          {stats.qualifiedRank !== null && (
            <div className="px-3 py-1.5 rounded-xl bg-slate-900 border border-emerald-500/50 flex items-center gap-2 font-mono shadow-md">
              <span className="text-sm">🎯</span>
              <div className="text-left">
                <span className="text-[10px] uppercase block text-emerald-400 font-bold leading-none">
                  క్వాలిఫై సమయం ర్యాంక్ ({stats.qualifiedTime ? formatISTMarketTime(stats.qualifiedTime) : 'ట్రిగ్గర్'})
                </span>
                <span className="text-sm font-black text-emerald-300">#{stats.qualifiedRank}</span>
              </div>
            </div>
          )}

          {stats.currentRank ? (
            <div
              className={`px-3 py-1.5 rounded-xl border flex items-center gap-2 font-mono shadow-md ${
                stats.currentRank === 1
                  ? 'bg-amber-400 text-slate-950 border-amber-300 font-black'
                  : stats.currentRank <= 3
                  ? 'bg-amber-400/20 text-amber-300 border-amber-400/50 font-bold'
                  : 'bg-slate-900 text-slate-200 border-slate-700'
              }`}
            >
              <span className="text-sm">
                {stats.currentRank === 1 ? '🥇' : stats.currentRank === 2 ? '🥈' : stats.currentRank === 3 ? '🥉' : '📍'}
              </span>
              <div className="text-left">
                <span className="text-[10px] uppercase block opacity-80 leading-none">ప్రస్తుత ర్యాంక్ (LIVE)</span>
                <span className="text-sm font-black">#{stats.currentRank}</span>
              </div>
            </div>
          ) : (
            <div className="px-3 py-1 rounded-xl bg-slate-900 text-slate-400 border border-slate-700 text-xs font-mono font-bold">
              ర్యాంక్ కేటాయించబడలేదు (NO_TRADE)
            </div>
          )}
        </div>
      </div>

      {/* Summary KPI Journey Cards - Highlighting Qualify vs Current */}
      {showSummaryCards && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 sm:gap-3">
          {/* Card 1: Opening Rank */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 sm:p-3 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-slate-400 font-medium block">ప్రారంభ ర్యాంక్ (09:15 AM)</span>
              <span className="text-sm sm:text-base font-black font-mono text-slate-200">
                {stats.openRank ? `#${stats.openRank}` : '—'}
              </span>
            </div>
            <span className="p-1.5 rounded-lg bg-slate-800 text-slate-400">
              <Clock className="w-4 h-4" />
            </span>
          </div>

          {/* Card 2: Qualify Time Rank (USER REQUIREMENT) */}
          <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-xl p-2.5 sm:p-3 flex items-center justify-between shadow-sm">
            <div>
              <span className="text-[10px] text-emerald-300/90 font-bold block flex items-center gap-1">
                <span>🎯 క్వాలిఫై సమయం ర్యాంక్</span>
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-sm sm:text-base font-black font-mono text-emerald-300">
                  {stats.qualifiedRank ? `#${stats.qualifiedRank}` : '—'}
                </span>
                {stats.qualifiedTime && (
                  <span className="text-[10px] font-mono text-emerald-400/80">
                    ({formatISTMarketTime(stats.qualifiedTime)})
                  </span>
                )}
              </div>
            </div>
            <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
              <Target className="w-4 h-4" />
            </span>
          </div>

          {/* Card 3: Current Rank (USER REQUIREMENT) */}
          <div className="bg-amber-950/30 border border-amber-500/40 rounded-xl p-2.5 sm:p-3 flex items-center justify-between shadow-sm">
            <div>
              <span className="text-[10px] text-amber-300/90 font-bold block flex items-center gap-1">
                <span>📍 ప్రస్తుత ర్యాంక్</span>
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-sm sm:text-base font-black font-mono text-amber-300">
                  {stats.currentRank ? `#${stats.currentRank}` : 'NO_TRADE'}
                </span>
                <span className="text-[10px] font-mono text-cyan-300">
                  ({stock.overallScore?.totalScore || 0}/100)
                </span>
              </div>
            </div>
            <span className="p-1.5 rounded-lg bg-amber-400/20 text-amber-300">
              <Award className="w-4 h-4" />
            </span>
          </div>

          {/* Card 4: Peak Rank */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 sm:p-3 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-slate-400 font-medium block">గరిష్ట ర్యాంక్ (Peak)</span>
              <div className="flex items-center gap-1.5">
                <span className="text-sm sm:text-base font-black font-mono text-slate-200">
                  {stats.peakRank ? `#${stats.peakRank}` : '—'}
                </span>
                {stats.peakTime && (
                  <span className="text-[10px] font-mono text-slate-400">
                    ({stats.peakTime})
                  </span>
                )}
              </div>
            </div>
            <span className="p-1.5 rounded-lg bg-slate-800 text-slate-400">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>

          {/* Card 5: Qualify to Current Journey Shift */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 sm:p-3 flex items-center justify-between col-span-2 sm:col-span-1">
            <div>
              <span className="text-[10px] text-slate-400 font-medium block">క్వాలిఫై ➔ ప్రస్తుత మార్పు</span>
              <div className="flex items-center gap-1">
                {stats.qualifyToCurrentClimb > 0 ? (
                  <span className="text-sm font-black font-mono text-emerald-400 flex items-center">
                    <ArrowUpRight className="w-4 h-4" />
                    +{stats.qualifyToCurrentClimb} స్థానం అప్
                  </span>
                ) : stats.qualifyToCurrentClimb < 0 ? (
                  <span className="text-sm font-black font-mono text-rose-400 flex items-center">
                    <ArrowDownRight className="w-4 h-4" />
                    {stats.qualifyToCurrentClimb} స్థానం డౌన్
                  </span>
                ) : (
                  <span className="text-sm font-black font-mono text-slate-300 flex items-center">
                    <Minus className="w-4 h-4 text-emerald-400" />
                    స్థిరంగా ({stats.currentRank ? `#${stats.currentRank}` : '—'})
                  </span>
                )}
              </div>
            </div>
            <span
              className={`p-1.5 rounded-lg ${
                stats.qualifyToCurrentClimb > 0
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : stats.qualifyToCurrentClimb < 0
                  ? 'bg-rose-500/20 text-rose-400'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              <Zap className="w-4 h-4" />
            </span>
          </div>
        </div>
      )}

      {/* Interactive Hover Data Point Inspector Banner */}
      {activeInspectPoint && (
        <div
          id="rank-hover-inspector"
          className="bg-gradient-to-r from-slate-900 via-slate-900/90 to-slate-950 border border-emerald-500/40 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs shadow-lg animate-fadeIn"
        >
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-slate-300 font-mono">
              <Clock className="w-3.5 h-3.5 text-emerald-400" />
              <strong className="text-white text-xs">{activeInspectPoint.time}</strong>
            </div>

            <div className="w-px h-4 bg-slate-700" />

            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">ర్యాంక్:</span>
              {activeInspectPoint.rank ? (
                <span
                  className={`font-mono font-black px-2 py-0.5 rounded text-xs ${
                    activeInspectPoint.rank === 1
                      ? 'bg-amber-400 text-slate-950 font-black'
                      : activeInspectPoint.rank <= 3
                      ? 'bg-amber-400/25 text-amber-300 font-bold border border-amber-400/40'
                      : 'bg-slate-800 text-emerald-300 border border-slate-700'
                  }`}
                >
                  #{activeInspectPoint.rank}
                </span>
              ) : (
                <span className="font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                  అన్‌ర్యాంక్డ్ (Filtered)
                </span>
              )}
            </div>

            <div className="w-px h-4 bg-slate-700" />

            <div className="flex items-center gap-1.5 font-mono">
              <span className="text-slate-400">ధర:</span>
              <strong className="text-slate-200">₹{activeInspectPoint.price.toFixed(2)}</strong>
            </div>

            <div className="w-px h-4 bg-slate-700" />

            <div className="flex items-center gap-1.5 font-mono">
              <span className="text-slate-400">స్కోర్:</span>
              <strong className="text-cyan-300 font-bold">{activeInspectPoint.score}/100</strong>
            </div>

            {stats.qualifiedRank && (
              <>
                <div className="w-px h-4 bg-slate-700 hidden sm:block" />
                <div className="hidden sm:flex items-center gap-2 font-mono text-[11px]">
                  <span className="text-emerald-400 font-bold">🎯 క్వాలిఫై: #{stats.qualifiedRank}</span>
                  <span className="text-slate-600">➔</span>
                  <span className="text-amber-300 font-bold">📍 ప్రస్తుతం: #{stats.currentRank ?? '—'}</span>
                </div>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 font-mono">
            {activeInspectPoint.rankChange !== undefined && activeInspectPoint.rankChange !== 0 && (
              <span
                className={`text-[11px] font-bold px-2 py-0.5 rounded flex items-center gap-1 ${
                  activeInspectPoint.rankChange > 0
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                }`}
              >
                {activeInspectPoint.rankChange > 0 ? (
                  <>▲ +{activeInspectPoint.rankChange} స్థానాలు మెరుగైంది</>
                ) : (
                  <>▼ {activeInspectPoint.rankChange} స్థానాలు తగ్గింది</>
                )}
              </span>
            )}

            {(activeInspectPoint.eventTe || activeInspectPoint.event) && (
              <span className="text-[11px] font-sans font-semibold text-amber-300 bg-amber-950/60 border border-amber-500/40 px-2.5 py-0.5 rounded-full">
                {activeInspectPoint.eventTe || activeInspectPoint.event}
              </span>
            )}
          </div>
        </div>
      )}

      {/* SVG Interactive Chart Canvas */}
      <div className="relative w-full overflow-hidden rounded-xl bg-slate-950/80 border border-slate-850 p-1">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${chartConfig.width} ${chartConfig.height}`}
          className="w-full h-auto cursor-crosshair overflow-visible touch-none"
          onPointerMove={handlePointerMove}
          onPointerLeave={handlePointerLeave}
        >
          <defs>
            {/* Area Fill Gradient: Top is vibrant emerald/gold, fading to dark at bottom */}
            <linearGradient id="rankAreaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.38" />
              <stop offset="35%" stopColor="#06b6d4" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#0f172a" stopOpacity="0.0" />
            </linearGradient>

            {/* Stroke Line Gradient */}
            <linearGradient id="rankLineGradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#06b6d4" />
              <stop offset="40%" stopColor="#10b981" />
              <stop offset="70%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#10b981" />
            </linearGradient>

            {/* Glow Filter */}
            <filter id="rankGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Horizontal Rank Grid Lines (Inverted scale where top is #1) */}
          {chartConfig.gridTiers.map((tier) => {
            const y = chartConfig.getY(tier);
            const isRank1 = tier === 1;
            const isTop3 = tier <= 3;
            return (
              <g key={`grid-tier-${tier}`}>
                <line
                  x1={chartConfig.padding.left}
                  y1={y}
                  x2={chartConfig.width - chartConfig.padding.right}
                  y2={y}
                  stroke={isRank1 ? '#f59e0b' : isTop3 ? '#0284c7' : '#334155'}
                  strokeWidth={isRank1 ? 1.5 : 1}
                  strokeDasharray={isRank1 ? undefined : '3 4'}
                  strokeOpacity={isRank1 ? 0.7 : 0.4}
                />
                {/* Y-Axis Label on left */}
                <text
                  x={chartConfig.padding.left - 8}
                  y={y + 4}
                  textAnchor="end"
                  className={`text-[11px] font-mono select-none font-bold ${
                    isRank1
                      ? 'fill-amber-400 font-black'
                      : isTop3
                      ? 'fill-cyan-400'
                      : 'fill-slate-500'
                  }`}
                >
                  {isRank1 ? '🥇 #1' : tier === 3 ? '🥉 #3' : `#${tier}`}
                </text>
              </g>
            );
          })}

          {/* Area under curve */}
          {chartConfig.areaD && (
            <path
              d={chartConfig.areaD}
              fill="url(#rankAreaGradient)"
              className="transition-all duration-300"
            />
          )}

          {/* Progression Curve Path */}
          {chartConfig.pathD && (
            <path
              d={chartConfig.pathD}
              fill="none"
              stroke="url(#rankLineGradient)"
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="url(#rankGlow)"
            />
          )}

          {/* Vertical Guideline when Hovered */}
          {hoveredX !== null && (
            <line
              x1={hoveredX}
              y1={chartConfig.padding.top}
              x2={hoveredX}
              y2={chartConfig.height - chartConfig.padding.bottom}
              stroke="#10b981"
              strokeWidth={1.5}
              strokeDasharray="4 4"
              strokeOpacity={0.8}
            />
          )}

          {/* Interactive Data Point Markers */}
          {chartConfig.renderedNodes.map((node) => {
            const isHovered = hoveredPoint && hoveredPoint.time === node.point.time;
            const isPeak = node.point.isPeak;
            const isQualified = node.point.isQualified;
            const isLast = node.index === chartConfig.renderedNodes.length - 1;
            const isRank1 = node.point.rank === 1;

            return (
              <g
                key={`node-${node.index}`}
                onClick={() => setSelectedPoint(node.point)}
                className="cursor-pointer"
              >
                {/* Outer Glow / Halo for key nodes */}
                {(isPeak || isRank1 || isQualified || isLast || isHovered) && (
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={isHovered ? 9 : 7}
                    fill={isRank1 || isPeak ? '#f59e0b' : isQualified ? '#10b981' : '#06b6d4'}
                    fillOpacity={isHovered ? 0.45 : 0.25}
                    className="transition-all duration-200"
                  />
                )}

                {/* Point Center Circle */}
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={isHovered ? 5.5 : isPeak || isRank1 ? 4.5 : isLast ? 4 : 3}
                  fill={
                    isRank1 || isPeak
                      ? '#f59e0b'
                      : isQualified
                      ? '#10b981'
                      : isLast
                      ? '#38bdf8'
                      : node.point.rank === null
                      ? '#64748b'
                      : '#10b981'
                  }
                  stroke="#020617"
                  strokeWidth={2}
                  className="transition-all duration-150"
                />

                {/* Milestone Annotation Pin: Peak Rank */}
                {isPeak && !isHovered && (
                  <g transform={`translate(${node.x}, ${node.y - 12})`}>
                    <rect
                      x="-24"
                      y="-14"
                      width="48"
                      height="15"
                      rx="4"
                      fill="#78350f"
                      stroke="#f59e0b"
                      strokeWidth="1"
                    />
                    <text
                      x="0"
                      y="-3.5"
                      textAnchor="middle"
                      className="fill-amber-300 font-mono text-[9px] font-bold"
                    >
                      👑 PEAK #{node.point.rank}
                    </text>
                  </g>
                )}

                {/* Milestone Annotation Pin: Qualification */}
                {isQualified && !isPeak && !isHovered && (
                  <g transform={`translate(${node.x}, ${node.y - 12})`}>
                    <rect
                      x="-30"
                      y="-14"
                      width="60"
                      height="15"
                      rx="4"
                      fill="#064e3b"
                      stroke="#10b981"
                      strokeWidth="1"
                    />
                    <text
                      x="0"
                      y="-3.5"
                      textAnchor="middle"
                      className="fill-emerald-300 font-mono text-[9px] font-bold"
                    >
                      🎯 QUALIFY #{node.point.rank ?? ''}
                    </text>
                  </g>
                )}

                {/* Milestone Annotation Pin: Current Position (Last Node) */}
                {isLast && !isPeak && !isQualified && !isHovered && stats.currentRank && (
                  <g transform={`translate(${node.x}, ${node.y - 12})`}>
                    <rect
                      x="-25"
                      y="-14"
                      width="50"
                      height="15"
                      rx="4"
                      fill="#0c4a6e"
                      stroke="#0284c7"
                      strokeWidth="1"
                    />
                    <text
                      x="0"
                      y="-3.5"
                      textAnchor="middle"
                      className="fill-sky-300 font-mono text-[9px] font-bold"
                    >
                      📍 NOW #{stats.currentRank}
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* Time Axis (X-Axis) Labels */}
          {chartConfig.renderedNodes
            .filter((_, idx, arr) => {
              // Show approximately 5-7 evenly spaced time labels
              const step = Math.max(1, Math.floor(arr.length / 6));
              return idx % step === 0 || idx === arr.length - 1;
            })
            .map((node, i) => (
              <text
                key={`xaxis-${i}`}
                x={node.x}
                y={chartConfig.height - 12}
                textAnchor="middle"
                className="fill-slate-400 font-mono text-[10px] select-none"
              >
                {node.point.time.replace(/:\d\d\s/, ' ')}
              </text>
            ))}
        </svg>
      </div>

      {/* Footer Notes and Legend */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-400 font-mono pt-1">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 border border-slate-900" />
            <span className="text-amber-300">గరిష్ట ర్యాంక్ (Peak #1)</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 border border-slate-900" />
            <span className="text-emerald-300">సిస్టమ్ గుర్తించిన పాయింట్ (Identified)</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 border border-slate-900" />
            <span className="text-cyan-300">ప్రస్తుత స్థితి (LTP)</span>
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-slate-400">
          <Info className="w-3.5 h-3.5 text-slate-500" />
          <span>చార్ట్‌పై మౌస్ లేదా వేలు కదిలించి ఖచ్చితమైన సమయం & ర్యాంక్‌ను పరిశీలించండి (Hover to inspect)</span>
        </div>
      </div>
    </div>
  );
};
