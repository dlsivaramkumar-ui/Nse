import fullUniverseData from './nseFullUniverse.json';
import { findUnlistedCompany, KNOWN_UNLISTED_COMPANIES, UnlistedCompany } from './unlistedCompanies';

export { findUnlistedCompany, KNOWN_UNLISTED_COMPANIES };
export type { UnlistedCompany };

export type SpecialSearchResult =
  | {
      type: 'ACTIVE_STOCK';
      symbol: string;
      name: string;
      nameTe?: string;
      basePrice: number;
      sector: string;
      isAliasMatch?: boolean;
    }
  | {
      type: 'UNLISTED_COMPANY';
      id: string;
      symbol: string;
      name: string;
      nameTe: string;
      categoryLabelTe: string;
      unlistedData: UnlistedCompany;
    }
  | {
      type: 'MERGED_ENTITY';
      symbol: string;
      name: string;
      newSymbol: string;
      reasonTe: string;
    }
  | {
      type: 'DELISTED_STOCK';
      symbol: string;
      name: string;
      reasonTe: string;
    };

export interface UniverseStock {
  symbol: string;
  name: string;
  nameTe: string;
  sector: string;
  basePrice: number;
  marketCapCr: number;
  avgVolume: number;
  prevClose?: number;
  dayHigh?: number;
  dayLow?: number;
}

// Complete Dynamic 100% Verified NSE Equities Universe
// STRICT MANDATE: Price ₹100-₹3,000, Market Cap >= ₹500 Cr, and 3-Months Average Volume > 25,000!
const BASE_FILTERED_UNIVERSE: UniverseStock[] = (fullUniverseData as UniverseStock[]).filter(
  s => s.basePrice >= 100 && s.basePrice <= 3000 && (s.marketCapCr || 0) >= 500 && (s.avgVolume || 0) > 25000
);

// Ensure newly listed / high-momentum institutional NSE stocks (GROWW, IXIGO, GYFTR, TEMPSENS, M&MFIN, etc.) are always placed at the front of the primary universe
const ESSENTIAL_ACTIVE_EQUITIES: UniverseStock[] = [
  {
    symbol: 'GROWW',
    name: 'Billionbrains Garage Ventures Ltd (Groww)',
    nameTe: 'బిలియన్‌బ్రెయిన్స్ గ్యారేజ్ (గ్రో / Groww)',
    sector: 'Financial Technology / Broking',
    basePrice: 223.89,
    prevClose: 207.23,
    dayHigh: 225.61,
    dayLow: 211.02,
    marketCapCr: 129989,
    avgVolume: 34138226,
  },
  {
    symbol: 'IXIGO',
    name: 'Le Travenues Technology Limited (ixigo)',
    nameTe: 'లె ట్రావెన్యూస్ టెక్నాలజీ (ఇక్సిగో / ixigo)',
    sector: 'Travel & Consumer Tech',
    basePrice: 163.79,
    prevClose: 144.65,
    dayHigh: 165.0,
    dayLow: 147.8,
    marketCapCr: 6350,
    avgVolume: 2778122,
  },
  {
    symbol: 'GYFTR',
    name: 'Gyftr Limited',
    nameTe: 'గిఫ్టర్ లిమిటెడ్ (Gyftr)',
    sector: 'Digital Rewards & Fintech',
    basePrice: 210.95,
    prevClose: 182.38,
    dayHigh: 212.5,
    dayLow: 186.0,
    marketCapCr: 2450,
    avgVolume: 157206,
  },
  {
    symbol: 'TEMPSENS',
    name: 'Tempsens Instruments (I) Limited',
    nameTe: 'టెంప్‌సెన్స్ ఇన్‌స్ట్రుమెంట్స్ లిమిటెడ్',
    sector: 'Industrial Manufacturing',
    basePrice: 552.25,
    prevClose: 486.4,
    dayHigh: 560.45,
    dayLow: 486.4,
    marketCapCr: 1750,
    avgVolume: 835054,
  },
  {
    symbol: 'M&MFIN',
    name: 'Mahindra & Mahindra Financial Services Limited',
    nameTe: 'మహీంద్రా & మహీంద్రా ఫైనాన్షియల్ సర్వీసెస్ లిమిటెడ్',
    sector: 'Financial Services / NBFC',
    basePrice: 290.5,
    prevClose: 270.1,
    dayHigh: 293.4,
    dayLow: 278.1,
    marketCapCr: 35800,
    avgVolume: 2373967,
  },
];

