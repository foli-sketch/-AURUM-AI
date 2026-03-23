import React, { useState } from "react";
import { Indicator } from "@workspace/api-client-react";
import { cn, getSignalColors, formatNumber } from "@/lib/utils";
import { Activity } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface TechnicalIndicatorsProps {
  indicators: Indicator[];
}

type TabType = "Trend" | "Momentum" | "Volatility" | "Volume";

const TABS: TabType[] = ["Trend", "Momentum", "Volatility", "Volume"];

// Categorization helper
function getCategory(name: string): TabType {
  const n = name.toUpperCase();
  if (n.includes("EMA") || n.includes("SMA") || n.includes("MACD") || n.includes("ADX") || n.includes("PSAR") || n.includes("TENKAN") || n.includes("KIJUN") || n.includes("SENKOU")) return "Trend";
  if (n.includes("RSI") || n.includes("STOCH") || n.includes("CCI") || n.includes("WILLR") || n.includes("ROC")) return "Momentum";
  if (n.includes("ATR") || n.includes("BB_") || n.includes("KC_") || n.includes("DC_")) return "Volatility";
  if (n.includes("OBV") || n.includes("MFI") || n.includes("CMF") || n.includes("VWAP")) return "Volume";
  return "Trend"; // fallback
}

export function TechnicalIndicators({ indicators }: TechnicalIndicatorsProps) {
  const [activeTab, setActiveTab] = useState<TabType>("Trend");

  const filteredIndicators = indicators.filter(ind => getCategory(ind.name) === activeTab);

  return (
    <div className="glass-panel rounded-2xl h-full flex flex-col overflow-hidden">
      
      <div className="p-4 md:p-5 border-b border-border/50 bg-secondary/10 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest flex items-center">
          <Activity className="w-4 h-4 mr-2" />
          Technical Data
        </h2>
        
        {/* Tabs */}
        <div className="flex bg-background/80 p-1 rounded-lg border border-border/50 w-full sm:w-auto">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "flex-1 sm:flex-none px-3 py-1.5 rounded-md text-xs font-semibold transition-colors relative",
                activeTab === tab ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {activeTab === tab && (
                <motion.div 
                  layoutId="activeIndicatorTab"
                  className="absolute inset-0 bg-secondary border border-border/50 rounded-md -z-10"
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              )}
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        <div className="grid grid-cols-[2fr_1fr_1fr] gap-4 px-4 py-2 text-[10px] uppercase font-bold text-muted-foreground tracking-wider border-b border-border/30 sticky top-0 bg-card/90 backdrop-blur-sm z-10">
          <span>Indicator</span>
          <span className="text-right">Value</span>
          <span className="text-right">Signal</span>
        </div>
        
        <AnimatePresence mode="popLayout">
          <motion.div 
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col"
          >
            {filteredIndicators.map((ind, i) => (
              <div 
                key={ind.name}
                className="grid grid-cols-[2fr_1fr_1fr] gap-4 px-4 py-3 items-center border-b border-border/20 hover:bg-secondary/20 transition-colors group"
              >
                <div className="flex flex-col">
                  <span className="font-semibold text-sm text-foreground">{ind.name.replace(/_/g, " ")}</span>
                  {ind.extra && <span className="text-[10px] text-muted-foreground mt-0.5">{ind.extra}</span>}
                </div>
                
                <span className="font-mono text-sm text-right text-foreground">
                  {formatNumber(ind.value, 4)}
                </span>
                
                <div className="flex justify-end">
                  <span className={cn(
                    "px-2 py-1 rounded text-[10px] font-bold tracking-wider",
                    getSignalColors(ind.signal)
                  )}>
                    {ind.signal}
                  </span>
                </div>
              </div>
            ))}
            
            {filteredIndicators.length === 0 && (
              <div className="py-12 text-center text-muted-foreground text-sm font-medium">
                No indicators available for this category.
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

    </div>
  );
}
