import React from 'react';
import { UnlistedCompany } from '../data/unlistedCompanies';
import {
  X,
  AlertTriangle,
  Info,
  Clock,
  ArrowRight,
  TrendingUp,
  ExternalLink,
  ShieldAlert,
  Sparkles,
  Layers,
  HelpCircle,
  CheckCircle2,
} from 'lucide-react';

export type SearchModalData =
  | {
      type: 'UNLISTED_COMPANY';
      company: UnlistedCompany;
    }
  | {
      type: 'MERGED_ENTITY';
      oldSymbol: string;
      newSymbol: string;
      companyName: string;
      reasonTe: string;
    }
  | {
      type: 'DELISTED_STOCK';
      symbol: string;
      reasonTe: string;
      reasonEn?: string;
    }
  | {
      type: 'PRICE_OUT_OF_RANGE';
      symbol: string;
      currentPrice: number;
      reasonTe: string;
    }
  | {
      type: 'NOT_FOUND';
      query: string;
    };

interface StockSearchStatusModalProps {
  data: SearchModalData | null;
  onClose: () => void;
  onSelectStockSymbol: (symbol: string) => void;
}

export const StockSearchStatusModal: React.FC<StockSearchStatusModalProps> = ({
  data,
  onClose,
  onSelectStockSymbol,
}) => {
  if (!data) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md overflow-y-auto animate-fadeIn">
      <div
        className="relative w-full max-w-xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Ribbon */}
        {data.type === 'UNLISTED_COMPANY' && (
          <div className="bg-gradient-to-r from-amber-600 via-orange-500 to-amber-600 px-4 py-2 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              అన్‌లిస్టెడ్ / ప్రీ-ఐపీవో స్థితి నివేదిక (Unlisted / Pre-IPO Status)
            </span>
            <span className="bg-slate-950/20 px-2 py-0.5 rounded text-[10px] font-mono font-bold">
              NSE క్యాష్ మార్కెట్‌లో ఇంకా లిస్ట్ కాలేదు
            </span>
          </div>
        )}

        {data.type === 'MERGED_ENTITY' && (
          <div className="bg-gradient-to-r from-cyan-600 to-blue-600 px-4 py-2 text-white font-black text-xs uppercase tracking-wider flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              కార్పొరేట్ రీ-బ్రాండింగ్ / విలీనం (Rebranded & Merged Entity)
            </span>
            <span className="bg-black/20 px-2 py-0.5 rounded text-[10px] font-mono">
              కొత్త NSE సింబల్ అందుబాటులో ఉంది
            </span>
          </div>
        )}

        {data.type === 'DELISTED_STOCK' && (
          <div className="bg-gradient-to-r from-rose-700 to-amber-700 px-4 py-2 text-white font-black text-xs uppercase tracking-wider flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5" />
              డీలిస్టెడ్ / ట్రేడింగ్ సస్పెండ్ చేయబడిన స్టాక్ (Delisted / Suspended)
            </span>
          </div>
        )}

        {data.type === 'PRICE_OUT_OF_RANGE' && (
          <div className="bg-gradient-to-r from-amber-600 to-yellow-600 px-4 py-2 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              ధర పరిధి ఫిల్టర్ హెచ్చరిక (Price Range Filter Notice)
            </span>
          </div>
        )}

        {data.type === 'NOT_FOUND' && (
          <div className="bg-gradient-to-r from-slate-700 to-slate-800 px-4 py-2 text-slate-200 font-bold text-xs uppercase tracking-wider flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
              సింబల్ అన్వేషణ మార్గదర్శకం (Symbol Lookup Assistance)
            </span>
          </div>
        )}

        {/* Modal Top Bar */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-start justify-between gap-3 bg-slate-950/60">
          <div>
            {data.type === 'UNLISTED_COMPANY' && (
              <>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl sm:text-2xl font-black text-white font-sans">
                    {data.company.name}
                  </h2>
                  <span className="text-[11px] px-2.5 py-0.5 rounded-full font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    {data.company.categoryLabelTe}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1 font-mono">
                  {data.company.legalEntityName}
                </p>
              </>
            )}

            {data.type === 'MERGED_ENTITY' && (
              <>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl font-black text-slate-100 font-mono">
                    {data.oldSymbol} → <span className="text-cyan-400">{data.newSymbol}</span>
                  </h2>
                  <span className="text-[11px] px-2.5 py-0.5 rounded-full font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                    సక్రియ NSE సింబల్
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">{data.companyName}</p>
              </>
            )}

            {data.type === 'DELISTED_STOCK' && (
              <>
                <h2 className="text-xl font-black text-rose-300 font-mono">
                  {data.symbol} (NSE Delisted)
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  నేషనల్ స్టాక్ ఎక్స్ఛేంజ్ (NSE) లో ట్రేడింగ్ నిలిపివేయబడింది
                </p>
              </>
            )}

            {data.type === 'PRICE_OUT_OF_RANGE' && (
              <>
                <h2 className="text-xl font-black text-amber-300 font-mono">
                  {data.symbol} (LTP: ₹{data.currentPrice.toFixed(2)})
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  మన స్కానర్ కేవలం ₹100 నుండి ₹3,000 పరిధిలో ఉన్న స్టాక్స్‌ను మాత్రమే ప్రాసెస్ చేస్తుంది
                </p>
              </>
            )}

            {data.type === 'NOT_FOUND' && (
              <>
                <h2 className="text-lg font-black text-slate-200">
                  "{data.query}" సింబల్ కనుగొనబడలేదు
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  NSE ఈక్విటీ కేటలాగ్‌లో ఖచ్చితమైన సింబల్‌తో సరిపోలలేదు
                </p>
              </>
            )}
          </div>

          <button
            id="btn-close-search-status-modal"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body Content */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto text-xs text-slate-300 leading-relaxed">
          {data.type === 'UNLISTED_COMPANY' && (
            <>
              {/* Status Explanation Card */}
              <div className="bg-amber-950/30 border border-amber-500/40 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center gap-2 text-amber-300 font-bold text-sm">
                  <Info className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>సెర్చ్ రిజల్ట్స్ ఎందుకు రావడం లేదు? (Why No Results?)</span>
                </div>
                <p className="text-slate-200 font-medium">
                  {data.company.statusSummaryTe}
                </p>
                <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800 text-[11px] text-slate-300">
                  {data.company.detailedReportTe}
                </div>
              </div>

              {/* SEBI / IPO Status Information */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 space-y-1.5">
                <div className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">
                  SEBI / IPO ప్రస్తుత స్థితి (Current Exchange Status)
                </div>
                <div className="text-sm font-bold font-mono text-cyan-300 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                  {data.company.sebiIpoStatus}
                </div>
                <p className="text-[11px] text-slate-400">
                  ఈ కంపెనీ పబ్లిక్ ఐపీవో (IPO) పూర్తి చేసుకుని NSE లో అధికారికంగా లిస్ట్ అయిన తక్షణమే, మన రియల్-టైమ్ స్కానర్ ఆటోమేటిక్‌గా దీని లైవ్ కొటేషన్స్, 20-మినిట్ పర్సిస్టెన్స్ మరియు బ్రేకవుట్ స్కోర్లను ట్రాక్ చేయడం ప్రారంభిస్తుంది.
                </p>
              </div>

              {/* Related Listed Peers on NSE */}
              {data.company.relatedListedPeers && data.company.relatedListedPeers.length > 0 && (
                <div className="space-y-2.5 pt-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                      సంబంధిత NSE లిస్టెడ్ ఈక్విటీలు (Related Active Listed Peers)
                    </span>
                    <span className="text-[10px] text-slate-400 font-normal">
                      క్లిక్ చేసి వెంటనే విశ్లేషించండి
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-2">
                    {data.company.relatedListedPeers.map((peer) => (
                      <div
                        key={peer.symbol}
                        onClick={() => {
                          onClose();
                          onSelectStockSymbol(peer.symbol);
                        }}
                        className="p-3 bg-slate-950/90 hover:bg-slate-800 border border-slate-800 hover:border-emerald-500/50 rounded-xl cursor-pointer transition-all flex items-center justify-between gap-3 group shadow-md"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-sm text-emerald-400 group-hover:text-emerald-300">
                              {peer.symbol}
                            </span>
                            <span className="text-xs font-bold text-slate-200">{peer.name}</span>
                            <span className="text-[10px] bg-slate-900 text-slate-400 px-1.5 py-0.2 rounded border border-slate-700">
                              {peer.sector}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 line-clamp-1">
                            {peer.reasonTe}
                          </p>
                        </div>

                        <div className="shrink-0 flex items-center gap-1 text-emerald-400 group-hover:translate-x-0.5 transition-transform font-bold text-xs">
                          <span>చూడండి</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {data.type === 'MERGED_ENTITY' && (
            <div className="space-y-4">
              <div className="bg-cyan-950/30 border border-cyan-500/40 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center gap-2 text-cyan-300 font-bold text-sm">
                  <Info className="w-4 h-4 text-cyan-400" />
                  <span>కార్పొరేట్ అప్‌డేట్ & కొత్త సింబల్</span>
                </div>
                <p className="text-slate-200">{data.reasonTe}</p>
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="text-xs text-slate-400">యాక్టివ్ NSE సింబల్:</div>
                  <div className="text-base font-black font-mono text-cyan-300">
                    {data.newSymbol}
                  </div>
                </div>

                <button
                  onClick={() => {
                    onClose();
                    onSelectStockSymbol(data.newSymbol);
                  }}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-lg shadow-cyan-950/50"
                >
                  <span>{data.newSymbol} చార్ట్ ఓపెన్ చేయండి</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {data.type === 'DELISTED_STOCK' && (
            <div className="space-y-3">
              <div className="bg-rose-950/30 border border-rose-500/40 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center gap-2 text-rose-300 font-bold text-sm">
                  <ShieldAlert className="w-4 h-4 text-rose-400" />
                  <span>డీలిస్టింగ్ లేదా ట్రేడింగ్ నిలిపివేత కారణం</span>
                </div>
                <p className="text-slate-200">{data.reasonTe}</p>
              </div>
              <p className="text-slate-400 text-[11px]">
                ఈక్విటీ ట్రేడింగ్ సస్పెండ్ చేయబడినందున, తప్పుడు సిగ్నల్స్ నివారణకు ఈ స్టాక్ స్కానర్ నుండి మినహాయించబడింది.
              </p>
            </div>
          )}

          {data.type === 'PRICE_OUT_OF_RANGE' && (
            <div className="space-y-3">
              <div className="bg-amber-950/30 border border-amber-500/40 rounded-xl p-3.5 space-y-2">
                <p className="text-slate-200">{data.reasonTe}</p>
                <div className="text-[11px] text-slate-400">
                  మన స్కానర్ నియమం: ₹100 కన్నా తక్కువ ఉన్న పెన్నీ స్టాక్స్ లేదా ₹3,000 కన్నా ఎక్కువ ఉన్న స్టాక్స్ సిస్టమ్ వ్యూహానికి సరిపోవు.
                </div>
              </div>
            </div>
          )}

          {data.type === 'NOT_FOUND' && (
            <div className="space-y-3">
              <p className="text-slate-300">
                దయచేసి అధికారిక NSE ఈక్విటీ సింబల్ నమోదు చేయండి (ఉదా: <strong>RELIANCE, INFY, TCS, SBIN, TATAMOTORS, PAYTM, BEL, TATASTEEL</strong>).
              </p>

              <div className="pt-2">
                <div className="text-xs font-bold text-slate-200 mb-2">
                  🔥 ప్రముఖ టెక్ & మొమెంటమ్ స్టాక్స్ (Quick Recommendations):
                </div>
                <div className="flex flex-wrap gap-2">
                  {['PAYTM', 'SWIGGY', 'ETERNAL', 'POLICYBZR', 'INFIBEAM', 'TMPV', 'BEL'].map(
                    (sym) => (
                      <button
                        key={sym}
                        onClick={() => {
                          onClose();
                          onSelectStockSymbol(sym);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 text-xs font-mono font-bold transition-colors"
                      >
                        {sym}
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 sm:p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
          <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>NSE ఇండియా అధీకృత ఈక్విటీల రక్షణ & పారదర్శకత</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors"
          >
            మూసివేయండి (Close)
          </button>
        </div>
      </div>
    </div>
  );
};
