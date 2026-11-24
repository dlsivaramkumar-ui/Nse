import React from 'react';
import { AlertNotification, StockIndicatorData } from '../types';
import { Bell, BellOff, Volume2, VolumeX, X, Zap, ArrowRight, Trash2 } from 'lucide-react';

interface AlertsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  alerts: AlertNotification[];
  onClearAlerts: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onSelectStockBySymbol: (symbol: string) => void;
}

export const AlertsDrawer: React.FC<AlertsDrawerProps> = ({
  isOpen,
  onClose,
  alerts,
  onClearAlerts,
  soundEnabled,
  onToggleSound,
  onSelectStockBySymbol,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div
        id="alerts-drawer"
        className="bg-slate-900 border-l border-slate-800 w-full max-w-md h-full shadow-2xl flex flex-col p-4 sm:p-5"
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-100 text-base">ఆటోమేటెడ్ అలర్ట్స్ (Live Alerts)</h3>
              <p className="text-xs text-slate-400">రియల్-టైమ్ సిగ్నల్ నోటిఫికేషన్లు</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onToggleSound}
              title={soundEnabled ? 'ఆడియో మ్యూట్ చేయండి' : 'ఆడియో ఆన్ చేయండి'}
              className={`p-2 rounded-lg border transition-colors ${
                soundEnabled
                  ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-400'
                  : 'bg-slate-800 border-slate-700 text-slate-400'
              }`}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Clear alerts bar */}
        <div className="flex items-center justify-between text-xs text-slate-400 mb-3 px-1">
          <span>మొత్తం అలర్ట్స్: {alerts.length}</span>
          {alerts.length > 0 && (
            <button
              onClick={onClearAlerts}
              className="flex items-center gap-1 text-rose-400 hover:text-rose-300 font-semibold transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" /> అన్నీ క్లియర్ చేయండి
            </button>
          )}
        </div>

        {/* Alert List */}
        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
          {alerts.length === 0 ? (
            <div className="h-48 flex flex-col items-center justify-center text-center text-slate-500 text-xs">
              <BellOff className="w-8 h-8 mb-2 opacity-40" />
              ఇంకా ఎలాంటి కొత్త సిగ్నల్ అలర్ట్స్ రాలేదు.
              <br />
              మార్కెట్ స్కాన్ కొనసాగుతోంది...
            </div>
          ) : (
            alerts.map((alert) => (
              <div
                key={alert.id}
                onClick={() => {
                  onSelectStockBySymbol(alert.symbol);
                  onClose();
                }}
                className="group p-3 rounded-xl bg-slate-850 border border-slate-800 hover:border-slate-700 cursor-pointer transition-all hover:bg-slate-800/80"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-sm text-slate-100 group-hover:text-emerald-400">
                        {alert.symbol}
                      </span>
                      <span className="text-xs text-slate-400 font-mono">₹{alert.price.toFixed(2)}</span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">{alert.name}</div>
                  </div>

                  <div className="text-right">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                        alert.signalStage === 'STRONG_LONG'
                          ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                          : 'bg-amber-950 text-amber-400 border-amber-800'
                      }`}
                    >
                      {alert.signalStage.replace(/_/g, ' ')}
                    </span>
                    <div className="text-[10px] text-slate-500 font-mono mt-1">{alert.timestamp}</div>
                  </div>
                </div>

                <div className="mt-2 text-xs text-slate-300 bg-slate-900/60 p-2 rounded border border-slate-800">
                  <div>{alert.message}</div>
                  {alert.messageTe && (
                    <div className="text-slate-400 text-[11px] mt-0.5">{alert.messageTe}</div>
                  )}
                </div>

                <div className="mt-2 flex items-center justify-between text-[11px]">
                  <span className="text-slate-400 font-mono">స్కోర్: {alert.score}/100</span>
                  <span className="text-emerald-400 font-semibold flex items-center gap-1">
                    చూడండి <ArrowRight className="w-3 h-3" />
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
