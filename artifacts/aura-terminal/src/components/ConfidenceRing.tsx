interface Props { confidence: number }

export function ConfidenceRing({ confidence }: Props) {
  const r = 52;
  const circ = 2 * Math.PI * r;
  const fill = (confidence / 100) * circ;
  const color = confidence >= 75 ? "#00e676" : confidence >= 50 ? "#ffd740" : "#ff3d3d";

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-32 h-32">
        <svg width="128" height="128" viewBox="0 0 128 128" className="-rotate-90">
          <circle cx="64" cy="64" r={r} fill="none" stroke="#1e1e2e" strokeWidth="8" />
          <circle
            cx="64" cy="64" r={r} fill="none"
            stroke={color} strokeWidth="8"
            strokeDasharray={`${fill} ${circ - fill}`}
            strokeLinecap="round"
            style={{ transition: "stroke-dasharray 0.8s ease, stroke 0.4s ease", filter: `drop-shadow(0 0 8px ${color}80)` }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold" style={{ color }}>{confidence}%</span>
          <span className="text-[9px] uppercase tracking-widest" style={{ color: "#666880" }}>Confidence</span>
        </div>
      </div>
    </div>
  );
}