const ESSENTIAL_SYMBOL_SET = new Set(ESSENTIAL_ACTIVE_EQUITIES.map(e => e.symbol));

export const NSE_UNIVERSE: UniverseStock[] = [
  ...ESSENTIAL_ACTIVE_EQUITIES,
  ...BASE_FILTERED_UNIVERSE.filter(b => !ESSENTIAL_SYMBOL_SET.has(b.symbol)),
];

// Map of legacy / former ticker symbols to active NSE symbols
export const ALIAS_MAP: Record<string, string> = {
  MUKAND: 'MUKANDLTD',
  TATAMOTORS: 'TMPV',
  TATAMTRDVR: 'TMPV',
  TMPV: 'TMPV',
  TMCV: 'TMCV',
  HBLPOWER: 'HBLENGINE',
  HBL: 'HBLENGINE',
  ZOMATO: 'ETERNAL',
  SWANENERGY: 'SWANCORP',
  SWAN: 'SWANCORP',
  TIPSINDLTD: 'TIPSMUSIC',
  TIPSINDIA: 'TIPSMUSIC',
  TIPS: 'TIPSMUSIC',
  AEGISCHEM: 'AEGISLOG',
  AEGIS: 'AEGISLOG',
  'AEGIS LOGISTICS': 'AEGISLOG',
  TEMPSENS: 'TEMPSENS',
  'TEMPSENS INSTRUMENTS': 'TEMPSENS',
  'ANGEL ONE': 'ANGELONE',
  ANGELBROK: 'ANGELONE',
  ANGELONE: 'ANGELONE',
  'MCDOWELL-N': 'UNITDSPR',
  MCDOWELL: 'UNITDSPR',
  UNITEDSPIRITS: 'UNITDSPR',
  GUJGASLTD: 'GUJGAS',
  ATFL: 'SUNDROP',
  URBAN: 'URBANCO',
  'URBAN COMPANY': 'URBANCO',
  URBANCOMPANY: 'URBANCO',
  URBANCLAP: 'URBANCO',
  'URBAN CLAP': 'URBANCO',
  'URBAN CO': 'URBANCO',
  URBANCO: 'URBANCO',
  MOBIKWIK: 'MOBIKWIK',
  'MOBI KWIK': 'MOBIKWIK',
  MOBIKWICK: 'MOBIKWIK',
  ONEMOBIKWIK: 'MOBIKWIK',
  'ONE MOBIKWIK': 'MOBIKWIK',
  KANOHAR: 'KANOHAR',
  'KANOHAR ELECTRICALS': 'KANOHAR',
  KANOHARELEC: 'KANOHAR',
  'BIRLA CABLE': 'BIRLACABLE',
  'BIRLA CABLE LIMITED': 'BIRLACABLE',
  BIRLACABLE: 'BIRLACABLE',
  GROWW: 'GROWW',
  GOWW: 'GROWW',
  BILLIONBRAINS: 'GROWW',
  'BILLION BRAINS': 'GROWW',
  IXIGO: 'IXIGO',
  'LE TRAVENUES': 'IXIGO',
  TRAVENUES: 'IXIGO',
  GYFTR: 'GYFTR',
  GIFTR: 'GYFTR',
  VOUCHAGRAM: 'GYFTR',
  MMFIN: 'M&MFIN',
  MNMFIN: 'M&MFIN',
  'M&MFIN': 'M&MFIN',
  'M&M FINANCIAL': 'M&MFIN',
  'MAHINDRA FINANCIAL': 'M&MFIN',
  'MAHINDRA FINANCE': 'M&MFIN',
  ANUP: 'ANUP',
  'THE ANUP ENGINEERING': 'ANUP',
  'THE ANUP ENGINEERING LIMITED': 'ANUP',
  'THE ANUP ENGINEERING LTD': 'ANUP',
  'ANUP ENGINEERING': 'ANUP',
  'ANUP ENGINEERING LIMITED': 'ANUP',
  'ANUP ENGINEERING LTD': 'ANUP',
  'ANUP ENGG': 'ANUP',
};

