import { 
  useGetTradingSignal, 
  useGetMarketNews, 
  useGetSignalHistory, 
  GetTradingSignalTimeframe,
  healthCheck
} from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";

// Health check to ensure backend is up
export function useBackendHealth(autoRefresh: boolean) {
  return useQuery({
    queryKey: ['/api/healthz'],
    queryFn: async () => {
      const res = await healthCheck();
      return res;
    },
    refetchInterval: autoRefresh ? 30000 : false,
    retry: false
  });
}

// Wrapper hooks that inject the auto-refresh logic
export function useLiveSignal(timeframe: GetTradingSignalTimeframe, autoRefresh: boolean) {
  return useGetTradingSignal(
    { timeframe },
    { 
      query: { 
        refetchInterval: autoRefresh ? 30000 : false,
        staleTime: 10000,
        retry: 2
      } 
    }
  );
}

export function useLiveNews(autoRefresh: boolean) {
  return useGetMarketNews(
    { 
      query: { 
        refetchInterval: autoRefresh ? 60000 : false,
        staleTime: 30000
      } 
    }
  );
}

export function useLiveHistory(autoRefresh: boolean) {
  return useGetSignalHistory(
    { 
      query: { 
        refetchInterval: autoRefresh ? 60000 : false,
        staleTime: 30000
      } 
    }
  );
}
