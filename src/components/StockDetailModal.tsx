import React, { useState, useEffect, useCallback } from 'react';
import { StockIndicatorData, Timeframe, Candle, RankDataPoint } from '../types';
import { formatISTMarketTime } from '../utils/istTime';
import { formatIndianVolume, formatAdvShort } from '../utils/volumeUtils';
import { CandleChart } from './CandleChart';
import { OrderBook } from './OrderBook';
import { RankTrendChart } from './RankTrendChart';
import {
  X,
  TrendingUp,
  ShieldAlert,
  CheckCircle,
  AlertOctagon,
  ArrowUpRight,
  Calculator,
  Compass,
  Zap,
  Activity,
  Award,
  Clock,
  Layers,
  BarChart3,
  RefreshCw,
  Radio,
  Maximize2,
  Minimize2
} from 'lucide-react';

interface StockDetailModalProps {
  stock: StockIndicatorData | null;
  onClose: () => void;
  onTimeframeChange: (tf: Timeframe) => void;
  selectedTimeframe: Timeframe;
  onRefreshLiveQuote?: () => void;
  isSyncingLiveQuote?: boolean;
}

export const StockDetailModal: React.FC<StockDetailModalProps> = ({
  stock,
  onClose,
  onTimeframeChange,
  selectedTimeframe,
  onRefreshLiveQuote,
  isSyncingLiveQuote = false,
}) => {
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'RANK_TREND' | 'ORDER_BOOK' | 'PIVOTS' | 'SCORE_BREAKDOWN' | 'CALCULATOR'>('OVERVIEW');
  const [hoveredRankPoint, setHoveredRankPoint] = useState<RankDataPoint | null>(null);
  const [capital, setCapital] = useState<number>(50000);
  const [riskPercent, setRiskPercent] = useState<number>(1.5);
  const [liveCandles, setLiveCandles] = useState<Candle[] | null>(null);
  const [isLoadingCandles, setIsLoadingCandles] = useState<boolean>(false);
  const [liveMeta, setLiveMeta] = useState<any>(null);
  const [isFullscreenChart, setIsFullscreenChart] = useState<boolean>(false);

  const fetchLiveCandlesData = useCallback(async (sym: string, tf: Timeframe) => {
    setIsLoadingCandles(true);
    try {
      const res = await fetch(`/api/candles/${encodeURIComponent(sym)}?timeframe=${tf}`);
      if (res.ok) {
        const data = await res.json();
        if (data.candles && data.candles.length > 0) {
          setLiveCandles(data.candles);
        }
        if (data.meta) {
          setLiveMeta(data.meta);
        }
      }
    } catch (err) {
      console.warn('Could not fetch real candles for', sym, err);
    } finally {
      setIsLoadingCandles(false);
    }
  }, []);

  useEffect(() => {
    if (stock?.symbol) {
      setLiveCandles(null);
      fetchLiveCandlesData(stock.symbol, selectedTimeframe);
    }
  }, [stock?.symbol, selectedTimeframe, fetchLiveCandlesData]);

  if (!stock) return null;

  const {
    symbol,
    name,
    nameTe,
    sector,
    currentPrice,
    change,
    changePercent,
    dayHigh,
    dayLow,
    dayOpen,
    prevClose,
    vwap,
    ema9,
    ema21,
    adx,
    rvol,
    buyerPressurePercent,
    sellerPressurePercent,
    cvd,
    marketState,
    signalStage,
    persistenceScore,
    overallScore,
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
  } = stock;

  const isPositive = change >= 0;

  // Active candles based on live feed or fallback
  const activeCandles =
    liveCandles && liveCandles.length > 0
      ? liveCandles
      : selectedTimeframe === '15M'
      ? candles15M
      : selectedTimeframe === '1H'
      ? candles1H
      : candles5M;

  // Position Sizing math
  const riskAmount = (capital * riskPercent) / 100;
  const perShareRisk = Math.max(0.5, currentPrice - tradePlan.stopLoss);
  const maxQty = Math.max(1, Math.floor(riskAmount / perShareRisk));
  const totalInvestment = maxQty * currentPrice;
  const t1Profit = maxQty * (tradePlan.target1 - currentPrice);
  const t2Profit = maxQty * (tradePlan.target2 - currentPrice);
  const t3Profit = maxQty * (tradePlan.target3 - currentPrice);

  // Accurate Market Metrics & Ranges
  const actualVolume = liveMeta?.regularMarketVolume || stock.currentVolume || stock.avgVolume;
  const actualAdv = liveMeta?.adv || liveMeta?.adv3m || stock.adv || (stock as any).adv3M || stock.avgVolume;
  const actualSessionRvol =
    liveMeta?.sessionRvol ||
    stock.sessionRvol ||
    stock.rvol;
  const actualFullDayRvol =
    liveMeta?.fullDayRvol ||
    stock.fullDayRvol ||
    (actualAdv > 0 ? Number((actualVolume / actualAdv).toFixed(2)) : 1.0);
  const actualExpectedSessionVol =
    liveMeta?.expectedSessionVolume ||
    stock.expectedSessionVolume;
  const fiftyTwoWHigh = liveMeta?.fiftyTwoWeekHigh || (stock as any).fiftyTwoWeekHigh;
  const fiftyTwoWLow = liveMeta?.fiftyTwoWeekLow || (stock as any).fiftyTwoWeekLow;

  const daySpread = Math.max(0.01, dayHigh - dayLow);
  const todayPct = Math.min(100, Math.max(0, ((currentPrice - dayLow) / daySpread) * 100));

  const fiftyTwoSpread =
    fiftyTwoWHigh && fiftyTwoWLow ? Math.max(0.01, Number(fiftyTwoWHigh) - Number(fiftyTwoWLow)) : 1;
  const fiftyTwoPct = fiftyTwoWLow
    ? Math.min(100, Math.max(0, ((currentPrice - Number(fiftyTwoWLow)) / fiftyTwoSpread) * 100))
    : 50;

  // Dedicated Full-Screen Mode: Expands chart to occupy the entire screen horizontally and vertically
  if (isFullscreenChart) {
    return (
      <div className="fixed inset-0 z-[9999] w-screen h-screen bg-slate-950 flex flex-col overflow-hidden select-none">
        <CandleChart
          candles={activeCandles}
          timeframe={selectedTimeframe}
          onTimeframeChange={onTimeframeChange}
          pivots={pivots}
          tradePlan={tradePlan}
          symbol={symbol}
          currentPrice={currentPrice}
          change={change}
          changePercent={changePercent}
          isFullscreen={true}
          onToggleFullscreen={() => setIsFullscreenChart(false)}
        />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-sm overflow-y-auto animate-fadeIn">
      <div
        id="stock-detail-modal"
        className="bg-slate-900 border border-slate-700 w-full max-w-5xl rounded-2xl shadow-2xl overflow-hidden my-auto max-h-[95vh] flex flex-col"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-800 bg-slate-950/80">
          <div className="flex items-center gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl sm:text-2xl font-black font-mono text-slate-100">{symbol}</h2>
                {stock.qualification && (
                  <span
                    className="text-xs sm:text-sm font-black font-mono px-2.5 py-0.5 rounded-lg border flex items-center gap-1 shadow-md bg-emerald-950/70 text-emerald-300 border-emerald-500/50"
                    title={`క్వాలిఫై సమయం (${formatISTMarketTime(stock.qualification.qualifiedTime)}) లో ర్యాంక్`}
                  >
                    <span>🎯</span>
                    <span>క్వాలిఫై ర్యాంక్ #{stock.qualification.qualifiedRank ?? stock.rank ?? '—'}</span>
                  </span>
                )}
                {(stock.rank || stock.qualification?.qualifiedRank) ? (
                  <span
                    className={`text-xs sm:text-sm font-black font-mono px-2.5 py-0.5 rounded-lg border flex items-center gap-1 shadow-md ${
                      (stock.rank ?? stock.qualification?.qualifiedRank) === 1
                        ? 'bg-amber-400 text-slate-950 border-amber-300 font-black shadow-amber-400/40'
                        : (stock.rank ?? stock.qualification?.qualifiedRank ?? 99) <= 3
                        ? 'bg-amber-400/25 text-amber-300 border-amber-400/60 font-bold'
                        : 'bg-slate-800 text-amber-300 border-amber-500/30'
                    }`}
                    title="ప్రస్తుత లైవ్ టెక్నికల్ ర్యాంక్"
                  >
                    <span>
                      {(stock.rank ?? stock.qualification?.qualifiedRank) === 1
                        ? '🥇'
                        : (stock.rank ?? stock.qualification?.qualifiedRank) === 2
                        ? '🥈'
                        : (stock.rank ?? stock.qualification?.qualifiedRank) === 3
                        ? '🥉'
                        : '📍'}
                    </span>
                    <span>ప్రస్తుత ర్యాంక్ #{stock.rank ?? stock.qualification?.qualifiedRank}</span>
                  </span>
                ) : (
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                    {signalStage === 'NO_TRADE' ? 'అన్‌ర్యాంక్డ్ (NO_TRADE)' : 'ర్యాంక్ లెక్కింపులో...'}
                  </span>
                )}
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  {sector}
                </span>
                <span
                  className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${
                    signalStage === 'STRONG_LONG'
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50'
                      : signalStage === 'PRE_BREAKOUT_WATCH'
                      ? 'bg-amber-500/20 text-amber-400 border-amber-500/50'
                      : signalStage === 'DIP_RECOVERY'
                      ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/50'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                >
                  {signalStage.replace(/_/g, ' ')}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                {name} {nameTe && <span className="text-slate-500">| {nameTe}</span>}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            <div className="text-right">
              {(!stock.isLiveSynced && isSyncingLiveQuote) ? (
                <div className="flex flex-col items-end gap-1">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-mono font-bold animate-pulse">
                    <RefreshCw className="w-3 h-3 animate-spin text-amber-400" />
                    లైవ్ ధర సింక్ అవుతోంది...
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">Real-time sync...</span>
                </div>
              ) : (
                <>
                  <div className="text-xl sm:text-2xl font-bold font-mono text-slate-100 flex items-center justify-end gap-1.5">
                    <span>₹{currentPrice.toFixed(2)}</span>
                    {stock.isLiveSynced && (
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title="100% లైవ్ వెరిఫైడ్ ధర" />
                    )}
                  </div>
                  <div
                    className={`text-xs font-semibold font-mono ${
                      isPositive ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {isPositive ? '+' : ''}{change} ({isPositive ? '+' : ''}{changePercent}%)
                  </div>
                </>
              )}
            </div>

            {/* Quick Full Screen Chart Launch Button in Header */}
            <button
              id="btn-header-fullscreen-chart"
              onClick={() => setIsFullscreenChart(true)}
              title="గ్రాఫ్‌ను పూర్తి స్క్రీన్‌లో చూడండి (Full Screen Chart View)"
              className="px-2.5 py-2 bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/60 text-emerald-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-emerald-950/40"
            >
              <Maximize2 className="w-4 h-4 text-emerald-400" />
              <span className="hidden sm:inline">ఫుల్ స్క్రీన్ చార్ట్</span>
            </button>

            <button
              id="btn-close-modal"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-xl transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Real-time Data Sync Status Banner */}
        {(!stock.isLiveSynced || isSyncingLiveQuote) ? (
          <div className="bg-amber-950/60 border-b border-amber-500/40 px-4 py-2 flex items-center justify-between text-xs text-amber-300">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
              <span className="font-bold">⚡ రియల్-టైమ్ NSE లైవ్ డేటా సింక్ అవుతోంది (100% లైవ్ ధర & ఇండికేటర్ల కాలిక్యులేషన్)...</span>
            </div>
            <span className="text-[11px] font-mono text-amber-400 bg-amber-900/60 px-2 py-0.5 rounded border border-amber-500/30">
              లైవ్ ప్రయారిటీ ఫెచ్
            </span>
          </div>
        ) : (
          <div className="bg-emerald-950/50 border-b border-emerald-500/30 px-4 py-1.5 flex items-center justify-between text-xs text-emerald-300">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-bold">🟢 100% లైవ్ NSE రియల్-టైమ్ డేటా వెరిఫై అయింది</span>
              {overallScore.totalScore >= 90 && (
                <span className="bg-amber-400/20 text-amber-300 px-2 py-0.5 rounded font-black border border-amber-400/40 text-[11px] flex items-center gap-1">
                  ⭐ 90+ ఎలైట్ టెక్నికల్ స్కోర్: {overallScore.totalScore}/100
                </span>
              )}
            </div>
            <div className="flex items-center gap-2.5">
              {stock.lastLiveSyncTime && (
                <span className="text-[10px] font-mono text-slate-400 hidden sm:inline">
                  చివరి సింక్: {new Date(stock.lastLiveSyncTime).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true })}
                </span>
              )}
              <button
                onClick={() => {
                  if (onRefreshLiveQuote) onRefreshLiveQuote();
                  fetchLiveCandlesData(symbol, selectedTimeframe);
                }}
                disabled={isLoadingCandles}
                className="px-2 py-0.5 rounded bg-emerald-900/80 hover:bg-emerald-800 text-emerald-200 border border-emerald-500/50 text-[11px] font-bold flex items-center gap-1 transition-all"
                title="తాజా మార్కెట్ కొటేషన్ మరియు క్యాండిల్స్ రీ-ఫెచ్ చేయండి"
              >
                <RefreshCw className={`w-3 h-3 ${isLoadingCandles ? 'animate-spin' : ''}`} />
                లైవ్ రీ-ఫెచ్ (Instant Sync)
              </button>
            </div>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 px-4 sm:px-5 py-2.5 border-b border-slate-800 bg-slate-900/90 overflow-x-auto text-xs font-semibold">
          <button
            onClick={() => setActiveTab('OVERVIEW')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
              activeTab === 'OVERVIEW'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            విశ్లేషణ & చార్ట్ (Overview & Chart)
          </button>
          <button
            id="tab-btn-rank-trend"
            onClick={() => setActiveTab('RANK_TREND')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
              activeTab === 'RANK_TREND'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 font-bold shadow-sm'
                : 'text-slate-400 hover:text-amber-300 hover:bg-slate-800'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
            ర్యాంక్ ప్రయాణం (Rank Journey)
            <span className="text-[10px] bg-amber-950 text-amber-300 px-1.5 py-0.2 rounded font-mono border border-amber-700/50">
              NEW
            </span>
          </button>
          <button
            onClick={() => setActiveTab('ORDER_BOOK')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
              activeTab === 'ORDER_BOOK'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold shadow-sm'
                : 'text-slate-400 hover:text-cyan-300 hover:bg-slate-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            ఆర్డర్ బుక్ (Order Book 5/15/1H)
            <span className="text-[10px] bg-cyan-950 text-cyan-300 px-1.5 py-0.2 rounded font-mono border border-cyan-700/50">
              NEW
            </span>
          </button>
          <button
            onClick={() => setActiveTab('PIVOTS')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
              activeTab === 'PIVOTS'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            పివోట్ పాయింట్లు (Pivot Points)
          </button>
          <button
            onClick={() => setActiveTab('SCORE_BREAKDOWN')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
              activeTab === 'SCORE_BREAKDOWN'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Award className="w-3.5 h-3.5" />
            100-పాయింట్ స్కోర్ వివరాలు (Score Breakdown)
          </button>
          <button
            onClick={() => setActiveTab('CALCULATOR')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
              activeTab === 'CALCULATOR'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Calculator className="w-3.5 h-3.5" />
            పొజిషన్ కాలిక్యులేటర్ (Position Calculator)
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-5">
          {activeTab === 'OVERVIEW' && (
            <>
              {/* System Deep Root-Cause Diagnostic & Auto-Remedy Section (User Mandate) */}
              {stock.diagnosticAnalysis && (
                <div
                  id={`diagnostic-analysis-banner-${symbol.toLowerCase()}`}
                  className="bg-gradient-to-r from-amber-950/80 via-slate-900 to-slate-950 border-2 border-amber-500/60 rounded-2xl p-4 sm:p-5 shadow-2xl shadow-amber-950/40 space-y-3.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-500/30 pb-3">
                    <div className="flex items-center gap-2.5">
                      <span className="p-1.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40">
                        <ShieldAlert className="w-5 h-5 text-amber-400" />
                      </span>
                      <div>
                        <h4 className="text-sm font-bold text-amber-300 tracking-wide font-mono flex items-center gap-2">
                          <span>సిస్టమ్ డీప్ ఆటో-డయాగ్నోస్టిక్ ఎనాలసిస్</span>
                          <span className="text-[10px] bg-amber-400 text-slate-950 font-black px-2 py-0.2 rounded font-sans">
                            రూట్-కాజ్ ఆడిట్
                          </span>
                        </h4>
                        <p className="text-xs text-slate-400">
                          90+ స్కోర్ స్టాక్‌ను సిస్టమ్ ముందుగా ఎందుకు గుర్తించలేదో సమగ్ర విశ్లేషణ & తక్షణ నివారణ చర్యలు
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] font-mono text-amber-300 bg-amber-900/60 px-2.5 py-1 rounded-lg border border-amber-500/40 font-bold">
                        1-Day Ephemeral (నేటి సెషన్‌కు మాత్రమే)
                      </span>
                      <span className="text-[11px] font-mono text-emerald-400 bg-slate-900 px-2 py-1 rounded border border-emerald-500/30">
                        🕒 గుర్తించిన సమయం: <strong>{stock.diagnosticAnalysis.identifiedAt}</strong>
                      </span>
                      <span className="text-[11px] font-mono text-amber-300 bg-slate-900 px-2 py-1 rounded border border-amber-500/30 font-bold">
                        🎯 ఆ సమయంలో ర్యాంక్: <strong>{stock.diagnosticAnalysis.identifiedRank ? `#${stock.diagnosticAnalysis.identifiedRank}` : 'అన్‌ర్యాంక్డ్ (ఫిల్టర్ చేయబడింది)'}</strong>
                      </span>
                      <span className="text-[11px] font-mono text-cyan-300 bg-slate-900 px-2 py-1 rounded border border-cyan-500/30 font-bold">
                        📍 ప్రస్తుత ర్యాంక్: <strong>{stock.rank ? `#${stock.rank}` : 'NO_TRADE'}</strong>
                      </span>
                    </div>
                  </div>

                  {/* Delay Reason */}
                  <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 space-y-1">
                    <span className="text-[11px] font-black uppercase text-amber-400 font-mono tracking-wider block">
                      ముందుగా స్కానర్‌లో రాకపోవడానికి సాంకేతిక కారణం (Root Cause):
                    </span>
                    <p className="text-xs text-slate-200 leading-relaxed">
                      {stock.diagnosticAnalysis.delayReasonTe}
                    </p>
                  </div>

                  {/* Remedial Actions Taken */}
                  <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-xl p-3 space-y-1.5">
                    <div className="text-[11px] font-bold text-emerald-400 flex items-center gap-1.5 font-mono">
                      <CheckCircle className="w-4 h-4 text-emerald-400" />
                      <span>భవిష్యత్తులో పొరపాటు జరగకుండా సిస్టమ్ తీసుకున్న శాశ్వత నివారణ చర్యలు:</span>
                    </div>
                    <ul className="text-xs text-slate-300 space-y-1 pl-4 list-disc marker:text-emerald-400">
                      {stock.diagnosticAnalysis.remedialActionsTe.map((action, i) => (
                        <li key={i} className="text-emerald-300/90 font-medium">
                          {action}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* 1-Day Expiry Guarantee Notice */}
                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 bg-slate-900/60 px-3 py-1.5 rounded-lg border border-slate-800">
                    <span className="text-slate-400">
                      🛡️ <strong>లైఫ్‌సైకిల్ రక్షణ:</strong> శాశ్వత ఫేవరెట్‌గా సేవ్ అవ్వదు; నేటి సెషన్ ముగియగానే లేదా రేపటి రోజున సిస్టమ్ నుండి ఆటోమేటిక్‌గా క్లియర్ అవుతుంది.
                    </span>
                    <span className="text-amber-400 font-bold">
                      ఎక్స్‌పైరీ: నేటి అర్ధరాత్రి ({stock.diagnosticAnalysis.sessionExpiryDate})
                    </span>
                  </div>
                </div>
              )}
              {/* Qualification Timestamp & Audit Banner */}
              {stock.qualification && (
                <div
                  id={`qualification-audit-banner-${symbol.toLowerCase()}`}
                  className="bg-gradient-to-r from-emerald-950/70 via-slate-900 to-slate-950 border-2 border-emerald-500/50 rounded-2xl p-4 shadow-xl shadow-emerald-950/30 flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-400"></span>
                      </span>
                      <h4 className="text-sm font-black text-emerald-300 tracking-wide uppercase font-mono">
                        అధికారిక టెక్నికల్ క్వాలిఫికేషన్ ఆడిట్ (Official Qualification Audit)
                      </h4>
                      <span className="text-[10px] bg-emerald-400/20 text-emerald-300 font-mono px-2 py-0.5 rounded-full border border-emerald-500/30">
                        VERIFIED
                      </span>
                    </div>
                    <div className="text-xs text-slate-300 flex items-center gap-2 flex-wrap">
                      <span>ట్రిగ్గర్ రీజన్: <strong className="text-white">{stock.qualification.triggerConditionTe}</strong></span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap pt-1">
                      {stock.qualification.keyDrivers.map((driver, idx) => (
                        <span key={idx} className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-900 text-emerald-300 border border-emerald-500/30">
                          {driver}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 bg-slate-900/90 border border-emerald-500/40 px-3.5 py-2.5 rounded-xl font-mono shrink-0 flex-wrap sm:flex-nowrap">
                    <div>
                      <div className="text-[10px] uppercase text-slate-400 font-bold">క్వాలిఫై సమయం (IST)</div>
                      <div className="text-base font-black text-emerald-400">{formatISTMarketTime(stock.qualification.qualifiedTime)}</div>
                    </div>
                    <div className="w-px h-8 bg-slate-700 hidden sm:block" />
                    <div>
                      <div className="text-[10px] uppercase text-emerald-400 font-bold">🎯 క్వాలిఫై సమయం ర్యాంక్</div>
                      <div className="text-base font-black text-emerald-300">#{stock.qualification.qualifiedRank ?? '—'}</div>
                    </div>
                    <div className="w-px h-8 bg-slate-700 hidden sm:block" />
                    <div>
                      <div className="text-[10px] uppercase text-amber-400 font-bold">📍 ప్రస్తుత ర్యాంక్</div>
                      <div className="text-base font-black text-amber-300">#{stock.rank ?? '—'}</div>
                    </div>
                    <div className="w-px h-8 bg-slate-700 hidden sm:block" />
                    <div>
                      <div className="text-[10px] uppercase text-slate-400 font-bold">ఎంట్రీ ధర</div>
                      <div className="text-base font-black text-white">₹{stock.qualification.qualifiedPrice.toFixed(2)}</div>
                    </div>
                    <div className="w-px h-8 bg-slate-700 hidden sm:block" />
                    <div>
                      <div className="text-[10px] uppercase text-slate-400 font-bold">స్కోర్</div>
                      <div className="text-base font-black text-cyan-300">{stock.qualification.qualifiedScore.toFixed(1)}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Data-Scientist Situational Intelligence & Archetype Engine Panel */}
              {stock.situationalIntelligence && (
                <div className="bg-gradient-to-r from-indigo-950/60 via-slate-900/90 to-cyan-950/50 border border-indigo-500/40 rounded-2xl p-4 shadow-lg space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-lg bg-indigo-500/20 border border-indigo-400/40 text-indigo-300 text-xs font-black font-mono">
                        🧠 DATA-SCIENTIST SITUATIONAL ENGINE
                      </span>
                      <span className="text-sm font-black text-white">
                        {stock.situationalIntelligence.archetypeNameTe}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-mono">
                      <span className="px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 font-bold">
                        ఇగ్నిషన్: {formatISTMarketTime(stock.situationalIntelligence.ignitionTime)} @ ₹{stock.situationalIntelligence.ignitionPrice.toFixed(2)} ({stock.situationalIntelligence.ignitionBarRvol}x)
                      </span>
                      <span className="px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 font-bold">
                        5D vs నేడు వాల్యూమ్: {stock.situationalIntelligence.fiveDayToTodayVolMultiple}x
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-200 leading-relaxed bg-slate-950/60 border border-slate-800/80 rounded-xl p-2.5">
                    <strong className="text-cyan-300">మార్కెట్ ట్రాజెక్టరీ అంచనా: </strong>
                    {stock.situationalIntelligence.predictedTrajectoryTe}
                  </p>

                  {stock.situationalIntelligence.situationalAdaptationsTe.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="text-[11px] font-bold text-indigo-300 uppercase tracking-wider">
                        ఇంటెలిజెంట్ రూల్ ఆప్టిమైజేషన్స్ (Situational Calibrations Applied):
                      </div>
                      <div className="grid grid-cols-1 gap-1.5">
                        {stock.situationalIntelligence.situationalAdaptationsTe.map((item, idx) => (
                          <div
                            key={idx}
                            className="text-xs text-slate-200 bg-indigo-950/40 border border-indigo-500/30 rounded-lg px-3 py-1.5 leading-relaxed"
                          >
                            {item}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Candlestick Chart (Top-level focus, unobstructed) */}
              <div id={`section-chart-${symbol}`} className="w-full">
                <CandleChart
                  candles={activeCandles}
                  timeframe={selectedTimeframe}
                  onTimeframeChange={onTimeframeChange}
                  pivots={pivots}
                  tradePlan={tradePlan}
                  symbol={symbol}
                  currentPrice={currentPrice}
                  change={change}
                  changePercent={changePercent}
                  isFullscreen={isFullscreenChart}
                  onToggleFullscreen={() => setIsFullscreenChart((prev) => !prev)}
                />
              </div>

              {/* Historical Intraday Rank Progression Journey Component */}
              <div id={`section-rank-trend-overview-${symbol}`} className="w-full">
                <RankTrendChart
                  stock={stock}
                  onHover={(point) => setHoveredRankPoint(point)}
                  showSummaryCards={true}
                />
              </div>

              {/* Stock Performance & Real Volume Section BELOW the Graph */}
              <div
                id={`section-stock-performance-${symbol}`}
                className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4"
              >
                {/* Live Feed Header & Sync Status */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-950/90 text-emerald-400 border border-emerald-700/60 text-xs font-bold font-mono">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      NSE LIVE FEED
                    </span>
                    <h3 className="text-sm font-bold text-slate-200">
                      స్టాక్ పెర్ఫార్మెన్స్ & వాల్యూమ్ విశ్లేషణ (Performance & Volume Analytics)
                    </h3>
                  </div>

                  <div className="flex items-center gap-3">
                    {isLoadingCandles ? (
                      <span className="text-xs text-slate-400 flex items-center gap-1 font-mono">
                        <RefreshCw className="w-3 h-3 animate-spin text-emerald-400" />
                        లైవ్ డేటా లోడ్ అవుతోంది...
                      </span>
                    ) : (
                      <span className="text-xs text-emerald-400/90 font-mono">
                        ✓ అధికారిక NSE ఫీడ్ సింక్ అయింది ({liveCandles?.length || activeCandles.length} బార్స్)
                      </span>
                    )}
                    <button
                      onClick={() => fetchLiveCandlesData(symbol, selectedTimeframe)}
                      disabled={isLoadingCandles}
                      className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-850 hover:bg-slate-750 text-slate-200 rounded-lg border border-slate-700 text-xs font-semibold transition-colors disabled:opacity-50 shadow-sm"
                      title="రీ-ఫెచ్ NSE డేటా"
                    >
                      <RefreshCw className={`w-3 h-3 ${isLoadingCandles ? 'animate-spin' : ''}`} />
                      రిఫ్రెష్
                    </button>
                  </div>
                </div>

                {/* Day Range and 52W Range Sliders */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Today's Range */}
                  <div className="bg-slate-900/90 p-3.5 rounded-xl border border-slate-800">
                    <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                      <span className="font-semibold text-slate-300">నేటి ధర శ్రేణి (Today's Range)</span>
                      <span className="font-mono text-slate-400">
                        స్ప్రెడ్: ₹{(dayHigh - dayLow).toFixed(2)} ({(((dayHigh - dayLow) / Math.max(1, dayLow)) * 100).toFixed(1)}%)
                      </span>
                    </div>
                    <div className="relative pt-4 pb-1">
                      {/* Price pointer indicator */}
                      <div
                        className="absolute top-0 -translate-x-1/2 flex flex-col items-center transition-all duration-300"
                        style={{ left: `${todayPct}%` }}
                      >
                        <span className="text-[10px] font-mono font-black text-emerald-400 bg-slate-950 px-1.5 py-0.5 rounded border border-emerald-500/50 whitespace-nowrap shadow">
                          LTP ₹{currentPrice.toFixed(2)}
                        </span>
                        <span className="w-0 h-0 border-l-[3px] border-l-transparent border-r-[3px] border-r-transparent border-t-[4px] border-t-emerald-400" />
                      </div>
                      {/* Bar */}
                      <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden flex">
                        <div
                          className="h-full bg-gradient-to-r from-rose-500 via-amber-400 to-emerald-400 rounded-full"
                          style={{ width: '100%' }}
                        />
                      </div>
                      <div className="flex items-center justify-between mt-1.5 text-xs font-mono">
                        <div className="text-left">
                          <span className="text-[10px] text-slate-400 block">Day Low</span>
                          <span className="font-bold text-rose-400">₹{dayLow.toFixed(2)}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 block">Day High</span>
                          <span className="font-bold text-emerald-400">₹{dayHigh.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 52-Week Range */}
                  <div className="bg-slate-900/90 p-3.5 rounded-xl border border-slate-800">
                    <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                      <span className="font-semibold text-slate-300">52-వారాల శ్రేణి (52-Week Range)</span>
                      {fiftyTwoWHigh && fiftyTwoWLow && (
                        <span className="font-mono text-slate-400">
                          గరిష్ట స్థాయి నుండి {((Number(fiftyTwoWHigh) - currentPrice) / Number(fiftyTwoWHigh) * 100).toFixed(1)}% క్రింద
                        </span>
                      )}
                    </div>
                    <div className="relative pt-4 pb-1">
                      {/* Price pointer indicator */}
                      <div
                        className="absolute top-0 -translate-x-1/2 flex flex-col items-center transition-all duration-300"
                        style={{ left: `${fiftyTwoPct}%` }}
                      >
                        <span className="text-[10px] font-mono font-black text-cyan-400 bg-slate-950 px-1.5 py-0.5 rounded border border-cyan-500/50 whitespace-nowrap shadow">
                          ₹{currentPrice.toFixed(2)}
                        </span>
                        <span className="w-0 h-0 border-l-[3px] border-l-transparent border-r-[3px] border-r-transparent border-t-[4px] border-t-cyan-400" />
                      </div>
                      {/* Bar */}
                      <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden flex">
                        <div
                          className="h-full bg-gradient-to-r from-slate-600 via-cyan-500 to-emerald-400 rounded-full"
                          style={{ width: '100%' }}
                        />
                      </div>
                      <div className="flex items-center justify-between mt-1.5 text-xs font-mono">
                        <div className="text-left">
                          <span className="text-[10px] text-slate-400 block">52W Low</span>
                          <span className="font-bold text-slate-300">₹{fiftyTwoWLow ? Number(fiftyTwoWLow).toFixed(2) : '-'}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 block">52W High</span>
                          <span className="font-bold text-slate-300">₹{fiftyTwoWHigh ? Number(fiftyTwoWHigh).toFixed(2) : '-'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 6 Key Accurate Volume & Fundamentals Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-1">
                  {/* Total Traded Volume */}
                  <div className="bg-slate-900/95 p-3 rounded-xl border border-slate-800">
                    <div className="text-[11px] text-slate-400">మొత్తం వాల్యూమ్ (Volume)</div>
                    <div className="text-base sm:text-lg font-black font-mono text-slate-100 mt-1">
                      {actualVolume.toLocaleString('en-IN')}
                    </div>
                    <div className="text-[11px] font-semibold text-emerald-400 font-mono mt-0.5">
                      {formatIndianVolume(actualVolume)} షేర్లు
                    </div>
                  </div>

                  {/* Relative Volume (RVOL) */}
                  <div className="bg-slate-900/95 p-3 rounded-xl border border-amber-500/40">
                    <div className="text-[11px] text-amber-300">సెషన్ RVOL (3M ADV ఆధారితం)</div>
                    <div className="text-base sm:text-lg font-black font-mono text-amber-400 mt-1">
                      {actualSessionRvol}×
                    </div>
                    <div className="text-[10px] font-bold font-mono mt-0.5 text-amber-300/90">
                      {actualSessionRvol >= 5.0
                        ? `🔥 అసాధారణ భారీ సర్జ్ (${actualSessionRvol}×)`
                        : actualSessionRvol >= 2.0
                        ? '🔥 భారీ ఇన్‌స్టిట్యూషనల్ సర్జ్'
                        : actualSessionRvol >= 1.2
                        ? '⚡ హై వాల్యూమ్ పార్టిసిపేషన్'
                        : 'సగటు స్థాయి వాల్యూమ్'}
                    </div>
                    <div className="text-[9px] text-slate-400 font-mono mt-0.5">
                      ఫుల్ డే RVOL: {actualFullDayRvol}×
                    </div>
                  </div>

                  {/* 3-Month Average Daily Volume (ADV) */}
                  <div className="bg-slate-900/95 p-3 rounded-xl border border-slate-800">
                    <div className="text-[11px] text-slate-400">3-నెలల సగటు వాల్యూమ్ (3M ADV)</div>
                    <div className="text-base sm:text-lg font-black font-mono text-cyan-400 mt-1">
                      {actualAdv.toLocaleString('en-IN')}
                    </div>
                    <div className="text-[11px] font-semibold text-slate-300 font-mono mt-0.5">
                      ~{formatAdvShort(actualAdv)} సాధారణ యావరేజ్
                    </div>
                  </div>

                  {/* Open & Prev Close */}
                  <div className="bg-slate-900/95 p-3 rounded-xl border border-slate-800">
                    <div className="text-[11px] text-slate-400">ఓపెన్ & గత ముగింపు</div>
                    <div className="text-sm font-bold font-mono text-slate-200 mt-1">
                      ఓపెన్: <span className="text-slate-100">₹{dayOpen.toFixed(2)}</span>
                    </div>
                    <div className="text-xs font-mono text-slate-400 mt-0.5">
                      క్లోజ్: <span className="text-slate-300">₹{prevClose.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* CVD Cumulative Volume Delta */}
                  <div className="bg-slate-900/95 p-3 rounded-xl border border-slate-800">
                    <div className="text-[11px] text-slate-400">CVD నెట్ డెల్టా (Order Flow)</div>
                    <div
                      className={`text-base sm:text-lg font-black font-mono mt-1 ${
                        cvd >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {cvd >= 0 ? '+' : ''}{cvd.toLocaleString('en-IN')}
                    </div>
                    <div className="text-[10px] font-mono text-slate-300 mt-0.5">
                      {cvd >= 0 ? '🟢 దూకుడుగా కొనుగోళ్లు' : '🔴 అమ్మకాల ఒత్తిడి'}
                    </div>
                  </div>

                  {/* Single Candle Bar RVOL & Delta */}
                  <div className="bg-slate-900/95 p-3 rounded-xl border border-slate-800">
                    <div className="text-[11px] text-slate-400">తాజా క్యాండిల్ వివరాలు ({selectedTimeframe})</div>
                    <div className="text-sm font-bold font-mono text-slate-200 mt-1">
                      RVOL: <span className="text-emerald-400">{stock.barRvol ?? rvol}×</span>
                    </div>
                    <div className="text-[11px] font-mono text-slate-400 mt-0.5 truncate">
                      వాల్యూమ్: {activeCandles[activeCandles.length - 1]?.volume?.toLocaleString('en-IN') || '-'}
                    </div>
                  </div>

                  {/* Candle Counts (Green / Red / Doji) & Dynamic Regime Penalty (User Mandate) */}
                  <div className={`p-3 rounded-xl border ${stock.isExcessiveRedCandles ? 'bg-rose-950/40 border-rose-600/70' : 'bg-slate-900/95 border-slate-800'}`}>
                    <div className="flex items-center justify-between text-[11px] text-slate-300">
                      <span>5M క్యాండిల్స్ (గ్రీన్ vs రెడ్ లెక్కింపు)</span>
                      <span className="text-[10px] text-slate-400 font-mono">మొత్తం: {stock.totalCandlesCount || stock.candles5M?.length || 0}</span>
                    </div>
                    <div className="text-xs sm:text-sm font-black font-mono mt-1 flex items-center gap-1.5 flex-wrap">
                      <span className="text-emerald-400" title={`గ్రీన్ క్యాండిల్స్: ${stock.greenCandlesCount ?? '-'}`}>
                        🟢 {stock.greenCandlesCount !== undefined ? `${stock.greenCandlesCount} (${stock.greenCandlePercent}%)` : '-'}
                      </span>
                      <span className="text-slate-500">|</span>
                      <span className={stock.isExcessiveRedCandles ? 'text-rose-400 font-bold' : 'text-slate-300'} title={`రెడ్ క్యాండిల్స్: ${stock.redCandlesCount ?? '-'}`}>
                        🔴 {stock.redCandlesCount !== undefined ? `${stock.redCandlesCount} (${stock.redCandlePercent}%)` : `${stock.redCandlePercent}%`}
                      </span>
                      {stock.dojiCandlesCount ? (
                        <>
                          <span className="text-slate-500">|</span>
                          <span className="text-slate-400 font-medium text-[11px]" title={`ఫ్లాట్ / డోజీ: ${stock.dojiCandlesCount}`}>⚪ {stock.dojiCandlesCount} Doji</span>
                        </>
                      ) : null}
                    </div>
                    <div className="text-[10px] font-mono mt-1.5 flex items-center justify-between">
                      <span className="text-slate-400">
                        పరిమితి: <strong>{stock.activeRedThreshold ?? 40}%</strong> ({stock.marketRegime === 'BULLISH' ? 'బుల్లిష్ 30%' : stock.marketRegime === 'BEARISH' ? 'బేరిష్ 50%' : 'న్యూట్రల్ 40%'})
                      </span>
                      {stock.isExcessiveRedCandles ? (
                        <span className="text-rose-400 font-bold bg-rose-950/80 px-1.5 py-0.5 rounded border border-rose-700/60">
                          వెయిటేజ్ తగ్గింపు: -{stock.redPenaltyPoints ?? stock.penaltyPoints ?? 0} pts
                        </span>
                      ) : (
                        <span className="text-emerald-400 font-semibold bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-700/40">
                          పరిమితి లోపల (సేఫ్ ✓)
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Metrics Ribbon */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2.5">
                <div className="bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/60">
                  <div className="text-[11px] text-slate-400">Total Score</div>
                  {(!stock.isLiveSynced && isSyncingLiveQuote) ? (
                    <div className="text-xs font-bold font-mono text-amber-400 flex items-center gap-1 mt-1 animate-pulse">
                      <RefreshCw className="w-3 h-3 animate-spin text-amber-400" />
                      సింక్ అవుతోంది...
                    </div>
                  ) : (
                    <div className={`text-lg font-black font-mono ${overallScore.totalScore >= 90 ? 'text-amber-400 flex items-center gap-1' : overallScore.totalScore >= 80 ? 'text-emerald-400' : 'text-slate-200'}`}>
                      {overallScore.totalScore >= 90 && <span>⭐</span>}
                      {overallScore.totalScore} / 100
                    </div>
                  )}
                </div>

                <div className="bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/60">
                  <div className="text-[11px] text-slate-400">20M Persistence</div>
                  <div className="text-lg font-black font-mono text-emerald-400">
                    {persistenceScore.persistencePercent}% ({persistenceScore.persistenceLevel})
                  </div>
                </div>

                <div className="bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/60">
                  <div className="text-[11px] text-slate-400">VWAP & Status</div>
                  <div className="text-sm font-bold font-mono text-purple-400 mt-1">
                    ₹{vwap} ({stock.priceVsVWAP})
                  </div>
                </div>

                <div className="bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/60">
                  <div className="text-[11px] text-slate-400">EMA 9 / 21</div>
                  <div className="text-sm font-bold font-mono text-cyan-400 mt-1">
                    ₹{ema9} / ₹{ema21}
                  </div>
                </div>

                <div className="bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/60">
                  <div className="text-[11px] text-slate-400">Buyers / Sellers</div>
                  <div className="text-sm font-bold font-mono text-slate-200 mt-1">
                    <span className="text-emerald-400">{buyerPressurePercent}%</span> /{' '}
                    <span className="text-rose-400">{sellerPressurePercent}%</span>
                  </div>
                </div>

                <div className="bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/60">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>RVOL & CVD</span>
                    <span
                      className={`text-[9px] px-1 rounded font-bold font-mono ${
                        rvol >= 1.5
                          ? 'bg-amber-950 text-amber-300 border border-amber-500/40'
                          : rvol >= 1.0
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                          : 'bg-slate-900 text-slate-400'
                      }`}
                    >
                      {rvol >= 2 ? 'SURGE 🔥' : rvol >= 1.2 ? 'HIGH' : 'NORMAL'}
                    </span>
                  </div>
                  <div className="text-sm font-bold font-mono text-amber-400 mt-1 flex items-baseline justify-between">
                    <span>{rvol}× RVOL</span>
                    <span
                      className={
                        stock.cvdTrend === 'RISING'
                          ? 'text-emerald-400'
                          : stock.cvdTrend === 'FALLING'
                          ? 'text-rose-400'
                          : 'text-slate-300'
                      }
                    >
                      Δ {cvd > 0 ? '+' : ''}{cvd.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono mt-0.5 flex justify-between">
                    <span>Bar: {stock.barRvol ?? rvol}×</span>
                    <span>
                      {stock.cvdDivergence === 'BULLISH_DIVERGENCE'
                        ? '🟢 అక్యుములేషన్'
                        : stock.cvdDivergence === 'BEARISH_DIVERGENCE'
                        ? '🔴 అబ్జార్ప్షన్'
                        : stock.cvdTrend === 'RISING'
                        ? '📈 బయ్యర్ మొమెంటం'
                        : stock.cvdTrend === 'FALLING'
                        ? '📉 సెల్లర్ ప్రెజర్'
                        : '⚖️ న్యూట్రల్'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Actionable Trade Plan Bar */}
              <div className="bg-gradient-to-r from-slate-900 to-slate-950 p-4 rounded-xl border border-emerald-500/30">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                    <Zap className="w-4 h-4 text-emerald-400" />
                    యాక్షన్ ప్లాన్ (Actionable Trade Plan)
                  </h3>
                  <div className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-700/50">
                    R:R = 1 : {tradePlan.riskRewardRatio}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <div className="bg-slate-850 p-2.5 rounded-lg border border-slate-700">
                    <div className="text-[10px] text-slate-400 uppercase">Entry Price</div>
                    <div className="text-base font-black font-mono text-emerald-400">
                      ₹{tradePlan.entryPrice}
                    </div>
                  </div>

                  <div className="bg-slate-850 p-2.5 rounded-lg border border-slate-700">
                    <div className="text-[10px] text-slate-400 uppercase">Stop Loss (SL)</div>
                    <div className="text-base font-black font-mono text-rose-400">
                      ₹{tradePlan.stopLoss}
                    </div>
                  </div>

                  <div className="bg-slate-850 p-2.5 rounded-lg border border-slate-700">
                    <div className="text-[10px] text-slate-400 uppercase">Target 1 (1:1.5)</div>
                    <div className="text-base font-black font-mono text-emerald-300">
                      ₹{tradePlan.target1}
                    </div>
                  </div>

                  <div className="bg-slate-850 p-2.5 rounded-lg border border-slate-700">
                    <div className="text-[10px] text-slate-400 uppercase">Target 2 (1:2.5)</div>
                    <div className="text-base font-black font-mono text-cyan-300">
                      ₹{tradePlan.target2}
                    </div>
                  </div>

                  <div className="bg-slate-850 p-2.5 rounded-lg border border-slate-700">
                    <div className="text-[10px] text-slate-400 uppercase">Target 3 (1:3.5)</div>
                    <div className="text-base font-black font-mono text-amber-300">
                      ₹{tradePlan.target3}
                    </div>
                  </div>
                </div>

                <div className="mt-3 text-xs text-slate-400 flex items-center justify-between border-t border-slate-800 pt-2">
                  <span>
                    Breakout Room to R1: <strong className="text-slate-200">{tradePlan.breakoutRoomPips} pts ({tradePlan.roomRatio}× ATR)</strong>
                  </span>
                  <span className="text-emerald-400 font-semibold">
                    {tradePlan.breakoutRoomStatus === 'BLOCKED' ? '⚠️ High Clamp Risk' : '🟢 Ample Room Available'}
                  </span>
                </div>
              </div>

              {/* Strengths & Weaknesses (బలాలు & బలహీనతలు) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Strengths */}
                <div className="bg-slate-850/60 p-4 rounded-xl border border-emerald-950/60">
                  <div className="flex items-center gap-2 text-sm font-bold text-emerald-400 mb-3">
                    <CheckCircle className="w-4 h-4" />
                    టెక్నికల్ బలాలు (Technical Strengths)
                  </div>
                  <ul className="space-y-2 text-xs">
                    {strengths.map((str, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-slate-300">
                        <span className="text-emerald-400 mt-0.5">•</span>
                        <div>
                          <div>{str}</div>
                          {strengthsTe[idx] && (
                            <div className="text-slate-400 text-[11px]">{strengthsTe[idx]}</div>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Weaknesses / Warnings */}
                <div className="bg-slate-850/60 p-4 rounded-xl border border-rose-950/60">
                  <div className="flex items-center gap-2 text-sm font-bold text-rose-400 mb-3">
                    <ShieldAlert className="w-4 h-4" />
                    హెచ్చరికలు & బలహీనతలు (Weaknesses / Traps)
                  </div>
                  {weaknesses.length === 0 ? (
                    <div className="text-xs text-slate-400 italic py-2">
                      No major technical weakness detected. Market structure is clear.
                    </div>
                  ) : (
                    <ul className="space-y-2 text-xs">
                      {weaknesses.map((w, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-slate-300">
                          <span className="text-rose-400 mt-0.5">•</span>
                          <div>
                            <div>{w}</div>
                            {weaknessesTe[idx] && (
                              <div className="text-slate-400 text-[11px]">{weaknessesTe[idx]}</div>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {/* Hard Filter Verification Status */}
              <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    హార్డ్ ఫిల్టర్ల తనిఖీ (Hard Filter Verification)
                  </h4>
                  {hardFilters.hasHardFilterBlock ? (
                    <span className="px-2 py-0.5 rounded bg-rose-950 text-rose-400 border border-rose-800 text-xs font-bold">
                      BLOCKED
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 text-xs font-bold">
                      ALL PASS
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs">
                  <div className={`p-2 rounded border ${hardFilters.is15MBearish ? 'bg-rose-950/50 border-rose-800 text-rose-300' : 'bg-slate-800/40 border-slate-700/60 text-slate-300'}`}>
                    15M Trend: <strong>{hardFilters.is15MBearish ? 'Fail (Bearish)' : 'Pass'}</strong>
                  </div>
                  <div className={`p-2 rounded border ${hardFilters.isBelowVWAP ? 'bg-rose-950/50 border-rose-800 text-rose-300' : 'bg-slate-800/40 border-slate-700/60 text-slate-300'}`}>
                    Price vs VWAP: <strong>{hardFilters.isBelowVWAP ? 'Fail (Below)' : 'Pass (Above)'}</strong>
                  </div>
                  <div className={`p-2 rounded border ${hardFilters.isEMA9Below21 ? 'bg-rose-950/50 border-rose-800 text-rose-300' : 'bg-slate-800/40 border-slate-700/60 text-slate-300'}`}>
                    EMA 9/21: <strong>{hardFilters.isEMA9Below21 ? 'Fail (Crossed Down)' : 'Pass (9 > 21)'}</strong>
                  </div>
                  <div className={`p-2 rounded border ${hardFilters.isResistanceTooClose ? 'bg-rose-950/50 border-rose-800 text-rose-300' : 'bg-slate-800/40 border-slate-700/60 text-slate-300'}`}>
                    Resistance Room: <strong>{hardFilters.isResistanceTooClose ? 'Blocked (<0.6 ATR)' : 'Pass'}</strong>
                  </div>
                  <div className={`p-2 rounded border ${hardFilters.isExcessiveRedCandles ? 'bg-rose-950/50 border-rose-800 text-rose-300' : 'bg-slate-800/40 border-slate-700/60 text-slate-300'}`}>
                    రెడ్ క్యాండిల్స్: <strong>{hardFilters.isExcessiveRedCandles ? `Fail (${stock.redCandlePercent}% > ${hardFilters.activeRedThreshold ?? 40}%)` : `Pass (${stock.redCandlePercent || 0}% <= ${hardFilters.activeRedThreshold ?? 40}%)`}</strong>
                  </div>
                  <div className={`p-2 rounded border ${hardFilters.isHyperVolatileSpike ? 'bg-rose-950/50 border-rose-800 text-rose-300' : 'bg-slate-800/40 border-slate-700/60 text-slate-300'}`}>
                    వాలటాలిటీ స్పైక్: <strong>{hardFilters.isHyperVolatileSpike ? 'Fail (Spike Trap)' : 'Pass (Safe)'}</strong>
                  </div>
                </div>
              </div>

              {/* Order Book Section in Overview for quick access */}
              <div className="pt-2">
                <OrderBook
                  symbol={symbol}
                  currentPrice={currentPrice}
                  prevClose={prevClose}
                  dayHigh={dayHigh}
                  dayLow={dayLow}
                  buyerPressurePercent={buyerPressurePercent}
                  pivots={pivots}
                  vwap={vwap}
                  avgVolume={stock.avgVolume}
                  initialTimeframe={selectedTimeframe}
                />
              </div>
            </>
          )}

          {/* Dedicated Intraday Rank Journey Tab */}
          {activeTab === 'RANK_TREND' && (
            <div className="space-y-5 animate-fadeIn">
              {/* Full-Feature Rank Trend Chart */}
              <RankTrendChart
                stock={stock}
                onHover={(point) => setHoveredRankPoint(point)}
                height={340}
                showSummaryCards={true}
              />

              {/* In-depth Intraday Rank Journey Explanation & Milestones */}
              <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-amber-400/20 text-amber-300">
                      <Award className="w-4 h-4 text-amber-400" />
                    </span>
                    <h3 className="text-sm font-bold text-slate-100 font-mono">
                      ర్యాంక్ పురోగతి విశ్లేషణ & సాంకేతిక మైలురాళ్ళు (Rank Progression Milestones)
                    </h3>
                  </div>
                  <span className="text-xs text-slate-400 font-mono">
                    NSE ట్రేడింగ్ సెషన్: 09:15 AM - 03:30 PM
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Phase 1: Open */}
                  <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-300 font-mono">1. సెషన్ ప్రారంభం (09:15 AM)</span>
                      <span className="text-xs font-mono font-bold text-slate-400">ప్రారంభ దశ</span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      మార్కెట్ ఓపెనింగ్ సమయంలో ప్రారంభ 5-నిమిషాల క్యాండిల్ ఆధారంగా వాల్యూమ్ మరియు మూవింగ్ యావరేజెస్ చెక్ చేయబడ్డాయి.
                    </p>
                    <div className="text-[11px] font-mono text-slate-400 bg-slate-950/60 p-2 rounded border border-slate-800/80">
                      ధర: ₹{dayOpen ? dayOpen.toFixed(2) : currentPrice.toFixed(2)} | స్థితి: {stock.signalStage === 'NO_TRADE' ? 'ఫిల్టర్ చేయబడింది' : 'వాచ్‌లిస్ట్‌లో చేరిక'}
                    </div>
                  </div>

                  {/* Phase 2: Peak / Qualification */}
                  <div className="bg-emerald-950/30 border border-emerald-500/40 rounded-xl p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-emerald-300 font-mono">2. క్వాలిఫై సమయం ర్యాంక్ (Qualification)</span>
                      <span className="text-xs font-mono font-black text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-500/40">
                        {stock.qualification
                          ? `🎯 క్వాలిఫై ర్యాంక్ #${stock.qualification.qualifiedRank ?? '—'}`
                          : 'ఇంకా క్వాలిఫై కాలేదు (Not Qualified)'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {stock.qualification
                        ? `ట్రిగ్గర్: ${stock.qualification.triggerConditionTe}. అధిక కొనుగోలుదారుల ప్రెషర్ తో స్కోర్ ${stock.qualification.qualifiedScore}/100 కి చేరింది.`
                        : 'ఈ స్టాక్ ప్రస్తుతం క్వాలిఫికేషన్ నిబంధనలను (3M ADV / Pivot / VWAP / RVOL) ఇంకా పూర్తిగా చేరుకోలేదు.'}
                    </p>
                    <div className="text-[11px] font-mono text-emerald-300 bg-emerald-950/80 p-2 rounded border border-emerald-500/30 flex items-center justify-between">
                      <span>{stock.qualification ? `సమయం: ${formatISTMarketTime(stock.qualification.qualifiedTime)}` : `డే హై: ₹${dayHigh.toFixed(2)}`}</span>
                      {stock.qualification && <span>ధర: ₹{stock.qualification.qualifiedPrice.toFixed(2)}</span>}
                    </div>
                  </div>

                  {/* Phase 3: Current State */}
                  <div className="bg-amber-950/25 border border-amber-500/40 rounded-xl p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-amber-300 font-mono">3. ప్రస్తుత మార్కెట్ స్థానం (Current Rank)</span>
                      <span className="text-xs font-mono font-black text-amber-300 bg-amber-950/80 px-2 py-0.5 rounded border border-amber-500/40">
                        {stock.rank ? `📍 ప్రస్తుత ర్యాంక్ #${stock.rank}` : 'NO_TRADE'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      ప్రస్తుత ధర ₹{currentPrice.toFixed(2)} వద్ద ట్రేడ్ అవుతోంది. టెక్నికల్ స్కోర్: {stock.overallScore?.totalScore || 0}/100, కొనుగోలుదారుల శాతం: {buyerPressurePercent}%.
                    </p>
                    <div className="text-[11px] font-mono text-amber-300 bg-slate-950/60 p-2 rounded border border-amber-500/30 flex items-center justify-between">
                      <span>LTP: ₹{currentPrice.toFixed(2)} ({change >= 0 ? '+' : ''}{changePercent}%)</span>
                      <span className="text-slate-400">స్కోర్: {stock.overallScore?.totalScore || 0}/100</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Dedicated Order Book Tab */}
          {activeTab === 'ORDER_BOOK' && (
            <div className="space-y-4">
              <OrderBook
                symbol={symbol}
                currentPrice={currentPrice}
                prevClose={prevClose}
                dayHigh={dayHigh}
                dayLow={dayLow}
                buyerPressurePercent={buyerPressurePercent}
                pivots={pivots}
                vwap={vwap}
                avgVolume={stock.avgVolume}
                initialTimeframe={selectedTimeframe}
              />
            </div>
          )}

          {activeTab === 'PIVOTS' && (
            <div className="space-y-4">
              <div className="bg-slate-850 p-4 rounded-xl border border-slate-800">
                <h3 className="text-sm font-bold text-slate-200 mb-1">
                  క్లాసిక్ & ఫిబోనాచీ పివోట్ లెవల్స్ (Pivot Points Table)
                </h3>
                <p className="text-xs text-slate-400 mb-4">
                  ఇంట్రాడే సపోర్ట్ & రెసిస్టెన్స్ లెవల్స్. ప్రస్తుత ధర: ₹{currentPrice.toFixed(2)}
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Classic Pivots */}
                  <div className="bg-slate-900 p-3.5 rounded-lg border border-slate-800">
                    <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-2.5">
                      Classic Pivots (క్లాసిక్ లెవల్స్)
                    </h4>
                    <div className="space-y-1.5 text-xs font-mono">
                      <div className="flex justify-between py-1 border-b border-slate-800 text-rose-400">
                        <span>Resistance 3 (R3)</span>
                        <span>₹{pivots.r3}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-800 text-rose-400">
                        <span>Resistance 2 (R2)</span>
                        <span>₹{pivots.r2}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-800 text-rose-300 font-bold">
                        <span>Resistance 1 (R1)</span>
                        <span>₹{pivots.r1}</span>
                      </div>
                      <div className="flex justify-between py-1.5 bg-slate-800/50 px-2 rounded text-amber-300 font-bold">
                        <span>Central Pivot (P)</span>
                        <span>₹{pivots.pivot}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-800 text-emerald-300 font-bold">
                        <span>Support 1 (S1)</span>
                        <span>₹{pivots.s1}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-800 text-emerald-400">
                        <span>Support 2 (S2)</span>
                        <span>₹{pivots.s2}</span>
                      </div>
                      <div className="flex justify-between py-1 text-emerald-500">
                        <span>Support 3 (S3)</span>
                        <span>₹{pivots.s3}</span>
                      </div>
                    </div>
                  </div>

                  {/* Fibonacci Pivots */}
                  <div className="bg-slate-900 p-3.5 rounded-lg border border-slate-800">
                    <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-wider mb-2.5">
                      Fibonacci Pivots (ఫిబోనాచీ లెవల్స్)
                    </h4>
                    <div className="space-y-1.5 text-xs font-mono">
                      <div className="flex justify-between py-1 border-b border-slate-800 text-rose-400">
                        <span>Fib R3 (1.000)</span>
                        <span>₹{pivots.fibR3}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-800 text-rose-400">
                        <span>Fib R2 (0.618)</span>
                        <span>₹{pivots.fibR2}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-800 text-rose-300 font-bold">
                        <span>Fib R1 (0.382)</span>
                        <span>₹{pivots.fibR1}</span>
                      </div>
                      <div className="flex justify-between py-1.5 bg-slate-800/50 px-2 rounded text-cyan-300 font-bold">
                        <span>Pivot Point (P)</span>
                        <span>₹{pivots.pivot}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-800 text-emerald-300 font-bold">
                        <span>Fib S1 (0.382)</span>
                        <span>₹{pivots.fibS1}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-800 text-emerald-400">
                        <span>Fib S2 (0.618)</span>
                        <span>₹{pivots.fibS2}</span>
                      </div>
                      <div className="flex justify-between py-1 text-emerald-500">
                        <span>Fib S3 (1.000)</span>
                        <span>₹{pivots.fibS3}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'SCORE_BREAKDOWN' && (
            <div className="space-y-4">
              {/* 20-Min Persistence Checklist */}
              <div className="bg-slate-850 p-4 rounded-xl border border-emerald-500/30">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-slate-200">
                    20-మినిట్ పర్సిస్టెన్స్ ఫిల్టర్ (20-Minute Persistence: 20 Pts Max)
                  </h3>
                  <div className="text-sm font-black font-mono text-emerald-400">
                    {persistenceScore.totalPersistenceScore} / 20 ({persistenceScore.persistencePercent}%)
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center justify-between p-2 rounded bg-slate-900 border border-slate-800">
                    <span>① 15M Trend Bullish (4 pts)</span>
                    <span className={persistenceScore.is15MBullish ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                      {persistenceScore.is15MBullish ? '✓ PASS (+4)' : '✗ FAIL (0)'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded bg-slate-900 border border-slate-800">
                    <span>② EMA 9/21 Expanding (3 pts)</span>
                    <span className={persistenceScore.isEMAExpanding ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                      {persistenceScore.isEMAExpanding ? '✓ PASS (+3)' : '✗ FAIL (0)'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded bg-slate-900 border border-slate-800">
                    <span>③ Price &gt; Rising VWAP (3 pts)</span>
                    <span className={persistenceScore.isVWAPRising ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                      {persistenceScore.isVWAPRising ? '✓ PASS (+3)' : '✗ FAIL (0)'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded bg-slate-900 border border-slate-800">
                    <span>④ ADX Rising & Dominant (3 pts)</span>
                    <span className={persistenceScore.isADXRising ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                      {persistenceScore.isADXRising ? '✓ PASS (+3)' : '✗ FAIL (0)'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded bg-slate-900 border border-slate-800">
                    <span>⑤ CVD Persistent Up (3 pts)</span>
                    <span className={persistenceScore.isCVDPersistent ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                      {persistenceScore.isCVDPersistent ? '✓ PASS (+3)' : '✗ FAIL (0)'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded bg-slate-900 border border-slate-800">
                    <span>⑥ Volume Participation RVOL &gt; 1.2 (2 pts)</span>
                    <span className={persistenceScore.hasVolumeParticipation ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                      {persistenceScore.hasVolumeParticipation ? '✓ PASS (+2)' : '✗ FAIL (0)'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded bg-slate-900 border border-slate-800 sm:col-span-2">
                    <span>⑦ Higher-Low Structure Holds (2 pts)</span>
                    <span className={persistenceScore.hasHigherLowStructure ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                      {persistenceScore.hasHigherLowStructure ? '✓ PASS (+2)' : '✗ FAIL (0)'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Full 100-pt Score Components */}
              <div className="bg-slate-850 p-4 rounded-xl border border-slate-800">
                <h3 className="text-sm font-bold text-slate-200 mb-3">
                  100-పాయింట్ ఇంజిన్ కాంపోనెంట్స్ (100-Point Scoring Engine)
                </h3>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between items-center p-2 rounded bg-slate-900 border border-slate-800">
                    <span>Momentum & Day High Proximity (మొమెంటమ్ & HOD) - Max 20</span>
                    <span className="font-mono font-bold text-emerald-400">{overallScore.momentum} / 20</span>
                  </div>
                  <div className="flex justify-between items-center p-2 rounded bg-slate-900 border border-slate-800">
                    <span>Volume & RVOL Surge (వాల్యూమ్ సర్జ్) - Max 15</span>
                    <span className="font-mono font-bold text-emerald-400">{overallScore.volume} / 15</span>
                  </div>
                  <div className="flex justify-between items-center p-2 rounded bg-slate-900 border border-slate-800">
                    <span>Trend & EMA Expansion (ట్రెండ్) - Max 15</span>
                    <span className="font-mono font-bold text-emerald-400">{overallScore.trend} / 15</span>
                  </div>
                  <div className="flex justify-between items-center p-2 rounded bg-slate-900 border border-slate-800">
                    <span>20-Min Persistence (పర్సిస్టెన్స్) - Max 15</span>
                    <span className="font-mono font-bold text-emerald-400">{overallScore.persistence} / 15</span>
                  </div>
                  <div className="flex justify-between items-center p-2 rounded bg-slate-900 border border-slate-800">
                    <span>Order Flow & CVD (ఆర్డర్ ఫ్లో) - Max 15</span>
                    <span className="font-mono font-bold text-emerald-400">{overallScore.orderFlow} / 15</span>
                  </div>
                  <div className="flex justify-between items-center p-2 rounded bg-slate-900 border border-slate-800">
                    <span>VWAP Alignment (వివాప్) - Max 10</span>
                    <span className="font-mono font-bold text-emerald-400">{overallScore.vwap} / 10</span>
                  </div>
                  <div className="flex justify-between items-center p-2 rounded bg-slate-900 border border-slate-800">
                    <span>Liquidity & Room to R1 (లిక్విడిటీ రూమ్) - Max 5</span>
                    <span className="font-mono font-bold text-emerald-400">{overallScore.liquidityLevels} / 5</span>
                  </div>
                  <div className="flex justify-between items-center p-2 rounded bg-slate-900 border border-slate-800">
                    <span>Candle Structure & HL (క్యాండిల్ స్ట్రక్చర్) - Max 5</span>
                    <span className="font-mono font-bold text-emerald-400">{overallScore.candleStructure} / 5</span>
                  </div>

                  <div className="flex justify-between items-center p-2.5 rounded bg-slate-800 font-bold text-slate-100 border border-slate-700">
                    <div>
                      <span>మొత్తం స్కోర్ (TOTAL SCORE)</span>
                      {overallScore.normalizedScore !== undefined && (
                        <div className="text-[11px] font-normal text-slate-400 font-mono">
                          Exact Normalized: <strong className="text-cyan-400">{overallScore.normalizedScore.toFixed(2)}</strong> / 100.00
                        </div>
                      )}
                    </div>
                    <span className="font-mono text-base text-emerald-400">{overallScore.totalScore} / 100</span>
                  </div>

                  {/* Tie-Breaker Priority Metrics (Crucial for stocks with equal scores like 93) */}
                  {overallScore.tieBreakers && (
                    <div className="mt-3 p-3 rounded-xl bg-slate-950/80 border border-cyan-500/30 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                          <span>⚖️</span>
                          <span>టై-బ్రేకర్ ప్రాధాన్యత మెట్రిక్స్ (Tie-Breaker Priority Breakdown)</span>
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono bg-cyan-950/60 text-cyan-300 px-2 py-0.5 rounded border border-cyan-800/40">
                          సమాన స్కోర్ ఉన్నప్పుడు ర్యాంకింగ్ క్రమం
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs font-mono">
                        <div className="bg-slate-900 p-2 rounded border border-slate-800">
                          <div className="text-[10px] text-slate-400">1. Momentum Velocity</div>
                          <div className="text-sm font-bold text-amber-300">
                            {overallScore.tieBreakers.momentumVelocity}
                          </div>
                          <div className="text-[9px] text-slate-500">Gain + HOD proximity</div>
                        </div>
                        <div className="bg-slate-900 p-2 rounded border border-slate-800">
                          <div className="text-[10px] text-slate-400">2. RVOL Consistency</div>
                          <div className="text-sm font-bold text-cyan-300">
                            {overallScore.tieBreakers.rvolConsistency}
                          </div>
                          <div className="text-[9px] text-slate-500">Volume multiple vs ADV</div>
                        </div>
                        <div className="bg-slate-900 p-2 rounded border border-slate-800">
                          <div className="text-[10px] text-slate-400">3. Order Flow Dominance</div>
                          <div className="text-sm font-bold text-emerald-300">
                            {overallScore.tieBreakers.orderFlowDominance}
                          </div>
                          <div className="text-[9px] text-slate-500">Net Buyer delta & CVD</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'CALCULATOR' && (
            <div className="bg-slate-850 p-4 sm:p-5 rounded-xl border border-slate-800 space-y-4">
              <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                <Calculator className="w-4 h-4 text-emerald-400" />
                ఇంట్రాడే పొజిషన్ సైజింగ్ & రిస్క్ మేనేజ్‌మెంట్ కాలిక్యులేటర్
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">మొత్తం ట్రేడింగ్ క్యాపిటల్ (₹)</label>
                  <input
                    type="number"
                    value={capital}
                    onChange={(e) => setCapital(Number(e.target.value) || 0)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 font-mono focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1">ఒక ట్రేడ్ రిస్క్ శాతం (%)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={riskPercent}
                    onChange={(e) => setRiskPercent(Number(e.target.value) || 0)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 font-mono focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Calculated Outputs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-900 p-4 rounded-xl border border-slate-800 font-mono text-xs">
                <div>
                  <div className="text-slate-400 text-[11px]">సిఫార్సు చేయబడిన షేర్ల సంఖ్య</div>
                  <div className="text-lg font-black text-cyan-400 mt-1">{maxQty} షేర్లు</div>
                </div>

                <div>
                  <div className="text-slate-400 text-[11px]">మొత్తం ఇన్వెస్ట్‌మెంట్</div>
                  <div className="text-lg font-black text-slate-200 mt-1">₹{totalInvestment.toLocaleString('en-IN')}</div>
                </div>

                <div>
                  <div className="text-slate-400 text-[11px]">SL వద్ద గరిష్ట నష్టం</div>
                  <div className="text-lg font-black text-rose-400 mt-1">-₹{riskAmount.toFixed(0)}</div>
                </div>

                <div>
                  <div className="text-slate-400 text-[11px]">T2 వద్ద లాభం (1:2.5)</div>
                  <div className="text-lg font-black text-emerald-400 mt-1">+₹{t2Profit.toFixed(0)}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
