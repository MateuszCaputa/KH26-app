'use client';

import { useState, useTransition } from 'react';
import { StatCard } from './stat-card';
import { SeverityBadge } from './severity-badge';
import { RecommendationCard } from './recommendation-card';
import { BpmnViewer } from './bpmn-viewer';
import type { PipelineOutput, CopilotOutput } from '@/lib/types';
import { formatDuration, formatDate } from '@/lib/utils';
import { runAnalysis, getBpmnXml } from '@/lib/api';

type TabId = 'overview' | 'bottlenecks' | 'variants' | 'ai' | 'bpmn';

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'bottlenecks', label: 'Bottlenecks' },
  { id: 'variants', label: 'Variants' },
  { id: 'ai', label: 'AI Analysis' },
  { id: 'bpmn', label: 'BPMN' },
];

interface ProcessTabsProps {
  pipeline: PipelineOutput;
  processId: string;
}

export function ProcessTabs({ pipeline, processId }: ProcessTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [copilot, setCopilot] = useState<CopilotOutput | null>(null);
  const [copilotError, setCopilotError] = useState<string | null>(null);
  const [bpmnXml, setBpmnXml] = useState<string | null>(
    pipeline ? null : null
  );
  const [isPending, startTransition] = useTransition();

  const [showAllBottlenecks, setShowAllBottlenecks] = useState(false);
  const [showAllActivities, setShowAllActivities] = useState(false);

  const { statistics: stats, activities, bottlenecks, variants, application_usage } = pipeline;

  const sortedActivities = [...activities].sort((a, b) => b.frequency - a.frequency);
  const topActivities = showAllActivities ? sortedActivities : sortedActivities.slice(0, 15);

  const sortedBottlenecks = [...bottlenecks].sort((a, b) => {
    const sev = { critical: 4, high: 3, medium: 2, low: 1 };
    return (sev[b.severity as keyof typeof sev] ?? 0) - (sev[a.severity as keyof typeof sev] ?? 0);
  });
  const visibleBottlenecks = showAllBottlenecks ? sortedBottlenecks : sortedBottlenecks.slice(0, 15);

  const maxUsage = Math.max(
    ...(application_usage?.map((a) => a.total_duration_seconds) ?? [1])
  );

  async function handleRunAnalysis() {
    setCopilotError(null);
    startTransition(async () => {
      try {
        const data = await runAnalysis(processId);
        setCopilot(data);
      } catch (err) {
        setCopilotError(err instanceof Error ? err.message : 'Analysis failed');
      }
    });
  }

  const [bpmnError, setBpmnError] = useState<string | null>(null);

  async function handleLoadBpmn() {
    setBpmnError(null);
    try {
      const xml = await getBpmnXml(processId);
      setBpmnXml(xml);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown';
      setBpmnError(msg.includes('202') ? 'Run AI Analysis first to generate BPMN.' : `Failed to load BPMN: ${msg}`);
    }
  }

  function handleDownloadBpmn() {
    if (!bpmnXml) return;
    const blob = new Blob([bpmnXml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `process-${processId}.bpmn`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Cases" value={stats.total_cases.toLocaleString()} />
        <StatCard label="Events" value={stats.total_events.toLocaleString()} />
        <StatCard label="Activities" value={stats.total_activities} />
        <StatCard label="Variants" value={stats.total_variants} />
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 border-b border-zinc-800 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id);
              if (tab.id === 'bpmn' && !bpmnXml) {
                handleLoadBpmn();
              }
            }}
            className={`px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap border-b-2 -mb-px ${
              activeTab === tab.id
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Overview */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <StatCard
              label="Date Range"
              value={formatDate(stats.start_date)}
              sub={`to ${formatDate(stats.end_date)}`}
            />
            <StatCard
              label="Avg Case Duration"
              value={formatDuration(stats.avg_case_duration_seconds)}
              sub={`median ${formatDuration(stats.median_case_duration_seconds)}`}
            />
            <StatCard
              label="Users / Apps"
              value={`${stats.total_users} / ${stats.total_applications}`}
              sub="unique users and applications"
            />
          </div>

          {/* Top activities table */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-800">
              <h3 className="text-sm font-medium text-zinc-200">Top Activities</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800">
                    <th className="text-left px-4 py-2 text-xs text-zinc-500 font-medium">Name</th>
                    <th className="text-right px-4 py-2 text-xs text-zinc-500 font-medium">Freq</th>
                    <th className="text-right px-4 py-2 text-xs text-zinc-500 font-medium">Avg Duration</th>
                    <th className="text-right px-4 py-2 text-xs text-zinc-500 font-medium">Copy-Paste</th>
                    <th className="text-left px-4 py-2 text-xs text-zinc-500 font-medium">Applications</th>
                  </tr>
                </thead>
                <tbody>
                  {topActivities.map((act) => (
                    <tr key={act.name} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                      <td className="px-4 py-2 text-zinc-200">{act.name}</td>
                      <td className="px-4 py-2 text-right font-mono text-zinc-400">{act.frequency}</td>
                      <td className="px-4 py-2 text-right font-mono text-zinc-400">
                        {formatDuration(act.avg_duration_seconds)}
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-zinc-400">
                        {act.copy_paste_count > 0 ? (
                          <span className={act.copy_paste_count > 50 ? 'text-orange-400' : ''}>
                            {act.copy_paste_count}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex gap-1 flex-wrap">
                          {act.applications.slice(0, 4).map((app) => (
                            <span
                              key={app}
                              className="text-xs px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400"
                            >
                              {app}
                            </span>
                          ))}
                          {act.applications.length > 4 && (
                            <span className="text-xs text-zinc-600">
                              +{act.applications.length - 4}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {activities.length > 15 && (
              <button
                onClick={() => setShowAllActivities(!showAllActivities)}
                className="w-full py-2 text-xs text-zinc-500 hover:text-zinc-300 transition-colors border-t border-zinc-800"
              >
                {showAllActivities ? 'Show less' : `Show all ${activities.length} activities`}
              </button>
            )}
          </div>

          {/* Application usage bar chart */}
          {application_usage && application_usage.length > 0 && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-800">
                <h3 className="text-sm font-medium text-zinc-200">Application Usage</h3>
              </div>
              <div className="p-4 space-y-3">
                {[...application_usage]
                  .sort((a, b) => b.total_duration_seconds - a.total_duration_seconds)
                  .map((app) => {
                    const pct = maxUsage > 0
                      ? (app.total_duration_seconds / maxUsage) * 100
                      : 0;
                    const activePct = app.total_duration_seconds > 0
                      ? (app.active_duration_seconds / app.total_duration_seconds) * 100
                      : 0;
                    return (
                      <div key={app.application} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-zinc-300">{app.application}</span>
                          <span className="text-zinc-500 font-mono">
                            {formatDuration(app.total_duration_seconds)}
                          </span>
                        </div>
                        <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-600 rounded-full"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <div className="text-xs text-zinc-600">
                          {activePct.toFixed(0)}% active
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab: Bottlenecks */}
      {activeTab === 'bottlenecks' && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
          {bottlenecks.length === 0 ? (
            <div className="px-4 py-8 text-center text-zinc-500 text-sm">
              No bottlenecks detected.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800">
                    <th className="text-left px-4 py-2 text-xs text-zinc-500 font-medium">Transition</th>
                    <th className="text-right px-4 py-2 text-xs text-zinc-500 font-medium">Avg Wait</th>
                    <th className="text-right px-4 py-2 text-xs text-zinc-500 font-medium">Max Wait</th>
                    <th className="text-right px-4 py-2 text-xs text-zinc-500 font-medium">Cases</th>
                    <th className="text-center px-4 py-2 text-xs text-zinc-500 font-medium">Severity</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleBottlenecks.map((bn, i) => (
                    <tr key={i} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                      <td className="px-4 py-3 text-zinc-200">
                        <span className="text-zinc-400">{bn.from_activity}</span>
                        <span className="mx-2 text-zinc-600">→</span>
                        <span>{bn.to_activity}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-zinc-400">
                        {formatDuration(bn.avg_wait_seconds)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-zinc-400">
                        {formatDuration(bn.max_wait_seconds)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-zinc-400">
                        {bn.case_count}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <SeverityBadge severity={bn.severity} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {bottlenecks.length > 15 && (
            <button
              onClick={() => setShowAllBottlenecks(!showAllBottlenecks)}
              className="w-full py-2 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              {showAllBottlenecks ? 'Show less' : `Show all ${bottlenecks.length} bottlenecks`}
            </button>
          )}
        </div>
      )}

      {/* Tab: Variants */}
      {activeTab === 'variants' && (
        <div className="space-y-3">
          {variants.length === 0 ? (
            <p className="text-zinc-500 text-sm">No variants found.</p>
          ) : (
            [...variants]
              .sort((a, b) => b.case_count - a.case_count)
              .slice(0, 10)
              .map((v) => (
                <div
                  key={v.variant_id}
                  className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 flex items-start gap-4"
                >
                  <div className="text-right min-w-[64px]">
                    <p className="text-sm font-semibold font-mono text-zinc-100">
                      {v.percentage.toFixed(1)}%
                    </p>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      {v.case_count} cases
                    </p>
                    {v.avg_total_duration_seconds > 0 && (
                      <p className="text-xs text-zinc-600 mt-0.5">
                        {formatDuration(v.avg_total_duration_seconds)}
                      </p>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex gap-1.5 flex-wrap items-center">
                      {v.sequence.map((step, idx) => (
                        <span key={idx} className="flex items-center gap-1.5">
                          <span className="text-xs px-2.5 py-1 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700">
                            {step}
                          </span>
                          {idx < v.sequence.length - 1 && (
                            <span className="text-zinc-600 text-xs">→</span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))
          )}
        </div>
      )}

      {/* Tab: AI Analysis */}
      {activeTab === 'ai' && (
        <div className="space-y-6">
          {!copilot && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-8 text-center space-y-4">
              <div>
                <p className="text-zinc-200 font-medium">Run AI Analysis</p>
                <p className="text-sm text-zinc-500 mt-1">
                  The AI copilot will analyse the process and generate automation recommendations.
                </p>
              </div>
              {copilotError && (
                <p className="text-sm text-red-400">{copilotError}</p>
              )}
              <button
                onClick={handleRunAnalysis}
                disabled={isPending}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
              >
                {isPending ? (
                  <>
                    <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                    Analysing…
                  </>
                ) : (
                  'Run AI Analysis'
                )}
              </button>
            </div>
          )}

          {copilot && (
            <>
              {copilot.summary && (
                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 space-y-2">
                  <h3 className="text-sm font-medium text-zinc-200">Summary</h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">{copilot.summary}</p>
                </div>
              )}

              {copilot.recommendations?.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-zinc-200">
                    Recommendations ({copilot.recommendations.length})
                  </h3>
                  {[...copilot.recommendations]
                    .sort((a, b) => a.priority - b.priority)
                    .map((rec) => (
                      <RecommendationCard key={rec.id} recommendation={rec} />
                    ))}
                </div>
              )}

              {copilot.reference_bpmn_comparison && (
                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 space-y-2">
                  <h3 className="text-sm font-medium text-zinc-200">Reference BPMN Comparison</h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    {copilot.reference_bpmn_comparison}
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Tab: BPMN */}
      {activeTab === 'bpmn' && (
        <BpmnTabContent
          processId={processId}
          bpmnXml={bpmnXml}
          bpmnError={bpmnError}
          onLoadBpmn={handleLoadBpmn}
          onDownloadBpmn={handleDownloadBpmn}
        />
      )}
    </div>
  );
}

/** BPMN tab — shows the AI-generated optimized workflow */
function BpmnTabContent({
  bpmnXml,
  bpmnError,
  onLoadBpmn,
  onDownloadBpmn,
}: {
  processId: string;
  bpmnXml: string | null;
  bpmnError: string | null;
  onLoadBpmn: () => void;
  onDownloadBpmn: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-zinc-200">
          Generated Process Workflow
        </h3>
        {bpmnXml && !bpmnXml.startsWith('<!--') && (
          <button
            onClick={onDownloadBpmn}
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium rounded-lg border border-zinc-700 transition-colors"
          >
            Download BPMN XML
          </button>
        )}
      </div>

      {bpmnError ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-8 text-center space-y-3">
          <p className="text-sm text-zinc-400">{bpmnError}</p>
          <button
            onClick={onLoadBpmn}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      ) : !bpmnXml ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-8 text-center">
          <p className="text-zinc-500 text-sm">Loading BPMN diagram…</p>
        </div>
      ) : (
        <BpmnViewer xml={bpmnXml} />
      )}
    </div>
  );
}
