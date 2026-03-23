import { useState, useEffect } from "react";
import { useLiveSignal, useLiveNews, useLiveAnalysis, useTelegramMutation } from "@/hooks/use-trading";
import type { Timeframe } from "@/hooks/use-trading";
import { ConfidenceRing } from "@/components/ConfidenceRing";
import { SRVisual } from "@/components/SRVisual";
import { MTFTable } from "@/components/MTFTable";
import { ChatPanel } from "@/components/ChatPanel";
import { Skeleton, CardSkeleton } from "@/components/Skeleton";

const TIMEFRAMES: Timeframe[] = ["5m", "15m", "30m", "1h", "4h", "1d"];
const REFRESH_INTERVAL = 60;

function fmt(v: number | null | undefined, d = 2) {
  if (v == null) return "—";
  return v.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
}
function signalColor(s: string) {
  return s === "BUY" ? "#00e676" : s === "SELL" ? "#ff3d3d" : "#f5a623";
}
function signalClass(s: string) {
  return s === "BUY" ? "signal-buy" : s === "SELL" ? "signal-sell" : "signal-hold";
}
function signalGlow(s: string) {
  return s === "BUY" ? "glow-buy" : s === "SELL" ? "glow-sell" : "glow-hold";
}
function biasBadge(bias: string) {
  if (bias === "BULLISH") return <span className="badge badge-bull">🟢 BULLISH</span>;
  if (bias === "BEARISH") return <span className="badge badge-bear">🔴 BEARISH</span>;
  if (bias === "MIXED")   return <span className="badge badge-gold">🟡 MIXED</span>;
  return <span className="badge badge-neut">⚪ NEUTRAL</span>;
}
function divBadge(val: string) {
  if (val === "bullish") return <span className="badge badge-bull">BULLISH</span>;
  if (val === "bearish") return <span className="badge badge-bear">BEARISH</span>;
  return <span className="badge badge-neut">NONE</span>;
}
function sentimentBorder(s: string) {
  if (s === "BULLISH") return "rgba(0,230,118,0.25)";
  if (s === "BEARISH") return "rgba(255,61,61,0.25)";
  return "#1e1e2e";
}
function sentimentBadge(s: string) {
  if (s === "BULLISH") return <span className="badge badge-bull text-[9px]">↑ BULL</span>;
  if (s === "BEARISH") return <span className="badge badge-bear text-[9px]">↓ BEAR</span>;
  return <span className="badge badge-neut text-[9px]">– NTRL</span>;
}
function timeAgo(pub: string) {
  try {
    const m = Math.floor((Date.now() - new Date(pub).getTime()) / 60000);
    if (m < 60)  return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24)  return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  } catch { return ""; }
}

