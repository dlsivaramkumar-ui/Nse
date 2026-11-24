import React, { useState, useMemo } from 'react';
import { Timeframe, PivotPoints } from '../types';
import { generateOrderBookForTimeframe } from '../engine/orderBookGenerator';
import {
  Layers,
  ShieldCheck,
  TrendingUp,
  Clock,
  Zap,
  DollarSign,
  BarChart2,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';

interface OrderBookProps {
  symbol: string;
  currentPrice: number;
  prevClose: number;
  dayHigh: number;
  dayLow: number;
  buyerPressurePercent: number;
  pivots: PivotPoints;
  vwap: number;
  avgVolume: number;
  initialTimeframe?: Timeframe;
}

export const OrderBook: React.FC<OrderBookProps> = ({
  symbol,
  currentPrice,
  prevClose,
  dayHigh,
  dayLow,
  buyerPressurePercent,
  pivots,
  vwap,
  avgVolume,
  initialTimeframe = '5M',
}) => {
  const [selectedTimeframe, setSelectedTimeframe] = useState<Timeframe>(initialTimeframe);

  const orderBook = useMemo(() => {
    return generateOrderBookForTimeframe({
      symbol,
      currentPrice,
      prevClose,
      dayHigh,
      dayLow,
      timeframe: selectedTimeframe,
      buyerPressurePercent,
      pivots,
      vwap,
      avgVolume,
    });
  }, [
    symbol,
    currentPrice,
    prevClose,
    dayHigh,
    dayLow,
    selectedTimeframe,
    buyerPressurePercent,
    pivots,
    vwap,
    avgVolume,
  ]);

  const totalDepth = orderBook.totalBidQty + orderBook.totalAskQty || 1;
  const bidDepthPercent = Math.round((orderBook.totalBidQty / totalDepth) * 100);
  const askDepthPercent = 100 - bidDepthPercent;

  return (
    <div className="bg-slate-900/95 border border-slate-800 rounded-2xl p-4 sm:p-5 text-slate-200 shadow-2xl">
      {/* Header with Timeframe Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-cyan-950/80 border border-cyan-500/40 text-cyan-400">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-base text-slate-100">
                ఆర్డర్ బుక్ & మార్కెట్ డెప్త్ (Order Book Depth)
              </h3>
              <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono font-bold">
                {symbol}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              {selectedTimeframe === '5M' &&
                '5M టైమ్‌ఫ్రేమ్: మైక్రో లిక్విడిటీ, తక్షణ స్కేల్పింగ్ వాల్స్ & టేప్ ఎగ్జిక్యూషన్స్'}
              {selectedTimeframe === '15M' &&
                '15M టైమ్‌ఫ్రేమ్: ఇంట్రాడే స్వింగ్ బ్లాక్స్, VWAP సపోర్ట్ పూల్స్ & రీ-టెస్ట్ ఆర్డర్లు'}
              {selectedTimeframe === '1H' &&
                '1H టైమ్‌ఫ్రేమ్: మేజర్ పివోట్స్ (P, R1, S1) & సంస్థాగత (Institutional) లిమిట్ క్లస్టర్స్'}
            </p>
          </div>
        </div>

        {/* Timeframe Selector Buttons (5M / 15M / 1H) */}
        <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
          {(['5M', '15M', '1H'] as Timeframe[]).map((tf) => (
            <button
              key={tf}
              id={`btn-ob-tf-${tf.toLowerCase()}`}
              onClick={() => setSelectedTimeframe(tf)}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                selectedTimeframe === tf
                  ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
              }`}
            >
              <Clock className="w-3 h-3" />
              {tf}
            </button>
          ))}
        </div>
      </div>

      {/* Depth Metrics Header Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4 text-xs">
        <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800">
          <span className="text-slate-400 text-[11px] block">మార్కెట్ స్ప్రెడ్ (Spread)</span>
          <div className="flex items-baseline gap-1.5 mt-0.5">
            <span className="font-mono font-bold text-slate-200 text-sm">
              ₹{orderBook.spread.toFixed(2)}
            </span>
            <span className="font-mono text-[11px] text-slate-400">
              ({orderBook.spreadPercent.toFixed(2)}%)
            </span>
          </div>
        </div>

        <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800">
          <span className="text-slate-400 text-[11px] block">మొత్తం బిడ్లు (Total Bids)</span>
          <div className="font-mono font-bold text-emerald-400 text-sm mt-0.5">
            {orderBook.totalBidQty.toLocaleString('en-IN')}{' '}
            <span className="text-[10px] text-slate-400 font-normal">({bidDepthPercent}%)</span>
          </div>
        </div>

        <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800">
          <span className="text-slate-400 text-[11px] block">మొత్తం ఆస్క్‌లు (Total Asks)</span>
          <div className="font-mono font-bold text-rose-400 text-sm mt-0.5">
            {orderBook.totalAskQty.toLocaleString('en-IN')}{' '}
            <span className="text-[10px] text-slate-400 font-normal">({askDepthPercent}%)</span>
          </div>
        </div>

        <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800">
          <span className="text-slate-400 text-[11px] block">డెప్త్ నిష్పత్తి (Buyer Imbalance)</span>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span
              className={`font-mono font-bold text-sm ${
                orderBook.buyerRatio >= 55
                  ? 'text-emerald-400'
                  : orderBook.buyerRatio <= 45
                  ? 'text-rose-400'
                  : 'text-amber-400'
              }`}
            >
              {orderBook.buyerRatio}% బైయర్
            </span>
          </div>
        </div>
      </div>

      {/* Visual Imbalance Bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-[11px] font-mono font-semibold mb-1">
          <span className="text-emerald-400 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            కొనుగోలు బలం (Bids): {bidDepthPercent}%
          </span>
          <span className="text-rose-400 flex items-center gap-1">
            అమ్మకం ఒత్తిడి (Asks): {askDepthPercent}%
            <span className="w-2 h-2 rounded-full bg-rose-400" />
          </span>
        </div>
        <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden flex border border-slate-700/50">
          <div
            className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-300"
            style={{ width: `${bidDepthPercent}%` }}
          />
          <div
            className="h-full bg-gradient-to-r from-rose-500 to-rose-700 transition-all duration-300"
            style={{ width: `${askDepthPercent}%` }}
          />
        </div>
      </div>

      {/* Two Column Order Book: Bids (Left) & Asks (Right) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4 font-mono text-xs">
        {/* Bids Table */}
        <div className="bg-slate-950 rounded-xl p-3 border border-slate-800/90">
          <div className="flex items-center justify-between text-emerald-400 border-b border-slate-800 pb-2 mb-2 font-bold">
            <span className="flex items-center gap-1">
              🟢 కొనుగోలుదారులు (BIDS)
            </span>
            <div className="grid grid-cols-3 gap-2 text-right text-[11px] text-slate-400 font-medium">
              <span>ధర (₹)</span>
              <span>క్వాంటిటీ</span>
              <span>ఆర్డర్లు</span>
            </div>
          </div>

          <div className="space-y-1.5">
            {orderBook.bids.map((bid, i) => (
              <div
                key={i}
                className="relative flex items-center justify-between py-1 px-1.5 rounded overflow-hidden"
              >
                {/* Background Depth Bar */}
                <div
                  className="absolute inset-0 bg-emerald-950/40 border-r border-emerald-500/20"
                  style={{ width: `${bid.depthPercent}%` }}
                />

                <span className="relative z-10 flex items-center gap-1 font-bold text-emerald-400">
                  {bid.isWall && (
                    <span
                      title="భారీ కొనుగోలు గోడ (Institutional Bid Wall)"
                      className="text-[10px] bg-emerald-950 text-emerald-300 px-1 rounded border border-emerald-500/40"
                    >
                      WALL
                    </span>
                  )}
                  ₹{bid.price.toFixed(2)}
                </span>

                <div className="relative z-10 grid grid-cols-3 gap-2 text-right">
                  <span className="text-slate-300">₹{bid.price.toFixed(2)}</span>
                  <span className="font-bold text-slate-100">{bid.quantity.toLocaleString('en-IN')}</span>
                  <span className="text-slate-400">{bid.orders}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Asks Table */}
        <div className="bg-slate-950 rounded-xl p-3 border border-slate-800/90">
          <div className="flex items-center justify-between text-rose-400 border-b border-slate-800 pb-2 mb-2 font-bold">
            <span className="flex items-center gap-1">
              🔴 అమ్మకందారులు (ASKS)
            </span>
            <div className="grid grid-cols-3 gap-2 text-right text-[11px] text-slate-400 font-medium">
              <span>ధర (₹)</span>
              <span>క్వాంటిటీ</span>
              <span>ఆర్డర్లు</span>
            </div>
          </div>

          <div className="space-y-1.5">
            {orderBook.asks.map((ask, i) => (
              <div
                key={i}
                className="relative flex items-center justify-between py-1 px-1.5 rounded overflow-hidden"
              >
                {/* Background Depth Bar */}
                <div
                  className="absolute inset-0 bg-rose-950/40 border-r border-rose-500/20"
                  style={{ width: `${ask.depthPercent}%` }}
                />

                <span className="relative z-10 flex items-center gap-1 font-bold text-rose-400">
                  {ask.isWall && (
                    <span
                      title="భారీ అమ్మకం గోడ (Institutional Ask Wall)"
                      className="text-[10px] bg-rose-950 text-rose-300 px-1 rounded border border-rose-500/40"
                    >
                      WALL
                    </span>
                  )}
                  ₹{ask.price.toFixed(2)}
                </span>

                <div className="relative z-10 grid grid-cols-3 gap-2 text-right">
                  <span className="text-slate-300">₹{ask.price.toFixed(2)}</span>
                  <span className="font-bold text-slate-100">{ask.quantity.toLocaleString('en-IN')}</span>
                  <span className="text-slate-400">{ask.orders}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Institutional Zones & Tape Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Left: Key Institutional Zones for this timeframe */}
        <div className="lg:col-span-2 bg-slate-950/80 rounded-xl p-3 border border-slate-800">
          <div className="flex items-center gap-1.5 font-bold text-xs text-slate-300 mb-2 border-b border-slate-800 pb-1.5">
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
            <span>
              {selectedTimeframe} కీ ఆర్డర్ జోన్లు & లిక్విడిటీ పూల్స్ (Institutional Levels)
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {orderBook.institutionalZones.map((zone, idx) => (
              <div
                key={idx}
                className={`p-2 rounded-lg border flex flex-col justify-between ${
                  zone.type === 'SUPPORT' || zone.type === 'VWAP'
                    ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300'
                    : 'bg-amber-950/30 border-amber-500/30 text-amber-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-200 text-[11px]">{zone.labelTe}</span>
                  <span
                    className={`text-[9px] px-1 rounded font-bold ${
                      zone.strength === 'EXTREME'
                        ? 'bg-purple-900/80 text-purple-200 border border-purple-500/50'
                        : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {zone.strength}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-1 font-mono text-[11px]">
                  <span className="text-slate-400">లెవల్: ₹{zone.price}</span>
                  <span className="font-bold">~{zone.volume.toLocaleString('en-IN')} షేర్లు</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Recent Trade Executions (Time & Sales / Tape) */}
        <div className="bg-slate-950/80 rounded-xl p-3 border border-slate-800">
          <div className="flex items-center justify-between font-bold text-xs text-slate-300 mb-2 border-b border-slate-800 pb-1.5">
            <span className="flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-amber-400" />
              తాజా ట్రేడ్స్ (Tape)
            </span>
            <span className="text-[10px] text-slate-500 font-mono">Live</span>
          </div>

          <div className="space-y-1 font-mono text-[11px]">
            {orderBook.tape.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between py-0.5 px-1 rounded hover:bg-slate-900 transition-colors"
              >
                <span className="text-slate-500 text-[10px]">{t.time}</span>
                <span
                  className={`font-bold ${
                    t.side === 'BUY' ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {t.side}
                </span>
                <span className="text-slate-200">₹{t.price.toFixed(2)}</span>
                <span
                  className={`font-semibold ${
                    t.isLargeBlock ? 'text-amber-300 font-bold' : 'text-slate-400'
                  }`}
                >
                  {t.quantity.toLocaleString('en-IN')}
                  {t.isLargeBlock && ' ★'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
