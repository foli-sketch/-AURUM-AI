import React from "react";
import { TradingSignal } from "@workspace/api-client-react";
import { cn, formatNumber, getSignalColors, getSignalTextColor } from "@/lib/utils";
import { ArrowUpRight, ArrowDownRight, Minus, Crosshair, ShieldAlert, Target, Scale } from "lucide-react";
import { motion } from "framer-motion";

interface MainSignalProps {
  signalData: TradingSignal;
}

export function MainSignal({ signalData }: MainSignalProps) {
  const { signal, confidence, strength, entry, stop_loss, take_profit_1, take_profit_2, take_profit_3, risk_reward, buy_score, sell_score } = signalData;

  const isBuy = signal.includes("BUY");
  const isSell = signal.includes("SELL");
  
  const SignalIcon = isBuy ? ArrowUpRight : isSell ? ArrowDownRight : Minus;
  
  return (
    <div className="glass-panel p-6 rounded-2xl h-full flex flex-col relative overflow-hidden group">
      {/* Background ambient glow based on signal */}
      <div className={cn(
        "absolute -top-24 -right-24 w-64 h-64 blur-[80px] rounded-full opacity-20 transition-colors duration-1000",
        isBuy ? "bg-success" : isSell ? "bg-destructive" : "bg-muted"
      )} />

      <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-6 flex items-center">
        <Crosshair className="w-4 h-4 mr-2" />
        Trading Signal
      </h2>

      <div className="flex flex-col xl:flex-row gap-8 items-center justify-between mb-8">
        
        {/* Signal Display */}
        <div className="flex-1 flex flex-col items-center xl:items-start text-center xl:text-left relative z-10">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            key={signal}
            className={cn(
              "inline-flex items-center justify-center p-4 rounded-2xl mb-4 shadow-xl border",
              getSignalColors(signal)
            )}
          >
            <SignalIcon className="w-10 h-10 mr-3" strokeWidth={3} />
            <span className="text-3xl font-black tracking-tight">{signal}</span>
          </motion.div>
          <p className="text-sm text-muted-foreground max-w-[250px]">
            AI multi-timeframe analysis indicates a <span className={cn("font-bold", getSignalTextColor(signal))}>{signal.toLowerCase()}</span> bias with {confidence}% confidence.
          </p>
        </div>

        {/* Confidence Ring */}
        <div className="relative w-36 h-36 flex-shrink-0 z-10">
          <svg className="w-full h-full transform -rotate-90">
            <circle cx="72" cy="72" r="64" stroke="currentColor" strokeWidth="12" fill="transparent" className="text-secondary/50" />
            <motion.circle 
              initial={{ strokeDasharray: "0 400" }}
              animate={{ strokeDasharray: `${(confidence / 100) * 402} 402` }}
              transition={{ duration: 1.5, ease: "easeOut" }}
              cx="72" cy="72" r="64" stroke="currentColor" strokeWidth="12" fill="transparent" 
              strokeLinecap="round"
              className={cn(
                isBuy ? "text-success" : isSell ? "text-destructive" : "text-primary"
              )} 
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-black font-mono tracking-tighter">{confidence}</span>
            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Confidence</span>
          </div>
        </div>
      </div>

      {/* Trade Setup Matrix */}
      {(entry || stop_loss || take_profit_1) ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6 relative z-10">
          <SetupCard title="Entry Range" value={formatNumber(entry)} icon={Crosshair} color="text-primary" />
          <SetupCard title="Stop Loss" value={formatNumber(stop_loss)} icon={ShieldAlert} color="text-destructive" />
          <SetupCard title="Take Profit 1" value={formatNumber(take_profit_1)} icon={Target} color="text-success" />
          <SetupCard title="Risk / Reward" value={`1 : ${formatNumber(risk_reward, 1)}`} icon={Scale} color="text-accent" />
        </div>
      ) : (
        <div className="bg-secondary/30 border border-border/50 rounded-xl p-6 text-center mb-6 relative z-10">
          <p className="text-muted-foreground font-medium">Wait for clear setup. No active entry signals.</p>
        </div>
      )}

      {/* Bull vs Bear Score Bars */}
      <div className="mt-auto pt-4 border-t border-border/50 relative z-10">
        <div className="flex justify-between text-xs font-bold uppercase tracking-wider mb-2">
          <span className="text-success">Bull Score: {buy_score}</span>
          <span className="text-destructive">Bear Score: {sell_score}</span>
        </div>
        <div className="h-3 w-full bg-secondary/50 rounded-full flex overflow-hidden border border-border/50">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${(buy_score / (buy_score + sell_score || 1)) * 100}%` }}
            className="h-full bg-gradient-to-r from-success/80 to-success" 
          />
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${(sell_score / (buy_score + sell_score || 1)) * 100}%` }}
            className="h-full bg-gradient-to-l from-destructive/80 to-destructive" 
          />
        </div>
      </div>

    </div>
  );
}

function SetupCard({ title, value, icon: Icon, color }: { title: string, value: string, icon: any, color: string }) {
  return (
    <div className="bg-secondary/30 border border-border/50 rounded-xl p-3 flex flex-col justify-center">
      <div className="flex items-center space-x-2 mb-1">
        <Icon className={cn("w-3.5 h-3.5", color)} />
        <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">{title}</span>
      </div>
      <span className="font-mono font-bold text-sm lg:text-base text-foreground tracking-tight">{value}</span>
    </div>
  );
}