function indicatorSignal(name: string, val: number | null, price: number, ind: Record<string, number | null>) {
  if (val === null) return { sig: "NEUTRAL", extra: null as string | null };
  const v = val;
  switch (name) {
    case "EMA 8":     return { sig: (ind.ema8 ?? 0) > (ind.ema21 ?? 0) ? "BUY" : "SELL", extra: `EMA21=${fmt(ind.ema21)}` };
    case "EMA 21":    return { sig: (ind.ema21 ?? 0) > (ind.ema50 ?? 0) ? "BUY" : "SELL", extra: null };
    case "EMA 50":    return { sig: (ind.ema50 ?? 0) > (ind.ema200 ?? 0) ? "BUY" : "SELL", extra: `EMA200=${fmt(ind.ema200)}` };
    case "EMA 200":   return { sig: price > (ind.ema200 ?? 0) ? "BUY" : "SELL", extra: null };
    case "SMA 20":    return { sig: (ind.sma20 ?? 0) > (ind.sma50 ?? 0) ? "BUY" : "SELL", extra: `SMA50=${fmt(ind.sma50)}` };
    case "MACD":      return { sig: (ind.macd ?? 0) > (ind.macd_signal ?? 0) ? "BUY" : "SELL", extra: `Sig=${fmt(ind.macd_signal)}` };
    case "MACD Hist": return { sig: (ind.macd_hist ?? 0) > 0 ? "BUY" : "SELL", extra: null };
    case "ADX":       return { sig: v > 25 ? ((ind.adx_pos ?? 0) > (ind.adx_neg ?? 0) ? "BUY" : "SELL") : "NEUTRAL", extra: `+DI=${fmt(ind.adx_pos,1)} -DI=${fmt(ind.adx_neg,1)}` };
    case "PSAR":      return { sig: price > v ? "BUY" : "SELL", extra: null };
    case "Ichimoku":  return { sig: (ind.tenkan ?? 0) > (ind.kijun ?? 0) ? "BUY" : "SELL", extra: `Kijun=${fmt(ind.kijun)}` };
    case "RSI":       return { sig: v < 30 ? "BUY" : v > 70 ? "SELL" : v < 45 ? "BUY" : v > 55 ? "SELL" : "NEUTRAL", extra: null };
    case "Stoch %K":  return { sig: (ind.stoch_k ?? 50) > (ind.stoch_d ?? 50) ? "BUY" : "SELL", extra: `%D=${fmt(ind.stoch_d,1)}` };
    case "StochRSI K":return { sig: (ind.srsi_k ?? 0.5) > (ind.srsi_d ?? 0.5) ? "BUY" : "SELL", extra: `D=${fmt(ind.srsi_d,3)}` };
    case "CCI":       return { sig: v < -100 ? "BUY" : v > 100 ? "SELL" : "NEUTRAL", extra: null };
    case "Williams%R":return { sig: v < -80 ? "BUY" : v > -20 ? "SELL" : "NEUTRAL", extra: null };
    case "ROC":       return { sig: v > 0 ? "BUY" : "SELL", extra: null };
    case "BB Upper":  return { sig: price < v ? "BUY" : "NEUTRAL", extra: `Mid=${fmt(ind.bb_middle)}` };
    case "BB Lower":  return { sig: price > v ? "NEUTRAL" : "BUY", extra: null };
    case "MFI":       return { sig: v < 20 ? "BUY" : v > 80 ? "SELL" : "NEUTRAL", extra: null };
    case "CMF":       return { sig: v > 0.1 ? "BUY" : v < -0.1 ? "SELL" : "NEUTRAL", extra: null };
    case "VWAP":      return { sig: price > v ? "BUY" : "SELL", extra: null };
    default:          return { sig: "NEUTRAL", extra: null };
  }
}

type IndTab = "trend" | "momentum" | "volatility" | "volume";

