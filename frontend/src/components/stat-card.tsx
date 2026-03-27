import { Tooltip } from './tooltip';

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  tooltip?: string;
}

export function StatCard({ label, value, sub, tooltip }: StatCardProps) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3">
      <p className="text-xs text-zinc-500 uppercase tracking-wide flex items-center gap-1.5">
        {label}
        {tooltip && <Tooltip text={tooltip} />}
      </p>
      <p className="text-2xl font-semibold font-mono text-zinc-100 mt-0.5">
        {value}
      </p>
      {sub && (
        <p className="text-xs text-zinc-500 mt-0.5">{sub}</p>
      )}
    </div>
  );
}
