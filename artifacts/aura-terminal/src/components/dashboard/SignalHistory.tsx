import React from "react";
import { useLiveHistory } from "@/hooks/use-trading";
import { History, Loader2 } from "lucide-react";
import { formatNumber, cn, getSignalColors } from "@/lib/utils";
import { format } from "date-fns";

export function SignalHistory({ autoRefresh }: { autoRefresh: boolean }) {
  const { data, isLoading, isError } = useLiveHistory(autoRefresh);

  return (
    <div className="glass-panel p-5 rounded-2xl h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest flex items-center">
          <History className="w-4 h-4 mr-2" />
          Signal History
        </h2>
        {isLoading && <Loader2 className="w-3 h-3 animate-spin text-primary" />}
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="grid grid-cols-[auto_1fr_1fr_1fr_auto] gap-3 px-3 py-2 text-[10px] uppercase font-bold text-muted-foreground tracking-wider border-b border-border/30">
          <span className="w-12">Time</span>
          <span>TF</span>
          <span className="text-right">Price</span>
          <span className="text-center">Conf</span>
          <span className="text-right">Signal</span>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {isLoading && !data && (
            <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
              Loading history...
            </div>
          )}

          {isError && (
            <div className="text-destructive text-sm p-4 text-center">
              Failed to load history.
            </div>
          )}

          {data?.history.map((sig, i) => (
            <div 
              key={i}
              className="grid grid-cols-[auto_1fr_1fr_1fr_auto] gap-3 px-3 py-2.5 items-center border-b border-border/20 hover:bg-secondary/20 transition-colors text-xs"
            >
              <span className="w-12 font-mono text-muted-foreground">
                {format(new Date(sig.timestamp), "HH:mm")}
              </span>
              <span className="font-bold text-muted-foreground">{sig.timeframe}</span>
              <span className="font-mono text-right text-foreground">{formatNumber(sig.price)}</span>
              <span className="font-mono text-center text-foreground">{sig.confidence}%</span>
              <div className="flex justify-end">
                <span className={cn(
                  "px-2 py-0.5 rounded text-[9px] font-bold tracking-wider whitespace-nowrap",
                  getSignalColors(sig.signal)
                )}>
                  {sig.signal}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