export default function Dashboard() {
  const [tf, setTf]               = useState<Timeframe>("1h");
  const [autoRefresh, setAuto]    = useState(true);
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL);
  const [chatOpen, setChatOpen]   = useState(false);
  const [tgStatus, setTgStatus]   = useState<"idle" | "ok" | "err">("idle");
  const [indTab, setIndTab]       = useState<IndTab>("trend");
  const [accordion, setAccordion] = useState(false);
  const [analysisKey, setAnalysisKey] = useState(0);
  const [analysisText, setAnalysisText] = useState("");
  const [now, setNow]             = useState(() => new Date().toLocaleTimeString());

  const tgMutation = useTelegramMutation();
  const { data: signal, isLoading, refetch } = useLiveSignal(tf, autoRefresh);
  const { data: newsData }                   = useLiveNews(autoRefresh);
  const { data: analysisData, isFetching: analysisFetching } = useLiveAnalysis(tf, true);

  useEffect(() => { if (analysisData?.analysis) setAnalysisText(analysisData.analysis); }, [analysisData]);

  // Clock
  useEffect(() => {
    const id = setInterval(() => setNow(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(id);
  }, []);

  // Countdown + auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => {
      setCountdown(c => { if (c <= 1) { refetch(); return REFRESH_INTERVAL; } return c - 1; });
    }, 1000);
    return () => clearInterval(id);
  }, [autoRefresh, refetch]);

  useEffect(() => { setCountdown(REFRESH_INTERVAL); }, [tf]);

  const handleTelegram = async () => {
    if (!signal) return;
    setTgStatus("idle");
    try {
      const res = await tgMutation.mutateAsync({ data: { ...signal, analysis: analysisText } as Record<string, unknown> });
      setTgStatus(res.success ? "ok" : "err");
    } catch { setTgStatus("err"); }
    setTimeout(() => setTgStatus("idle"), 5000);
  };

  const ind   = signal?.indicators ?? {};
  const price = signal?.price ?? 0;
  const sgnl  = signal?.signal ?? "HOLD";

  const TREND_ROWS: [string, number | null][]      = [["EMA 8", ind.ema8 ?? null],["EMA 21", ind.ema21 ?? null],["EMA 50", ind.ema50 ?? null],["EMA 200", ind.ema200 ?? null],["SMA 20", ind.sma20 ?? null],["MACD", ind.macd ?? null],["MACD Hist", ind.macd_hist ?? null],["ADX", ind.adx ?? null],["PSAR", ind.psar ?? null],["Ichimoku", ind.tenkan ?? null]];
  const MOMENTUM_ROWS: [string, number | null][]   = [["RSI", ind.rsi ?? null],["Stoch %K", ind.stoch_k ?? null],["StochRSI K", ind.srsi_k ?? null],["CCI", ind.cci ?? null],["Williams%R", ind.willr ?? null],["ROC", ind.roc ?? null]];
  const VOLATILITY_ROWS: [string, number | null][] = [["ATR", ind.atr ?? null],["BB Upper", ind.bb_upper ?? null],["BB Middle", ind.bb_middle ?? null],["BB Lower", ind.bb_lower ?? null],["BB Width", ind.bb_width ?? null],["KC Upper", ind.kc_upper ?? null],["KC Lower", ind.kc_lower ?? null]];
  const VOLUME_ROWS: [string, number | null][]     = [["OBV", ind.obv ?? null],["MFI", ind.mfi ?? null],["CMF", ind.cmf ?? null],["VWAP", ind.vwap ?? null]];
  const activeRows = indTab === "trend" ? TREND_ROWS : indTab === "momentum" ? MOMENTUM_ROWS : indTab === "volatility" ? VOLATILITY_ROWS : VOLUME_ROWS;

  // ── RENDER ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: "#08080f", color: "#c8c8d8", fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* [1] NAVBAR */}
      <nav style={{ background: "#0a0a14", borderBottom: "1px solid #151525", position: "sticky", top: 0, zIndex: 40 }}>
        <div style={{ maxWidth: 1440, margin: "0 auto", display: "flex", alignItems: "center", height: 52, padding: "0 20px", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 140 }}>
            <div style={{ width: 30, height: 30, borderRadius: 7, background: "linear-gradient(135deg,#f5a623,#c4780f)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 900, color: "#000" }}>A</div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, color: "#f5a623", letterSpacing: "0.1em" }}>AURA TERMINAL</div>
              <div style={{ fontSize: 8, color: "#444", letterSpacing: "0.14em" }}>PRO · XAU/USD</div>
            </div>
          </div>

          {signal && !isLoading && (
            <div style={{ marginRight: "auto" }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: "#fff", fontFamily: "monospace", lineHeight: 1 }}>${fmt(price)}</div>
              <div style={{ fontSize: 10, color: "#555" }}>GOLD SPOT</div>
            </div>
          )}

          <div style={{ display: "flex", gap: 3, marginLeft: signal ? 0 : "auto" }}>
            {TIMEFRAMES.map(t => (
              <button key={t} className={`tab-btn ${tf === t ? "active" : ""}`} onClick={() => setTf(t)}>{t}</button>
            ))}
          </div>

          {signal && (
            <span className={`badge ${signal.trade_allowed ? "badge-active" : "badge-inactive"}`} style={{ fontSize: 10 }}>
              {signal.trade_allowed ? "🟢" : "🔴"} {signal.session}
            </span>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 10, color: "#555" }}>
            <span style={{ fontFamily: "monospace" }}>{now}</span>
            <button onClick={() => setAuto(a => !a)} className="action-btn action-btn-primary" style={{ padding: "3px 10px", fontSize: 9 }}>
              {autoRefresh ? `⏸ ${countdown}s` : "▶ AUTO"}
            </button>
          </div>
        </div>
      </nav>

      <div style={{ maxWidth: 1440, margin: "0 auto", padding: "16px 16px" }}>

        {/* [3] STAT ROW */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 10, marginBottom: 16 }}>
          {isLoading ? Array(5).fill(0).map((_, i) => <CardSkeleton key={i} />) : signal && <>
            <div className="stat-card fade-in">
              <div style={{ fontSize: 9, color: "#555", letterSpacing: "0.1em" }}>XAUUSD PRICE</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: "#fff", fontFamily: "monospace", margin: "4px 0" }}>${fmt(price)}</div>
              <div style={{ fontSize: 10, color: (ind.roc ?? 0) >= 0 ? "#00e676" : "#ff3d3d" }}>
                {(ind.roc ?? 0) >= 0 ? "▲" : "▼"} ROC {fmt(ind.roc ?? 0, 3)}%
              </div>
            </div>
            <div className="stat-card fade-in">
              <div style={{ fontSize: 9, color: "#555", letterSpacing: "0.1em" }}>RSI (14)</div>
              <div style={{ fontSize: 24, fontWeight: 900, fontFamily: "monospace", margin: "4px 0", color: (ind.rsi ?? 50) > 70 ? "#ff3d3d" : (ind.rsi ?? 50) < 30 ? "#00e676" : "#fff" }}>{fmt(ind.rsi ?? null, 1)}</div>
              <div>{(ind.rsi ?? 50) > 70 ? <span className="badge badge-bear">OVERBOUGHT</span> : (ind.rsi ?? 50) < 30 ? <span className="badge badge-bull">OVERSOLD</span> : <span className="badge badge-neut">NEUTRAL</span>}</div>
            </div>
            <div className="stat-card fade-in">
              <div style={{ fontSize: 9, color: "#555", letterSpacing: "0.1em" }}>MACD</div>
              <div style={{ fontSize: 24, fontWeight: 900, fontFamily: "monospace", margin: "4px 0", color: (ind.macd ?? 0) > (ind.macd_signal ?? 0) ? "#00e676" : "#ff3d3d" }}>{fmt(ind.macd ?? null)}</div>
              <div>{(ind.macd ?? 0) > (ind.macd_signal ?? 0) ? <span className="badge badge-bull">+ Cross</span> : <span className="badge badge-bear">− Cross</span>}</div>
            </div>
            <div className="stat-card fade-in">
              <div style={{ fontSize: 9, color: "#555", letterSpacing: "0.1em" }}>ATR VOLATILITY</div>
              <div style={{ fontSize: 24, fontWeight: 900, fontFamily: "monospace", color: "#f5a623", margin: "4px 0" }}>{fmt(ind.atr ?? null)}</div>
              <div style={{ fontSize: 10, color: "#555" }}>Daily Range Est.</div>
            </div>
            <div className="stat-card fade-in">
              <div style={{ fontSize: 9, color: "#555", letterSpacing: "0.1em" }}>ADX STRENGTH</div>
              <div style={{ fontSize: 24, fontWeight: 900, fontFamily: "monospace", margin: "4px 0", color: (ind.adx ?? 0) > 25 ? "#ffa726" : "#fff" }}>{fmt(ind.adx ?? null, 1)}</div>
              <div style={{ fontSize: 10, color: "#555" }}>{(ind.adx ?? 0) > 40 ? "VERY STRONG" : (ind.adx ?? 0) > 25 ? "TRENDING" : "WEAK TREND"}</div>
            </div>
          </>}
        </div>

        {/* MAIN 3-COL LAYOUT */}
        <div style={{ display: "grid", gridTemplateColumns: "260px 1fr 280px", gap: 14, marginBottom: 14 }}>

          {/* LEFT COL */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {/* [4] CONFIDENCE + CONTEXT */}
            <div className="card-terminal" style={{ padding: 18 }}>
              <div className="section-header">◎ Confidence</div>
              {isLoading ? <div className="skeleton" style={{ height: 160 }} /> : signal && (
                <div className="fade-in" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                  <ConfidenceRing confidence={signal.confidence} />
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center" }}>
                    {biasBadge(signal.mtf_bias)}
                    <span className={`badge ${signal.trade_allowed ? "badge-active" : "badge-inactive"}`}>{signal.session}</span>
                  </div>
                  <div style={{ width: "100%" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, marginBottom: 4 }}>
                      <span style={{ color: "#00e676" }}>BULL {signal.score}/20</span>
                      <span style={{ color: "#ff3d3d" }}>BEAR {signal.bear_score}/20</span>
                    </div>
                    <div style={{ height: 5, background: "#1a1a2e", borderRadius: 3, overflow: "hidden", display: "flex" }}>
                      <div style={{ width: `${(signal.score / Math.max(signal.score + signal.bear_score, 1)) * 100}%`, background: "#00e676", transition: "width 0.6s" }} />
                      <div style={{ flex: 1, background: "#ff3d3d" }} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* [8] MTF TABLE */}
            <div className="card-terminal" style={{ padding: 16, flex: 1 }}>
              <div className="section-header">≡ MTF Confluence</div>
              {isLoading ? <Skeleton h="130px" /> : signal ? (
                <div className="fade-in">
                  <MTFTable mtfData={signal.mtf_data as Record<string, { bias: string; rsi: number | null; macd_bull: boolean | null; ema_bull: boolean | null }>} overallBias={signal.mtf_bias} />
                </div>
              ) : null}
            </div>
          </div>

          {/* CENTER COL — [5] SIGNAL BOX */}
          <div className="card-terminal" style={{ padding: 22 }}>
            <div className="section-header">⚡ Signal</div>
            {isLoading ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <Skeleton h="90px" /><Skeleton h="110px" /><Skeleton h="180px" />
              </div>
            ) : signal ? (
              <div className="fade-in">
                {/* Signal hero */}
                <div className={signalGlow(sgnl)} style={{ background: "#0b0b18", border: `1px solid ${signalColor(sgnl)}30`, borderRadius: 10, padding: "18px 22px", marginBottom: 16, display: "flex", alignItems: "center", gap: 18 }}>
                  <span style={{ fontSize: 36 }}>{sgnl === "BUY" ? "↗" : sgnl === "SELL" ? "↘" : "→"}</span>
                  <div>
                    <div className={signalClass(sgnl)} style={{ fontSize: 48, fontWeight: 900, lineHeight: 1 }}>{sgnl}</div>
                    <div style={{ fontSize: 10, color: "#666880", marginTop: 4 }}>
                      Score: <span style={{ color: signalColor(sgnl), fontWeight: 700 }}>{sgnl === "SELL" ? signal.bear_score : signal.score}/20</span>
                    </div>
                  </div>
                </div>

                {/* Trade levels */}
                {signal.sl ? (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 16 }}>
                    {[
                      { label: "ENTRY", val: fmt(price), color: "#fff" },
                      { label: "STOP LOSS", val: `$${fmt(signal.sl)}`, color: "#ff3d3d" },
                      { label: "R/R RATIO", val: signal.rr ? `1:${signal.rr}` : "—", color: "#f5a623" },
                      { label: "TP1 🎯", val: `$${fmt(signal.tp1)}`, color: "#00e676" },
                      { label: "TP2 🎯", val: `$${fmt(signal.tp2)}`, color: "#00c853" },
                      { label: "TP3 🎯", val: `$${fmt(signal.tp3)}`, color: "#00a84a" },
                    ].map(({ label, val, color }) => (
                      <div key={label} style={{ background: "#10101c", border: "1px solid #1e1e2e", borderRadius: 7, padding: "9px 10px" }}>
                        <div style={{ fontSize: 8, color: "#444", letterSpacing: "0.1em", marginBottom: 3 }}>{label}</div>
                        <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "monospace", color }}>{val}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ textAlign: "center", padding: "12px", fontSize: 11, color: "#555", marginBottom: 12 }}>
                    No active trade setup — conditions not met (score &lt; 10 or session off)
                  </div>
                )}

                {/* Confirmations list */}
                <div style={{ maxHeight: 200, overflowY: "auto" }}>
                  <div style={{ fontSize: 9, color: "#444", letterSpacing: "0.1em", marginBottom: 6 }}>CONFIRMATIONS ({signal.confirmations.length})</div>
                  {signal.confirmations.length === 0 ? (
                    <div style={{ fontSize: 11, color: "#333", textAlign: "center", padding: "16px" }}>Insufficient confirmations</div>
                  ) : signal.confirmations.map((c, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", background: "#10101c", borderRadius: 5, border: `1px solid ${c.side === "bull" ? "rgba(0,230,118,0.1)" : "rgba(255,61,61,0.1)"}`, marginBottom: 4 }}>
                      <span style={{ fontSize: 10 }}>{c.side === "bull" ? "✅" : "🔴"}</span>
                      <span style={{ fontSize: 11, color: c.side === "bull" ? "#00e676" : "#ff6060" }}>{c.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          {/* RIGHT COL */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {/* [7] S/R VISUAL */}
            <div className="card-terminal" style={{ padding: 16 }}>
              <div className="section-header">◈ Support & Resistance</div>
              {isLoading ? <Skeleton h="200px" /> : signal ? (
                <div className="fade-in"><SRVisual support={signal.support} resistance={signal.resistance} price={price} /></div>
              ) : null}
            </div>

            {/* [9] PATTERNS + DIVERGENCE */}
            <div className="card-terminal" style={{ padding: 16, flex: 1 }}>
              <div className="section-header">🕯️ Patterns & Divergence</div>
              {isLoading ? <Skeleton h="110px" /> : signal ? (
                <div className="fade-in">
                  {signal.patterns.length === 0
                    ? <div style={{ fontSize: 11, color: "#444", marginBottom: 10 }}>No patterns detected</div>
                    : signal.patterns.map((p, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", borderBottom: "1px solid #12121e" }}>
                        <span style={{ fontSize: 11, color: "#c8c8d8" }}>{p.name}</span>
                        <span className={`badge ${p.type === "BULLISH" ? "badge-bull" : p.type === "BEARISH" ? "badge-bear" : "badge-neut"}`}>{p.type}</span>
                      </div>
                    ))}
                  <div style={{ paddingTop: 10, marginTop: 6, borderTop: "1px solid #1e1e2e" }}>
                    <div style={{ fontSize: 9, color: "#444", letterSpacing: "0.1em", marginBottom: 8 }}>DIVERGENCE</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 11, color: "#888" }}>RSI</span>{divBadge(signal.divergence.rsi)}
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 11, color: "#888" }}>MACD</span>{divBadge(signal.divergence.macd)}
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* [6] SMC PANEL */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 14 }}>
          {/* Order Blocks */}
          <div className="card-terminal" style={{ padding: 16 }}>
            <div className="section-header">🏦 Order Blocks</div>
            {isLoading ? <Skeleton h="110px" /> : signal ? (
              <div className="fade-in">
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 10, color: "#00e676", fontWeight: 700, marginBottom: 6 }}>🟢 Bullish OBs</div>
                  {signal.smc.bullish_obs.length === 0
                    ? <div style={{ fontSize: 11, color: "#333" }}>None detected</div>
                    : signal.smc.bullish_obs.map((ob, i) => (
                      <div key={i} style={{ fontSize: 11, fontFamily: "monospace", color: "#00e676", padding: "3px 0" }}>
                        ${ob.low.toLocaleString()} – ${ob.high.toLocaleString()}
                      </div>
                    ))}
                </div>
                <div style={{ borderTop: "1px solid #1e1e2e", paddingTop: 10 }}>
                  <div style={{ fontSize: 10, color: "#ff3d3d", fontWeight: 700, marginBottom: 6 }}>🔴 Bearish OBs</div>
                  {signal.smc.bearish_obs.length === 0
                    ? <div style={{ fontSize: 11, color: "#333" }}>None detected</div>
                    : signal.smc.bearish_obs.map((ob, i) => (
                      <div key={i} style={{ fontSize: 11, fontFamily: "monospace", color: "#ff6060", padding: "3px 0" }}>
                        ${ob.low.toLocaleString()} – ${ob.high.toLocaleString()}
                      </div>
                    ))}
                </div>
              </div>
            ) : null}
          </div>

          {/* FVGs */}
          <div className="card-terminal" style={{ padding: 16 }}>
            <div className="section-header">⬛ Fair Value Gaps</div>
            {isLoading ? <Skeleton h="110px" /> : signal ? (
              <div className="fade-in">
                {signal.smc.fvgs.length === 0
                  ? <div style={{ fontSize: 11, color: "#333" }}>No FVGs found</div>
                  : signal.smc.fvgs.map((fvg, i) => (
                    <div key={i} style={{ padding: "6px 0", borderBottom: "1px solid #12121e" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                        <span className={`badge ${fvg.type === "bullish" ? "badge-bull" : "badge-bear"} text-[9px]`}>{fvg.type.toUpperCase()}</span>
                        <span style={{ fontSize: 9, color: "#555" }}>FVG</span>
                      </div>
                      <div style={{ fontSize: 11, fontFamily: "monospace", color: fvg.type === "bullish" ? "#00e676" : "#ff6060" }}>
                        ${fvg.bottom?.toLocaleString()} – ${fvg.top?.toLocaleString()}
                      </div>
                    </div>
                  ))}
              </div>
            ) : null}
          </div>

          {/* Liquidity */}
          <div className="card-terminal" style={{ padding: 16 }}>
            <div className="section-header">💧 Liquidity Zones</div>
            {isLoading ? <Skeleton h="110px" /> : signal ? (
              <div className="fade-in">
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 10, color: "#ff3d3d", fontWeight: 700, marginBottom: 6 }}>Equal Highs</div>
                  {signal.smc.equal_highs.length === 0
                    ? <div style={{ fontSize: 11, color: "#333" }}>None</div>
                    : signal.smc.equal_highs.map((v, i) => <div key={i} style={{ fontSize: 11, fontFamily: "monospace", color: "#ff9090", padding: "2px 0" }}>═ ${v.toLocaleString()}</div>)}
                </div>
                <div style={{ borderTop: "1px solid #1e1e2e", paddingTop: 10 }}>
                  <div style={{ fontSize: 10, color: "#00e676", fontWeight: 700, marginBottom: 6 }}>Equal Lows</div>
                  {signal.smc.equal_lows.length === 0
                    ? <div style={{ fontSize: 11, color: "#333" }}>None</div>
                    : signal.smc.equal_lows.map((v, i) => <div key={i} style={{ fontSize: 11, fontFamily: "monospace", color: "#00e676", padding: "2px 0" }}>═ ${v.toLocaleString()}</div>)}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {/* [10]+[12] AI ANALYSIS + INDICATORS */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.1fr", gap: 14, marginBottom: 14 }}>

          {/* [10] AI ANALYSIS */}
          <div className="card-terminal" style={{ padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div className="section-header" style={{ marginBottom: 0 }}>🤖 Why This Signal?</div>
              <button className="action-btn action-btn-primary" style={{ padding: "3px 10px", fontSize: 9 }}
                onClick={() => setAnalysisKey(k => k + 1)}>↻ Refresh</button>
            </div>
            <div style={{ minHeight: 200 }}>
              {analysisFetching ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 200, gap: 10 }}>
                  <div style={{ width: 28, height: 28, border: "3px solid #1e1e2e", borderTopColor: "#f5a623", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
                  <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                  <span style={{ fontSize: 11, color: "#555" }}>AI analyzing market…</span>
                </div>
              ) : analysisText ? (
                <div id="analysis-text" style={{ fontSize: 11, lineHeight: 1.8, color: "#b0b0c0", overflowY: "auto", maxHeight: 280 }}>
                  {analysisText.split("\n").map((line, i) => {
                    const isH = /^\d+\.\s/.test(line.trim());
                    return <div key={i} style={{ color: isH ? "#f5a623" : "#b0b0c0", fontWeight: isH ? 700 : 400, marginTop: isH ? 8 : 0 }}>{line}</div>;
                  })}
                </div>
              ) : (
                <div style={{ fontSize: 11, color: "#333", textAlign: "center", paddingTop: 70 }}>Click Refresh to load AI analysis</div>
              )}
            </div>
          </div>

          {/* [12] INDICATORS */}
          <div className="card-terminal" style={{ padding: 16 }}>
            <div className="section-header">📊 Technical Indicators</div>
            <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
              {(["trend","momentum","volatility","volume"] as IndTab[]).map(t => (
                <button key={t} className={`tab-btn ${indTab === t ? "active" : ""}`} onClick={() => setIndTab(t)}
                  style={{ padding: "3px 8px", fontSize: 9 }}>{t[0].toUpperCase() + t.slice(1)}</button>
              ))}
            </div>
            {isLoading ? <Skeleton h="200px" /> : signal ? (
              <div className="fade-in" style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #1e1e2e" }}>
                      {["Indicator","Value","Signal"].map(h => (
                        <th key={h} style={{ textAlign: "left", fontSize: 9, color: "#444", letterSpacing: "0.08em", paddingBottom: 6, paddingLeft: 8 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {activeRows.map(([name, val]) => {
                      const { sig, extra } = indicatorSignal(name, val, price, ind as Record<string, number | null>);
                      const color = sig === "BUY" ? "#00e676" : sig === "SELL" ? "#ff3d3d" : "#888";
                      const badgeCls = sig === "BUY" ? "badge-bull" : sig === "SELL" ? "badge-bear" : "badge-neut";
                      return (
                        <tr key={name} style={{ borderBottom: "1px solid #10101a" }}>
                          <td style={{ padding: "5px 8px", color: "#888" }}>
                            <div>{name}</div>
                            {extra && <div style={{ fontSize: 9, color: "#444" }}>{extra}</div>}
                          </td>
                          <td style={{ padding: "5px 8px", fontFamily: "monospace", color, textAlign: "right" }}>{fmt(val)}</td>
                          <td style={{ padding: "5px 8px", textAlign: "right" }}>
                            <span className={`badge ${badgeCls} text-[9px]`}>{sig}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        </div>

        {/* [11] NEWS */}
        <div className="card-terminal" style={{ padding: 16, marginBottom: 14 }}>
          <div className="section-header">📰 Gold Market News</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
            {!newsData ? Array(6).fill(0).map((_, i) => <CardSkeleton key={i} />) : newsData.news.length === 0 ? (
              <div style={{ fontSize: 11, color: "#444" }}>No news available</div>
            ) : newsData.news.map((n, i) => (
              <a key={i} href={n.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
                <div className="fade-in" style={{ background: "#0c0c18", border: `1px solid ${sentimentBorder(n.sentiment)}`, borderRadius: 8, padding: "10px 12px", cursor: "pointer", height: "100%" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                    <span style={{ fontSize: 9, color: "#555" }}>{n.source}</span>
                    {sentimentBadge(n.sentiment)}
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#ccc", lineHeight: 1.4, marginBottom: 5 }}>{n.title}</div>
                  <div style={{ fontSize: 10, color: "#444" }}>{timeAgo(n.published)}</div>
                </div>
              </a>
            ))}
          </div>
        </div>

        {/* [14] SIGNAL HISTORY */}
        <div className="card-terminal" style={{ padding: 16, marginBottom: 14 }}>
          <div className="section-header">🕒 Recent Signals (Last 15)</div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #1e1e2e" }}>
                  {["TIME","TF","SIGNAL","PRICE","CONF%","PATTERN"].map(h => (
                    <th key={h} style={{ textAlign: "left", fontSize: 9, color: "#444", letterSpacing: "0.1em", paddingBottom: 8, paddingLeft: 10 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(signal?.recent_signals ?? []).slice(0, 15).map((row, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #10101a" }}>
                    <td style={{ padding: "6px 10px", color: "#555", fontFamily: "monospace", fontSize: 10, whiteSpace: "nowrap" }}>{row.time}</td>
                    <td style={{ padding: "6px 10px", color: "#f5a623", fontWeight: 700 }}>{row.timeframe}</td>
                    <td style={{ padding: "6px 10px" }}>
                      <span style={{ color: signalColor(row.signal), fontWeight: 800 }}>{row.signal}</span>
                    </td>
                    <td style={{ padding: "6px 10px", fontFamily: "monospace" }}>${row.price.toLocaleString()}</td>
                    <td style={{ padding: "6px 10px", color: row.confidence >= 60 ? "#00e676" : row.confidence >= 40 ? "#ffd740" : "#ff6060", fontWeight: 700 }}>{row.confidence}%</td>
                    <td style={{ padding: "6px 10px", color: "#666", fontSize: 10 }}>{row.pattern}</td>
                  </tr>
                ))}
                {!signal?.recent_signals?.length && (
                  <tr><td colSpan={6} style={{ padding: "24px", textAlign: "center", color: "#333" }}>Signals appear after first data fetch</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* [13] ACTIONS */}
        <div className="card-terminal" style={{ padding: 14, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div className="section-header" style={{ marginBottom: 0 }}>⚙ Terminal Actions</div>
          <button className="action-btn action-btn-primary" onClick={() => { refetch(); setCountdown(REFRESH_INTERVAL); }}>
            🔄 Force Refresh
          </button>
          <button className="action-btn action-btn-tg" onClick={handleTelegram} disabled={tgMutation.isPending || !signal}>
            {tgMutation.isPending ? "📡 Sending…" : "📡 Broadcast to Telegram"}
          </button>
          {tgStatus === "ok" && <span style={{ fontSize: 11, color: "#00e676", fontWeight: 600 }}>✅ Sent to @wolfthunderrBot!</span>}
          {tgStatus === "err" && <span style={{ fontSize: 11, color: "#ff3d3d", fontWeight: 600 }}>❌ Send failed — check token</span>}
          <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 10, color: "#444" }}>Auto-refresh</span>
            <div onClick={() => setAuto(a => !a)} style={{ width: 38, height: 20, borderRadius: 10, cursor: "pointer", background: autoRefresh ? "rgba(0,230,118,0.4)" : "#2a2a3e", position: "relative", border: `1px solid ${autoRefresh ? "rgba(0,230,118,0.5)" : "#333"}`, transition: "background 0.3s" }}>
              <div style={{ width: 14, height: 14, borderRadius: "50%", background: "#fff", position: "absolute", top: 2, left: autoRefresh ? 20 : 3, transition: "left 0.3s" }} />
            </div>
          </div>
        </div>
      </div>

      {/* [15] FLOATING CHAT */}
      <ChatPanel open={chatOpen} onClose={() => setChatOpen(false)} signal={signal} />
      <button
        onClick={() => setChatOpen(o => !o)}
        title="Ask Jarvis AI"
        style={{
          position: "fixed", bottom: 22, right: 22, width: 54, height: 54,
          borderRadius: "50%", border: "2px solid #f5a623",
          background: chatOpen ? "rgba(245,166,35,0.25)" : "rgba(245,166,35,0.12)",
          cursor: "pointer", fontSize: 22, zIndex: 60,
          boxShadow: "0 4px 20px rgba(245,166,35,0.35)",
          transition: "all 0.2s",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >{chatOpen ? "✕" : "💬"}</button>
    </div>
  );
}
