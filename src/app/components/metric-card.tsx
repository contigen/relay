type MetricCardProps = {
  label: string;
  value: string | number;
  highlight?: boolean;
};

export default function MetricCard({ label, value, highlight = false }: MetricCardProps) {
  return (
    <div className="border border-[#e5e5e5] bg-white p-5 flex flex-col justify-between min-h-[96px]">
      <span className="text-[11px] font-mono uppercase tracking-wider text-[#737373]">
        {label}
      </span>
      <span
        className={`text-3xl font-serif tracking-tight mt-2 ${
          highlight ? "text-[#16a34a]" : "text-[#0a0a0a]"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