// Search aliases to allow searching by previous company or brand names (including Telugu phonetic search)
export const REVERSE_SEARCH_ALIASES: Record<string, string[]> = {
  GROWW: ['goww', 'groww', 'billionbrains', 'billion brains', 'గ్రోవ్', 'గ్రో', 'billionbrains garage'],
  IXIGO: ['ixigo', 'le travenues', 'travenues', 'ఇక్సిగో'],
  GYFTR: ['gyftr', 'giftr', 'vouchagram', 'గిఫ్టర్'],
  'M&MFIN': ['mmfin', 'mnmfin', 'm&mfin', 'm&m finance', 'mahindra finance', 'mahindra financial', 'మహీంద్రా ఫైనాన్స్', 'మహీంద్రా'],
  SWANCORP: ['swanenergy', 'swan energy', 'swan'],
  TIPSMUSIC: ['tipsindia', 'tips india', 'tipsindltd', 'tips film', 'tips'],
  ETERNAL: ['zomato', 'జొమాటో', 'blinkit', 'బ్లింకిట్'],
  HBLENGINE: ['hblpower', 'hbl power', 'hbl'],
  TMPV: ['tatamotors', 'tata motors', 'tatamtrdvr', 'టాటా మోటార్స్', 'టాటా'],
  AEGISLOG: ['aegischem', 'aegis chem', 'aegis chemicals', 'aegis', 'aegis logistics', 'ఏజిస్ లాజిస్టిక్స్', 'ఏజిస్'],
  TEMPSENS: ['tempsens', 'tempsens instruments', 'tempsens limited', 'టెంప్‌సెన్స్', 'టెంప్సెన్స్'],
  ANGELONE: ['angel one', 'angel broking', 'angelbrok', 'ఏంజెల్ వన్', 'ఏంజెల్'],
  GRSE: ['garden reach', 'garden reach shipbuilders', 'grse', 'గార్డెన్ రీచ్'],
  UNITDSPR: ['mcdowell', 'mcdowell-n', 'united spirits', 'usl'],
  GUJGAS: ['gujgasltd', 'gujarat gas'],
  SUNDROP: ['atfl', 'agro tech', 'sundrop'],
  PAYTM: ['one97', 'one 97', 'paytm', 'పేటీఎం', 'పేటిఎం'],
  SWIGGY: ['swiggy', 'స్విగ్గీ', 'instamart'],
  OLAELEC: ['ola', 'ola electric', 'ఓలా', 'ఓలా ఎలక్ట్రిక్'],
  HONASA: ['mamaearth', 'మామాఎర్త్', 'honasa'],
  NYKAA: ['nykaa', 'నైకా', 'fsn'],
  POLICYBZR: ['policybazaar', 'పాలసీబజార్', 'pb fintech'],
  FIRSTCRY: ['firstcry', 'ఫస్ట్‌క్రై', 'brainbees'],
  BAJAJHFL: ['bajaj housing', 'బజాజ్ హౌసింగ్'],
  HYUNDAI: ['hyundai', 'హ్యుందాయ్'],
  URBANCO: [
    'urban',
    'urban company',
    'urbanclap',
    'urban clap',
    'urban company limited',
    'urbanco',
    'urban co',
    'urbancompany',
    'అర్బన్ కంపెనీ',
    'అర్బన్ క్లాప్',
    'అర్బన్‌క్లాప్',
    'అర్బన్',
  ],
  MOBIKWIK: [
    'mobikwik',
    'mobi kwik',
    'onemobikwik',
    'one mobikwik',
    'mobikwick',
    'mobicwik',
    'మోబిక్విక్',
    'మోబీక్విక్',
    'మొబిక్విక్',
  ],
  HUDCO: [
    'hudco',
    'housing and urban',
    'housing & urban development',
    'హడ్కో',
    'హౌసింగ్ అండ్ అర్బన్',
  ],
  KANOHAR: [
    'kanohar',
    'kanohar electricals',
    'kanohar electricals limited',
    'కనోహర్',
    'కనోహర్ ఎలక్ట్రికల్స్',
  ],
  BIRLACABLE: [
    'birla cable',
    'birlacable',
    'birla cable limited',
    'బిర్లా కేబుల్',
    'బిర్లా కేబుల్ లిమిటెడ్',
    'బిర్లా',
    'birla',
  ],
  ANUP: [
    'anup',
    'the anup',
    'the anup engineering',
    'the anup engineering limited',
    'the anup engineering ltd',
    'anup engineering',
    'anup engineering limited',
    'anup engg',
    'అనూప్ ఇంజనీరింగ్',
    'ది అనూప్ ఇంజనీరింగ్',
  ],
};

