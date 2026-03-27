import type { Recommendation, RecommendationType, ImpactLevel } from '@/lib/types';

const TYPE_STYLES: Record<RecommendationType, string> = {
  automate: 'bg-blue-500/15 text-blue-400 border border-blue-500/30',
  eliminate: 'bg-red-500/15 text-red-400 border border-red-500/30',
  simplify: 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/30',
  parallelize: 'bg-green-500/15 text-green-400 border border-green-500/30',
  reassign: 'bg-purple-500/15 text-purple-400 border border-purple-500/30',
};

const IMPACT_STYLES: Record<ImpactLevel, string> = {
  high: 'bg-red-500/15 text-red-400 border border-red-500/30',
  medium: 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/30',
  low: 'bg-zinc-700/40 text-zinc-400 border border-zinc-700',
};

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

interface RecommendationCardProps {
  recommendation: Recommendation;
}

export function RecommendationCard({ recommendation: rec }: RecommendationCardProps) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-mono text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded">
            P{rec.priority}
          </span>
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_STYLES[rec.type]}`}
          >
            {rec.type}
          </span>
          {rec.automation_type && (
            <span className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-500 border border-zinc-700">
              {rec.automation_type}
            </span>
          )}
        </div>
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${IMPACT_STYLES[rec.impact]}`}
        >
          {rec.impact} impact
        </span>
      </div>

      <p className="text-sm font-medium text-zinc-100">{rec.target}</p>

      <p className="text-sm text-zinc-400 leading-relaxed">{rec.reasoning}</p>

      <div className="flex gap-4 text-xs text-zinc-500 font-mono">
        {rec.estimated_time_saved_seconds > 0 && (
          <span>Est. saved: {formatDuration(rec.estimated_time_saved_seconds)}</span>
        )}
        {rec.affected_cases_percentage > 0 && (
          <span>Affects: {rec.affected_cases_percentage.toFixed(1)}% of cases</span>
        )}
      </div>
    </div>
  );
}
