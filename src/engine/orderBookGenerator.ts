import { OrderBookData, OrderBookLevel, PivotPoints, Timeframe, TradeTapeItem } from '../types';

// Deterministic seed helper
function seededRandom(seed: number) {
  const x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
}

export function generateOrderBookForTimeframe({
  symbol,
  currentPrice,
  prevClose,
  dayHigh,
  dayLow,
  timeframe,
  buyerPressurePercent,
  pivots,
  vwap,
  avgVolume,
}: {
  symbol: string;
  currentPrice: number;
  prevClose: number;
  dayHigh: number;
  dayLow: number;
  timeframe: Timeframe;
  buyerPressurePercent: number;
  pivots: PivotPoints;
  vwap: number;
  avgVolume: number;
}): OrderBookData {
  let seed = symbol.split('').reduce((acc, c) => acc + c.charCodeAt(0), 150) + (timeframe === '5M' ? 10 : timeframe === '15M' ? 20 : 30);

  // Normalize price and tick size
  const tickSize = currentPrice > 2000 ? 0.20 : currentPrice > 500 ? 0.05 : 0.05;
  const buyerRatio = Math.max(20, Math.min(85, buyerPressurePercent));
  const sellerRatio = 100 - buyerRatio;

  // Base volume scaler based on stock liquidity
  const baseQty = Math.max(100, Math.round(avgVolume / (timeframe === '5M' ? 2500 : timeframe === '15M' ? 800 : 250)));

  const bids: OrderBookLevel[] = [];
  const asks: OrderBookLevel[] = [];

  let stepMultiplier = 1;
  let numLevels = 8;
  if (timeframe === '5M') {
    stepMultiplier = 1; // 1-2 ticks
    numLevels = 8;
  } else if (timeframe === '15M') {
    stepMultiplier = Math.max(4, Math.round((currentPrice * 0.001) / tickSize)); // ~0.1% per level
    numLevels = 8;
  } else {
    // 1H
    stepMultiplier = Math.max(10, Math.round((currentPrice * 0.003) / tickSize)); // ~0.3% per level
    numLevels = 8;
  }

  const spread = Number((tickSize * (timeframe === '5M' ? 1 : timeframe === '15M' ? 2 : 4)).toFixed(2));
  const spreadPercent = Number(((spread / currentPrice) * 100).toFixed(3));

  let maxQty = 1;

  // Generate Bids (below currentPrice)
  for (let i = 1; i <= numLevels; i++) {
    const r1 = seededRandom(seed++);
    const r2 = seededRandom(seed++);
    const priceOffset = i * stepMultiplier * tickSize;
    const bidPrice = Number((currentPrice - priceOffset).toFixed(2));

    // Weight quantity by buyerRatio and proximity to VWAP or Pivots
    let weight = (buyerRatio / 50) * (1 + (numLevels - i) * 0.12);
    const isNearVWAP = Math.abs(bidPrice - vwap) / currentPrice < 0.002;
    const isNearS1 = Math.abs(bidPrice - pivots.s1) / currentPrice < 0.003;
    const isWall = (isNearVWAP || isNearS1 || r1 > 0.82) && i > 1;

    if (isWall) {
      weight *= 2.6;
    }

    const qty = Math.round(baseQty * (0.6 + r1 * 0.8) * weight);
    const orders = Math.max(1, Math.round(qty / (25 + r2 * 75)));
    if (qty > maxQty) maxQty = qty;

    bids.push({
      price: bidPrice,
      quantity: qty,
      orders,
      depthPercent: 0,
      isWall,
    });
  }

  // Generate Asks (above currentPrice)
  for (let i = 1; i <= numLevels; i++) {
    const r1 = seededRandom(seed++);
    const r2 = seededRandom(seed++);
    const priceOffset = i * stepMultiplier * tickSize;
    const askPrice = Number((currentPrice + priceOffset).toFixed(2));

    let weight = (sellerRatio / 50) * (1 + (numLevels - i) * 0.12);
    const isNearR1 = Math.abs(askPrice - pivots.r1) / currentPrice < 0.003;
    const isNearDayHigh = Math.abs(askPrice - dayHigh) / currentPrice < 0.002;
    const isWall = (isNearR1 || isNearDayHigh || r1 > 0.82) && i > 1;

    if (isWall) {
      weight *= 2.4;
    }

    const qty = Math.round(baseQty * (0.6 + r1 * 0.8) * weight);
    const orders = Math.max(1, Math.round(qty / (25 + r2 * 75)));
    if (qty > maxQty) maxQty = qty;

    asks.push({
      price: askPrice,
      quantity: qty,
      orders,
      depthPercent: 0,
      isWall,
    });
  }

  // Compute depth percentages
  bids.forEach((b) => (b.depthPercent = Math.min(100, Math.round((b.quantity / maxQty) * 100))));
  asks.forEach((a) => (a.depthPercent = Math.min(100, Math.round((a.quantity / maxQty) * 100))));

  const totalBidQty = bids.reduce((acc, b) => acc + b.quantity, 0);
  const totalAskQty = asks.reduce((acc, a) => acc + a.quantity, 0);

  // Generate recent tape prints (Time & Sales)
  const tape: TradeTapeItem[] = [];
  const now = Date.now();
  const tradeCount = timeframe === '5M' ? 8 : timeframe === '15M' ? 6 : 5;

  for (let k = 0; k < tradeCount; k++) {
    const rSide = seededRandom(seed++);
    const rQty = seededRandom(seed++);
    const rSec = k * (timeframe === '5M' ? 8 : timeframe === '15M' ? 25 : 60);
    const tradeTime = new Date(now - rSec * 1000).toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

    const isBuy = rSide < buyerRatio / 100;
    const isBlock = rQty > 0.85;
    const tradeQty = Math.round(baseQty * (0.4 + rQty * (isBlock ? 2.5 : 0.8)));
    const priceVariance = isBuy ? (rQty > 0.5 ? 0 : spread) : (rQty > 0.5 ? -spread : 0);
    const tradePrice = Number((currentPrice + priceVariance).toFixed(2));

    tape.push({
      id: `trade-${k}-${seed}`,
      time: tradeTime,
      price: tradePrice,
      quantity: tradeQty,
      side: isBuy ? 'BUY' : 'SELL',
      isLargeBlock: isBlock,
    });
  }

  // Institutional Zones according to Timeframe
  const institutionalZones: OrderBookData['institutionalZones'] = [];

  if (timeframe === '5M') {
    institutionalZones.push(
      {
        label: 'Micro VWAP Base',
        labelTe: '5M మైక్రో VWAP సపోర్ట్ జోన్',
        price: Number(vwap.toFixed(2)),
        volume: Math.round(baseQty * 4.2),
        type: 'VWAP',
        strength: currentPrice >= vwap ? 'HIGH' : 'MEDIUM',
      },
      {
        label: 'Immediate Scalp Resistance',
        labelTe: 'తక్షణ స్కేల్ప్ రెసిస్టెన్స్ లెవల్',
        price: Number(asks[Math.min(3, asks.length - 1)].price.toFixed(2)),
        volume: Math.round(baseQty * 3.5),
        type: 'RESISTANCE',
        strength: 'MEDIUM',
      },
      {
        label: 'Micro Order Flow Absorption',
        labelTe: 'మైక్రో ఆర్డర్ ఫ్లో అబ్జార్ప్షన్ వాల్',
        price: Number(bids[Math.min(2, bids.length - 1)].price.toFixed(2)),
        volume: Math.round(baseQty * 3.8),
        type: 'SUPPORT',
        strength: buyerRatio >= 60 ? 'EXTREME' : 'HIGH',
      }
    );
  } else if (timeframe === '15M') {
    institutionalZones.push(
      {
        label: 'Intraday VWAP Defense Wall',
        labelTe: 'ఇంట్రాడే VWAP డిఫెన్స్ లిక్విడిటీ వాల్',
        price: Number(vwap.toFixed(2)),
        volume: Math.round(baseQty * 6.5),
        type: 'VWAP',
        strength: 'EXTREME',
      },
      {
        label: 'Pivotal Breakout Gate (R1)',
        labelTe: 'R1 బ్రేక్‌అవుట్ రెసిస్టెన్స్ గేట్',
        price: Number(pivots.r1.toFixed(2)),
        volume: Math.round(baseQty * 7.8),
        type: 'RESISTANCE',
        strength: 'HIGH',
      },
      {
        label: '15M Pullback Demand Block',
        labelTe: '15M పుల్‌బ్యాక్ డిమాండ్ బ్లాక్',
        price: Number(pivots.s1.toFixed(2)),
        volume: Math.round(baseQty * 6.0),
        type: 'SUPPORT',
        strength: 'HIGH',
      }
    );
  } else {
    // 1H
    institutionalZones.push(
      {
        label: 'Major Floor Pivot (P)',
        labelTe: 'మేజర్ సెంట్రల్ పివోట్ (P) ఇన్‌స్టిట్యూషనల్ బేస్',
        price: Number(pivots.pivot.toFixed(2)),
        volume: Math.round(baseQty * 14.5),
        type: 'PIVOT',
        strength: 'EXTREME',
      },
      {
        label: 'R1 Supply Cluster',
        labelTe: 'R1 హెవీ ఇన్‌స్టిట్యూషనల్ సప్లై క్లస్టర్',
        price: Number(pivots.r1.toFixed(2)),
        volume: Math.round(baseQty * 12.0),
        type: 'RESISTANCE',
        strength: 'EXTREME',
      },
      {
        label: 'Day High Liquidity Pool',
        labelTe: 'డే హై లిక్విడిటీ హంట్ పూల్',
        price: Number(dayHigh.toFixed(2)),
        volume: Math.round(baseQty * 10.5),
        type: 'LIQUIDITY_POOL',
        strength: 'HIGH',
      },
      {
        label: 'S1 Accumulation Zone',
        labelTe: 'S1 ఇన్‌స్టిట్యూషనల్ అక్యుములేషన్ జోన్',
        price: Number(pivots.s1.toFixed(2)),
        volume: Math.round(baseQty * 11.2),
        type: 'SUPPORT',
        strength: 'HIGH',
      }
    );
  }

  return {
    symbol,
    timeframe,
    currentPrice,
    spread,
    spreadPercent,
    totalBidQty,
    totalAskQty,
    buyerRatio,
    sellerRatio,
    bids,
    asks,
    tape,
    institutionalZones,
  };
}