// Known delisted, merged, or suspended symbols with clear explanation
export const KNOWN_DELISTED_STOCKS: Record<string, { reason: string; reasonTe: string }> = {
  TCNSBRANDS: {
    reason: 'TCNS Clothing Co. merged into Aditya Birla Fashion and Retail (ABFRL) and was delisted from NSE.',
    reasonTe: 'TCNS Clothing Co. ఆదిత్య బిర్లా ఫ్యాషన్ & రిటైల్ (ABFRL) తో విలీనం చెంది NSE నుండి డీలిస్ట్ చేయబడింది.',
  },
  JCHAC: {
    reason: 'Johnson Controls-Hitachi Air Conditioning India equity trading is suspended / delisted from NSE.',
    reasonTe: 'జాన్సన్ కంట్రోల్స్-హిటాచీ ఎయిర్ కండిషనింగ్ ఈక్విటీ ట్రేడింగ్ NSE లో నిలిపివేయబడింది/డీలిస్ట్ చేయబడింది.',
  },
  SUNDARMHLD: {
    reason: 'Sundaram Finance Holdings amalgamated into Sundaram Finance Limited (SUNDARMFIN) and was delisted.',
    reasonTe: 'సుందరం ఫైనాన్స్ హోల్డింగ్స్ సుందరం ఫైనాన్స్ (SUNDARMFIN) తో విలీనం చేయబడి డీలిస్ట్ చేయబడింది.',
  },
  IDFC: {
    reason: 'IDFC Limited reverse-merged into IDFC FIRST Bank (IDFCFIRSTB) and was delisted from NSE.',
    reasonTe: 'IDFC లిమిటెడ్ IDFC FIRST బ్యాంక్ తో విలీనమై NSE నుండి డీలిస్ట్ చేయబడింది.',
  },
  ISEC: {
    reason: 'ICICI Securities delisted from NSE following its merger into ICICI Bank.',
    reasonTe: 'ICICI సెక్యూరిటీస్ ICICI బ్యాంక్ లో విలీనమై NSE నుండి డీలిస్ట్ చేయబడింది.',
  },
  ADORWELD: {
    reason: 'Ador Welding corporate scheme of arrangement / restructuring completed.',
    reasonTe: 'అడోర్ వెల్డింగ్ కార్పొరేట్ పునర్వ్యవస్థీకరణ ప్రక్రియ పూర్తయ్యింది.',
  },
  ALLSEC: {
    reason: 'Allsec Technologies merged into Quess Corp and was delisted.',
    reasonTe: 'ఆల్‌సెక్ టెక్నాలజీస్ క్వెస్ కార్ప్‌తో విలీనమై డీలిస్ట్ చేయబడింది.',
  },
};

// Fast lookup map by symbol
const universeMap = new Map<string, UniverseStock>();
NSE_UNIVERSE.forEach(s => universeMap.set(s.symbol, s));

