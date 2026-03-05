import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

interface Props {
  altitude: number[];
  totalDistanceKm: number;
  onHoverIndex: (index: number | null) => void;
}

export default function ElevationChart({ altitude, totalDistanceKm, onHoverIndex }: Props) {
  const step = totalDistanceKm / (altitude.length - 1);
  const data = altitude.map((alt, i) => ({
    distance: parseFloat((i * step).toFixed(2)),
    elevation: Math.round(alt),
  }));

  const min = Math.min(...altitude);
  const max = Math.max(...altitude);
  const padding = Math.max(20, (max - min) * 0.1);

  return (
    <ResponsiveContainer width="100%" height={180}>
      <AreaChart
        data={data}
        margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
        onMouseMove={(state) => {
          if (state.isTooltipActive && state.activeTooltipIndex != null) {
            onHoverIndex(Number(state.activeTooltipIndex));
          }
        }}
        onMouseLeave={() => onHoverIndex(null)}
      >
        <defs>
          <linearGradient id="elevGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#f97316" stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="distance"
          tickFormatter={(v) => `${v}km`}
          tick={{ fontSize: 11, fill: "#9ca3af" }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          domain={[min - padding, max + padding]}
          tickFormatter={(v) => `${v}m`}
          tick={{ fontSize: 11, fill: "#9ca3af" }}
          axisLine={false}
          tickLine={false}
          width={45}
        />
        <Tooltip
          formatter={(value) => [`${value}m`, "Elevation"]}
          labelFormatter={(label) => `${label}km`}
          contentStyle={{ fontSize: 12, borderRadius: 6, border: "1px solid #e5e7eb" }}
        />
        <Area
          type="monotone"
          dataKey="elevation"
          stroke="#f97316"
          strokeWidth={2}
          fill="url(#elevGradient)"
          dot={false}
          activeDot={{ r: 4, fill: "#f97316" }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
