import React from "react";
import { SMCAnalysis } from "@workspace/api-client-react";
import { Layers, ArrowUpRight, ArrowDownRight, Hash } from "lucide-react";
import { formatNumber } from "@/lib/utils";

interface SmartMoneyProps {
  smc: SMCAnalysis;
}

export function SmartMoney({ smc }: SmartMoneyProps) {
  
  return (
    <div className="glass-panel p-5 md:p-6 rounded-2xl flex flex-col h-full">
      <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-4 flex items-center">
        <Layers className="w-4 h-4 mr-2 text-primary" />
        SMC Analysis
      </h2>

      <div className="space-y-6 overflow-y-auto pr-2">
        
        {/* Order Blocks */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <h3 className="text-[10px] uppercase font-bold text-success flex items-center tracking-wider">
              <ArrowUpRight className="w-3 h-3 mr-1" /> Bullish OBs
            </h3>
            {smc.bullish_obs.length > 0 ? smc.bullish_obs.map((ob, i) => (
              <div key={i} className="bg-success/5 border border-success/20 rounded-lg p-2 flex justify-between font-mono text-xs">
                <span className="text-muted-foreground">Range</span>
                <span className="text-success font-semibold">{formatNumber(ob.low)} - {formatNumber(ob.high)}</span>
              </div>
            )) : <EmptyState text="No Bullish OBs" />}
          </div>

          <div className="space-y-2">
            <h3 className="text-[10px] uppercase font-bold text-destructive flex items-center tracking-wider">
              <ArrowDownRight className="w-3 h-3 mr-1" /> Bearish OBs
            </h3>
            {smc.bearish_obs.length > 0 ? smc.bearish_obs.map((ob, i) => (
              <div key={i} className="bg-destructive/5 border border-destructive/20 rounded-lg p-2 flex justify-between font-mono text-xs">
                <span className="text-muted-foreground">Range</span>
                <span className="text-destructive font-semibold">{formatNumber(ob.low)} - {formatNumber(ob.high)}</span>
              </div>
            )) : <EmptyState text="No Bearish OBs" />}
          </div>
        </div>

        {/* Fair Value Gaps */}
        <div className="space-y-2">
          <h3 className="text-[10px] uppercase font-bold text-primary flex items-center tracking-wider">
            <Hash className="w-3 h-3 mr-1" /> Fair Value Gaps (FVG)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {smc.fvgs.length > 0 ? smc.fvgs.map((fvg, i) => (
              <div key={i} className="bg-secondary/30 border border-border/50 rounded-lg p-2 flex items-center justify-between font-mono text-xs">
                <span className="px-1.5 py-0.5 rounded bg-background text-[9px] uppercase font-bold text-muted-foreground">
                  {fvg.type}
                </span>
                <span className="text-foreground">{formatNumber(fvg.bottom)} - {formatNumber(fvg.top)}</span>
              </div>
            )) : <EmptyState text="No recent FVGs detected" />}
          </div>
        </div>

        {/* Equal Highs / Lows */}
        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border/30">
          <div>
            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block mb-1">Eq Highs</span>
            <div className="flex flex-wrap gap-1">
              {smc.equal_highs.length > 0 ? smc.equal_highs.map((val, i) => (
                <span key={i} className="px-2 py-1 bg-destructive/10 text-destructive border border-destructive/20 rounded text-[10px] font-mono font-bold">{formatNumber(val)}</span>
              )) : <span className="text-xs text-muted-foreground/50">-</span>}
            </div>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block mb-1">Eq Lows</span>
            <div className="flex flex-wrap gap-1">
              {smc.equal_lows.length > 0 ? smc.equal_lows.map((val, i) => (
                <span key={i} className="px-2 py-1 bg-success/10 text-success border border-success/20 rounded text-[10px] font-mono font-bold">{formatNumber(val)}</span>
              )) : <span className="text-xs text-muted-foreground/50">-</span>}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="text-xs text-muted-foreground/60 italic p-2 border border-dashed border-border/30 rounded-lg bg-secondary/10">{text}</div>;
}
