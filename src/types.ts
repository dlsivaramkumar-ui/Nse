export type Timeframe = '5M' | '15M' | '1H';

export type SignalStage = 
  | 'STRONG_LONG'        // 🟢 STRONG LONG BUY (Actionable signal)
  | 'PRE_BREAKOUT_WATCH' // 🟡 PRE-BREAKOUT WATCH (Compression / 1-2 candles early)
  | 'EARLY_SETUP'        // 🔵 EARLY SETUP (Initial structure forming)
  | 'DIP_RECOVERY'       // 🟣 HEALTHY PULLBACK / DIP RECOVERY (Reclaiming HL/VWAP)
  | 'MOMENTUM_TRAP'      // 🔴 MOMENTUM TRAP RISK (Blocked)
  | 'NO_TRADE';          // ⚪ NO TRADE / CHOPPY / HARD FILTER BLOCKED

export type PersistenceLevel = 'HIGH' | 'MEDIUM' | 'LOW';
export type MarketRegime = 'BULLISH' | 'NEUTRAL' | 'BEARISH';

export interface Candle {
  time: string;
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  buyerVolume: number;
  sellerVolume: number;
  barDelta?: number; // Buyer volume - Seller volume
  rvol?: number; // Relative volume of this specific candle vs 20-period SMA
  vwap?: number;
  ema9?: number;
  ema21?: number;
  cvd?: number;
}

export interface OrderBookLevel {
  price: number;
  quantity: number;
  orders: number;
  depthPercent: number; // For background visual bar
  isWall?: boolean; // Large limit order cluster
}

export interface TradeTapeItem {
  id: string;
  time: string;
  price: number;
  quantity: number;
  side: 'BUY' | 'SELL';
  isLargeBlock?: boolean;
}

export interface OrderBookData {
  symbol: string;
  timeframe: Timeframe;
  currentPrice: number;
  spread: number;
  spreadPercent: number;
  totalBidQty: number;
  totalAskQty: number;
  buyerRatio: number; // % buyers (e.g. 62)
  sellerRatio: number; // % sellers (e.g. 38)
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  tape: TradeTapeItem[];
  institutionalZones: {
    label: string;
    labelTe: string;
    price: number;
    volume: number;
    type: 'SUPPORT' | 'RESISTANCE' | 'PIVOT' | 'VWAP' | 'LIQUIDITY_POOL';
    strength: 'HIGH' | 'MEDIUM' | 'EXTREME';
  }[];
}

export interface PivotPoints {
  pivot: number;
  r1: number;
  r2: number;
  r3: number;
  s1: number;
  s2: number;
  s3: number;
  fibR1: number;
  fibR2: number;
  fibR3: number;
  fibS1: number;
  fibS2: number;
  fibS3: number;
}

export interface HardFilterStatus {
  is15MBearish: boolean;
  isBelowVWAP: boolean;
  isEMA9Below21: boolean;
  isCVDFalling: boolean;
  isADXFallingWeak: boolean;
  isResistanceTooClose: boolean;
  isBearishAbsorption: boolean;
  isLiquiditySweepFailed: boolean;
  isSpikeTrap: boolean;
  isExcessiveRedCandles?: boolean; // Excessive red candles above active market regime threshold
  isHyperVolatileSpike?: boolean; // Extreme 5M spike >= 7% or erratic wick trap (e.g. FINOPB)
  isMorningSpikeAndStagnate?: boolean; // Spiked in morning (before 10:30 AM) and stagnated/fell rest of day, or locked in flat upper circuit
  isFirstHourHyperSpike?: boolean; // Surged 8-20% in first hour (high volatility exhaustion trap; remaining market time upside depleted)
  activeRedThreshold?: number; // 30% Bullish, 40% Neutral, 50% Bearish
  marketRegime?: MarketRegime;
  hasHardFilterBlock: boolean;
  blockReasons: string[];
}

