import React from "react";
import { AlignJustify } from "lucide-react";
import { formatNumber } from "@/lib/utils";

interface SupportResistancePanelProps {
  support: number[];
  resistance: number[];
  currentPrice: number;
}

export function SupportResistancePanel({ support, resistance, currentPrice }: SupportResistancePanelProps) {
  // Sort descending for visual hierarchy (highest price at top)
  const sortedResistance = [...resistance].sort((a, b) => b - a);
  const sortedSupport = [...support].sort((a, b) => b - a);

  return (
    <div className="glass-panel p-5 rounded-2xl h-full flex flex-col">
      <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-4 flex items-center">
        <AlignJustify className="w-4 h-4 mr-2" />
        Key Levels
      </h2>

      <div className="flex-1 bg-background/40 border border-border/50 rounded-xl p-3 flex flex-col font-mono text-sm relative">
        
        {/* Resistance block */}
        <div className="flex flex-col gap-1 mb-3">
          {sortedResistance.map((r, i) => (
            <div key={`r-${i}`} className="flex items-center text-destructive/80 hover:text-destructive transition-colors">
              <div className="w-8 text-[10px] font-sans font-bold text-muted-foreground tracking-wider">R{sortedResistance.length - i}</div>
              <div className="flex-1 h-px bg-destructive/20 mx-2 border-b border-dashed border-destructive/30" />
              <span>{formatNumber(r)}</span>
            </div>
          ))}
          {sortedResistance.length === 0 && <div className="text-xs text-muted-foreground text-center py-1">No major resistance</div>}
        </div>

        {/* Current Price Marker */}
        <div className="py-2 my-1 flex items-center relative z-10 bg-primary/10 border-y border-primary/30 -mx-3 px-3 shadow-[0_0_10px_rgba(250,204,21,0.1)]">
          <div className="w-8 text-[10px] font-sans font-bold text-primary tracking-wider flex items-center">
            <span className="w-2 h-2 rounded-full bg-primary mr-1 animate-pulse" />
            CMP
          </div>
          <div className="flex-1 h-px bg-primary/40 mx-2" />
          <span className="text-primary font-bold shadow-sm">{formatNumber(currentPrice)}</span>
        </div>

        {/* Support block */}
        <div className="flex flex-col gap-1 mt-3">
          {sortedSupport.map((s, i) => (
            <div key={`s-${i}`} className="flex items-center text-success/80 hover:text-success transition-colors">
              <div className="w-8 text-[10px] font-sans font-bold text-muted-foreground tracking-wider">S{i + 1}</div>
              <div className="flex-1 h-px bg-success/20 mx-2 border-b border-dashed border-success/30" />
              <span>{formatNumber(s)}</span>
            </div>
          ))}
          {sortedSupport.length === 0 && <div className="text-xs text-muted-foreground text-center py-1">No major support</div>}
        </div>

      </div>
    </div>
  );
}
