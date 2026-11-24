import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { Candle, PivotPoints, Timeframe, TradePlan } from '../types';
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Sliders,
  TrendingUp,
  Activity,
  ArrowRight,
} from 'lucide-react';

interface CandleChartProps {
  candles: Candle[];
  timeframe: Timeframe;
  onTimeframeChange: (tf: Timeframe) => void;
  pivots?: PivotPoints;
  tradePlan?: TradePlan;
  symbol: string;
  currentPrice: number;
  change?: number;
  changePercent?: number;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

export const CandleChart: React.FC<CandleChartProps> = ({
  candles,
  timeframe,
  onTimeframeChange,
  pivots,
  tradePlan,
  symbol,
  currentPrice,
  change,
  changePercent,
  isFullscreen: controlledFullscreen,
  onToggleFullscreen,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Zoom and Pan states
  // visibleCount can range from 6 (ultra-deep zoom) to total candles (full view)
  const defaultCount = Math.min(26, candles.length || 26);
  const [visibleCount, setVisibleCount] = useState<number>(defaultCount);
  const [panOffset, setPanOffset] = useState<number>(0); // 0 = rightmost (latest candles), >0 = shifted into the past
  const [isExpandedHeight, setIsExpandedHeight] = useState<boolean>(false);
  const [internalFullscreen, setInternalFullscreen] = useState<boolean>(false);

  const isFullscreen = controlledFullscreen !== undefined ? controlledFullscreen : internalFullscreen;

  const handleToggleFullscreen = () => {
    if (onToggleFullscreen) {
      onToggleFullscreen();
    } else {
      setInternalFullscreen((prev) => !prev);
    }
  };

  // Keyboard Escape listener for fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        handleToggleFullscreen();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  // Touch gesture state for swipe panning and pinch zoom
  const touchStartXRef = useRef<number | null>(null);
  const touchStartDistRef = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      touchStartXRef.current = e.touches[0].clientX;
    } else if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      touchStartDistRef.current = dist;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && touchStartXRef.current !== null) {
      const deltaX = e.touches[0].clientX - touchStartXRef.current;
      if (Math.abs(deltaX) > 18) {
        if (deltaX > 0) {
          handlePanLeft(); // Swipe right -> pan older
        } else {
          handlePanRight(); // Swipe left -> pan newer
        }
        touchStartXRef.current = e.touches[0].clientX;
      }
    } else if (e.touches.length === 2 && touchStartDistRef.current !== null) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const diff = dist - touchStartDistRef.current;
      if (Math.abs(diff) > 25) {
        if (diff > 0) {
          handleZoomIn(); // Pinch out -> zoom in
        } else {
          handleZoomOut(); // Pinch in -> zoom out
        }
        touchStartDistRef.current = dist;
      }
    }
  };

  const handleTouchEnd = () => {
    touchStartXRef.current = null;
    touchStartDistRef.current = null;
  };

  // Indicators toggle
  const [showVWAP, setShowVWAP] = useState(true);
  const [showEMAs, setShowEMAs] = useState(true);
  const [showPivots, setShowPivots] = useState(true);
  const [showTargets, setShowTargets] = useState(true);
  const [showCVDLine, setShowCVDLine] = useState(true);

  // Hover crosshair
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  // Keep visibleCount and panOffset within bounds when candles change
  useEffect(() => {
    if (candles.length === 0) return;
    setVisibleCount((prev) => Math.min(Math.max(6, prev), candles.length));
    setPanOffset((prev) => Math.max(0, Math.min(prev, candles.length - 6)));
  }, [candles.length]);

  // Compute sliced window of candles based on zoom and pan
  const { displayCandles, startIndex, endIndex } = useMemo(() => {
    const total = candles.length;
    if (total === 0) return { displayCandles: [], startIndex: 0, endIndex: 0 };

    const count = Math.min(visibleCount, total);
    // panOffset 0 means we take candles from (total - count) to total
    const end = Math.max(count, total - panOffset);
    const start = Math.max(0, end - count);
    const actualSlice = candles.slice(start, end);

    return {
      displayCandles: actualSlice,
      startIndex: start,
      endIndex: end,
    };
  }, [candles, visibleCount, panOffset]);

  // Zoom handlers
  const handleZoomIn = () => {
    setVisibleCount((prev) => Math.max(6, prev - 4));
  };

  const handleZoomOut = () => {
    setVisibleCount((prev) => Math.min(candles.length, prev + 6));
  };

  const handleResetZoom = () => {
    setVisibleCount(Math.min(26, candles.length));
    setPanOffset(0);
  };

  const handlePresetZoom = (presetCount: number) => {
    setVisibleCount(Math.min(candles.length, Math.max(6, presetCount)));
    setPanOffset(0);
  };

  // Pan handlers
  const handlePanLeft = () => {
    setPanOffset((prev) => Math.min(candles.length - visibleCount, prev + 3));
  };

  const handlePanRight = () => {
    setPanOffset((prev) => Math.max(0, prev - 3));
  };

  const handleJumpToLatest = () => {
    setPanOffset(0);
  };

  // Mouse wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      handleZoomIn();
    } else {
      handleZoomOut();
    }
  };

  // Hover inspection
  const activeHoverIndex =
    hoverIndex !== null && hoverIndex < displayCandles.length
      ? hoverIndex
      : displayCandles.length - 1;
  const hoveredCandle = displayCandles[activeHoverIndex] || displayCandles[displayCandles.length - 1];

  // SVG Stage Dimensions (High vertical resolution)
  const svgWidth = isFullscreen ? 1100 : 960;
  const priceAxisWidth = 84;
  const chartAreaWidth = svgWidth - priceAxisWidth;
  const mainHeight = isFullscreen ? 520 : isExpandedHeight ? 460 : 360;
  const volHeight = isFullscreen ? 130 : isExpandedHeight ? 120 : 95;
  const totalHeight = mainHeight + volHeight + 30;

  // Price Bounds Calculation
  const prices: number[] = displayCandles.flatMap((c) => [c.high, c.low]);
  if (currentPrice > 0) prices.push(currentPrice);

  if (pivots && showPivots) {
    if (pivots.pivot) prices.push(pivots.pivot);
    if (pivots.r1) prices.push(pivots.r1);
    if (pivots.s1) prices.push(pivots.s1);
  }
  if (tradePlan && showTargets) {
    if (tradePlan.entryPrice) prices.push(tradePlan.entryPrice);
    if (tradePlan.stopLoss) prices.push(tradePlan.stopLoss);
    if (tradePlan.target1) prices.push(tradePlan.target1);
    if (tradePlan.target2) prices.push(tradePlan.target2);
  }

  const rawMin = Math.min(...(prices.length ? prices : [currentPrice * 0.98]));
  const rawMax = Math.max(...(prices.length ? prices : [currentPrice * 1.02]));
  const priceRange = rawMax - rawMin || 1;
  const pad = priceRange * 0.08;
  const effectiveMin = rawMin - pad;
  const effectiveMax = rawMax + pad;
  const effectiveRange = effectiveMax - effectiveMin;

  // Volume & CVD Bounds
  const maxVolume = Math.max(...displayCandles.map((c) => c.volume), 1000);
  const cvdValues = displayCandles.map((c) => c.cvd ?? 0);
  const minCvd = Math.min(...cvdValues, 0);
  const maxCvd = Math.max(...cvdValues, 1000);
  const cvdRange = maxCvd - minCvd || 1;

  // Coordinate Transformers
  const getY = useCallback(
    (price: number) => {
      return mainHeight - ((price - effectiveMin) / effectiveRange) * mainHeight;
    },
    [effectiveMin, effectiveRange, mainHeight]
  );

  const getVolY = useCallback(
    (vol: number) => {
      return mainHeight + volHeight - (vol / maxVolume) * (volHeight * 0.82);
    },
    [mainHeight, volHeight, maxVolume]
  );

  const getCvdY = useCallback(
    (cvdVal: number) => {
      return mainHeight + volHeight - ((cvdVal - minCvd) / cvdRange) * (volHeight * 0.75) - 4;
    },
    [mainHeight, volHeight, minCvd, cvdRange]
  );

  const candleSlotWidth = chartAreaWidth / (displayCandles.length || 1);
  // Responsive candle width that gets comfortably wide when zoomed in!
  const candleBodyWidth = Math.max(5, Math.min(42, candleSlotWidth * 0.72));
  const wickWidth = candleSlotWidth > 30 ? 2.5 : candleSlotWidth > 18 ? 1.8 : 1.2;

  // Indicator Polyline coordinates
  const vwapPoints = displayCandles
    .map((c, i) => (c.vwap ? `${i * candleSlotWidth + candleSlotWidth / 2},${getY(c.vwap)}` : null))
    .filter(Boolean)
    .join(' ');

  const ema9Points = displayCandles
    .map((c, i) => (c.ema9 ? `${i * candleSlotWidth + candleSlotWidth / 2},${getY(c.ema9)}` : null))
    .filter(Boolean)
    .join(' ');

  const ema21Points = displayCandles
    .map((c, i) => (c.ema21 ? `${i * candleSlotWidth + candleSlotWidth / 2},${getY(c.ema21)}` : null))
    .filter(Boolean)
    .join(' ');

  const cvdPoints = displayCandles
    .map((c, i) =>
      c.cvd !== undefined
        ? `${i * candleSlotWidth + candleSlotWidth / 2},${getCvdY(c.cvd)}`
        : null
    )
    .filter(Boolean)
    .join(' ');

  // Mouse move handler for crosshair
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * svgWidth;
    if (x <= chartAreaWidth) {
      const idx = Math.floor((x / chartAreaWidth) * displayCandles.length);
      if (idx >= 0 && idx < displayCandles.length) {
        setHoverIndex(idx);
      }
    }
  };

  const handleMouseLeave = () => {
    setHoverIndex(null);
  };

  // Right Price Axis Grids (5 levels)
  const priceGridLevels = [0.15, 0.35, 0.55, 0.75, 0.92].map((ratio) => {
    const y = mainHeight * ratio;
    const price = effectiveMax - ratio * effectiveRange;
    return { y, price };
  });

  return (
    <div
      id={`candle-chart-container-${symbol}`}
      className={`${
        isFullscreen
          ? 'fixed inset-0 z-[999] bg-slate-950 text-slate-100 flex flex-col w-screen h-[100dvh] overflow-hidden p-2 sm:p-4 select-none'
          : 'bg-slate-900/95 border border-slate-800 rounded-2xl p-3 sm:p-4 text-slate-200 shadow-2xl select-none'
      }`}
      ref={containerRef}
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Top Header Bar: Timeframes, Indicators, Zoom Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-slate-800 pb-3 mb-3">
        {/* Left: Timeframe pills and Stock identity */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-slate-850 rounded-xl p-1 border border-slate-700/80">
            {(['5M', '15M', '1H'] as Timeframe[]).map((tf) => (
              <button
                key={tf}
                id={`btn-tf-${tf.toLowerCase()}`}
                onClick={() => onTimeframeChange(tf)}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                  timeframe === tf
                    ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-750'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>

          <div className="text-xs font-mono bg-slate-950/90 px-3 py-1.5 rounded-xl border border-slate-800 flex items-center gap-2">
            <span className="font-bold text-slate-100">{symbol}</span>
            <span className="text-emerald-400 font-black">₹{currentPrice.toFixed(2)}</span>
            {changePercent !== undefined && (
              <span
                className={`text-[11px] font-bold ${
                  changePercent >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {changePercent >= 0 ? '+' : ''}{changePercent}%
              </span>
            )}
          </div>

          {/* Quick Zoom Presets */}
          <div className="hidden sm:flex items-center bg-slate-950/60 p-1 rounded-xl border border-slate-800 text-[11px] font-mono">
            <span className="text-slate-400 px-2 flex items-center gap-1">
              <ZoomIn className="w-3 h-3 text-cyan-400" />
              క్యాండిల్స్:
            </span>
            <button
              onClick={() => handlePresetZoom(10)}
              title="10 క్యాండిల్స్ డీప్ జూమ్ (Deep Zoom)"
              className={`px-2 py-0.5 rounded transition-colors ${
                visibleCount <= 12 ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              10C డీప్
            </button>
            <button
              onClick={() => handlePresetZoom(24)}
              title="24 క్యాండిల్స్ స్టాండర్డ్ జూమ్ (Standard View)"
              className={`px-2 py-0.5 rounded transition-colors ${
                visibleCount > 12 && visibleCount <= 32 ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              24C నార్మల్
            </button>
            <button
              onClick={() => handlePresetZoom(candles.length)}
              title="పూర్తి క్యాండిల్స్ వైడ్ వ్యూ (All Candles)"
              className={`px-2 py-0.5 rounded transition-colors ${
                visibleCount > 32 ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              మొత్తం ({candles.length})
            </button>
          </div>
        </div>

        {/* Right Controls: Overlays & Zoom buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Overlays */}
          <div className="flex items-center gap-1 text-xs">
            <button
              onClick={() => setShowVWAP(!showVWAP)}
              className={`px-2 py-1 rounded-lg flex items-center gap-1 border transition-all text-[11px] font-semibold ${
                showVWAP
                  ? 'bg-purple-950/80 border-purple-500/60 text-purple-300'
                  : 'bg-slate-850/60 border-slate-700/40 text-slate-400'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-purple-400" />
              VWAP
            </button>
            <button
              onClick={() => setShowEMAs(!showEMAs)}
              className={`px-2 py-1 rounded-lg flex items-center gap-1 border transition-all text-[11px] font-semibold ${
                showEMAs
                  ? 'bg-cyan-950/80 border-cyan-500/60 text-cyan-300'
                  : 'bg-slate-850/60 border-slate-700/40 text-slate-400'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-cyan-400" />
              EMA 9/21
            </button>
            <button
              onClick={() => setShowPivots(!showPivots)}
              className={`px-2 py-1 rounded-lg flex items-center gap-1 border transition-all text-[11px] font-semibold ${
                showPivots
                  ? 'bg-amber-950/80 border-amber-500/60 text-amber-300'
                  : 'bg-slate-850/60 border-slate-700/40 text-slate-400'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              Pivots
            </button>
            <button
              onClick={() => setShowCVDLine(!showCVDLine)}
              className={`px-2 py-1 rounded-lg flex items-center gap-1 border transition-all text-[11px] font-semibold ${
                showCVDLine
                  ? 'bg-emerald-950/80 border-emerald-500/60 text-emerald-300'
                  : 'bg-slate-850/60 border-slate-700/40 text-slate-400'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              CVD
            </button>
          </div>

          {/* Interactive Zoom and Pan Control Cluster */}
          <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-xl border border-slate-800">
            <button
              onClick={handleZoomIn}
              title="జూమ్ ఇన్ (+ Zoom: మరింత పెద్ద క్యాండిల్స్)"
              className="p-1.5 text-slate-300 hover:text-emerald-400 hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-1"
            >
              <ZoomIn className="w-4 h-4" />
              <span className="text-[11px] font-bold hidden md:inline">+ జూమ్</span>
            </button>

            <button
              onClick={handleZoomOut}
              title="జూమ్ ఔట్ (- Zoom: ఎక్కువ క్యాండిల్స్)"
              className="p-1.5 text-slate-300 hover:text-amber-400 hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-1"
            >
              <ZoomOut className="w-4 h-4" />
              <span className="text-[11px] font-bold hidden md:inline">- జూమ్</span>
            </button>

            <button
              onClick={handleResetZoom}
              title="రీసెట్ వ్యూ"
              className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            <div className="w-[1px] h-4 bg-slate-800 mx-0.5" />

            {/* Expand / Minimize Height */}
            <button
              onClick={() => setIsExpandedHeight(!isExpandedHeight)}
              title={isExpandedHeight ? 'గ్రాఫ్ ఎత్తు తగ్గించండి' : 'గ్రాఫ్‌ను నిలువుగా పెద్దది చేయండి (Expand Height)'}
              className={`p-1.5 rounded-lg transition-colors ${
                isExpandedHeight ? 'bg-emerald-950 text-emerald-400' : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
              }`}
            >
              {isExpandedHeight ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* Prominent Fullscreen View Button */}
          <button
            id={`btn-fullscreen-${symbol}`}
            onClick={handleToggleFullscreen}
            title={isFullscreen ? 'సాధారణ వ్యూకు వెళ్ళండి (Exit Full Screen - Esc)' : 'వర్టికల్ పూర్తి స్క్రీన్ మోడ్ (View Vertical Full Screen)'}
            className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all text-xs border ${
              isFullscreen
                ? 'bg-rose-950/90 text-rose-300 border-rose-500/60 shadow-lg shadow-rose-950/50 hover:bg-rose-900'
                : 'bg-emerald-950/90 text-emerald-300 border-emerald-500/60 hover:bg-emerald-900 shadow-md shadow-emerald-950/40 ring-1 ring-emerald-500/30'
            }`}
          >
            {isFullscreen ? (
              <>
                <Minimize2 className="w-4 h-4" />
                <span>సాధారణ వ్యూ (Exit)</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-4 h-4 text-emerald-400" />
                <span className="font-extrabold">⛶ పూర్తి స్క్రీన్ చార్ట్</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* SVG Candlestick Chart Area (Clean & Unobstructed, expands in Fullscreen) */}
      <div
        className={`relative w-full overflow-hidden bg-slate-950 rounded-xl border border-slate-800 shadow-inner ${
          isFullscreen ? 'flex-1 min-h-0 flex items-center justify-center' : ''
        }`}
      >
        <svg
          viewBox={`0 0 ${svgWidth} ${totalHeight}`}
          className={`w-full ${isFullscreen ? 'h-full max-h-full' : 'h-auto'} cursor-crosshair block`}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          <defs>
            <linearGradient id="chartVolGreen" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#059669" stopOpacity="0.3" />
            </linearGradient>
            <linearGradient id="chartVolRed" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#be123c" stopOpacity="0.3" />
            </linearGradient>
          </defs>

          {/* Grid lines & Right Price Axis */}
          {priceGridLevels.map((gl, i) => (
            <g key={i}>
              <line
                x1="0"
                y1={gl.y}
                x2={chartAreaWidth}
                y2={gl.y}
                stroke="#1e293b"
                strokeDasharray="4 4"
                strokeWidth="0.8"
              />
              {/* Right price scale background pill */}
              <rect
                x={chartAreaWidth + 4}
                y={gl.y - 7}
                width={priceAxisWidth - 8}
                height="14"
                fill="#0b1324"
                stroke="#1e293b"
                rx="3"
              />
              <text
                x={chartAreaWidth + priceAxisWidth / 2}
                y={gl.y + 3}
                fill="#64748b"
                fontSize="9"
                textAnchor="middle"
                fontFamily="monospace"
              >
                ₹{gl.price.toFixed(1)}
              </text>
            </g>
          ))}

          {/* Price Axis Separator */}
          <line
            x1={chartAreaWidth}
            y1="0"
            x2={chartAreaWidth}
            y2={totalHeight}
            stroke="#1e293b"
            strokeWidth="1"
          />

          {/* Volume Sub-panel Separator */}
          <line
            x1="0"
            y1={mainHeight}
            x2={chartAreaWidth}
            y2={mainHeight}
            stroke="#334155"
            strokeWidth="1"
          />
          <text
            x="10"
            y={mainHeight + 14}
            fill="#64748b"
            fontSize="9"
            fontWeight="bold"
            fontFamily="sans-serif"
          >
            📊 వాల్యూమ్ & క్యుములేటివ్ డెల్టా (VOLUME & CVD ACCUMULATION)
          </text>

          {/* Live Current Price horizontal marker */}
          {currentPrice > 0 && (
            <g>
              <line
                x1="0"
                y1={getY(currentPrice)}
                x2={chartAreaWidth}
                y2={getY(currentPrice)}
                stroke="#10b981"
                strokeDasharray="2 2"
                strokeWidth="1.2"
                opacity="0.9"
              />
              <rect
                x={chartAreaWidth + 2}
                y={getY(currentPrice) - 8}
                width={priceAxisWidth - 4}
                height="16"
                fill="#064e3b"
                stroke="#10b981"
                rx="4"
              />
              <text
                x={chartAreaWidth + priceAxisWidth / 2}
                y={getY(currentPrice) + 4}
                fill="#34d399"
                fontSize="9"
                fontWeight="bold"
                textAnchor="middle"
                fontFamily="monospace"
              >
                ₹{currentPrice.toFixed(2)}
              </text>
            </g>
          )}

          {/* Pivot Points Overlays */}
          {pivots && showPivots && (
            <>
              {/* R1 */}
              <line
                x1="0"
                y1={getY(pivots.r1)}
                x2={chartAreaWidth}
                y2={getY(pivots.r1)}
                stroke="#f59e0b"
                strokeDasharray="4 3"
                strokeWidth="1.2"
                opacity="0.8"
              />
              <rect
                x={chartAreaWidth + 4}
                y={getY(pivots.r1) - 7}
                width={priceAxisWidth - 8}
                height="14"
                fill="#451a03"
                stroke="#f59e0b"
                rx="3"
              />
              <text
                x={chartAreaWidth + priceAxisWidth / 2}
                y={getY(pivots.r1) + 3}
                fill="#f59e0b"
                fontSize="8"
                fontWeight="bold"
                textAnchor="middle"
                fontFamily="monospace"
              >
                R1 ₹{pivots.r1}
              </text>

              {/* Pivot */}
              <line
                x1="0"
                y1={getY(pivots.pivot)}
                x2={chartAreaWidth}
                y2={getY(pivots.pivot)}
                stroke="#94a3b8"
                strokeDasharray="2 2"
                strokeWidth="1"
                opacity="0.7"
              />
              <rect
                x={chartAreaWidth + 4}
                y={getY(pivots.pivot) - 7}
                width={priceAxisWidth - 8}
                height="14"
                fill="#1e293b"
                stroke="#94a3b8"
                rx="3"
              />
              <text
                x={chartAreaWidth + priceAxisWidth / 2}
                y={getY(pivots.pivot) + 3}
                fill="#94a3b8"
                fontSize="8"
                fontWeight="bold"
                textAnchor="middle"
                fontFamily="monospace"
              >
                P ₹{pivots.pivot}
              </text>

              {/* S1 */}
              <line
                x1="0"
                y1={getY(pivots.s1)}
                x2={chartAreaWidth}
                y2={getY(pivots.s1)}
                stroke="#38bdf8"
                strokeDasharray="4 3"
                strokeWidth="1.2"
                opacity="0.8"
              />
              <rect
                x={chartAreaWidth + 4}
                y={getY(pivots.s1) - 7}
                width={priceAxisWidth - 8}
                height="14"
                fill="#0c4a6e"
                stroke="#38bdf8"
                rx="3"
              />
              <text
                x={chartAreaWidth + priceAxisWidth / 2}
                y={getY(pivots.s1) + 3}
                fill="#38bdf8"
                fontSize="8"
                fontWeight="bold"
                textAnchor="middle"
                fontFamily="monospace"
              >
                S1 ₹{pivots.s1}
              </text>
            </>
          )}

          {/* Trade Plan Targets Overlays */}
          {tradePlan && showTargets && (
            <>
              {/* Entry */}
              <line
                x1="0"
                y1={getY(tradePlan.entryPrice)}
                x2={chartAreaWidth}
                y2={getY(tradePlan.entryPrice)}
                stroke="#22c55e"
                strokeDasharray="5 3"
                strokeWidth="1.2"
              />
              {/* Stop Loss */}
              <line
                x1="0"
                y1={getY(tradePlan.stopLoss)}
                x2={chartAreaWidth}
                y2={getY(tradePlan.stopLoss)}
                stroke="#ef4444"
                strokeDasharray="5 3"
                strokeWidth="1.2"
              />
              {/* Target 1 */}
              <line
                x1="0"
                y1={getY(tradePlan.target1)}
                x2={chartAreaWidth}
                y2={getY(tradePlan.target1)}
                stroke="#10b981"
                strokeDasharray="3 3"
                strokeWidth="1"
                opacity="0.8"
              />
            </>
          )}

          {/* Candlesticks & Volume Bars */}
          {displayCandles.map((c, i) => {
            const xCenter = i * candleSlotWidth + candleSlotWidth / 2;
            const isGreen = c.close >= c.open;
            const openY = getY(c.open);
            const closeY = getY(c.close);
            const highY = getY(c.high);
            const lowY = getY(c.low);
            const bodyY = Math.min(openY, closeY);
            const bodyHeight = Math.max(2, Math.abs(openY - closeY));

            const color = isGreen ? '#22c55e' : '#ef4444';
            const volY = getVolY(c.volume);
            const volBarHeight = Math.max(2, mainHeight + volHeight - volY);

            return (
              <g key={i}>
                {/* Volume Bar */}
                <rect
                  x={xCenter - candleBodyWidth / 2}
                  y={volY}
                  width={candleBodyWidth}
                  height={volBarHeight}
                  fill={isGreen ? 'url(#chartVolGreen)' : 'url(#chartVolRed)'}
                  rx="1"
                />

                {/* Candlestick Upper/Lower Wicks */}
                <line
                  x1={xCenter}
                  y1={highY}
                  x2={xCenter}
                  y2={lowY}
                  stroke={color}
                  strokeWidth={wickWidth}
                  strokeLinecap="round"
                />

                {/* Candlestick Body */}
                <rect
                  x={xCenter - candleBodyWidth / 2}
                  y={bodyY}
                  width={candleBodyWidth}
                  height={bodyHeight}
                  fill={color}
                  stroke={isGreen ? '#15803d' : '#991b1b'}
                  strokeWidth="0.8"
                  rx="1.5"
                />
              </g>
            );
          })}

          {/* Indicator PolyLines */}
          {showVWAP && vwapPoints && (
            <polyline
              points={vwapPoints}
              fill="none"
              stroke="#c084fc"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {showEMAs && ema9Points && (
            <polyline
              points={ema9Points}
              fill="none"
              stroke="#06b6d4"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {showEMAs && ema21Points && (
            <polyline
              points={ema21Points}
              fill="none"
              stroke="#f59e0b"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Cumulative Volume Delta (CVD) Line in Volume Sub-panel */}
          {showCVDLine && cvdPoints && (
            <polyline
              points={cvdPoints}
              fill="none"
              stroke="#38bdf8"
              strokeWidth="1.6"
              strokeDasharray="3 2"
              opacity="0.9"
            />
          )}

          {/* Crosshair Cursor Tracking */}
          {hoverIndex !== null && hoverIndex < displayCandles.length && (
            <>
              {/* Vertical line */}
              <line
                x1={hoverIndex * candleSlotWidth + candleSlotWidth / 2}
                y1="0"
                x2={hoverIndex * candleSlotWidth + candleSlotWidth / 2}
                y2={totalHeight}
                stroke="#cbd5e1"
                strokeWidth="1"
                strokeDasharray="2 2"
                opacity="0.85"
              />

              {/* Horizontal line */}
              <line
                x1="0"
                y1={getY(hoveredCandle.close)}
                x2={chartAreaWidth}
                y2={getY(hoveredCandle.close)}
                stroke="#cbd5e1"
                strokeWidth="1"
                strokeDasharray="2 2"
                opacity="0.85"
              />

              {/* Bottom Time Badge */}
              <rect
                x={hoverIndex * candleSlotWidth + candleSlotWidth / 2 - 32}
                y={totalHeight - 20}
                width="64"
                height="16"
                fill="#0f172a"
                stroke="#475569"
                rx="4"
              />
              <text
                x={hoverIndex * candleSlotWidth + candleSlotWidth / 2}
                y={totalHeight - 8}
                fill="#f8fafc"
                fontSize="9"
                fontWeight="bold"
                textAnchor="middle"
                fontFamily="monospace"
              >
                {hoveredCandle.time}
              </text>

              {/* Right price scale hover pill */}
              <rect
                x={chartAreaWidth + 2}
                y={getY(hoveredCandle.close) - 8}
                width={priceAxisWidth - 4}
                height="16"
                fill="#0284c7"
                stroke="#38bdf8"
                rx="3"
              />
              <text
                x={chartAreaWidth + priceAxisWidth / 2}
                y={getY(hoveredCandle.close) + 4}
                fill="#ffffff"
                fontSize="9"
                fontWeight="bold"
                textAnchor="middle"
                fontFamily="monospace"
              >
                ₹{hoveredCandle.close}
              </text>
            </>
          )}
        </svg>
      </div>

      {/* Real-time Data Points Ribbon - Positioned Strictly BELOW the Graph to Prevent Any Overlap */}
      <div
        id={`chart-datapoints-${symbol}`}
        className="bg-slate-950/95 border border-slate-800 rounded-xl p-2.5 mt-2.5 flex flex-wrap items-center justify-between gap-2.5 text-xs font-mono shadow-md select-text"
      >
        {hoveredCandle ? (
          <>
            {/* Left Cluster: Time, OHLC, and Candle Range */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-slate-300">
              <span className="text-slate-300 font-bold bg-slate-900 px-2 py-0.5 rounded border border-slate-700 flex items-center gap-1 text-[11px]">
                🕒 {hoveredCandle.time}
              </span>
              <span>
                O: <strong className="text-slate-100 font-bold">₹{hoveredCandle.open}</strong>
              </span>
              <span>
                H: <strong className="text-cyan-400 font-bold">₹{hoveredCandle.high}</strong>
              </span>
              <span>
                L: <strong className="text-rose-400 font-bold">₹{hoveredCandle.low}</strong>
              </span>
              <span>
                C:{' '}
                <strong
                  className={`font-black ${
                    hoveredCandle.close >= hoveredCandle.open ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  ₹{hoveredCandle.close}
                </strong>
              </span>
              <span className="text-slate-400 text-[11px] hidden sm:inline">
                (పరిధి: ₹{(hoveredCandle.high - hoveredCandle.low).toFixed(2)})
              </span>
            </div>

            {/* Right Cluster: Volume, RVOL, CVD, and Overlays */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
              <span className="text-slate-400">
                వాల్యూమ్:{' '}
                <strong className="text-slate-100 font-bold">
                  {hoveredCandle.volume.toLocaleString('en-IN')}
                </strong>
              </span>

              {hoveredCandle.rvol !== undefined && (
                <span
                  className={`px-1.5 py-0.5 rounded border font-bold text-[11px] ${
                    hoveredCandle.rvol >= 1.6
                      ? 'bg-amber-950 text-amber-300 border-amber-500/60 shadow-sm'
                      : hoveredCandle.rvol >= 1.0
                      ? 'bg-emerald-950 text-emerald-300 border-emerald-500/60'
                      : 'bg-slate-900 text-slate-400 border-slate-800'
                  }`}
                  title="20-పీరియడ్ యావరేజ్ వాల్యూమ్‌తో పోలిస్తే రిలేటివ్ వాల్యూమ్ (RVOL)"
                >
                  RVOL: {hoveredCandle.rvol}×
                </span>
              )}

              {hoveredCandle.barDelta !== undefined && (
                <span
                  className={`px-1.5 py-0.5 rounded border font-bold text-[11px] ${
                    hoveredCandle.barDelta > 0
                      ? 'bg-emerald-950 text-emerald-400 border-emerald-500/50'
                      : 'bg-rose-950 text-rose-400 border-rose-500/50'
                  }`}
                  title="క్యాండిల్ వాల్యూమ్ డెల్టా (Buyer - Seller Delta)"
                >
                  Δ {hoveredCandle.barDelta > 0 ? '+' : ''}
                  {hoveredCandle.barDelta.toLocaleString('en-IN')}
                </span>
              )}

              {hoveredCandle.cvd !== undefined && (
                <span className="text-cyan-300 font-mono text-[11px]">
                  CVD: <strong className="font-bold">{hoveredCandle.cvd > 0 ? '+' : ''}{hoveredCandle.cvd.toLocaleString('en-IN')}</strong>
                </span>
              )}

              {showVWAP && hoveredCandle.vwap && (
                <span className="text-purple-300 text-[11px]">
                  VWAP: <strong className="font-bold">₹{hoveredCandle.vwap}</strong>
                </span>
              )}

              {showEMAs && hoveredCandle.ema9 && (
                <span className="text-cyan-400 text-[11px]">
                  EMA9: <strong className="font-bold">₹{hoveredCandle.ema9}</strong>
                </span>
              )}

              {showEMAs && hoveredCandle.ema21 && (
                <span className="text-amber-400 text-[11px]">
                  EMA21: <strong className="font-bold">₹{hoveredCandle.ema21}</strong>
                </span>
              )}
            </div>
          </>
        ) : (
          <div className="text-slate-400 text-xs flex items-center gap-1.5">
            <span>చార్ట్‌పై కర్సర్ ఉంచితే డేటా పాయింట్లు ఇక్కడ కనిపిస్తాయి</span>
          </div>
        )}
      </div>

      {/* Bottom Navigation: Zoom Slider, Pan Buttons, Info */}
      <div className="flex flex-wrap items-center justify-between gap-3 mt-3 pt-2.5 border-t border-slate-800 text-xs">
        {/* Left: Pan buttons */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={handlePanLeft}
            disabled={panOffset >= candles.length - visibleCount}
            title="పూర్వపు క్యాండిల్స్ చూడండి (Scroll to earlier candles)"
            className="px-2.5 py-1 bg-slate-850 hover:bg-slate-750 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg border border-slate-700 text-slate-300 flex items-center gap-1 font-semibold text-[11px]"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            పూర్వపు క్యాండిల్స్
          </button>

          <button
            onClick={handlePanRight}
            disabled={panOffset === 0}
            title="తాజా క్యాండిల్స్ వైపు రండి (Scroll towards latest)"
            className="px-2.5 py-1 bg-slate-850 hover:bg-slate-750 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg border border-slate-700 text-slate-300 flex items-center gap-1 font-semibold text-[11px]"
          >
            తాజా క్యాండిల్స్
            <ChevronRight className="w-3.5 h-3.5" />
          </button>

          {panOffset > 0 && (
            <button
              onClick={handleJumpToLatest}
              className="px-2 py-1 bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/50 text-emerald-400 rounded-lg text-[11px] font-bold transition-all"
            >
              లైవ్‌కు వెళ్ళు ⚡
            </button>
          )}
        </div>

        {/* Center: Live Zoom Range Slider */}
        <div className="flex items-center gap-2.5 bg-slate-950/80 px-3 py-1.5 rounded-xl border border-slate-800">
          <span className="text-[11px] text-slate-400 font-medium">జూమ్ స్లైడర్:</span>
          <ZoomIn className="w-3.5 h-3.5 text-emerald-400" />
          <input
            type="range"
            min={6}
            max={Math.max(12, candles.length)}
            step={1}
            value={visibleCount}
            onChange={(e) => {
              setVisibleCount(Number(e.target.value));
              setPanOffset(0);
            }}
            className="w-24 sm:w-36 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
          />
          <ZoomOut className="w-3.5 h-3.5 text-slate-400" />
          <span className="font-mono text-emerald-400 font-bold text-[11px]">
            {visibleCount} క్యాండిల్స్
          </span>
        </div>

        {/* Right: Hint & Bottom Fullscreen Action */}
        <div className="flex items-center gap-2">
          <div className="text-[11px] text-slate-400 hidden xl:block">
            💡 <em>మౌస్ వీల్ లేదా టచ్‌తో జూమ్/స్క్రోల్ చేయండి</em>
          </div>
          <button
            onClick={handleToggleFullscreen}
            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5 text-emerald-400" />}
            <span>{isFullscreen ? 'సాధారణ వ్యూ (Exit)' : '⛶ ఫుల్ స్క్రీన్'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
