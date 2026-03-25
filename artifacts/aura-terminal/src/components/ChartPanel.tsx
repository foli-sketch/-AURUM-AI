import { useState, useEffect, useRef, useCallback } from "react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const TF_LABELS = ["5m", "15m", "30m", "1h", "4h", "1d"] as const;
type ChartTF = typeof TF_LABELS[number];

export function ChartPanel({ defaultTf = "1h" }: { defaultTf?: ChartTF }) {
  const [tf, setTf]           = useState<ChartTF>(defaultTf);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const divRef  = useRef<HTMLDivElement>(null);
  const plotRef = useRef<typeof import("plotly.js-dist-min") | null>(null);

  const loadChart = useCallback(async (timeframe: ChartTF) => {
    if (!divRef.current) return;
    setLoading(true);
    setError(null);
    try {
      if (!plotRef.current) {
        plotRef.current = await import("plotly.js-dist-min");
      }
      const Plotly = plotRef.current;

      const res = await fetch(`${BASE}/api/trading/chart?timeframe=${timeframe}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const fig = await res.json();
      if (fig.error) throw new Error(fig.error);

      await Plotly.newPlot(divRef.current!, fig.data, fig.layout, {
        responsive: true,
        displayModeBar: true,
        modeBarButtonsToRemove: ["lasso2d", "select2d", "autoScale2d"],
        displaylogo: false,
        scrollZoom: true,
        toImageButtonOptions: {
          format: "png",
          filename: `xauusd_${timeframe}`,
          height: 650,
          width: 1200,
        },
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load chart");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadChart(tf); }, [tf, loadChart]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    const id = setInterval(() => loadChart(tf), 60000);
    return () => clearInterval(id);
  }, [tf, loadChart]);

  return (
    <div className="card-terminal" style={{ padding: 16, marginBottom: 14 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div className="section-header" style={{ marginBottom: 0 }}>📈 Live Analysis Chart</div>
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          {TF_LABELS.map(t => (
            <button
              key={t}
              className={`tab-btn ${tf === t ? "active" : ""}`}
              style={{ padding: "3px 10px", fontSize: 10 }}
              onClick={() => setTf(t)}
            >{t.toUpperCase()}</button>
          ))}
          <button
            className="action-btn action-btn-primary"
            style={{ padding: "3px 10px", fontSize: 9, marginLeft: 8 }}
            onClick={() => loadChart(tf)}
          >↻ Refresh</button>
        </div>
      </div>

      {/* Chart area */}
      <div style={{ position: "relative", minHeight: 420 }}>
        {/* Loading overlay */}
        {loading && (
          <div style={{
            position: "absolute", inset: 0, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", zIndex: 10,
            background: "rgba(10,10,15,0.85)", borderRadius: 8, gap: 12,
          }}>
            <div style={{
              width: 36, height: 36,
              border: "3px solid #1e1e2e", borderTopColor: "#f5a623",
              borderRadius: "50%", animation: "spin 1s linear infinite",
            }} />
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            <span style={{ fontSize: 12, color: "#f5a623", letterSpacing: "0.06em" }}>
              📊 Analyzing chart patterns…
            </span>
          </div>
        )}

        {/* Error state */}
        {error && !loading && (
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            justifyContent: "center", height: 420, gap: 12, color: "#ff3d3d",
          }}>
            <div style={{ fontSize: 28 }}>⚠️</div>
            <div style={{ fontSize: 12 }}>Chart load failed: {error}</div>
            <button className="action-btn action-btn-primary" onClick={() => loadChart(tf)}>
              ↻ Retry
            </button>
          </div>
        )}

        {/* Plotly container */}
        <div
          ref={divRef}
          id="plotly-chart"
          style={{
            width: "100%",
            minHeight: 650,
            opacity: loading ? 0.3 : 1,
            transition: "opacity 0.3s",
          }}
        />
      </div>

      {/* Legend hints */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 10, fontSize: 10, color: "#555" }}>
        <span><span style={{ color: "#26a69a" }}>■</span> Bullish candle</span>
        <span><span style={{ color: "#ef5350" }}>■</span> Bearish candle</span>
        <span><span style={{ color: "#f5a623" }}>—</span> EMA 8</span>
        <span><span style={{ color: "#2196F3" }}>—</span> EMA 21</span>
        <span><span style={{ color: "#9C27B0" }}>—</span> EMA 50</span>
        <span><span style={{ color: "#FF5722" }}>—</span> EMA 200</span>
        <span><span style={{ color: "#50ff96" }}>···</span> Support</span>
        <span><span style={{ color: "#ff5050" }}>···</span> Resistance</span>
        <span><span style={{ color: "#00ff64" }}>■</span> Bull OB</span>
        <span><span style={{ color: "#ff3232" }}>■</span> Bear OB</span>
        <span style={{ marginLeft: "auto", color: "#444" }}>Scroll to zoom · Drag to pan</span>
      </div>
    </div>
  );
}