export interface PersistenceScoreBreakdown {
  is15MBullish: boolean; // 4 pts
  isEMAExpanding: boolean; // 3 pts
  isVWAPRising: boolean; // 3 pts
  isADXRising: boolean; // 3 pts
  isCVDPersistent: boolean; // 3 pts
  hasVolumeParticipation: boolean; // 2 pts
  hasHigherLowStructure: boolean; // 2 pts
  totalPersistenceScore: number; // Max 20
  persistencePercent: number; // 0-100%
  persistenceLevel: PersistenceLevel;
}

export interface TieBreakerMetrics {
  momentumVelocity: number; // rate of gain + HOD proximity metric
  rvolConsistency: number; // volume multiple & RVOL ratio
  orderFlowDominance: number; // net buyer pressure & CVD trend metric
}

export interface OverallScoreBreakdown {
  trend: number; // max 15
  persistence: number; // max 15
  orderFlow: number; // max 15
  volume: number; // max 15
  vwap: number; // max 10
  momentum: number; // max 20
  liquidityLevels: number; // max 5
  candleStructure: number; // max 5
  totalScore: number; // max 100
  normalizedScore: number; // precise float score before rounding (e.g. 93.42)
  tieBreakers?: TieBreakerMetrics;
}

export interface TradePlan {
  entryPrice: number;
  stopLoss: number;
  target1: number;
  target2: number;
  target3: number;
  riskRewardRatio: number;
  breakoutRoomPips: number;
  breakoutRoomStatus: 'EXCELLENT' | 'GOOD' | 'TIGHT' | 'BLOCKED';
  roomRatio: number; // Room to R1 / ATR
}

export interface QualificationMetadata {
  qualifiedTime: string; // e.g., '09:45 AM'
  qualifiedPrice: number; // e.g., 512.40
  qualifiedScore: number; // e.g., 97.8
  qualifiedRank?: number | null; // Historical rank at qualification time (e.g. #1, #2, etc., or null if unranked)
  triggerCondition: string; // e.g., 'RVOL 23.2x Surge & VWAP Cross'
  triggerConditionTe: string; // e.g., '23.2x ఆర్వీఓఎల్ బ్రేకవుట్ & విడబ్ల్యూఎపి క్రాస్'
  keyDrivers: string[]; // Key technical reasons (e.g. ['RVOL 23.19x', '+11.29% Momentum'])
}

export interface SystemDiagnosticReport {
  identifiedAt: string; // IST timestamp
  identifiedRank?: number | null; // Rank at time system identified this stock
  triggerType: 'USER_SEARCH_90_PLUS' | 'AUTO_SCAN_DISCOVERY';
  delayReason: string;
  delayReasonTe: string;
  universeIndex: number;
  totalUniverseSize: number;
  remedialActions: string[];
  remedialActionsTe: string[];
  sessionExpiryDate: string; // YYYY-MM-DD IST - strictly 1-day ephemeral
}

export interface RankDataPoint {
  time: string; // e.g., '09:15 AM'
  timestamp: number;
  rank: number | null; // 1 = best rank; null = unranked / NO_TRADE
  score: number; // Technical score 0-100
  price: number;
  stage?: SignalStage;
  event?: string;
  eventTe?: string;
  rankChange?: number; // Change compared to previous point
  rvol?: number;
  isPeak?: boolean;
  isQualified?: boolean;
}

export type FiveDayPriorityTier = 1 | 2 | 3 | 4; // 1 = Priority 1 (All 5d <2%), 2 = Priority 2 (1d >2%, 4d <2%), 3 = Priority 3 (1d >3%, 1d 2-3%, 3d <2%), 4 = Standard Qualified / Unqualified

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

export interface FiveDayBaseProfile {
  priorityTier: FiveDayPriorityTier;
  historicalPriorityTier?: FiveDayPriorityTier; // Pure 5D historical base tier independent of intraday micro-flips
  isTodayBreakoutActive?: boolean;
  isVerifiedHistoricalData?: boolean;
  tierLabel: string;
  tierLabelTe: string;
  tierDescriptionTe: string;
  isLowVolume5D: boolean;
  isAll5DaysBelow3MAdv?: boolean;
  avg5DayVolume: number;
  volumeVsTodayRatio: number; // todayVolume / avg5DayVolume
  daysUnder2Pct: number;
  daysBetween2And3Pct: number;
  daysAbove2Pct: number;
  daysAbove3Pct: number;
  max5DayGainPct: number;
  dailyChangesPct: number[];
  last5DaysData: HistoricalDaySummary[];
}

