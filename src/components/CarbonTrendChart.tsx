import { useMemo } from 'react';
import { TrendingUp } from 'lucide-react';

interface DataPoint {
  date: string;
  label: string;
  carbon: number;
}

interface CarbonTrendChartProps {
  data: DataPoint[];
}

export default function CarbonTrendChart({ data }: CarbonTrendChartProps) {
  const chartData = useMemo(() => {
    if (data.length === 0) return null;

    const maxCarbon = Math.max(...data.map(d => d.carbon), 1);
    const chartWidth = 100;
    const chartHeight = 100;
    const paddingX = 2;
    const paddingY = 8;
    const usableWidth = chartWidth - paddingX * 2;
    const usableHeight = chartHeight - paddingY * 2;

    const points = data.map((d, i) => ({
      x: paddingX + (data.length === 1 ? usableWidth / 2 : (i / (data.length - 1)) * usableWidth),
      y: paddingY + usableHeight - (d.carbon / maxCarbon) * usableHeight,
      ...d,
    }));

    // Build smooth path
    const linePath = points.map((p, i) => (i === 0 ? `M${p.x},${p.y}` : `L${p.x},${p.y}`)).join(' ');

    // Area fill path
    const areaPath = `${linePath} L${points[points.length - 1].x},${chartHeight - paddingY} L${points[0].x},${chartHeight - paddingY} Z`;

    return { points, linePath, areaPath, maxCarbon };
  }, [data]);

  const totalCarbon = useMemo(() => data.reduce((s, d) => s + d.carbon, 0), [data]);

  if (!chartData || data.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-5 shadow-md mb-6">
        <div className="flex items-center gap-2 mb-3">
          <div className="bg-emerald-100 p-2 rounded-full">
            <TrendingUp className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h3 className="font-bold text-gray-800 text-sm">Carbon Savings Trend</h3>
            <p className="text-xs text-gray-500">Belum ada data carbon savings</p>
          </div>
        </div>
        <div className="h-32 flex items-center justify-center text-gray-400 text-sm">
          Data akan muncul setelah scan pertama
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-5 shadow-md mb-6">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <div className="bg-emerald-100 p-2 rounded-full">
            <TrendingUp className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h3 className="font-bold text-gray-800 text-sm">Carbon Savings Trend</h3>
            <p className="text-xs text-gray-500">30 hari terakhir</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-emerald-600">{totalCarbon.toFixed(1)}</p>
          <p className="text-[10px] text-gray-500">kg CO₂ total</p>
        </div>
      </div>

      {/* SVG Chart */}
      <div className="mt-3 relative">
        <svg viewBox="0 0 100 100" className="w-full h-40" preserveAspectRatio="none">
          <defs>
            <linearGradient id="carbonGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {/* Grid lines */}
          {[0, 25, 50, 75].map(y => (
            <line key={y} x1="2" y1={8 + (84 * y) / 100} x2="98" y2={8 + (84 * y) / 100}
              stroke="#e5e7eb" strokeWidth="0.3" strokeDasharray="1,1" />
          ))}
          {/* Area */}
          <path d={chartData.areaPath} fill="url(#carbonGradient)" />
          {/* Line */}
          <path d={chartData.linePath} fill="none" stroke="#10b981" strokeWidth="1.2"
            strokeLinecap="round" strokeLinejoin="round" />
          {/* Dots */}
          {chartData.points.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r="1.5" fill="#10b981" stroke="white" strokeWidth="0.6" />
          ))}
        </svg>

        {/* X-axis labels */}
        <div className="flex justify-between mt-1 px-1">
          {data.length <= 7
            ? data.map((d, i) => (
                <span key={i} className="text-[9px] text-gray-400">{d.label}</span>
              ))
            : [0, Math.floor(data.length / 2), data.length - 1].map(i => (
                <span key={i} className="text-[9px] text-gray-400">{data[i].label}</span>
              ))
          }
        </div>
      </div>

      {/* Y-axis summary */}
      <div className="flex justify-between mt-3 text-[10px] text-gray-500 border-t border-gray-100 pt-2">
        <span>Max: {chartData.maxCarbon.toFixed(1)} kg/hari</span>
        <span>Avg: {(totalCarbon / data.length).toFixed(1)} kg/hari</span>
        <span>🌳 ~{Math.round(totalCarbon / 21)} pohon</span>
      </div>
    </div>
  );
}
