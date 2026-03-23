import React from "react";
import { useLiveNews } from "@/hooks/use-trading";
import { Newspaper, ExternalLink, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export function MarketNews({ autoRefresh }: { autoRefresh: boolean }) {
  const { data, isLoading, isError } = useLiveNews(autoRefresh);

  return (
    <div className="glass-panel p-5 rounded-2xl h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest flex items-center">
          <Newspaper className="w-4 h-4 mr-2" />
          Live News
        </h2>
        {isLoading && <Loader2 className="w-3 h-3 animate-spin text-primary" />}
      </div>

      <div className="flex-1 overflow-y-auto pr-2 space-y-3">
        {isLoading && !data && (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
            Loading news feed...
          </div>
        )}
        
        {isError && (
          <div className="text-destructive text-sm p-4 bg-destructive/10 rounded-lg border border-destructive/20 text-center">
            Failed to load news feed.
          </div>
        )}

        {data?.news.map((item, i) => (
          <a 
            key={i} 
            href={item.link} 
            target="_blank" 
            rel="noopener noreferrer"
            className="block p-3 bg-secondary/20 hover:bg-secondary/40 border border-border/30 hover:border-border/60 rounded-xl transition-all group"
          >
            <div className="flex justify-between items-start mb-1">
              <span className="text-[10px] font-bold text-primary uppercase tracking-wider">{item.source}</span>
              <span className="text-[10px] text-muted-foreground font-mono">
                {formatDistanceToNow(new Date(item.published), { addSuffix: true })}
              </span>
            </div>
            <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2 mb-1.5 leading-snug">
              {item.title}
            </h3>
            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
              {item.summary}
            </p>
          </a>
        ))}
      </div>
    </div>
  );
}