export interface EarlyAccumulationRadar {
  earlyDetectionScore: number; // 0 to 100
  isEarlyBreakoutCandidate: boolean;
  isFakeMorningGapTrap: boolean;
  opening15MinVolumeMultiple: number; // First 15-min volume vs expected 15-min ADV slice
  vwapTightHoldPercent: number; // % of early candles holding above rising VWAP
  rangeRetentionPercent: number; // (Close - Low) / (High - Low) * 100
  pocketPivotDetected: boolean; // Single 5M bar volume > max volume of prior 10 bars
  estimatedTrueMorningRank: number; // What the rank is when fake morning gaps & unverified stocks are stripped out
  forensicWhyMissedMorningTe: string;
  forensicWhyFakeMorningFailedTe: string;
  earlySignalsTe: string[];
}

export type SituationalArchetypeCode =
  | 'SILENT_COIL_IGNITION'
  | 'MORNING_INSTITUTIONAL_DRIVE'
  | 'MID_SESSION_IGNITION_BREAKOUT'
  | 'FLAG_RESET_SECOND_WAVE'
  | 'ALL_DAY_ACCUMULATION_STAIRCASE'
  | 'EXHAUSTION_OR_CHOP_TRAP'
  | 'STANDARD_PARTICIPATION';

export interface SituationalIntelligenceProfile {
  archetypeCode: SituationalArchetypeCode;
  archetypeName: string;
  archetypeNameTe: string;
  confidenceScore: number; // 0 to 100
  ignitionTime: string; // e.g., '09:20 AM' or '11:20 AM'
  ignitionPrice: number;
  ignitionBarRvol: number;
  rawAdv3M: number;
  regimeAdjustedAdv: number;
  isAdvOutlierAdjusted: boolean;
  isFlagResetAfterImpulse: boolean;
  isShakeoutAbsorbed: boolean;
  hasMidSessionIgnition: boolean;
  isHealthyIntradayRetest?: boolean;
  isHighPotentialityOverride?: boolean;
  fullDayPotentialityScore?: number;
  pullbackVolumeRatio?: number;
  fiveDayToTodayVolMultiple: number;
  predictedTrajectoryTe: string;
  situationalAdaptationsTe: string[];
}

export interface AdaptiveBrainDecision {
  brainRegime: 'LOOSE_EARLY_CAPTURE' | 'BALANCED_PROGRESSIVE' | 'STRICT_ELITE_SELECT';
  brainRegimeLabelTe: string;
  passedMandatoryCore: boolean;
  prioritySlotEligible: boolean;
  progressiveLayersApplied: string[];
  progressiveLayersAppliedTe: string[];
  stoppedAtLayer: number;
  isTopApexLeader: boolean;
  parallelWeightScore: number;
  p12PoolCount: number;
  apexSurvivingCount: number;
  brainSummaryTe: string;
}

