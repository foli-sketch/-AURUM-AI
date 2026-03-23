interface MTFEntry {
  bias: string;
  rsi: number | null;
  macd_bull: boolean | null;
  ema_bull: boolean | null;
}

interface Props {
  mtfData: Record<string, MTFEntry>;
  overallBias: string;
}

function BiasCell({ bias }: { bias: string }) {
  const cls = bias === "BULLISH" ? "badge-bull" : bias === "BEARISH" ? "badge-bear" : "badge-neut";
  const icon = bias === "BULLISH" ? "🟢" : bias === "BEARISH" ? "🔴" : "⚪";
  return <span className={`badge ${cls}`}>{icon} {bias}</span>;
}

export function MTFTable({ mtfData, overallBias }: Props) {
  const tfs = ["1h", "4h", "1d"];
  const bullCount = Object.values(mtfData).filter(v => v.bias === "BULLISH").length;
  const bearCount = Object.values(mtfData).filter(v => v.bias === "BEARISH").length;

  return (
    <div>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-[#1e1e2e]">
            {["TF", "EMA", "RSI", "MACD", "Bias"].map(h => (
              <th key={h} className="text-left py-2 px-2 text-[#666880] font-semibold uppercase tracking-wider text-[10px]">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tfs.map(tf => {
            const d = mtfData[tf];
            if (!d) return null;
            return (
              <tr key={tf} className="border-b border-[#12121e] hover:bg-[#12121e] transition-colors">
                <td className="py-2 px-2 font-mono font-bold text-[#f5a623]">{tf.toUpperCase()}</td>
                <td className="py-2 px-2">
                  {d.ema_bull === null ? <span className="text-[#444]">—</span>
                    : d.ema_bull
                    ? <span className="text-[#00e676]">↑ Bull</span>
                    : <span className="text-[#ff3d3d]">↓ Bear</span>}
                </td>
                <td className="py-2 px-2 font-mono">
                  {d.rsi !== null ? (
                    <span style={{ color: d.rsi > 70 ? "#ff3d3d" : d.rsi < 30 ? "#00e676" : "#ccc" }}>
                      {d.rsi}
                    </span>
                  ) : <span className="text-[#444]">—</span>}
                </td>
                <td className="py-2 px-2">
                  {d.macd_bull === null ? <span className="text-[#444]">—</span>
                    : d.macd_bull
                    ? <span className="text-[#00e676]">+ Bull</span>
                    : <span className="text-[#ff3d3d]">− Bear</span>}
                </td>
                <td className="py-2 px-2"><BiasCell bias={d.bias} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="mt-3 pt-3 border-t border-[#1e1e2e] flex items-center gap-3">
        <span className="text-[10px] text-[#666880] uppercase tracking-wider">Overall:</span>
        <BiasCell bias={overallBias} />
        <span className="text-[10px] text-[#666880] ml-auto">
          {bullCount > 0 && <span className="text-[#00e676]">{bullCount} Bull </span>}
          {bearCount > 0 && <span className="text-[#ff3d3d]">{bearCount} Bear</span>}
          {bullCount === 0 && bearCount === 0 && <span>Mixed</span>}
        </span>
      </div>
    </div>
  );
}
