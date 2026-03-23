interface Props {
  support: number[];
  resistance: number[];
  price: number;
}

export function SRVisual({ support, resistance, price }: Props) {
  const allLevels = [
    ...resistance.map((v, i) => ({ label: `R${resistance.length - i}`, value: v, side: "res" as const })).reverse(),
    { label: "CMP", value: price, side: "price" as const },
    ...support.map((v, i) => ({ label: `S${i + 1}`, value: v, side: "sup" as const })).reverse(),
  ].sort((a, b) => b.value - a.value);

  const max = Math.max(...allLevels.map(l => l.value));
  const min = Math.min(...allLevels.map(l => l.value));
  const range = max - min || 1;

  return (
    <div className="space-y-1">
      {allLevels.map((lvl) => {
        const pct = Math.round(((lvl.value - min) / range) * 100);
        const isPrice = lvl.side === "price";
        const isRes   = lvl.side === "res";
        const color   = isPrice ? "#ffffff" : isRes ? "#ff3d3d" : "#00e676";
        return (
          <div key={lvl.label + lvl.value} className="flex items-center gap-2">
            <span className="text-[10px] font-mono font-bold w-8 text-right" style={{ color }}>{lvl.label}</span>
            <div className="flex-1 h-[3px] rounded" style={{ background: isPrice ? "#33334a" : "#1e1e2e", position: "relative" }}>
              <div
                className="absolute left-0 top-0 h-full rounded"
                style={{ width: `${pct}%`, background: color, opacity: isPrice ? 1 : 0.6, transition: "width 0.5s ease" }}
              />
            </div>
            <span className="text-[10px] font-mono w-20 text-right" style={{ color, fontWeight: isPrice ? 700 : 400 }}>
              ${lvl.value.toLocaleString()}
            </span>
          </div>
        );
      })}
    </div>
  );
}