export function getUniverseStock(symbol: string): UniverseStock | undefined {
  if (!symbol) return undefined;
  const clean = symbol.trim().toUpperCase().replace('.NS', '');
  const aliased = ALIAS_MAP[clean] || clean;
  return universeMap.get(aliased) || universeMap.get(clean);
}

export function isDelistedStock(symbol: string) {
  const clean = symbol.trim().toUpperCase().replace('.NS', '');
  return KNOWN_DELISTED_STOCKS[clean] || null;
}

export function searchUniverse(query: string, limit = 10): UniverseStock[] {
  if (!query || query.trim().length < 1) return [];
  const q = query.trim().toLowerCase();
  const cleanUpper = query.trim().toUpperCase().replace('.NS', '');
  const aliased = ALIAS_MAP[cleanUpper] || ALIAS_MAP[q];
  const results: UniverseStock[] = [];
  const added = new Set<string>();

  // Direct alias resolution first (e.g. URBAN -> URBANCO, MOBIKWIK -> MOBIKWIK, TATAMOTORS -> TMPV)
  if (aliased) {
    const direct = getUniverseStock(aliased);
    if (direct) {
      results.push(direct);
      added.add(direct.symbol);
    }
  }

  for (const s of NSE_UNIVERSE) {
    if (added.has(s.symbol)) continue;
    const aliases = REVERSE_SEARCH_ALIASES[s.symbol] || [];
    const aliasMatch = aliases.some(a => a.toLowerCase().includes(q) || q.includes(a.toLowerCase()));
    if (
      s.symbol.toLowerCase().includes(q) ||
      s.name.toLowerCase().includes(q) ||
      (s.nameTe && s.nameTe.toLowerCase().includes(q)) ||
      aliasMatch
    ) {
      results.push(s);
      added.add(s.symbol);
      if (results.length >= limit) return results;
    }
  }

  // Fallback to full universe data
  if (results.length < limit) {
    for (const s of (fullUniverseData as UniverseStock[])) {
      if (added.has(s.symbol)) continue;
      if (s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q)) {
        results.push(s);
        added.add(s.symbol);
        if (results.length >= limit) break;
      }
    }
  }

  return results;
}

