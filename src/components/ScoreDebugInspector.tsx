import React, { useState } from 'react';
import { StockIndicatorData } from '../types';
import { formatISTMarketTime } from '../utils/istTime';
import { compareStocksByTechnicalStrength } from '../engine/technicalIndicators';
import {
  SlidersHorizontal,
  Zap,
  TrendingUp,
  Activity,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ArrowUpRight,
  Info,
  ShieldAlert,
  Flame
} from 'lucide-react';

interface ScoreDebugInspectorProps {
  stocks: StockIndicatorData[];
  onSelectStock: (stock: StockIndicatorData) => void;
  isOpen: boolean;
  onToggle: () => void;
  morningTop10Symbols?: string[];
}

export const ScoreDebugInspector: React.FC<ScoreDebugInspectorProps> = ({
  stocks,
  onSelectStock,
  isOpen,
  onToggle,
  morningTop10Symbols = [],
}) => {
  const [filterMode, setFilterMode] = useState<'TOP10' | 'ELITE90' | 'ALL'>('TOP10');

  // Filter stocks according to mode, strictly sorted by totalScore descending
  const displayedStocks = React.useMemo(() => {
    // Master sort: Highest Total Score ALWAYS ranked first (98 > 96 > 94 > 93...)
    const sorted = [...stocks].sort(compareStocksByTechnicalStrength);

    if (filterMode === 'ELITE90') {
      return sorted.filter((s) => s.overallScore.totalScore >= 90);
    }
    if (filterMode === 'TOP10') {
      return sorted.slice(0, 10);
    }
    return sorted;
  }, [stocks, filterMode]);

  const elite90Count = React.useMemo(() => {
    return stocks.filter((s) => s.overallScore.totalScore >= 90).length;
  }, [stocks]);

  if (!isOpen) return null;

  return (
    <div
      id="score-debug-inspector-panel"
      className="bg-slate-950/95 border-2 border-cyan-500/50 rounded-2xl p-4 sm:p-5 shadow-2xl shadow-cyan-950/40 relative overflow-hidden transition-all animate-fadeIn"
    >
      {/* Background glow styling */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20" />

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3 relative z-10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-400/60 flex items-center justify-center text-cyan-300">
            <SlidersHorizontal className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-black text-slate-100 flex items-center gap-2">
                <span>టెక్నికల్ స్కోర్ & టై-బ్రేకర్ డీబగ్గింగ్ మోడ్</span>
                <span className="text-[10px] font-mono uppercase bg-cyan-400 text-slate-950 px-2 py-0.5 rounded font-black tracking-wider">
                  LIVE INSPECTOR
                </span>
              </h2>
            </div>
            <p className="text-xs text-slate-400">
              గరిష్ట 100-పాయింట్ నార్మలైజేషన్ మరియు సమాన స్కోరు వచ్చినప్పుడు (93 vs 93) ఖచ్చితమైన ప్రాధాన్యత విశ్లేషణ.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5 text-xs font-semibold">
            <button
              onClick={() => setFilterMode('TOP10')}
              className={`px-2.5 py-1 rounded-md transition-all ${
                filterMode === 'TOP10' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              టాప్ 10 (Top 10)
            </button>
            <button
              onClick={() => setFilterMode('ELITE90')}
              className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1 ${
                filterMode === 'ELITE90'
                  ? 'bg-amber-400 text-slate-950 font-bold shadow-sm'
                  : 'text-amber-400/90 hover:text-amber-300'
              }`}
            >
              <span>⭐ 90+ ఎలైట్ ({elite90Count})</span>
            </button>
            <button
              onClick={() => setFilterMode('ALL')}
              className={`px-2.5 py-1 rounded-md transition-all ${
                filterMode === 'ALL' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              టాప్ 25 (Top 25)
            </button>
          </div>

          <button
            onClick={onToggle}
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800"
            title="డీబగ్గర్ మూసివేయండి"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Mathematical Normalization Summary Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 my-3 text-[11px] relative z-10">
        <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800 text-center">
          <div className="text-slate-400 font-medium">1. మొమెంటమ్ / HOD</div>
          <div className="font-mono font-bold text-amber-300">Max 20 pts</div>
        </div>
        <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800 text-center">
          <div className="text-slate-400 font-medium">2. RVOL & వాల్యూమ్</div>
          <div className="font-mono font-bold text-cyan-300">Max 15 pts</div>
        </div>
        <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800 text-center">
          <div className="text-slate-400 font-medium">3. ట్రెండ్ & EMA</div>
          <div className="font-mono font-bold text-emerald-300">Max 15 pts</div>
        </div>
        <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800 text-center">
          <div className="text-slate-400 font-medium">4. 20M పర్సిస్టెన్స్</div>
          <div className="font-mono font-bold text-emerald-300">Max 15 pts</div>
        </div>
        <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800 text-center">
          <div className="text-slate-400 font-medium">5. ఆర్డర్ ఫ్లో & CVD</div>
          <div className="font-mono font-bold text-cyan-300">Max 15 pts</div>
        </div>
        <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800 text-center">
          <div className="text-slate-400 font-medium">6. VWAP అలైన్‌మెంట్</div>
          <div className="font-mono font-bold text-emerald-300">Max 10 pts</div>
        </div>
        <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800 text-center">
          <div className="text-slate-400 font-medium">7. బ్రేక్‌అవుట్ రూమ్</div>
          <div className="font-mono font-bold text-amber-300">Max 5 pts</div>
        </div>
        <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800 text-center">
          <div className="text-slate-400 font-medium">8. క్యాండిల్ స్ట్రక్చర్</div>
          <div className="font-mono font-bold text-slate-300">Max 5 pts</div>
        </div>
      </div>

      {/* Tie-Breaker Explanation Box */}
      <div className="p-3 bg-gradient-to-r from-slate-900/90 to-cyan-950/40 rounded-xl border border-cyan-500/30 text-xs text-slate-300 flex flex-wrap items-center justify-between gap-2 mb-3 relative z-10">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-cyan-400 flex-shrink-0" />
          <span>
            <strong className="text-cyan-300">సమాన స్కోర్ల టై-బ్రేకింగ్ ప్రాధాన్యత ఆర్డర్:</strong> ఉదాహరణకు 3 స్టాక్స్ <strong>93</strong> స్కోర్ సాధించినప్పుడు:
            <span className="text-amber-300 ml-1">① మొమెంటమ్ వెలాసిటీ (HOD Proximity & % Gain)</span> &gt;
            <span className="text-cyan-300 ml-1">② RVOL కన్సిస్టెన్సీ (ADV Multiple)</span> &gt;
            <span className="text-emerald-300 ml-1">③ ఆర్డర్ ఫ్లో మెట్రిక్స్ (Net Buyers & CVD)</span> క్రమంలో #1, #2 నిర్ణయించబడుతుంది.
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] font-mono text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-700/50">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>90+ స్టాక్స్ ఎప్పుడూ మిస్ కావు (Omission Protected)</span>
        </div>
      </div>

      {/* Stocks Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-800 relative z-10">
        <table className="w-full text-left text-xs font-sans">
          <thead className="bg-slate-900/90 text-slate-400 font-mono text-[11px] border-b border-slate-800">
            <tr>
              <th className="py-2.5 px-3">ర్యాంక్ (Rank)</th>
              <th className="py-2.5 px-3">స్టాక్ (Symbol)</th>
              <th className="py-2.5 px-3">ధర & గెయిన్ (% Change)</th>
              <th className="py-2.5 px-3">క్వాలిఫై సమయం & ట్రిగ్గర్ ధర</th>
              <th className="py-2.5 px-3 text-center">రౌండెడ్ స్కోర్</th>
              <th className="py-2.5 px-3 text-center">ఖచ్చితమైన నార్మలైజ్డ్ స్కోర్</th>
              <th className="py-2.5 px-3">8-కాంపోనెంట్ వెయిటేజ్ వివరాలు</th>
              <th className="py-2.5 px-3">టై-బ్రేకర్ మెట్రిక్స్ (Priority)</th>
              <th className="py-2.5 px-3 text-right">యాక్షన్</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 bg-slate-950/60">
            {displayedStocks.map((stock, idx) => {
              const { overallScore, changePercent, dayHigh, currentPrice, rvol, buyerPressurePercent, sellerPressurePercent, cvdTrend } = stock;
              const distToHOD = dayHigh > 0 ? Math.max(0, ((dayHigh - currentPrice) / dayHigh) * 100) : 0;
              const isElite90 = overallScore.totalScore >= 90;

              return (
                <tr
                  key={stock.symbol}
                  className={`hover:bg-slate-900/50 transition-colors ${
                    isElite90 ? 'bg-amber-500/5' : ''
                  }`}
                >
                  {/* Rank */}
                  <td className="py-3 px-3">
                    <span
                      className={`font-mono font-black text-xs px-2 py-0.5 rounded-lg border inline-flex items-center gap-1 ${
                        idx === 0
                          ? 'bg-amber-400 text-slate-950 border-amber-300 font-extrabold shadow-sm'
                          : idx === 1
                          ? 'bg-slate-300 text-slate-950 border-slate-200'
                          : idx === 2
                          ? 'bg-amber-700 text-slate-100 border-amber-600'
                          : 'bg-slate-900 text-slate-300 border-slate-800'
                      }`}
                    >
                      {idx === 0 && <Flame className="w-3 h-3 text-slate-950" />}
                      #{stock.rank || idx + 1}
                    </span>
                  </td>

                  {/* Symbol */}
                  <td className="py-3 px-3">
                    <div className="font-bold text-slate-100 text-sm flex items-center gap-1.5">
                      <span>{stock.symbol}</span>
                      {isElite90 && (
                        <span className="text-[10px] text-amber-400 bg-amber-400/20 px-1.5 py-0.2 rounded font-mono font-bold border border-amber-400/30">
                          ⭐ 90+
                        </span>
                      )}
                      {morningTop10Symbols.includes(stock.symbol) && (
                        <span className="text-[9px] text-emerald-400 bg-emerald-400/10 px-1.5 py-0.2 rounded font-mono font-bold border border-emerald-400/30">
                          MORNING
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 truncate max-w-[140px]">{stock.name}</div>
                  </td>

                  {/* Price & Change */}
                  <td className="py-3 px-3 font-mono">
                    <div className="font-bold text-slate-200">₹{stock.currentPrice.toFixed(2)}</div>
                    <div
                      className={`text-[11px] font-semibold flex items-center gap-1 ${
                        changePercent >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      <span>{changePercent >= 0 ? '+' : ''}{changePercent.toFixed(2)}%</span>
                      <span className="text-slate-500 text-[10px]">
                        (HOD -{distToHOD.toFixed(2)}%)
                      </span>
                    </div>
                  </td>

                  {/* Qualification Data */}
                  <td className="py-3 px-3 font-mono">
                    {stock.qualification ? (
                      <div>
                        <div className="text-emerald-400 font-bold flex items-center gap-1 text-[11px]">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping inline-block" />
                          <span>{formatISTMarketTime(stock.qualification.qualifiedTime)}</span>
                        </div>
                        <div className="text-slate-200 text-[11px] font-bold">
                          ₹{stock.qualification.qualifiedPrice.toFixed(2)}
                        </div>
                        <div className="text-[9px] text-emerald-400/80 truncate max-w-[140px]" title={stock.qualification.triggerConditionTe}>
                          {stock.qualification.triggerConditionTe}
                        </div>
                        <div className="text-[10px] text-slate-300 font-mono mt-0.5 whitespace-nowrap">
                          <span className="text-emerald-300 font-bold">క్వాలిఫై #{stock.qualification.qualifiedRank ?? stock.rank ?? '—'}</span>
                          <span className="text-slate-500"> ➔ </span>
                          <span className="text-amber-300 font-bold">ప్రస్తుతం #{stock.rank ?? '—'}</span>
                        </div>
                      </div>
                    ) : (
                      <span className="text-slate-600 text-[10px]">--</span>
                    )}
                  </td>

                  {/* Rounded Score */}
                  <td className="py-3 px-3 text-center">
                    <span
                      className={`font-mono text-base font-black px-2.5 py-1 rounded-xl border inline-block ${
                        isElite90
                          ? 'bg-amber-400/20 text-amber-300 border-amber-400/60 shadow-md shadow-amber-500/10'
                          : overallScore.totalScore >= 75
                          ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60'
                          : 'bg-slate-900 text-slate-300 border-slate-800'
                      }`}
                    >
                      {overallScore.totalScore}
                    </span>
                  </td>

                  {/* Exact Normalized Score */}
                  <td className="py-3 px-3 text-center font-mono">
                    <div className="text-sm font-bold text-cyan-300">
                      {overallScore.normalizedScore !== undefined ? overallScore.normalizedScore.toFixed(2) : overallScore.totalScore.toFixed(2)}
                    </div>
                    <div className="text-[10px] text-slate-500">/ 100.00 max</div>
                  </td>

                  {/* 8-Component Breakdown */}
                  <td className="py-3 px-3">
                    <div className="flex flex-wrap items-center gap-1 max-w-xs font-mono text-[10px]">
                      <span className="bg-slate-900 text-amber-300 px-1.5 py-0.5 rounded border border-slate-800" title="మొమెంటమ్ & HOD సామీప్యత (గరిష్టం: 20)">
                        ⚡Mom:{overallScore.momentum}/20
                      </span>
                      <span className="bg-slate-900 text-cyan-300 px-1.5 py-0.5 rounded border border-slate-800" title="RVOL & వాల్యూమ్ సర్జ్ (గరిష్టం: 15)">
                        📊Vol:{overallScore.volume}/15
                      </span>
                      <span className="bg-slate-900 text-emerald-300 px-1.5 py-0.5 rounded border border-slate-800" title="ట్రెండ్ & EMA అలైన్‌మెంట్ (గరిష్టం: 15)">
                        📈Trd:{overallScore.trend}/15
                      </span>
                      <span className="bg-slate-900 text-emerald-300 px-1.5 py-0.5 rounded border border-slate-800" title="20-మినిట్ పర్సిస్టెన్స్ (గరిష్టం: 15)">
                        ⏱️Per:{overallScore.persistence}/15
                      </span>
                      <span className="bg-slate-900 text-cyan-300 px-1.5 py-0.5 rounded border border-slate-800" title="ఆర్డర్ ఫ్లో & CVD (గరిష్టం: 15)">
                        🌊OF:{overallScore.orderFlow}/15
                      </span>
                      <span className="bg-slate-900 text-emerald-300 px-1.5 py-0.5 rounded border border-slate-800" title="VWAP సపోర్ట్ (గరిష్టం: 10)">
                        🎯VWAP:{overallScore.vwap}/10
                      </span>
                      <span className="bg-slate-900 text-amber-300 px-1.5 py-0.5 rounded border border-slate-800" title="బ్రేక్‌అవుట్ రూమ్ (గరిష్టం: 5)">
                        🚪Rm:{overallScore.liquidityLevels}/5
                      </span>
                      <span className="bg-slate-900 text-slate-300 px-1.5 py-0.5 rounded border border-slate-800" title="క్యాండిల్ స్ట్రక్చర్ (గరిష్టం: 5)">
                        🕯️Cdl:{overallScore.candleStructure}/5
                      </span>
                      {stock.penaltyPoints && stock.penaltyPoints > 0 ? (
                        <span className="bg-rose-950 text-rose-300 px-1.5 py-0.5 rounded border border-rose-800 font-bold" title={`వెయిటేజ్ తగ్గింపు: ${stock.redCandlePercent}% రెడ్ క్యాండిల్స్ (${stock.activeRedThreshold ?? 40}% పరిమితి కంటే ఎక్కువ)`}>
                          🔻Pen:-{stock.penaltyPoints} ({stock.redCandlePercent}% R &gt; {stock.activeRedThreshold ?? 40}%)
                        </span>
                      ) : null}
                    </div>
                  </td>

                  {/* Tie-Breaker Priority Metrics */}
                  <td className="py-3 px-3 font-mono text-[11px]">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1 text-amber-300">
                        <span className="text-[10px] text-slate-400">1.MomVel:</span>
                        <strong>{overallScore.tieBreakers?.momentumVelocity ?? (changePercent * 2.5).toFixed(1)}</strong>
                        <span className="text-[10px] text-slate-500">(-{distToHOD.toFixed(1)}% HOD)</span>
                      </div>
                      <div className="flex items-center gap-1 text-cyan-300">
                        <span className="text-[10px] text-slate-400">2.RVOL:</span>
                        <strong>{rvol.toFixed(2)}×</strong>
                        <span className="text-[10px] text-slate-500">(Idx: {overallScore.tieBreakers?.rvolConsistency ?? (rvol * 10).toFixed(0)})</span>
                      </div>
                      <div className="flex items-center gap-1 text-emerald-300">
                        <span className="text-[10px] text-slate-400">3.OrderFlow:</span>
                        <strong>{buyerPressurePercent}% B</strong>
                        <span className="text-[10px] text-slate-500">({cvdTrend})</span>
                      </div>
                    </div>
                  </td>

                  {/* Action */}
                  <td className="py-3 px-3 text-right">
                    <button
                      onClick={() => onSelectStock(stock)}
                      className="px-2.5 py-1.5 bg-slate-900 hover:bg-emerald-950 text-emerald-400 hover:text-emerald-300 rounded-lg border border-slate-800 hover:border-emerald-700/60 font-semibold text-xs flex items-center gap-1 ml-auto transition-all"
                    >
                      <span>విశ్లేషణ</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
