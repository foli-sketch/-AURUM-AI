import {
  useGetTradingSignal,
  useGetMarketNews,
  useGetSignalHistory,
  useGetAnalysis,
  sendChat,
  broadcastTelegram,
  GetTradingSignalTimeframe,
  TradingSignal,
  NewsItem,
  HistorySignal,
  ChatRequest,
  TelegramRequest,
} from "@workspace/api-client-react";
import { useMutation } from "@tanstack/react-query";

export type { TradingSignal, NewsItem, HistorySignal, GetTradingSignalTimeframe };
export type Timeframe = GetTradingSignalTimeframe;

export function useLiveSignal(timeframe: Timeframe, autoRefresh: boolean) {
  return useGetTradingSignal(
    { timeframe },
    { query: { refetchInterval: autoRefresh ? 30000 : false, staleTime: 10000, retry: 2 } }
  );
}

export function useLiveNews(autoRefresh: boolean) {
  return useGetMarketNews(
    { query: { refetchInterval: autoRefresh ? 300000 : false, staleTime: 60000 } }
  );
}

export function useSignalHistory() {
  return useGetSignalHistory({ query: { staleTime: 10000 } });
}

export function useLiveAnalysis(timeframe: Timeframe, enabled: boolean) {
  return useGetAnalysis(
    { timeframe },
    { query: { enabled, staleTime: 120000, retry: 1 } }
  );
}

export function useChatMutation() {
  return useMutation({
    mutationFn: (req: ChatRequest) => sendChat(req),
  });
}

export function useTelegramMutation() {
  return useMutation({
    mutationFn: (req: TelegramRequest) => broadcastTelegram(req),
  });
}
