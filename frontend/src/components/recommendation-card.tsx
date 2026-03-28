'use client';

import { useState } from 'react';
import type { Recommendation, RecommendationType, ImpactLevel, AutomationBlueprint } from '@/lib/types';
import { formatDuration } from '@/lib/utils';

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

const COMPLEXITY_STYLES: Record<string, string> = {
  low: 'text-green-400',
  medium: 'text-amber-400',
  high: 'text-red-400',
};

interface RecommendationCardProps {
  recommendation: Recommendation;
  blueprint?: AutomationBlueprint;
}

function downloadBlueprint(bp: AutomationBlueprint) {
  const blob = new Blob([JSON.stringify(bp, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${bp.blueprint_id}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function RecommendationCard({ recommendation: rec, blueprint }: RecommendationCardProps) {
  const [showBlueprint, setShowBlueprint] = useState(false);

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

      {blueprint && (
        <>
          <button
            onClick={() => setShowBlueprint(!showBlueprint)}
            className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
            aria-label={showBlueprint ? 'Hide automation blueprint' : 'View automation blueprint'}
          >
            {showBlueprint ? 'Hide Blueprint' : 'View Blueprint'}
          </button>

          {showBlueprint && (
            <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-mono text-zinc-500">{blueprint.blueprint_id}</p>
                  <p className="text-sm font-medium text-zinc-200">{blueprint.name}</p>
                </div>
                <button
                  onClick={() => downloadBlueprint(blueprint)}
                  className="text-xs px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded border border-zinc-700 transition-colors"
                  aria-label="Download blueprint as JSON"
                >
                  Download JSON
                </button>
              </div>

              <div className="flex gap-3 text-xs">
                <span className="text-zinc-500">Type: <span className="text-zinc-300">{blueprint.automation_type}</span></span>
                <span className="text-zinc-500">Complexity: <span className={COMPLEXITY_STYLES[blueprint.complexity] ?? 'text-zinc-300'}>{blueprint.complexity}</span></span>
                <span className="text-zinc-500">Dev: <span className="text-zinc-300">{blueprint.estimated_dev_hours}h</span></span>
              </div>

              <div>
                <p className="text-xs text-zinc-500 mb-1">Trigger</p>
                <p className="text-xs text-zinc-400">{blueprint.trigger_description}</p>
              </div>

              <div>
                <p className="text-xs text-zinc-500 mb-1.5">Steps</p>
                <ol className="space-y-1.5">
                  {blueprint.steps.map((step, i) => (
                    <li key={i} className="flex gap-2 text-xs">
                      <span className="text-zinc-600 font-mono w-4 flex-shrink-0">{i + 1}.</span>
                      <div>
                        <span className="text-zinc-300">{step.description}</span>
                        {step.target_app && (
                          <span className="ml-1.5 text-zinc-600">({step.target_app})</span>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              </div>

              {blueprint.technology_stack.length > 0 && (
                <div className="flex gap-1.5 flex-wrap">
                  {blueprint.technology_stack.map((tech) => (
                    <span key={tech} className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                      {tech}
                    </span>
                  ))}
                </div>
              )}

              {blueprint.prerequisites.length > 0 && (
                <div>
                  <p className="text-xs text-zinc-500 mb-1">Prerequisites</p>
                  <ul className="text-xs text-zinc-400 space-y-0.5">
                    {blueprint.prerequisites.map((p, i) => (
                      <li key={i}>• {p}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
