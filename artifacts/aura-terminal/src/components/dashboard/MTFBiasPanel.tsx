import React from "react";
import { MTFBias, CandlePattern } from "@workspace/api-client-react";
import { Compass, Zap } from "lucide-react";
import { cn, getSignalColors } from "@/lib/utils";

interface MTFBiasPanelProps {
  bias: MTFBias;
  patterns: CandlePattern[];
}

export function MTFBiasPanel({ bias, patterns }: MTFBiasPanelProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Bias Card */}
      <div className="glass-panel p-5 rounded-2xl flex flex-col justify-between">
        <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-4 flex items-center">
          <Compass className="w-4 h-4 mr-2" />
          MTF Bias
        </h2>
        
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Overall Context</span>
          <span className={cn(
            "px-3 py-1 rounded-full text-xs font-black tracking-widest shadow-sm",
            getSignalColors(bias.overall)
          )}>
            {bias.overall}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 mt-auto">
          {Object.entries(bias.timeframes).map(([tf, val]) => (
            <div key={tf} className="flex flex-col items-center bg-secondary/30 border border-border/50 rounded-xl p-2">
              <span className="text-[10px] font-bold text-muted-foreground mb-1">{tf}</span>
              <div className={cn("w-3 h-3 rounded-full shadow-inner", 
                val === "BULLISH" ? "bg-success shadow-success/50" : 
                val === "BEARISH" ? "bg-destructive shadow-destructive/50" : 
                "bg-muted shadow-muted/50"
              )} />
            </div>
          ))}
        </div>
      </div>

      {/* Patterns Card */}
      <div className="glass-panel p-5 rounded-2xl flex flex-col">
        <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-4 flex items-center">
          <Zap className="w-4 h-4 mr-2 text-primary" />
          Candle Patterns
        </h2>
        
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-[140px]">
          {patterns.length > 0 ? patterns.map((p, i) => (
            <div key={i} className="flex items-center justify-between bg-background/50 border border-border/40 p-2.5 rounded-lg group hover:border-border transition-colors">
              <span className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">{p.name}</span>
              <span className={cn(
                "text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded",
                p.type === "BULLISH" ? "bg-success/10 text-success border border-success/20" :
                p.type === "BEARISH" ? "bg-destructive/10 text-destructive border border-destructive/20" :
                "bg-muted/20 text-muted-foreground border border-muted/30"
              )}>
                {p.type}
              </span>
            </div>
          )) : (
            <div className="h-full flex items-center justify-center text-muted-foreground text-sm italic">
              No strong patterns detected
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
