import React, { useState, useMemo } from 'react';
import { StockIndicatorData } from '../types';
import { Trophy, Medal, Star, ChevronDown, ChevronUp, ArrowUpRight, TrendingUp, Sparkles, Filter, Info, CheckCircle2, Brain, ShieldAlert } from 'lucide-react';
import { formatISTMarketTime } from '../utils/istTime';

interface TopRankedLeaderboardProps {
  stocks: StockIndicatorData[];
  onSelectStock: (stock: StockIndicatorData) => void;
  selectedStockSymbol?: string;
  morningTop10Symbols?: string[];
}

export const TopRankedLeaderboard: React.FC<TopRankedLeaderboardProps> = ({
  stocks,
  onSelectStock,
  selectedStockSymbol,
  morningTop10Symbols = [],
}) => {
  const [viewMode, setViewMode] = useState<'TOP_10' | 'ELITE_90' | 'RVOL' | 'ALL'>('TOP_10');
  const [isExpandedTable, setIsExpandedTable] = useState<boolean>(true);
  const [allPageLimit, setAllPageLimit] = useState<number>(50);

  // Ensure stocks are strictly filtered to Price ₹100-₹3,000 AND Market Cap >= 500 Cr, then sorted strictly by rank
  const sortedStocks = useMemo(() => {
    return [...stocks]
      .filter(s => s.currentPrice >= 100 && s.currentPrice <= 3000 && (s.marketCapCr || 0) >= 500)
      .sort((a, b) => (a.rank || 999) - (b.rank || 999));
  }, [stocks]);

  // STRICT USER MANDATE: Top 10 Pool ONLY allows Priority 1 -> Priority 2 -> Priority 3 (Tier 4 completely excluded!)
  const top10PriorityPool = useMemo(() => {
    return sortedStocks
      .filter(
        s =>
          (s.adv3M || s.adv || s.avgVolume || 0) > 25000 &&
          (s.fiveDayBaseProfile?.priorityTier ?? 4) <= 3
      )
      .slice(0, 10);
  }, [sortedStocks]);

  const displayList = useMemo(() => {
    if (viewMode === 'ELITE_90') {
      return sortedStocks.filter(s => s.overallScore.totalScore >= 90);
    }
    if (viewMode === 'RVOL') {
      return [...sortedStocks].sort((a, b) => b.rvol - a.rvol).slice(0, 50);
    }
    if (viewMode === 'ALL') {
      return sortedStocks.slice(0, allPageLimit);
    }
    return top10PriorityPool;
  }, [sortedStocks, top10PriorityPool, viewMode, allPageLimit]);

  const eliteCount = useMemo(() => {
    return sortedStocks.filter(s => s.overallScore.totalScore >= 90).length;
  }, [sortedStocks]);

  const consistentCount = useMemo(() => {
    if (morningTop10Symbols.length === 0) return 0;
    const currentTop10 = top10PriorityPool.map(s => s.symbol);
    return currentTop10.filter(sym => morningTop10Symbols.includes(sym)).length;
  }, [top10PriorityPool, morningTop10Symbols]);

  const priorityCounts = useMemo(() => {
    let p1 = 0;
    let p2 = 0;
    let p3 = 0;
    let p4 = 0;
    sortedStocks.forEach(s => {
      if ((s.adv3M || s.adv || s.avgVolume || 0) <= 25000) return;
      if (s.currentVolume <= 0 && s.changePercent === 0) return;
      const tier = s.fiveDayBaseProfile?.priorityTier ?? 4;
      if (tier === 1) p1++;
      else if (tier === 2) p2++;
      else if (tier === 3) p3++;
      else p4++;
    });
    return { p1, p2, p3, p4 };
  }, [sortedStocks]);

  const activeBrain = useMemo(() => {
    return top10PriorityPool[0]?.adaptiveBrain || sortedStocks.find(s => s.adaptiveBrain)?.adaptiveBrain;
  }, [top10PriorityPool, sortedStocks]);

  if (sortedStocks.length === 0) return null;

  const top1 = top10PriorityPool[0];
  const top2 = top10PriorityPool[1];
  const top3 = top10PriorityPool[2];

  return (
    <section
      id="top-ranked-leaderboard"
      className="bg-gradient-to-b from-slate-900 via-slate-900/95 to-slate-950 border-2 border-amber-500/40 rounded-2xl p-4 sm:p-5 shadow-2xl relative overflow-hidden"
    >
      {/* Decorative background glow */}
      <div className="absolute top-0 right-0 w-96 h-40 bg-amber-500/10 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-80 h-32 bg-emerald-500/10 blur-3xl pointer-events-none" />

      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800 relative z-10">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-black shadow-lg shadow-amber-400/30">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-100 flex items-center flex-wrap gap-2">
                <span>ఈరోజు టాప్ పొజిషన్ స్టాక్స్ (Top Technical Ranks)</span>
                <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/40">
                  🥇 P1 → 🥈 P2 → 🥉 P3 ప్రయారిటీ ఫస్ట్
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                టెక్నికల్ స్కోర్ ఎంత ఉన్నా <strong>ప్రయారిటీ 1 &amp; 2</strong> స్టాక్స్‌కే టాప్-10 లో మొదటి స్థానాలు (స్థానాలు మిగిలితేనే ప్రయారిటీ 3; <strong className="text-rose-300">Tier-4 టాప్-10 లో పూర్తిగా అవాయిడ్</strong>).
              </p>
            </div>
          </div>
        </div>

        {/* View Mode Filters */}
        <div className="flex items-center gap-1.5 bg-slate-950/80 p-1 rounded-xl border border-slate-800">
          <button
            id="btn-leaderboard-top10"
            onClick={() => setViewMode('TOP_10')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              viewMode === 'TOP_10'
                ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            🏆 టాప్ 10 (Top 10)
          </button>
          <button
            id="btn-leaderboard-elite90"
            onClick={() => setViewMode('ELITE_90')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${
              viewMode === 'ELITE_90'
                ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20'
                : 'text-amber-300/80 hover:text-amber-300'
            }`}
          >
            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
            <span>90+ ఎలైట్ ({eliteCount})</span>
          </button>
          <button
            id="btn-leaderboard-all"
            onClick={() => setViewMode('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              viewMode === 'ALL'
                ? 'bg-slate-700 text-slate-100 shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            అన్ని ({sortedStocks.length})
          </button>
          <button
            id="btn-leaderboard-rvol"
            onClick={() => setViewMode('RVOL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              viewMode === 'RVOL'
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                : 'text-emerald-400/80 hover:text-emerald-300'
            }`}
          >
            🔥 RVOL
          </button>
        </div>
      </div>

      {/* Comparison Summary Banner (Morning vs Now) */}
      {morningTop10Symbols.length > 0 && viewMode === 'TOP_10' && top10PriorityPool.length > 0 && (
        <div className="mt-3 p-2.5 bg-amber-950/20 border border-amber-500/30 rounded-xl flex items-center justify-between gap-3 text-xs relative z-10">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span className="text-slate-300">
              <strong className="text-amber-300">లీడర్‌బోర్డ్ వ్యత్యాసం (Morning vs Now):</strong> ఉదయం టాప్ 10 లో ఉన్న వాటిలో <strong>{consistentCount}</strong> స్టాక్స్ ఇప్పటికీ తమ స్థానాలను కాపాడుకున్నాయి. మిగిలిన <strong>{Math.max(0, top10PriorityPool.length - consistentCount)}</strong> కొత్తవి.
            </span>
          </div>
          <div className="flex items-center gap-2 font-mono font-bold whitespace-nowrap">
            <span className="px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-800/50" title="ఉదయం నుండి టాప్ 10 లోనే కొనసాగుతున్నవి">
              {consistentCount} పాతవి
            </span>
            <span className="px-2 py-0.5 rounded bg-amber-400 text-slate-950" title="ఇటీవల టాప్ 10 లోకి ప్రవేశించినవి">
              {Math.max(0, top10PriorityPool.length - consistentCount)} కొత్తవి
            </span>
          </div>
        </div>
      )}

      {/* Adaptive Thinking Brain Status Banner */}
      {activeBrain && (
        <div className="mt-3 p-3 bg-gradient-to-r from-indigo-950/60 via-slate-900/95 to-cyan-950/40 border border-indigo-400/40 rounded-xl flex flex-col gap-2 text-xs relative z-10">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-black text-indigo-200">
              <Brain className="w-4 h-4 text-cyan-400 flex-shrink-0" />
              <span>🧠 అడాప్టివ్ థింకింగ్ బ్రెయిన్ (Self-Adjusting Market Brain):</span>
              <span
                className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                  activeBrain.brainRegime === 'LOOSE_EARLY_CAPTURE'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/50'
                    : activeBrain.brainRegime === 'BALANCED_PROGRESSIVE'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-400/50'
                    : 'bg-rose-500/20 text-rose-300 border-rose-400/50'
                }`}
              >
                {activeBrain.brainRegimeLabelTe}
              </span>
            </div>
            <div className="flex items-center gap-1.5 font-mono text-[10px] font-bold">
              <span className="px-2 py-0.5 rounded bg-slate-800 text-cyan-300 border border-cyan-500/30">
                P1+P2 పూల్: {activeBrain.p12PoolCount}
              </span>
              <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-200 border border-indigo-400/40">
                ⚡ అపెక్స్ లీడర్లు: టాప్ {activeBrain.apexSurvivingCount}
              </span>
            </div>
          </div>
          <p className="text-[11px] text-slate-300 leading-relaxed">
            {activeBrain.brainSummaryTe}
          </p>
          {activeBrain.progressiveLayersAppliedTe.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              <span className="text-[10px] font-bold text-slate-400">అప్లై చేసిన లేయర్లు:</span>
              {activeBrain.progressiveLayersAppliedTe.map((lbl, idx) => (
                <span
                  key={idx}
                  className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950/70 text-cyan-300 border border-cyan-500/30"
                >
                  ✓ {lbl}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 5-Day Low Volume & Price Change Cascading Priority Ribbon (User Mandate) */}
      <div className="mt-3 p-3 bg-gradient-to-r from-emerald-950/40 via-slate-900/90 to-amber-950/30 border border-emerald-500/30 rounded-xl flex flex-wrap items-center justify-between gap-2.5 text-xs relative z-10">
        <div className="space-y-0.5">
          <div className="font-black text-emerald-300 flex items-center gap-1.5">
            <span>📊 5-రోజుల లో-వాల్యూమ్ & ప్రైస్ బేస్ ర్యాంకింగ్ ప్రయారిటీ ఆర్డర్ (Priority-First Top 10 Mandate):</span>
          </div>
          <p className="text-[11px] text-slate-300">
            <strong className="text-emerald-400">1వ ప్రయారిటీ</strong> (5 రోజులు &lt;2% పెరుగుదల) ➔ <strong className="text-cyan-400">2వ ప్రయారిటీ</strong> (1 రోజు &gt;2%, 4 రోజులు &lt;2%) ➔ <strong className="text-amber-400">3వ ప్రయారిటీ</strong> (స్థానాలు మిగిలితేనే). <strong className="text-rose-300">Tier-4 స్టాక్స్ టాప్-10 నుండి పూర్తిగా మినహాయించబడ్డాయి!</strong>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11px] font-bold">
          <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40" title="అన్ని 5 రోజుల్లో ధర < 2% మరియు తక్కువ వాల్యూమ్">
            🥇 1వ ప్రయారిటీ: {priorityCounts.p1} {priorityCounts.p1 > 0 ? `(#1 - #${Math.min(10, priorityCounts.p1)})` : ''}
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/40" title="ఒక రోజు > 2% మరియు 4 రోజులు < 2% + తక్కువ వాల్యూమ్">
            🥈 2వ ప్రయారిటీ: {priorityCounts.p2} {priorityCounts.p2 > 0 ? `(#${priorityCounts.p1 + 1} - #${priorityCounts.p1 + priorityCounts.p2})` : ''}
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40" title="3 రోజులు < 2%, 1 రోజు < 3% (~2.5%), 1 రోజు > 3% + తక్కువ వాల్యూమ్">
            🥉 3వ ప్రయారిటీ: {priorityCounts.p3}
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-rose-950/60 text-rose-300 border border-rose-500/40" title="టాప్-10 నుండి పూర్తిగా తొలగించబడినవి">
            🚫 Tier-4 అవాయిడ్: {priorityCounts.p4}
          </span>
        </div>
      </div>

      {/* Empty state if no Priority 1/2/3 stocks yet in TOP_10 mode */}
      {top10PriorityPool.length === 0 && viewMode === 'TOP_10' && (
        <div className="my-4 p-4 rounded-xl bg-slate-900/80 border border-slate-700 flex items-center gap-3 text-xs text-slate-300 relative z-10">
          <ShieldAlert className="w-5 h-5 text-amber-400 flex-shrink-0" />
          <div>
            <div className="font-bold text-amber-300">ప్రస్తుతం ప్రయారిటీ 1, 2 లేదా 3 స్టాక్స్ ఇంకా ఏర్పడలేదు</div>
            <p className="text-slate-400 mt-0.5">
              మీ నిబంధన ప్రకారం 5-రోజుల ప్రైస్ &amp; వాల్యూమ్ బేస్ లేని Tier-4 స్టాక్స్‌ను (స్కోర్ ఎక్కువ ఉన్నా) టాప్-10 లో చూపడం లేదు. లైవ్ స్కాన్ పూర్తయిన వెంటనే అర్హత ఉన్న P1/P2/P3 స్టాక్స్ ఇక్కడ #1, #2, #3... ర్యాంకులతో కనిపిస్తాయి.
            </p>
          </div>
        </div>
      )}

      {/* Podium Showcase: Top 3 Gold, Silver, Bronze Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 my-4 relative z-10">
        {/* Rank #1 Gold */}
        {top1 && (
          <div
            onClick={() => onSelectStock(top1)}
            className={`cursor-pointer rounded-xl p-3.5 border-2 transition-all relative overflow-hidden group ${
              selectedStockSymbol === top1.symbol
                ? 'bg-amber-950/40 border-amber-400 shadow-xl shadow-amber-500/20 ring-2 ring-amber-400/50'
                : 'bg-gradient-to-br from-amber-500/15 via-slate-900 to-slate-950 border-amber-400/60 hover:border-amber-400 hover:bg-amber-950/20'
            }`}
          >
            {/* Morning badge */}
            {morningTop10Symbols.length > 0 && (
              morningTop10Symbols.includes(top1.symbol) ? (
                <div className="absolute top-0 right-0 bg-emerald-500 text-slate-950 text-[9px] font-black px-2 py-0.5 rounded-bl-lg shadow-md z-20">
                  ఉదయం లీడర్ (MORNING LEADER)
                </div>
              ) : (
                <div className="absolute top-0 right-0 bg-amber-400 text-slate-950 text-[9px] font-black px-2 py-0.5 rounded-bl-lg shadow-md z-20 flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5 fill-slate-950" /> కొత్తగా చేరినవి (NEW ENTRANT)
                </div>
              )
            )}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-400 text-slate-950 flex items-center justify-center font-black text-sm shadow-md shadow-amber-400/50">
                  #1
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-black text-base text-amber-300 group-hover:text-amber-200">
                      {top1.symbol}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-400/20 text-amber-300 border border-amber-400/40 font-bold">
                      🥇 నం. 1 లీడర్
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 truncate max-w-[160px]">
                    {top1.name}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] uppercase font-bold text-amber-400/90">స్కోర్ (Score)</div>
                <div className="text-xl font-black font-mono text-amber-300 leading-none">
                  {top1.overallScore.totalScore}
                  <span className="text-xs font-normal text-amber-400/60">/100</span>
                </div>
              </div>
            </div>
            <div className="mt-2.5 pt-2 border-t border-amber-500/30 flex items-center justify-between text-xs font-mono">
              <div>
                <span className="text-slate-100 font-bold">₹{top1.currentPrice.toFixed(2)}</span>{' '}
                <span className={top1.change >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                  ({top1.change >= 0 ? '+' : ''}{top1.changePercent.toFixed(2)}%)
                </span>
              </div>
              <div className="flex items-center gap-2 text-[11px] flex-wrap">
                <span className="text-slate-400">RVOL: <strong className="text-amber-300">{top1.rvol.toFixed(1)}x</strong></span>
                {top1.qualification?.qualifiedTime && (
                  <span className="text-amber-300 font-bold bg-amber-400/20 px-1.5 py-0.5 rounded border border-amber-400/40 text-[10px] flex items-center gap-1">
                    <span>🕒 {top1.qualification.qualifiedTime}</span>
                    <span className="text-slate-500">|</span>
                    <span className="text-emerald-300">క్వాలిఫై #{top1.qualification.qualifiedRank ?? top1.rank}</span>
                    <span className="text-slate-500">➔</span>
                    <span className="text-amber-200">ప్రస్తుతం #{top1.rank}</span>
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Rank #2 Silver */}
        {top2 && (
          <div
            onClick={() => onSelectStock(top2)}
            className={`cursor-pointer rounded-xl p-3.5 border-2 transition-all relative overflow-hidden group ${
              selectedStockSymbol === top2.symbol
                ? 'bg-slate-800/80 border-slate-300 shadow-xl ring-2 ring-slate-300/50'
                : 'bg-gradient-to-br from-slate-700/20 via-slate-900 to-slate-950 border-slate-400/50 hover:border-slate-300 hover:bg-slate-800/40'
            }`}
          >
            {/* Morning badge */}
            {morningTop10Symbols.length > 0 && (
              morningTop10Symbols.includes(top2.symbol) ? (
                <div className="absolute top-0 right-0 bg-emerald-500 text-slate-950 text-[9px] font-black px-2 py-0.5 rounded-bl-lg shadow-md z-20">
                  ఉదయం లీడర్
                </div>
              ) : (
                <div className="absolute top-0 right-0 bg-amber-400 text-slate-950 text-[9px] font-black px-2 py-0.5 rounded-bl-lg shadow-md z-20">
                  కొత్తగా
                </div>
              )
            )}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-slate-200 text-slate-950 flex items-center justify-center font-black text-sm shadow-md">
                  #2
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-black text-base text-slate-100 group-hover:text-emerald-400">
                      {top2.symbol}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-700 text-slate-200 border border-slate-600 font-bold">
                      🥈 ర్యాంక్ 2
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 truncate max-w-[160px]">
                    {top2.name}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] uppercase font-bold text-slate-400">స్కోర్ (Score)</div>
                <div className="text-xl font-black font-mono text-slate-100 leading-none">
                  {top2.overallScore.totalScore}
                  <span className="text-xs font-normal text-slate-400">/100</span>
                </div>
              </div>
            </div>
            <div className="mt-2.5 pt-2 border-t border-slate-800 flex items-center justify-between text-xs font-mono">
              <div>
                <span className="text-slate-100 font-bold">₹{top2.currentPrice.toFixed(2)}</span>{' '}
                <span className={top2.change >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                  ({top2.change >= 0 ? '+' : ''}{top2.changePercent.toFixed(2)}%)
                </span>
              </div>
              <div className="flex items-center gap-2 text-[11px] flex-wrap">
                <span className="text-slate-400">RVOL: <strong className="text-slate-200">{top2.rvol.toFixed(1)}x</strong></span>
                {top2.qualification?.qualifiedTime && (
                  <span className="text-slate-200 font-bold bg-slate-800 px-1.5 py-0.5 rounded border border-slate-600 text-[10px] flex items-center gap-1">
                    <span>🕒 {top2.qualification.qualifiedTime}</span>
                    <span className="text-slate-500">|</span>
                    <span className="text-emerald-300">క్వాలిఫై #{top2.qualification.qualifiedRank ?? top2.rank}</span>
                    <span className="text-slate-500">➔</span>
                    <span className="text-slate-100">ప్రస్తుతం #{top2.rank}</span>
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Rank #3 Bronze */}
        {top3 && (
          <div
            onClick={() => onSelectStock(top3)}
            className={`cursor-pointer rounded-xl p-3.5 border-2 transition-all relative overflow-hidden group ${
              selectedStockSymbol === top3.symbol
                ? 'bg-amber-950/30 border-amber-600 shadow-xl ring-2 ring-amber-600/50'
                : 'bg-gradient-to-br from-amber-700/15 via-slate-900 to-slate-950 border-amber-600/40 hover:border-amber-500 hover:bg-amber-950/20'
            }`}
          >
            {/* Morning badge */}
            {morningTop10Symbols.length > 0 && (
              morningTop10Symbols.includes(top3.symbol) ? (
                <div className="absolute top-0 right-0 bg-emerald-500 text-slate-950 text-[9px] font-black px-2 py-0.5 rounded-bl-lg shadow-md z-20">
                  ఉదయం లీడర్
                </div>
              ) : (
                <div className="absolute top-0 right-0 bg-amber-400 text-slate-950 text-[9px] font-black px-2 py-0.5 rounded-bl-lg shadow-md z-20">
                  కొత్తగా
                </div>
              )
            )}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-600 text-slate-950 flex items-center justify-center font-black text-sm shadow-md">
                  #3
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-black text-base text-amber-200 group-hover:text-amber-100">
                      {top3.symbol}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-900/40 text-amber-300 border border-amber-600/40 font-bold">
                      🥉 ర్యాంక్ 3
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 truncate max-w-[160px]">
                    {top3.name}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] uppercase font-bold text-amber-500/90">స్కోర్ (Score)</div>
                <div className="text-xl font-black font-mono text-amber-200 leading-none">
                  {top3.overallScore.totalScore}
                  <span className="text-xs font-normal text-amber-400/60">/100</span>
                </div>
              </div>
            </div>
            <div className="mt-2.5 pt-2 border-t border-slate-800 flex items-center justify-between text-xs font-mono">
              <div>
                <span className="text-slate-100 font-bold">₹{top3.currentPrice.toFixed(2)}</span>{' '}
                <span className={top3.change >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                  ({top3.change >= 0 ? '+' : ''}{top3.changePercent.toFixed(2)}%)
                </span>
              </div>
              <div className="flex items-center gap-2 text-[11px] flex-wrap">
                <span className="text-slate-400">RVOL: <strong className="text-amber-300">{top3.rvol.toFixed(1)}x</strong></span>
                {top3.qualification?.qualifiedTime && (
                  <span className="text-amber-300 font-bold bg-amber-950/80 px-1.5 py-0.5 rounded border border-amber-600/50 text-[10px] flex items-center gap-1">
                    <span>🕒 {top3.qualification.qualifiedTime}</span>
                    <span className="text-amber-600">|</span>
                    <span className="text-emerald-300">క్వాలిఫై #{top3.qualification.qualifiedRank ?? top3.rank}</span>
                    <span className="text-amber-600">➔</span>
                    <span className="text-amber-200">ప్రస్తుతం #{top3.rank}</span>
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Horizontal Scroller / Quick Rank List for Ranks #4 to #10 */}
      <div className="relative z-10">
        <div className="flex items-center justify-between py-2 text-xs font-bold text-slate-300">
          <span className="flex items-center gap-1.5">
            <span>ర్యాంకింగ్ క్రమం (Rank Hierarchy: Descending by Score)</span>
            <span className="text-[10px] font-normal text-slate-400">
              ({displayList.length} స్టాక్స్ ప్రదర్శించబడుతున్నాయి)
            </span>
          </span>
          <button
            onClick={() => setIsExpandedTable(!isExpandedTable)}
            className="text-amber-400 hover:text-amber-300 flex items-center gap-1 text-xs font-semibold py-0.5 px-2 rounded-lg hover:bg-slate-800 transition-colors"
          >
            {isExpandedTable ? (
              <>
                <span>టేబుల్ కుదించండి (Collapse Table)</span>
                <ChevronUp className="w-3.5 h-3.5" />
              </>
            ) : (
              <>
                <span>పూర్తి ర్యాంకింగ్ టేబుల్ చూడండి (View Full Ranking Table)</span>
                <ChevronDown className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>

        {/* Quick Chips Row for immediate glance */}
        {!isExpandedTable && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1 no-scrollbar">
            {displayList.slice(3, 12).map((s) => (
              <button
                key={s.symbol}
                onClick={() => onSelectStock(s)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs shrink-0 transition-all font-mono ${
                  selectedStockSymbol === s.symbol
                    ? 'bg-amber-400/20 border-amber-400 text-amber-300 ring-1 ring-amber-400'
                    : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-850'
                }`}
              >
                <span
                  className={`font-black px-1.5 py-0.2 rounded text-[11px] ${
                    s.rank && s.rank <= 5
                      ? 'bg-amber-400/30 text-amber-300 border border-amber-400/40'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  #{s.rank}
                </span>
                <span className="font-bold text-slate-100">{s.symbol}</span>
                <span
                  className={`font-black ${
                    s.overallScore.totalScore >= 90
                      ? 'text-amber-300'
                      : s.overallScore.totalScore >= 80
                      ? 'text-emerald-400'
                      : 'text-slate-300'
                  }`}
                >
                  {s.overallScore.totalScore}
                  <span className="text-[10px] opacity-60 font-normal">pts</span>
                </span>
                <span className={s.change >= 0 ? 'text-emerald-400 text-[11px]' : 'text-rose-400 text-[11px]'}>
                  {s.changePercent >= 0 ? '+' : ''}{s.changePercent.toFixed(1)}%
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Expanded Full Interactive Ranking Table */}
        {isExpandedTable && (
          <div className="mt-3 overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/90 shadow-inner">
            <table className="w-full text-left text-xs border-collapse font-sans">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/90 text-slate-400 font-mono text-[11px]">
                  <th className="py-2.5 px-3">ర్యాంక్ (Rank)</th>
                  <th className="py-2.5 px-3">స్టాక్ సింబల్ (Symbol)</th>
                  <th className="py-2.5 px-3 text-right">మొత్తం స్కోర్ (Total Score)</th>
                  <th className="py-2.5 px-3 text-right">లైవ్ ధర (Price)</th>
                  <th className="py-2.5 px-3 text-right">మార్పు % (Change)</th>
                  <th className="py-2.5 px-3 text-right">RVOL</th>
                  <th className="py-2.5 px-3 text-center">5-రోజుల ప్రయారిటీ (5D Priority)</th>
                  <th className="py-2.5 px-3 text-center">క్వాలిఫై సమయం (Qualify Time)</th>
                  <th className="py-2.5 px-3 text-center">ఉదయం స్థితి (Session Start)</th>
                  <th className="py-2.5 px-3 text-center">కేటగిరీ (Category)</th>
                  <th className="py-2.5 px-3 text-right">చర్య (Action)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850 font-mono">
                {displayList.map((stk) => {
                  const isTop3 = stk.rank && stk.rank <= 3;
                  const isElite = stk.overallScore.totalScore >= 90;
                  return (
                    <tr
                      key={stk.symbol}
                      onClick={() => onSelectStock(stk)}
                      className={`cursor-pointer transition-colors ${
                        selectedStockSymbol === stk.symbol
                          ? 'bg-amber-500/20 text-white font-bold'
                          : 'hover:bg-slate-850/80 text-slate-300'
                      }`}
                    >
                      <td className="py-2.5 px-3 font-bold">
                        <span
                          className={`inline-flex items-center justify-center w-7 h-6 rounded-md font-black text-xs ${
                            stk.rank === 1
                              ? 'bg-amber-400 text-slate-950 shadow-md'
                              : stk.rank === 2
                              ? 'bg-slate-200 text-slate-950 font-bold'
                              : stk.rank === 3
                              ? 'bg-amber-700 text-white font-bold'
                              : isElite
                              ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          #{stk.rank}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-slate-100 flex items-center gap-1.5">
                          <span>{stk.symbol}</span>
                          {isElite && <span className="text-amber-400 text-[10px]">⭐</span>}
                        </div>
                        <div className="text-[10px] text-slate-400 font-sans truncate max-w-[140px]">
                          {stk.name}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <span
                          className={`font-black text-sm px-2 py-0.5 rounded-md ${
                            isElite
                              ? 'bg-amber-400/20 text-amber-300 border border-amber-400/40'
                              : stk.overallScore.totalScore >= 80
                              ? 'text-emerald-400'
                              : 'text-slate-300'
                          }`}
                        >
                          {stk.overallScore.totalScore}/100
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-200">
                        ₹{stk.currentPrice.toFixed(2)}
                      </td>
                      <td
                        className={`py-2.5 px-3 text-right font-bold ${
                          stk.change >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {stk.change >= 0 ? '+' : ''}{stk.changePercent.toFixed(2)}%
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <span className={`font-mono font-bold ${stk.rvol >= 5.0 ? 'text-amber-300 bg-amber-400/20 px-1.5 py-0.5 rounded border border-amber-400/40' : stk.rvol >= 2.0 ? 'text-amber-400' : stk.rvol >= 1.2 ? 'text-emerald-400' : 'text-slate-300'}`}>
                          {stk.rvol.toFixed(2)}x
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center font-sans">
                        {stk.fiveDayBaseProfile ? (
                          <div className="flex flex-col items-center gap-0.5" title={stk.fiveDayBaseProfile.tierDescriptionTe}>
                            <div className="flex items-center gap-1">
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded-full font-bold border whitespace-nowrap ${
                                  stk.fiveDayBaseProfile.priorityTier === 1
                                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/50'
                                    : stk.fiveDayBaseProfile.priorityTier === 2
                                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400/50'
                                    : stk.fiveDayBaseProfile.priorityTier === 3
                                    ? 'bg-amber-500/20 text-amber-300 border-amber-400/50'
                                    : 'bg-rose-950/60 text-rose-300 border-rose-500/40'
                                }`}
                              >
                                {stk.fiveDayBaseProfile.priorityTier === 1
                                  ? '🥇 1వ ప్రయారిటీ (5D <2%)'
                                  : stk.fiveDayBaseProfile.priorityTier === 2
                                  ? '🥈 2వ ప్రయారిటీ (1D >2%)'
                                  : stk.fiveDayBaseProfile.priorityTier === 3
                                  ? '🥉 3వ ప్రయారిటీ (3D<2%,1D<3%)'
                                  : '🚫 Tier-4 (అవాయిడ్)'}
                              </span>
                              {stk.adaptiveBrain?.isTopApexLeader && (
                                <span
                                  className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-500/30 text-indigo-200 border border-indigo-400/50 font-black whitespace-nowrap"
                                  title="Adaptive Brain Top 3-5 Apex Leader"
                                >
                                  ⚡ Apex
                                </span>
                              )}
                            </div>
                            <span className="text-[9px] font-mono text-slate-400 whitespace-nowrap">
                              5D Max: {stk.fiveDayBaseProfile.max5DayGainPct >= 0 ? '+' : ''}{stk.fiveDayBaseProfile.max5DayGainPct}% | Vol: {stk.fiveDayBaseProfile.volumeVsTodayRatio}x
                              {stk.adaptiveBrain ? ` | Wt: ${Math.round(stk.adaptiveBrain.parallelWeightScore)}` : ''}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-600 text-[10px]">--</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono">
                        {stk.qualification?.qualifiedTime ? (
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-amber-300 font-bold bg-amber-400/15 px-2 py-0.5 rounded border border-amber-400/30 text-[11px] whitespace-nowrap">
                              🕒 {stk.qualification.qualifiedTime}
                            </span>
                            <div className="flex items-center gap-1 text-[10px] text-slate-300 whitespace-nowrap">
                              <span className="text-emerald-400 font-bold">క్వాలిఫై #{stk.qualification.qualifiedRank ?? stk.rank}</span>
                              <span className="text-slate-500">➔</span>
                              <span className="text-amber-300 font-bold">ప్రస్తుతం #{stk.rank}</span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-600 text-[10px]">--</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {morningTop10Symbols.length > 0 && morningTop10Symbols.includes(stk.symbol) ? (
                          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-500/40">
                            <CheckCircle2 className="w-3 h-3" /> ఉదయం నుండి (Leader)
                          </span>
                        ) : morningTop10Symbols.length > 0 ? (
                          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-400/20 text-amber-300 border border-amber-400/40">
                            <Sparkles className="w-3 h-3" /> కొత్త ఎంట్రీ (New)
                          </span>
                        ) : (
                          <span className="text-slate-600 text-[10px]">--</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center font-sans">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${
                            stk.category === 'ALREADY_STRONG'
                              ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40'
                              : stk.category === 'PRE_BREAKOUT'
                              ? 'bg-amber-950/80 text-amber-300 border-amber-500/40'
                              : 'bg-indigo-950/80 text-indigo-300 border-indigo-500/40'
                          }`}
                        >
                          {stk.category === 'ALREADY_STRONG'
                            ? 'ఆల్రెడీ స్ట్రాంగ్'
                            : stk.category === 'PRE_BREAKOUT'
                            ? 'బ్రేక్ అవుట్'
                            : 'డిప్ రికవరీ'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectStock(stk);
                          }}
                          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold border border-slate-700 inline-flex items-center gap-1 transition-colors"
                        >
                          <span>విశ్లేషణ</span>
                          <ArrowUpRight className="w-3 h-3 text-emerald-400" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Pagination / Load More for ALL view */}
            {viewMode === 'ALL' && allPageLimit < sortedStocks.length && (
              <div className="p-3 bg-slate-900/60 border-t border-slate-800 flex items-center justify-between">
                <span className="text-xs text-slate-400 font-mono">
                  చూపిస్తున్నవి: <strong className="text-slate-200">{displayList.length}</strong> / <strong>{sortedStocks.length}</strong> స్టాక్స్
                </span>
                <button
                  onClick={() => setAllPageLimit(prev => Math.min(sortedStocks.length, prev + 50))}
                  className="px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs shadow-md transition-colors"
                >
                  + మరిన్ని 50 స్టాక్స్ లోడ్ చేయండి (Load More 50)
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
};