export interface StockIndicatorData {
  rank?: number; // Pure technical score rank (#1, #2, etc.) regardless of market cap
  rankHistory?: RankDataPoint[]; // Historical progression of rank throughout trading day
  symbol: string;
  name: string;
  nameTe?: string;
  sector: string;
  marketCapCr: number;
  currentPrice: number;
  change: number;
  changePercent: number;
  dayHigh: number;
  dayLow: number;
  dayOpen: number;
  prevClose: number;
  currentVolume: number;
  avgVolume: number;
  adv?: number; // 3-Month Average Daily Volume (ADV)
  adv3M?: number; // Explicit 3-Month Average Daily Volume
  rvol: number; // Time-of-day normalized Relative Volume
  fullDayRvol?: number; // Current volume vs full-day 3-Month ADV
  expectedSessionVolume?: number; // Expected volume up to current IST session time
  barRvol?: number;
  sessionRvol?: number;
  momentumRvol?: number;
  surgeRvol?: number;
  vwap: number;
  vwapSlope: 'RISING' | 'FLAT' | 'FALLING';
  priceVsVWAP: 'ABOVE' | 'BELOW';
  ema9: number;
  ema21: number;
  emaDistancePercent: number;
  emaSlope: 'EXPANDING' | 'CONVERGING' | 'PARALLEL';
  trend15M: 'BULLISH' | 'NEUTRAL' | 'BEARISH';
  adx: number;
  adxSlope: 'RISING' | 'FALLING';
  plusDI: number;
  minusDI: number;
  buyerPressurePercent: number;
  sellerPressurePercent: number;
  cvd: number;
  cvdTrend: 'RISING' | 'NEUTRAL' | 'FALLING';
  cvdDivergence?: 'BULLISH_DIVERGENCE' | 'BEARISH_DIVERGENCE' | 'ALIGNED';
  atr: number;
  isCompression: boolean;
  marketState: 'TRENDING' | 'COMPRESSION' | 'EXPANSION' | 'PULLBACK' | 'CHOPPY';
  signalStage: SignalStage;
  category: 'ALREADY_STRONG' | 'PRE_BREAKOUT' | 'DIP_RECOVERY' | 'OTHER';
  persistenceScore: PersistenceScoreBreakdown;
  overallScore: OverallScoreBreakdown;
  qualification?: QualificationMetadata;
  fiveDayBaseProfile?: FiveDayBaseProfile;
  earlyAccumulationRadar?: EarlyAccumulationRadar;
  situationalIntelligence?: SituationalIntelligenceProfile;
  adaptiveBrain?: AdaptiveBrainDecision;
  last5Days?: HistoricalDaySummary[];
  diagnosticAnalysis?: SystemDiagnosticReport;
  hardFilters: HardFilterStatus;
  tradePlan: TradePlan;
  pivots: PivotPoints;
  strengths: string[];
  strengthsTe: string[];
  weaknesses: string[];
  weaknessesTe: string[];
  candles5M: Candle[];
  candles15M: Candle[];
  candles1H: Candle[];
  greenCandlesCount?: number;
  redCandlesCount?: number;
  dojiCandlesCount?: number;
  totalCandlesCount?: number;
  greenCandlePercent?: number; // % of green candles in 5M session (e.g. 50.7%)
  redCandlePercent?: number; // % of red candles in 5M session (e.g. 49.3%)
  dojiCandlePercent?: number;
  redCandleRatio?: number;
  activeRedThreshold?: number; // Active regime threshold: 30% Bullish, 40% Neutral, 50% Bearish
  marketRegime?: MarketRegime;
  max5MBarJumpPercent?: number; // Largest single 5-minute jump %
  avgWickRatio?: number; // Average wick ratio across candles
  isExcessiveRedCandles?: boolean;
  isHyperVolatileSpike?: boolean;
  isFirstHourHyperSpike?: boolean;
  penaltyPoints?: number; // Weightage points deducted due to volatility/red candles
  redPenaltyPoints?: number; // Specific weightage penalty deducted for red candles exceeding market threshold
  dayTurnoverCr?: number; // Total turnover in Crores for the current day
  lastUpdated: string;
  isLiveSynced?: boolean;
  lastLiveSyncTime?: number;
  bahubaliResult?: {
    decision: 'STRONG_BUY' | 'REJECT';
    reason?: string;
    setup?: string;
    entry_price?: number;
    stop_loss?: number;
    target_1?: number;
    target_2?: number;
    rvol?: number;
  };
}

export interface ScanResultSummary {
  totalScanned: number;
  alreadyStrongCount: number;
  preBreakoutCount: number;
  dipRecoveryCount: number;
  lastScanTimestamp: string;
  isFilteredSession: boolean; // True if using cached shortlists for lightweight rescan
}

export interface AlertNotification {
  id: string;
  timestamp: string;
  symbol: string;
  name: string;
  price: number;
  signalStage: SignalStage;
  score: number;
  message: string;
  messageTe: string;
  isRead: boolean;
}
