import React from 'react';
import { StockIndicatorData } from '../types';
import { formatISTMarketTime } from '../utils/istTime';
import { formatIndianVolume, formatAdvShort } from '../utils/volumeUtils';
import { TrendingUp, ShieldAlert, ArrowUpRight, Zap, Target, BarChart2, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';

interface SignalCardProps {
  stock: StockIndicatorData;
  onSelect: (stock: StockIndicatorData) => void;
  isSelected?: boolean;
  scoreDebugMode?: boolean;
}

export const SignalCard: React.FC<SignalCardProps> = ({ stock, onSelect, isSelected, scoreDebugMode = false }) => {
  const {
    symbol,
    name,
    nameTe,
    currentPrice,
    change,
    changePercent,
    signalStage,
    overallScore,
    persistenceScore,
    trend15M,
    emaSlope,
    priceVsVWAP,
    adxSlope,
    cvdTrend,
    buyerPressurePercent,
    rvol,
    marketState,
    tradePlan,
    hardFilters,
  } = stock;

  const isPositive = change >= 0;

  // Signal Stage styling
  let badgeBg = 'bg-slate-800 text-slate-400 border-slate-700';
  let badgeLabel = '⚪ NO TRADE';
  let badgeTe = 'నో ట్రేడ్ / చాపీ';

  if (signalStage === 'STRONG_LONG') {
    badgeBg = 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40';
    badgeLabel = '🟢 STRONG LONG BUY';
    badgeTe = 'స్ట్రాంగ్ లాంగ్ బై';
  } else if (signalStage === 'PRE_BREAKOUT_WATCH') {
    badgeBg = 'bg-amber-500/15 text-amber-400 border-amber-500/40';
    badgeLabel = '🟡 PRE-BREAKOUT WATCH';
    badgeTe = 'ప్రీ-బ్రేక్‌అవుట్ వాచ్';
  } else if (signalStage === 'DIP_RECOVERY') {
    badgeBg = 'bg-indigo-500/15 text-indigo-400 border-indigo-500/40';
    badgeLabel = '🟣 HEALTHY PULLBACK';
    badgeTe = 'డిప్ రికవరీ / హెల్తీ పుల్‌బ్యాక్';
  } else if (signalStage === 'MOMENTUM_TRAP') {
    badgeBg = 'bg-rose-500/20 text-rose-400 border-rose-500/50';
    badgeLabel = '🔴 MOMENTUM TRAP RISK';
    badgeTe = 'మొమెంటమ్ ట్రాప్ రిస్క్ (బ్లాక్)';
  } else if (signalStage === 'EARLY_SETUP') {
    badgeBg = 'bg-blue-500/15 text-blue-400 border-blue-500/40';
    badgeLabel = '🔵 EARLY SETUP';
    badgeTe = 'ఎర్లీ సెటప్ (1-2 క్యాండిల్స్)';
  }

  // 20-min persistence badge
  const persistenceColor =
    persistenceScore.persistenceLevel === 'HIGH'
      ? 'text-emerald-400 bg-emerald-950/60 border-emerald-500/40'
      : persistenceScore.persistenceLevel === 'MEDIUM'
      ? 'text-amber-400 bg-amber-950/60 border-amber-500/40'
      : 'text-slate-400 bg-slate-900 border-slate-700';

  const isElite90Plus = overallScore.totalScore >= 90;

  // Market Cap classification for transparency (proving no large-cap / blue-chip bias)
  const capLabel =
    stock.marketCapCr < 20000
      ? { text: 'Small Cap', te: 'స్మాల్ క్యాప్', color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' }
      : stock.marketCapCr < 75000
      ? { text: 'Mid Cap', te: 'మిడ్ క్యాప్', color: 'bg-purple-500/10 text-purple-400 border-purple-500/30' }
      : { text: 'Large Cap', te: 'లార్జ్ క్యాప్', color: 'bg-blue-500/10 text-blue-400 border-blue-500/30' };

  return (
    <div
      id={`signal-card-${symbol.toLowerCase()}`}
      onClick={() => onSelect(stock)}
      className={`group relative bg-slate-900/95 rounded-2xl border transition-all duration-200 cursor-pointer overflow-hidden shadow-lg hover:shadow-2xl ${
        isElite90Plus
          ? isSelected
            ? 'border-amber-400 ring-4 ring-amber-400/30 shadow-2xl shadow-amber-950/60 bg-gradient-to-b from-amber-950/20 via-slate-900 to-slate-900'
            : 'border-amber-500/70 ring-2 ring-amber-400/30 shadow-xl shadow-amber-950/30 bg-gradient-to-b from-amber-950/15 via-slate-900 to-slate-900 hover:border-amber-400'
          : isSelected
          ? 'border-emerald-500 ring-2 ring-emerald-500/20 shadow-emerald-950/40 hover:border-slate-600'
          : 'border-slate-800 hover:border-slate-600 hover:bg-slate-850'
      }`}
    >
      {/* 90+ Elite Score Crown Ribbon */}
      {isElite90Plus && (
        <div className="bg-gradient-to-r from-amber-500/30 via-emerald-500/20 to-amber-500/30 border-b border-amber-400/50 px-3.5 py-1.5 flex items-center justify-between text-xs font-bold text-amber-300">
          <span className="flex items-center gap-1.5 tracking-wide">
            <span className="inline-block animate-pulse text-amber-400">⭐</span>
            <span>90+ ఎలైట్ టెక్నికల్ స్కోర్ (ELITE SCORE)</span>
          </span>
          <span className="bg-amber-400/20 text-amber-200 px-2 py-0.5 rounded-full text-[11px] font-mono border border-amber-400/40 flex items-center gap-1">
            <span>{stock.rank === 1 ? '🥇' : stock.rank === 2 ? '🥈' : stock.rank === 3 ? '🥉' : '🏆'}</span>
            <span>{stock.rank ? `టెక్నికల్ ర్యాంక్ #${stock.rank}` : 'TOP TIER'}</span>
          </span>
        </div>
      )}

      {/* Top Header */}
      <div className={`p-4 border-b border-slate-800/80 ${isElite90Plus ? 'bg-amber-950/10' : 'bg-slate-900/60'}`}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              {stock.rank && (
                <span
                  className={`text-xs font-black font-mono px-2 py-0.5 rounded-md flex items-center gap-1 shadow-sm ${
                    stock.rank === 1
                      ? 'bg-amber-400 text-slate-950 font-black shadow-md shadow-amber-400/50 border border-amber-300'
                      : stock.rank === 2
                      ? 'bg-slate-200 text-slate-950 font-black border border-white shadow-md'
                      : stock.rank === 3
                      ? 'bg-amber-700 text-white font-black border border-amber-600 shadow-md'
                      : stock.rank <= 5
                      ? 'bg-amber-400/25 text-amber-300 border border-amber-400/50 font-bold'
                      : isElite90Plus
                      ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30 font-semibold'
                      : 'bg-slate-800 text-slate-300 border border-slate-700'
                  }`}
                  title={`Pure Technical Rank #${stock.rank} (No Market-Cap Bias) - 100% Score Based`}
                >
                  <span>{stock.rank === 1 ? '🥇' : stock.rank === 2 ? '🥈' : stock.rank === 3 ? '🥉' : ''}</span>
                  <span>ర్యాంక్ #{stock.rank}</span>
                </span>
              )}
              <span className="font-bold text-lg text-slate-100 group-hover:text-emerald-400 transition-colors font-mono tracking-wide">
                {symbol}
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 font-sans">
                {stock.sector}
              </span>
              {/* Market Cap Tag (Proves 100% Unbiased Ranking) */}
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded border font-sans font-medium ${capLabel.color}`}
                title={`Market Cap: ₹${stock.marketCapCr.toLocaleString('en-IN')} Cr - Ranking is based 100% on technical score, zero company bias.`}
              >
                {capLabel.te} ({capLabel.text})
              </span>
            </div>
            <div className="text-xs text-slate-400 truncate max-w-[240px] mt-1" title={name}>
              {name} {nameTe && <span className="text-slate-500">({nameTe})</span>}
            </div>
          </div>

          <div className="text-right shrink-0">
            <div className="text-base font-bold font-mono text-slate-100">
              ₹{currentPrice.toFixed(2)}
            </div>
            <div
              className={`text-xs font-semibold font-mono flex items-center justify-end gap-0.5 ${
                isPositive ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {isPositive ? '+' : ''}{change} ({isPositive ? '+' : ''}{changePercent}%)
            </div>
          </div>
        </div>

        {/* Signal Stage Badge & Scores */}
        <div className="mt-3 flex items-center justify-between gap-2">
          <div className={`px-2.5 py-1 rounded-lg border text-xs font-bold tracking-tight ${badgeBg}`}>
            <div>{badgeLabel}</div>
            <div className="text-[10px] opacity-85 font-normal">{badgeTe}</div>
          </div>

          <div className="flex items-center gap-2 text-right">
            {/* Score Badge - Prominently highlighted for 90+ */}
            <div
              className={`rounded-lg px-2.5 py-1 transition-all ${
                isElite90Plus
                  ? 'bg-gradient-to-br from-amber-500/25 to-amber-950/80 border border-amber-400/80 shadow-md shadow-amber-500/20 ring-1 ring-amber-400/40'
                  : 'bg-slate-800/70 border border-slate-700/60'
              }`}
            >
              <div
                className={`text-[9px] uppercase font-bold flex items-center gap-1 ${
                  isElite90Plus ? 'text-amber-300 font-black' : 'text-slate-400'
                }`}
              >
                {isElite90Plus && <span>⭐</span>}
                {isElite90Plus ? 'ELITE SCORE' : 'Score'}
              </div>
              <div
                className={`text-sm font-black font-mono ${
                  isElite90Plus ? 'text-amber-300 text-base' : 'text-emerald-400'
                }`}
              >
                {overallScore.totalScore}
                <span className={`text-[10px] font-normal ${isElite90Plus ? 'text-amber-300/70' : 'text-slate-500'}`}>
                  /100
                </span>
              </div>
            </div>

            <div className={`border rounded-lg px-2 py-1 ${persistenceColor}`}>
              <div className="text-[10px] uppercase font-semibold">Persistence</div>
              <div className="text-sm font-black font-mono">
                {persistenceScore.persistencePercent}%
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Real-time Qualification Timestamp & Trigger Price Banner */}
      {stock.qualification && (
        <div className="bg-gradient-to-r from-emerald-950/50 via-slate-900 to-slate-950 border-b border-emerald-500/30 px-3.5 py-2.5 flex flex-col gap-1.5 text-xs">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 font-semibold text-emerald-300">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400"></span>
              </span>
              <span>🎯 క్వాలిఫై సమయం: <strong className="font-mono text-white text-[13px] bg-slate-900/90 px-1.5 py-0.5 rounded border border-emerald-500/30">{formatISTMarketTime(stock.qualification.qualifiedTime)}</strong></span>
            </div>
            <div className="flex items-center gap-1.5 font-mono text-[11px]">
              <span className="bg-emerald-950/80 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-500/40 font-bold">
                🎯 క్వాలిఫై: #{stock.qualification.qualifiedRank ?? stock.rank ?? '—'}
              </span>
              <span className="text-slate-600">➔</span>
              <span className="bg-amber-950/80 text-amber-300 px-1.5 py-0.5 rounded border border-amber-500/40 font-bold">
                📍 ప్రస్తుతం: #{stock.rank ?? '—'}
              </span>
            </div>
            <div className="font-mono text-slate-300 text-right text-[11px] shrink-0">
              ఎంట్రీ/ట్రిగ్గర్ ధర: <strong className="text-emerald-400 text-xs font-bold bg-slate-900/90 px-1.5 py-0.5 rounded border border-emerald-500/30">₹{stock.qualification.qualifiedPrice.toFixed(2)}</strong>
            </div>
          </div>
          
          <div className="text-[11px] text-slate-300 flex items-baseline gap-1 flex-wrap">
            <span className="text-emerald-400 font-semibold">⚡ ట్రిగ్గర్ కండిషన్:</span>
            <span className="text-slate-200 font-medium">{stock.qualification.triggerConditionTe}</span>
          </div>

          {stock.fiveDayBaseProfile && stock.fiveDayBaseProfile.priorityTier <= 3 && (
            <div className="p-2 rounded-lg bg-slate-950/80 border border-emerald-500/30 flex flex-col gap-1">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span
                  className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                    stock.fiveDayBaseProfile.priorityTier === 1
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/50'
                      : stock.fiveDayBaseProfile.priorityTier === 2
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400/50'
                      : 'bg-amber-500/20 text-amber-300 border-amber-400/50'
                  }`}
                >
                  {stock.fiveDayBaseProfile.tierLabelTe}
                </span>
                <span className="text-[10px] font-mono text-slate-300">
                  5D Avg Vol: <strong>{formatAdvShort(stock.fiveDayBaseProfile.avg5DayVolume)}</strong> (నేడు <strong>{stock.fiveDayBaseProfile.volumeVsTodayRatio}x</strong>)
                </span>
              </div>
              <div className="text-[10px] text-slate-400 leading-snug">
                {stock.fiveDayBaseProfile.tierDescriptionTe}
              </div>
              <div className="flex items-center gap-1 flex-wrap font-mono text-[9px] pt-0.5">
                <span className="text-slate-400">గత 5 రోజుల ధర %:</span>
                {stock.fiveDayBaseProfile.last5DaysData.map((d, idx) => (
                  <span
                    key={idx}
                    className={`px-1.5 py-0.2 rounded border ${
                      d.changePercent <= 2.0
                        ? 'bg-emerald-950/60 text-emerald-300 border-emerald-700/50'
                        : d.changePercent <= 3.0
                        ? 'bg-cyan-950/60 text-cyan-300 border-cyan-700/50'
                        : 'bg-amber-950/60 text-amber-300 border-amber-700/50'
                    }`}
                  >
                    {d.dateStr}: {d.changePercent >= 0 ? '+' : ''}{d.changePercent}%
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-1 flex-wrap pt-0.5">
            {stock.qualification.keyDrivers.map((driver, i) => (
              <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-900 text-emerald-300 border border-emerald-500/20 font-mono">
                {driver}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Technical Checks Table (matching user's ASCII mockup) */}
      <div className="p-3.5 space-y-1.5 text-xs border-b border-slate-800/80 bg-slate-950/40">
        <div className="flex justify-between items-center py-0.5">
          <span className="text-slate-400">15M Trend</span>
          <span className={`font-semibold flex items-center gap-1 font-mono ${trend15M === 'BULLISH' ? 'text-emerald-400' : trend15M === 'BEARISH' ? 'text-rose-400' : 'text-slate-400'}`}>
            {trend15M === 'BULLISH' ? '🟢 Bullish' : trend15M === 'BEARISH' ? '🔴 Bearish' : '⚪ Neutral'}
          </span>
        </div>

        <div className="flex justify-between items-center py-0.5">
          <span className="text-slate-400">5M EMA 9/21</span>
          <span className={`font-semibold flex items-center gap-1 font-mono ${emaSlope === 'EXPANDING' ? 'text-emerald-400' : emaSlope === 'CONVERGING' ? 'text-amber-400' : 'text-slate-400'}`}>
            {emaSlope === 'EXPANDING' ? '🟢 Expanding' : emaSlope === 'CONVERGING' ? '🟡 Converging' : '⚪ Parallel'}
          </span>
        </div>

        <div className="flex justify-between items-center py-0.5">
          <span className="text-slate-400">VWAP</span>
          <span className={`font-semibold flex items-center gap-1 font-mono ${priceVsVWAP === 'ABOVE' ? 'text-emerald-400' : 'text-rose-400'}`}>
            {priceVsVWAP === 'ABOVE' ? '🟢 Above (₹' + stock.vwap + ')' : '🔴 Below'}
          </span>
        </div>

        <div className="flex justify-between items-center py-0.5">
          <span className="text-slate-400">పివోట్ పాయింట్ (PP)</span>
          <span className={`font-semibold flex items-center gap-1 font-mono text-[11px] ${stock.pivots && stock.currentPrice >= stock.pivots.pivot ? 'text-emerald-400' : 'text-rose-400'}`}>
            {stock.pivots ? (
              stock.currentPrice >= stock.pivots.r3
                ? `🟢 R3 పైన (₹${stock.pivots.r3})`
                : stock.currentPrice >= stock.pivots.r2
                ? `🟢 R2 పైన (₹${stock.pivots.r2})`
                : stock.currentPrice >= stock.pivots.r1
                ? `🟢 R1 పైన (₹${stock.pivots.r1})`
                : stock.currentPrice >= stock.pivots.pivot
                ? `🟢 PP పైన (₹${stock.pivots.pivot})`
                : `🔴 PP క్రింద (₹${stock.pivots.pivot})`
            ) : '—'}
          </span>
        </div>

        <div className="flex justify-between items-center py-0.5">
          <span className="text-slate-400">ADX Trend</span>
          <span className={`font-semibold flex items-center gap-1 font-mono ${adxSlope === 'RISING' ? 'text-emerald-400' : 'text-slate-400'}`}>
            {adxSlope === 'RISING' ? '🟢 Rising (' + stock.adx + ')' : '⚪ Falling (' + stock.adx + ')'}
          </span>
        </div>

        <div className="flex justify-between items-center py-0.5">
          <span className="text-slate-400">CVD (Delta)</span>
          <div className="flex items-center gap-1.5 font-mono text-right">
            <span className={`text-[11px] font-bold ${stock.cvd > 0 ? 'text-emerald-400' : stock.cvd < 0 ? 'text-rose-400' : 'text-slate-300'}`}>
              {stock.cvd > 0 ? '+' : ''}{stock.cvd.toLocaleString('en-IN')}
            </span>
            <span className={`font-semibold flex items-center gap-0.5 ${cvdTrend === 'RISING' ? 'text-emerald-400' : cvdTrend === 'FALLING' ? 'text-rose-400' : 'text-slate-400'}`}>
              {cvdTrend === 'RISING' ? '🟢 పైకి' : cvdTrend === 'FALLING' ? '🔴 క్రిందికి' : '⚪ న్యూట్రల్'}
            </span>
          </div>
        </div>

        <div className="flex justify-between items-center py-0.5">
          <span className="text-slate-400">Buyer Pressure</span>
          <span className="font-semibold font-mono text-slate-200">
            <span className={buyerPressurePercent >= 60 ? 'text-emerald-400' : 'text-slate-300'}>
              {buyerPressurePercent}%
            </span>
          </span>
        </div>

        <div className="flex justify-between items-center py-0.5">
          <span className="text-slate-400">మొత్తం వాల్యూమ్ (Volume)</span>
          <span className="font-bold font-mono text-slate-200">
            {formatIndianVolume(stock.currentVolume)}
            <span className="text-[10px] text-slate-400 ml-1 font-normal">
              (3M ADV: {formatAdvShort(stock.adv || stock.avgVolume)})
            </span>
          </span>
        </div>

        <div className="flex justify-between items-center py-0.5">
          <span className="text-slate-400">Power RVOL (Multi-TF)</span>
          <div className="flex flex-col items-end gap-0.5 font-mono">
            <span
              className={`font-black px-2 py-0.5 rounded text-xs ${
                rvol >= 5.0
                  ? 'bg-amber-400 text-slate-950 font-black border border-amber-300 shadow-md shadow-amber-400/50'
                  : rvol >= 2.0
                  ? 'bg-amber-500/25 text-amber-300 border border-amber-400/80 shadow-sm shadow-amber-500/20'
                  : rvol >= 1.2
                  ? 'bg-emerald-950/90 text-emerald-300 border border-emerald-500/60'
                  : 'bg-slate-800 text-slate-300 border border-slate-700'
              }`}
            >
              {rvol}× {rvol >= 5.0 ? '🔥 మెగా సర్జ్' : rvol >= 2.0 ? '🔥 సర్జ్' : rvol >= 1.2 ? '⚡ హై' : ''}
            </span>
            <div className="flex items-center gap-1.5 text-[9px] text-slate-500 font-normal">
              <span>Session: {stock.sessionRvol || '-'}×</span>
              <span>•</span>
              <span className={stock.surgeRvol && stock.surgeRvol >= 1.5 ? 'text-amber-400 font-bold' : ''}>
                Surge: {stock.surgeRvol || '-'}×
              </span>
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center py-0.5">
          <span className="text-slate-400">Market State</span>
          <span className="font-semibold font-mono uppercase text-indigo-300">
            {marketState}
          </span>
        </div>

        {/* 5M Green vs Red Candles Ratio & Dynamic Regime Penalty Tracking */}
        <div className="flex justify-between items-center py-0.5">
          <span className="text-slate-400">క్యాండిల్స్ (గ్రీన్ / రెడ్)</span>
          <div className="flex items-center gap-1.5 font-mono text-[11px]">
            <span className="text-emerald-400 font-bold" title={`గ్రీన్ క్యాండిల్స్: ${stock.greenCandlesCount ?? '-'}`}>
              🟢 {stock.greenCandlesCount !== undefined ? `${stock.greenCandlesCount} (${stock.greenCandlePercent}%)` : ''}
            </span>
            <span className="text-slate-600 font-bold">/</span>
            <span
              className={`font-bold px-1.5 py-0.2 rounded ${
                stock.isExcessiveRedCandles
                  ? 'bg-rose-950/90 text-rose-300 border border-rose-700/80 shadow-sm'
                  : 'text-slate-300'
              }`}
              title={`రెడ్ క్యాండిల్స్: ${stock.redCandlesCount ?? '-'} (${stock.activeRedThreshold ?? 40}% పరిమితి)`}
            >
              🔴 {stock.redCandlesCount !== undefined ? `${stock.redCandlesCount} (${stock.redCandlePercent}%)` : `${stock.redCandlePercent}%`}
            </span>
            {stock.isExcessiveRedCandles && stock.penaltyPoints ? (
              <span className="text-[10px] text-rose-400 font-bold bg-rose-950/50 px-1 py-0.2 rounded border border-rose-900" title={`${stock.activeRedThreshold ?? 40}% పరిమితి దాటినందుకు వెయిటేజ్ పెనాల్టీ`}>
                -{stock.penaltyPoints} pts
              </span>
            ) : null}
          </div>
        </div>

        {/* Hyper-Volatile Spike Alert Banner */}
        {stock.isHyperVolatileSpike && (
          <div className="flex items-center justify-between py-1 px-2.5 rounded-lg bg-rose-950/80 border border-rose-600/80 text-rose-200 text-[11px] font-mono mt-1 shadow">
            <span className="flex items-center gap-1.5 font-bold">
              <ShieldAlert className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
              <span>హై వాలటాలిటీ స్పైక్ ట్రాప్</span>
            </span>
            <span className="text-[10px] bg-rose-500/20 text-rose-300 px-1.5 py-0.2 rounded border border-rose-500/30">
              ఫిల్టర్ చేయబడింది
            </span>
          </div>
        )}
      </div>

      {/* Score Debugging Inspector Section on Card (When scoreDebugMode is enabled) */}
      {scoreDebugMode && (
        <div className="p-3 bg-slate-950/95 border-b border-cyan-500/40 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold text-cyan-300 flex items-center gap-1.5 text-[11px]">
              <span>🔬</span>
              <span>స్కోర్ డీబగ్గింగ్ (Weightings & Tie-Breakers)</span>
            </span>
            <span className="font-mono text-[10px] text-cyan-400 bg-cyan-950/80 px-1.5 py-0.5 rounded border border-cyan-800">
              Exact: {overallScore.normalizedScore !== undefined ? overallScore.normalizedScore.toFixed(2) : overallScore.totalScore.toFixed(2)}/100
            </span>
          </div>

          {/* 8 Weighting Components */}
          <div className="grid grid-cols-4 gap-1 font-mono text-[9px]">
            <div className="bg-slate-900 p-1 rounded border border-slate-800 text-center" title="మొమెంటమ్ & HOD సామీప్యత (గరిష్టం: 20)">
              <div className="text-slate-400 text-[8px]">Mom/HOD</div>
              <div className="font-bold text-amber-300">{overallScore.momentum}/20</div>
            </div>
            <div className="bg-slate-900 p-1 rounded border border-slate-800 text-center" title="RVOL & వాల్యూమ్ సర్జ్ (గరిష్టం: 15)">
              <div className="text-slate-400 text-[8px]">RVOL/Vol</div>
              <div className="font-bold text-cyan-300">{overallScore.volume}/15</div>
            </div>
            <div className="bg-slate-900 p-1 rounded border border-slate-800 text-center" title="ట్రెండ్ & EMA ఎక్స్‌పాన్షన్ (గరిష్టం: 15)">
              <div className="text-slate-400 text-[8px]">Trd/EMA</div>
              <div className="font-bold text-emerald-300">{overallScore.trend}/15</div>
            </div>
            <div className="bg-slate-900 p-1 rounded border border-slate-800 text-center" title="20-మినిట్ పర్సిస్టెన్స్ (గరిష్టం: 15)">
              <div className="text-slate-400 text-[8px]">20M Pers</div>
              <div className="font-bold text-emerald-300">{overallScore.persistence}/15</div>
            </div>
            <div className="bg-slate-900 p-1 rounded border border-slate-800 text-center" title="ఆర్డర్ ఫ్లో & CVD (గరిష్టం: 15)">
              <div className="text-slate-400 text-[8px]">OF/CVD</div>
              <div className="font-bold text-cyan-300">{overallScore.orderFlow}/15</div>
            </div>
            <div className="bg-slate-900 p-1 rounded border border-slate-800 text-center" title="VWAP అలైన్‌మెంట్ (గరిష్టం: 10)">
              <div className="text-slate-400 text-[8px]">VWAP</div>
              <div className="font-bold text-emerald-300">{overallScore.vwap}/10</div>
            </div>
            <div className="bg-slate-900 p-1 rounded border border-slate-800 text-center" title="బ్రేక్‌అవుట్ రూమ్ (గరిష్టం: 5)">
              <div className="text-slate-400 text-[8px]">Room R1</div>
              <div className="font-bold text-amber-300">{overallScore.liquidityLevels}/5</div>
            </div>
            <div className="bg-slate-900 p-1 rounded border border-slate-800 text-center" title="క్యాండిల్ స్ట్రక్చర్ (గరిష్టం: 5)">
              <div className="text-slate-400 text-[8px]">Candle HL</div>
              <div className="font-bold text-slate-300">{overallScore.candleStructure}/5</div>
            </div>
          </div>

          {/* Tie-Breaker Priority Metrics */}
          {overallScore.tieBreakers && (
            <div className="p-1.5 rounded bg-slate-900/90 border border-slate-800 space-y-1 font-mono text-[10px]">
              <div className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider flex items-center justify-between">
                <span>Tie-Breaker Priority Factors:</span>
                <span className="text-[8px] text-cyan-400">93 vs 93 Determinants</span>
              </div>
              <div className="flex items-center justify-between text-amber-300">
                <span className="text-slate-400">1. Momentum Velocity:</span>
                <strong>{overallScore.tieBreakers.momentumVelocity}</strong>
              </div>
              <div className="flex items-center justify-between text-cyan-300">
                <span className="text-slate-400">2. RVOL Consistency:</span>
                <strong>{overallScore.tieBreakers.rvolConsistency}</strong>
              </div>
              <div className="flex items-center justify-between text-emerald-300">
                <span className="text-slate-400">3. Order Flow Dominance:</span>
                <strong>{overallScore.tieBreakers.orderFlowDominance}</strong>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Trade Plan & Breakout Room (Entry / SL / T1-T3) */}
      <div className="p-3.5 bg-slate-900/90 text-xs space-y-1.5 border-b border-slate-800/80">
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800">
            <div className="text-[10px] text-slate-400">Entry (ఎంట్రీ)</div>
            <div className="text-sm font-bold font-mono text-emerald-400">₹{tradePlan.entryPrice}</div>
          </div>
          <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800">
            <div className="text-[10px] text-slate-400">SL (స్టాప్ లాస్)</div>
            <div className="text-sm font-bold font-mono text-rose-400">₹{tradePlan.stopLoss}</div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-1.5 text-center font-mono">
          <div className="bg-slate-950/40 p-1.5 rounded border border-slate-800/60">
            <div className="text-[9px] text-slate-400">T1 (1:1.5)</div>
            <div className="font-semibold text-emerald-300">₹{tradePlan.target1}</div>
          </div>
          <div className="bg-slate-950/40 p-1.5 rounded border border-slate-800/60">
            <div className="text-[9px] text-slate-400">T2 (1:2.5)</div>
            <div className="font-semibold text-cyan-300">₹{tradePlan.target2}</div>
          </div>
          <div className="bg-slate-950/40 p-1.5 rounded border border-slate-800/60">
            <div className="text-[9px] text-slate-400">R:R Ratio</div>
            <div className="font-bold text-amber-300">1 : {tradePlan.riskRewardRatio}</div>
          </div>
        </div>

        {/* Breakout Room Indicator */}
        <div className="flex items-center justify-between text-[11px] pt-1">
          <span className="text-slate-400">Breakout Room to R1:</span>
          <span
            className={`font-semibold font-mono px-2 py-0.5 rounded text-[10px] ${
              tradePlan.breakoutRoomStatus === 'EXCELLENT'
                ? 'bg-emerald-950/70 text-emerald-400 border border-emerald-800'
                : tradePlan.breakoutRoomStatus === 'GOOD'
                ? 'bg-cyan-950/70 text-cyan-400 border border-cyan-800'
                : tradePlan.breakoutRoomStatus === 'TIGHT'
                ? 'bg-amber-950/70 text-amber-400 border border-amber-800'
                : 'bg-rose-950/70 text-rose-400 border border-rose-800'
            }`}
          >
            {tradePlan.breakoutRoomStatus} ({tradePlan.roomRatio}× ATR)
          </span>
        </div>
      </div>

      {/* Hard Filter Block Warning or Clean Pass */}
      <div className="p-2.5 bg-slate-950/70 text-[11px] flex items-center justify-between">
        {hardFilters.hasHardFilterBlock ? (
          <div className="flex items-center gap-1.5 text-rose-400">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate" title={hardFilters.blockReasons.join(', ')}>
              Blocked: {hardFilters.blockReasons[0]}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
            <span>Hard Filters Pass • 20M Follow-Through Clean</span>
          </div>
        )}

        <button
          className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1 ml-2 transition-transform group-hover:translate-x-0.5"
          onClick={(e) => {
            e.stopPropagation();
            onSelect(stock);
          }}
        >
          విశ్లేషణ <ArrowUpRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
