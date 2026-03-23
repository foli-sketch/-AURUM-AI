import { useState, useRef, useEffect } from "react";
import { useChatMutation } from "@/hooks/use-trading";
import type { TradingSignal } from "@/hooks/use-trading";

const QUICK_CHIPS = [
  "Should I buy now?",
  "What's the trend?",
  "Explain the signal",
  "Best entry point?",
  "Any news impact?",
];

interface Msg { role: "user" | "ai"; content: string }

function loadHistory(): Msg[] {
  try {
    return JSON.parse(sessionStorage.getItem("aura_chat") || "[]");
  } catch { return []; }
}
function saveHistory(msgs: Msg[]) {
  sessionStorage.setItem("aura_chat", JSON.stringify(msgs.slice(-20)));
}

interface Props {
  open: boolean;
  onClose: () => void;
  signal: TradingSignal | undefined;
}

export function ChatPanel({ open, onClose, signal }: Props) {
  const [msgs, setMsgs]   = useState<Msg[]>(loadHistory);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const mutation  = useChatMutation();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, mutation.isPending]);

  const send = async (text: string) => {
    if (!text.trim() || mutation.isPending) return;
    const newMsgs: Msg[] = [...msgs, { role: "user", content: text }];
    setMsgs(newMsgs);
    setInput("");
    try {
      const res = await mutation.mutateAsync({
        message: text,
        history: newMsgs.slice(-10).map(m => ({ role: m.role === "ai" ? "assistant" : "user", content: m.content })),
        market_snapshot: signal ? {
          price:         signal.price,
          signal:        signal.signal,
          confidence:    signal.confidence,
          session:       signal.session,
          mtf_bias:      signal.mtf_bias,
          rsi:           signal.indicators?.rsi ?? undefined,
          macd:          signal.indicators?.macd ?? undefined,
          adx:           signal.indicators?.adx ?? undefined,
          atr:           signal.indicators?.atr ?? undefined,
          ema8:          signal.indicators?.ema8 ?? undefined,
          ema21:         signal.indicators?.ema21 ?? undefined,
          patterns:      signal.patterns,
          divergence:    signal.divergence,
          support:       signal.support,
          resistance:    signal.resistance,
          confirmations: signal.confirmations,
        } : undefined,
      });
      const updated = [...newMsgs, { role: "ai" as const, content: res.response }];
      setMsgs(updated);
      saveHistory(updated);
    } catch {
      const updated = [...newMsgs, { role: "ai" as const, content: "Connection error. Please try again." }];
      setMsgs(updated);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed bottom-20 right-4 z-50 flex flex-col rounded-xl overflow-hidden fade-in"
      style={{ width: 380, height: 500, background: "#0e0e18", border: "1px solid #2a2a3e", boxShadow: "0 8px 40px rgba(0,0,0,0.7)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e1e2e]">
        <div className="flex items-center gap-2">
          <span className="text-lg">🤖</span>
          <span className="font-bold text-sm text-white">Jarvis AI</span>
          <span className="badge badge-active text-[9px]">LIVE</span>
        </div>
        <button onClick={onClose} className="text-[#666880] hover:text-white text-lg leading-none transition-colors">✕</button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {msgs.length === 0 && (
          <div className="text-center text-[#444] text-xs mt-8">
            <div className="text-2xl mb-2">💬</div>
            Ask Jarvis anything about Gold markets
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className="max-w-[85%] px-3 py-2 rounded-xl text-xs leading-relaxed"
              style={
                m.role === "user"
                  ? { background: "rgba(245,166,35,0.15)", color: "#f5a623", border: "1px solid rgba(245,166,35,0.2)" }
                  : { background: "#14141e", color: "#c8c8d8", border: "1px solid #2a2a3e" }
              }
            >
              {m.content}
            </div>
          </div>
        ))}
        {mutation.isPending && (
          <div className="flex justify-start">
            <div className="px-4 py-3 rounded-xl" style={{ background: "#14141e", border: "1px solid #2a2a3e" }}>
              <div className="chat-dots"><span/><span/><span/></div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick chips */}
      <div className="px-3 pb-1 flex gap-1 flex-wrap">
        {QUICK_CHIPS.map(chip => (
          <button key={chip} onClick={() => send(chip)}
            className="text-[9px] px-2 py-1 rounded border border-[#2a2a3e] text-[#888aaa] hover:border-[#f5a623] hover:text-[#f5a623] transition-colors"
          >{chip}</button>
        ))}
      </div>

      {/* Input */}
      <div className="flex gap-2 p-3 border-t border-[#1e1e2e]">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && send(input)}
          placeholder="Ask about gold markets..."
          className="flex-1 bg-[#14141e] border border-[#2a2a3e] rounded-lg px-3 py-2 text-xs text-white placeholder-[#444] outline-none focus:border-[#f5a623] transition-colors"
        />
        <button
          onClick={() => send(input)}
          disabled={!input.trim() || mutation.isPending}
          className="px-3 py-2 rounded-lg text-xs font-bold transition-all"
          style={{
            background: input.trim() && !mutation.isPending ? "rgba(245,166,35,0.2)" : "rgba(245,166,35,0.05)",
            color: input.trim() && !mutation.isPending ? "#f5a623" : "#666",
            border: "1px solid rgba(245,166,35,0.2)",
          }}
        >➤</button>
      </div>
    </div>
  );
}
