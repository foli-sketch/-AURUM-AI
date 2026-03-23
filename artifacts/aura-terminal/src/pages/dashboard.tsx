import React, { useState } from "react";
import { GetTradingSignalTimeframe } from "@workspace/api-client-react";
import { useLiveSignal, useBackendHealth } from "@/hooks/use-trading";
import { TopBar } from "@/components/dashboard/TopBar";
import { MainSignal } from "@/components/dashboard/MainSignal";
import { TechnicalIndicators } from "@/components/dashboard/TechnicalIndicators";
import { MTFBiasPanel } from "@/components/dashboard/MTFBiasPanel";
import { SmartMoney } from "@/components/dashboard/SmartMoney";
import { SupportResistancePanel } from "@/components/dashboard/SupportResistancePanel";
import { MarketNews } from "@/components/dashboard/MarketNews";
import { SignalHistory } from "@/components/dashboard/SignalHistory";
import { AlertCircle, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

export default function Dashboard() {
  const [timeframe, setTimeframe] = useState<GetTradingSignalTimeframe>("1h");
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Check generic health
  const { isError: isHealthError } = useBackendHealth(autoRefresh);
  
  // Fetch main signal data
  const { data: signalData, isLoading, isError, isFetching } = useLiveSignal(timeframe, autoRefresh);

  const isBackendDown = isHealthError || isError;

  return (
    <div className="min-h-screen bg-background text-foreground p-3 md:p-6 overflow-x-hidden selection:bg-primary/30">
      
      <div className="max-w-[1600px] mx-auto space-y-4 md:space-y-6">
        
        {/* Header Section */}
        <TopBar 
          timeframe={timeframe} 
          setTimeframe={setTimeframe}
          autoRefresh={autoRefresh}
          setAutoRefresh={setAutoRefresh}
          price={signalData?.price}
          session={signalData?.session}
          lastUpdated={signalData?.timestamp}
          isFetching={isFetching}
          isBackendDown={isBackendDown}
        />

        {/* Global Error State */}
        {isBackendDown && !signalData && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full p-6 glass-panel border-destructive/50 bg-destructive/10 flex flex-col items-center justify-center rounded-2xl text-center"
          >
            <AlertCircle className="w-12 h-12 text-destructive mb-4" />
            <h2 className="text-xl font-bold text-foreground mb-2">Backend Connection Failed</h2>
            <p className="text-muted-foreground max-w-md">
              Unable to connect to the trading engine. Ensure the Flask backend is running and the API endpoints are accessible.
            </p>
          </motion.div>
        )}

        {/* Initial Loading State */}
        {isLoading && !signalData && !isBackendDown && (
          <div className="w-full h-[60vh] flex flex-col items-center justify-center">
            <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
            <p className="text-muted-foreground font-mono text-sm tracking-widest uppercase animate-pulse">Initializing Terminal...</p>
          </div>
        )}

        {/* Main Grid Layout */}
        {signalData && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6"
          >
            
            {/* Column 1: Main Signal & Bias (Spans 5 cols on desktop) */}
            <div className="lg:col-span-5 flex flex-col gap-4 md:gap-6">
              <div className="min-h-[380px]">
                <MainSignal signalData={signalData} />
              </div>
              <MTFBiasPanel bias={signalData.mtf_bias} patterns={signalData.patterns} />
            </div>

            {/* Column 2: Indicators & SMC (Spans 4 cols on desktop) */}
            <div className="lg:col-span-4 flex flex-col gap-4 md:gap-6">
              <div className="h-[400px]">
                <TechnicalIndicators indicators={signalData.indicators} />
              </div>
              <div className="flex-1 min-h-[300px]">
                <SmartMoney smc={signalData.smc} />
              </div>
            </div>

            {/* Column 3: Levels, News, History (Spans 3 cols on desktop) */}
            <div className="lg:col-span-3 flex flex-col gap-4 md:gap-6">
              <div className="h-[250px]">
                <SupportResistancePanel 
                  support={signalData.support_levels} 
                  resistance={signalData.resistance_levels} 
                  currentPrice={signalData.price} 
                />
              </div>
              <div className="h-[300px]">
                <MarketNews autoRefresh={autoRefresh} />
              </div>
              <div className="h-[300px]">
                <SignalHistory autoRefresh={autoRefresh} />
              </div>
            </div>

          </motion.div>
        )}

      </div>
    </div>
  );
}