// Unified multi-category search: active NSE stocks, unlisted tech unicorns, merged entities, and delisted stocks
export function searchUniverseWithSpecialEntities(query: string, limit = 8): SpecialSearchResult[] {
  if (!query || query.trim().length < 1) return [];
  const q = query.trim().toLowerCase();
  const cleanUpper = query.trim().toUpperCase().replace('.NS', '');
  const results: SpecialSearchResult[] = [];
  const addedKeys = new Set<string>();

  // 1. Direct Alias Match (e.g. URBAN -> URBANCO, MOBIKWIK -> MOBIKWIK)
  const directAlias = ALIAS_MAP[cleanUpper] || ALIAS_MAP[q];
  if (directAlias && !KNOWN_DELISTED_STOCKS[cleanUpper]) {
    const stock = getUniverseStock(directAlias) || (fullUniverseData as UniverseStock[]).find(s => s.symbol === directAlias);
    if (stock) {
      addedKeys.add(stock.symbol);
      results.push({
        type: 'ACTIVE_STOCK',
        symbol: stock.symbol,
        name: stock.name,
        nameTe: stock.nameTe,
        basePrice: stock.basePrice,
        sector: stock.sector,
        isAliasMatch: true,
      });
      if (results.length >= limit) return results;
    }
  }

  // 2. Active NSE Stocks in primary universe (symbol, name, Telugu name, reverse aliases)
  for (const s of NSE_UNIVERSE) {
    if (addedKeys.has(s.symbol)) continue;

    const aliases = REVERSE_SEARCH_ALIASES[s.symbol] || [];
    const aliasMatch = aliases.some((a) => a.toLowerCase().includes(q) || q.includes(a.toLowerCase()));
    const nameMatch = s.name.toLowerCase().includes(q);
    const symMatch = s.symbol.toLowerCase().includes(q);
    const nameTeMatch = (s.nameTe || '').toLowerCase().includes(q);

    if (symMatch || nameMatch || nameTeMatch || aliasMatch) {
      addedKeys.add(s.symbol);
      results.push({
        type: 'ACTIVE_STOCK',
        symbol: s.symbol,
        name: s.name,
        nameTe: s.nameTe,
        basePrice: s.basePrice,
        sector: s.sector,
        isAliasMatch: aliasMatch && !symMatch && !nameMatch,
      });
      if (results.length >= limit) return results;
    }
  }

  // 3. Fallback check across full equity universe for active NSE stocks
  if (results.length < limit) {
    for (const s of (fullUniverseData as UniverseStock[])) {
      if (addedKeys.has(s.symbol)) continue;
      if (s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q)) {
        addedKeys.add(s.symbol);
        results.push({
          type: 'ACTIVE_STOCK',
          symbol: s.symbol,
          name: s.name,
          nameTe: s.nameTe,
          basePrice: s.basePrice,
          sector: s.sector,
        });
        if (results.length >= limit) break;
      }
    }
  }

  // 4. Check Merged / Renamed Entities (e.g. ZOMATO -> ETERNAL, TATAMOTORS -> TMPV)
  if (ALIAS_MAP[cleanUpper] && ALIAS_MAP[cleanUpper] !== cleanUpper) {
    const newSym = ALIAS_MAP[cleanUpper];
    const targetStock = getUniverseStock(newSym);
    const key = `MERGED_${cleanUpper}`;
    if (!addedKeys.has(key) && !addedKeys.has(newSym)) {
      addedKeys.add(key);
      results.push({
        type: 'MERGED_ENTITY',
        symbol: cleanUpper,
        name: targetStock ? targetStock.name : `Rebranded / Merged to ${newSym}`,
        newSymbol: newSym,
        reasonTe: `${cleanUpper} స్టాక్ ఇప్పుడు అధికారికంగా ${newSym} సింబల్‌తో NSE లో ట్రేడ్ అవుతోంది.`,
      });
      if (results.length >= limit) return results;
    }
  }

  // 5. Check Known Delisted Stocks
  if (KNOWN_DELISTED_STOCKS[cleanUpper]) {
    const info = KNOWN_DELISTED_STOCKS[cleanUpper];
    const key = `DELISTED_${cleanUpper}`;
    if (!addedKeys.has(key)) {
      addedKeys.add(key);
      results.push({
        type: 'DELISTED_STOCK',
        symbol: cleanUpper,
        name: cleanUpper,
        reasonTe: info.reasonTe,
      });
      if (results.length >= limit) return results;
    }
  }

  // 6. Check Unlisted / Pre-IPO Unicorns (e.g. Zepto, PhonePe, Flipkart, boAt, Razorpay)
  // ARCHITECTURAL MANDATE: Never show an unlisted warning if the query matches an active NSE listed stock!
  const hasDirectActiveStock = NSE_UNIVERSE.some(
    s => s.symbol.toLowerCase() === q || s.symbol.toUpperCase() === cleanUpper || (ALIAS_MAP[cleanUpper] && s.symbol === ALIAS_MAP[cleanUpper])
  );

  if (!hasDirectActiveStock) {
    for (const unlisted of KNOWN_UNLISTED_COMPANIES) {
      const match =
        unlisted.id.toLowerCase().includes(q) ||
        unlisted.name.toLowerCase().includes(q) ||
        unlisted.brandName.toLowerCase().includes(q) ||
        unlisted.legalEntityName.toLowerCase().includes(q) ||
        unlisted.nameTe.toLowerCase().includes(q) ||
        unlisted.aliases.some((a) => a.toLowerCase().includes(q) || q.includes(a.toLowerCase()));

      if (match && !addedKeys.has(unlisted.id)) {
        addedKeys.add(unlisted.id);
        results.push({
          type: 'UNLISTED_COMPANY',
          id: unlisted.id,
          symbol: unlisted.name,
          name: unlisted.brandName,
          nameTe: unlisted.nameTe,
          categoryLabelTe: unlisted.categoryLabelTe,
          unlistedData: unlisted,
        });
        if (results.length >= limit) return results;
      }
    }
  }

  return results;
}

