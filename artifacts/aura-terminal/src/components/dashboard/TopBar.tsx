import React from "react";
import { Clock, Activity, Power, Globe, RefreshCcw } from "lucide-react";
import { GetTradingSignalTimeframe } from "@workspace/api-client-react";
import { cn, formatPrice } from "@/lib/utils";

interface TopBarProps {
  timeframe: GetTradingSignalTimeframe;
  setTimeframe: (tf: GetTradingSignalTimeframe) => void;
  autoRefresh: boolean;
  setAutoRefresh: (val: boolean) => void;
  price?: number;
  session?: { name: string; active: boolean };
  lastUpdated?: string;
  isFetching: boolean;
  isBackendDown: boolean;
}

export function TopBar({
  timeframe,
  setTimeframe,
  autoRefresh,
  setAutoRefresh,
  price,
  session,
  lastUpdated,
  isFetching,
  isBackendDown
}: TopBarProps) {
  const timeframes: GetTradingSignalTimeframe[] = ["5m", "15m", "30m", "1h", "4h", "1d"];

  return (
    <div className="w-full glass-panel flex flex-col md:flex-row items-center justify-between px-4 py-3 md:px-6 rounded-2xl mb-6 relative overflow-hidden">
      
      {/* Decorative background glow */}
      <div className="absolute top-0 left-1/4 w-96 h-full bg-primary/5 blur-3xl rounded-full pointer-events-none" />

      {/* Brand & Price */}
      <div className="flex items-center space-x-6 w-full md:w-auto mb-4 md:mb-0">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-amber-700 flex items-center justify-center shadow-lg shadow-primary/20">
            <Activity className="w-5 h-5 text-background" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-foreground leading-none">AURA</h1>
            <p className="text-[10px] text-primary uppercase font-semibold tracking-wider">Terminal Pro</p>
          </div>
        </div>

        <div className="h-10 w-px bg-border hidden sm:block" />

        <div className="flex flex-col">
          <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">XAU/USD</span>
          <span className="text-2xl font-mono font-bold text-foreground text-shadow-sm flex items-center space-x-2">
            {price ? formatPrice(price) : "---.--"}
            {isFetching && <RefreshCcw className="w-4 h-4 ml-2 animate-spin text-muted-foreground" />}
          </span>
        </div>
      </div>

      {/* Timeframes */}
      <div className="flex bg-background/50 p-1 rounded-xl border border-border/50 overflow-x-auto max-w-full">
        {timeframes.map((tf) => (
          <button
            key={tf}
            onClick={() => setTimeframe(tf)}
            className={cn(
              "px-4 py-1.5 rounded-lg text-sm font-semibold transition-all duration-200 whitespace-nowrap",
              timeframe === tf
                ? "bg-primary text-primary-foreground shadow-md"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
            )}
          >
            {tf}
          </button>
        ))}
      </div>

      {/* Status & Controls */}
      <div className="flex items-center space-x-4 mt-4 md:mt-0 w-full md:w-auto justify-end">
        {session && (
          <div className="hidden lg:flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-secondary/30 border border-border/50">
            <Globe className={cn("w-4 h-4", session.active ? "text-primary" : "text-muted-foreground")} />
            <span className="text-xs font-semibold tracking-wider">{session.name}</span>
          </div>
        )}

        <div className="hidden sm:flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-secondary/30 border border-border/50">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs font-mono text-muted-foreground">
            {lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : "--:--:--"}
          </span>
        </div>

        <button
          onClick={() => setAutoRefresh(!autoRefresh)}
          className={cn(
            "flex items-center space-x-2 px-3 py-1.5 rounded-lg border transition-all duration-300",
            autoRefresh 
              ? "bg-primary/10 border-primary/30 text-primary" 
              : "bg-secondary/30 border-border/50 text-muted-foreground hover:bg-secondary/50",
            isBackendDown && "opacity-50 cursor-not-allowed"
          )}
          disabled={isBackendDown}
          title="Auto Refresh (30s)"
        >
          <Power className="w-4 h-4" />
          <span className="text-xs font-bold uppercase tracking-wider hidden sm:inline">
            {isBackendDown ? "OFFLINE" : autoRefresh ? "LIVE" : "PAUSED"}
          </span>
        </button>
      </div>

    </div>
  );
}
