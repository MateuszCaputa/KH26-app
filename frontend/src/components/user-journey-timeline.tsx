'use client';

import { useState, useMemo, useEffect } from 'react';
import type { PipelineOutput, Activity, Bottleneck } from '@/lib/types';
import { formatDuration } from '@/lib/utils';
import { normalizeActivityNameShort, formatUserId as fmtUid } from '@/lib/format-names';

type BlockClass = 'core_work' | 'copy_paste' | 'coordination' | 'bottleneck';

interface TimelineBlock {
  id: string;
  label: string;
  widthFraction: number;
  durationSeconds: number;
  class: BlockClass;
  activity: Activity | null;
  bottleneck: Bottleneck | null;
}

interface UserJourneyTimelineProps {
  pipeline: PipelineOutput;
  initialUsers?: string[];
  onActivityClick?: (activityName: string) => void;
}

const CLASS_CONFIG: Record<BlockClass, { color: string; label: string; textColor: string }> = {
  core_work:    { color: '#22c55e', label: 'Core Work',            textColor: '#052e16' },
  copy_paste:   { color: '#f59e0b', label: 'Manual Data Transfer', textColor: '#1c0f00' },
  coordination: { color: '#818cf8', label: 'Coordination',         textColor: '#f0f0ff' },
  bottleneck:   { color: '#f43f5e', label: 'Waiting / Blocked',    textColor: '#fff1f2' },
};

const PASSIVE_APPS = new Set(['Teams', 'Outlook', 'New Outlook', 'Slack', 'Gmail', 'Zoom', 'Meet']);

function classifyActivity(activity: Activity): BlockClass {
  const name = activity.name.toLowerCase();
  const isCoordination =
    name.includes('communication') ||
    name.includes('meeting') ||
    name.includes('email') ||
    name.includes('chat') ||
    activity.applications.every(a => PASSIVE_APPS.has(a));

  if (isCoordination) return 'coordination';

  const minutes = Math.max(1, activity.avg_duration_seconds / 60);
  if (activity.copy_paste_count / minutes >= 0.3 || activity.copy_paste_count >= 60) {
    return 'copy_paste';
  }
  return 'core_work';
}

const formatUserId = fmtUid;

const MAX_ACTIVITY_BLOCKS = 8; // keep timeline readable at all data sizes

function buildTimeline(user: string, pipeline: PipelineOutput): TimelineBlock[] {
  const { activities, variants, bottlenecks } = pipeline;

  const userActs = activities.filter(a => a.performers.includes(user));
  if (userActs.length === 0) return [];

  const userActNames = new Set(userActs.map(a => a.name));

  // Best variant that includes this user's activities
  const bestVariant = [...variants]
    .filter(v => v.sequence.some(s => userActNames.has(s)))
    .sort((a, b) => b.case_count - a.case_count)[0];

  // Fallback: order by duration descending if no variant found
  const orderedActs = bestVariant
    ? bestVariant.sequence
        .filter(s => userActNames.has(s))
        // Deduplicate consecutive repeated steps
        .reduce<string[]>((acc, s) => {
          if (acc[acc.length - 1] !== s) acc.push(s);
          return acc;
        }, [])
    : [...userActs].sort((a, b) => b.avg_duration_seconds - a.avg_duration_seconds).map(a => a.name);

  // Cap at MAX_ACTIVITY_BLOCKS — prefer the most time-consuming ones if trimming
  const cappedSequence = orderedActs.slice(0, MAX_ACTIVITY_BLOCKS);

  const bnMap = new Map<string, Bottleneck>();
  bottlenecks.forEach(bn => bnMap.set(`${bn.from_activity}→${bn.to_activity}`, bn));

  type Raw = { label: string; seconds: number; class: BlockClass; activity: Activity | null; bottleneck: Bottleneck | null };
  const raw: Raw[] = [];

  cappedSequence.forEach((name, i) => {
    const act = userActs.find(a => a.name === name);
    if (!act) return;

    // Bottleneck gap before this step
    if (i > 0) {
      const prevName = cappedSequence[i - 1];
      const bn = bnMap.get(`${prevName}→${name}`);
      if (bn && bn.avg_wait_seconds >= 600) {
        raw.push({
          label: 'Waiting',
          seconds: Math.min(bn.avg_wait_seconds, 7200),
          class: 'bottleneck',
          activity: null,
          bottleneck: bn,
        });
      }
    }

    raw.push({
      label: normalizeActivityNameShort(act.name),
      seconds: Math.max(act.avg_duration_seconds, 600),
      class: classifyActivity(act),
      activity: act,
      bottleneck: null,
    });
  });

  const total = raw.reduce((s, b) => s + b.seconds, 0);
  if (total === 0) return [];

  return raw.map((b, i) => ({
    id: `b${i}`,
    label: b.label,
    widthFraction: b.seconds / total,
    durationSeconds: b.seconds,
    class: b.class,
    activity: b.activity,
    bottleneck: b.bottleneck,
  }));
}

function computeSimilarity(userA: string, userB: string, activities: Activity[]): number {
  const setA = new Set(activities.filter(a => a.performers.includes(userA)).map(a => a.name));
  const setB = new Set(activities.filter(a => a.performers.includes(userB)).map(a => a.name));
  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return union.size > 0 ? intersection.size / union.size : 0;
}

function computeUserStats(
  user: string,
  blocks: TimelineBlock[],
  pipeline: PipelineOutput,
) {
  const totalSeconds = blocks.reduce((s, b) => s + b.durationSeconds, 0);
  const waste = blocks
    .filter(b => b.class === 'bottleneck' || b.class === 'copy_paste')
    .reduce((s, b) => s + b.durationSeconds, 0);
  const wastePercent = totalSeconds > 0 ? Math.round((waste / totalSeconds) * 100) : 0;
  const performerStat = pipeline.performer_stats?.find(p => p.user === user);
  const userActCount = pipeline.activities.filter(a => a.performers.includes(user)).length;
  const totalEvents = performerStat?.total_events ?? pipeline.statistics.total_events;
  return { totalSeconds, wastePercent, totalEvents, userActCount };
}

export function UserJourneyTimeline({ pipeline, initialUsers, onActivityClick }: UserJourneyTimelineProps) {
  const users = useMemo(() => {
    const set = new Set<string>();
    pipeline.activities.forEach(a => a.performers.forEach(p => set.add(p)));
    return Array.from(set).sort();
  }, [pipeline]);

  const [selectedUsers, setSelectedUsers] = useState<string[]>(
    initialUsers && initialUsers.length > 0
      ? initialUsers
      : users.length > 0 ? [users[0]] : []
  );
  const [tooltip, setTooltip] = useState<{ block: TimelineBlock; x: number; y: number } | null>(null);

  // Sync with initialUsers prop when it changes
  useEffect(() => {
    if (initialUsers && initialUsers.length > 0) {
      setSelectedUsers(initialUsers);
    }
  }, [initialUsers]);

  const timelines = useMemo(
    () => selectedUsers.map(user => ({
      user,
      blocks: buildTimeline(user, pipeline),
    })),
    [selectedUsers, pipeline]
  );

  // Aggregate stats across all selected users
  const aggregateStats = useMemo(() => {
    if (timelines.length === 0) return { totalSeconds: 0, wastePercent: 0, totalEvents: 0, userActCount: 0 };
    if (timelines.length === 1) {
      return computeUserStats(timelines[0].user, timelines[0].blocks, pipeline);
    }
    // Aggregate across multiple users
    let totalSeconds = 0;
    let wasteSeconds = 0;
    let totalEvents = 0;
    const activityNames = new Set<string>();
    for (const { user, blocks } of timelines) {
      const stats = computeUserStats(user, blocks, pipeline);
      totalSeconds += stats.totalSeconds;
      wasteSeconds += blocks
        .filter(b => b.class === 'bottleneck' || b.class === 'copy_paste')
        .reduce((s, b) => s + b.durationSeconds, 0);
      totalEvents += stats.totalEvents;
      pipeline.activities
        .filter(a => a.performers.includes(user))
        .forEach(a => activityNames.add(a.name));
    }
    const wastePercent = totalSeconds > 0 ? Math.round((wasteSeconds / totalSeconds) * 100) : 0;
    return { totalSeconds, wastePercent, totalEvents, userActCount: activityNames.size };
  }, [timelines, pipeline]);

  // Similarity between selected users (pairwise average)
  const similarityInfo = useMemo(() => {
    if (selectedUsers.length < 2) return null;
    const pairs: { a: string; b: string; score: number }[] = [];
    for (let i = 0; i < selectedUsers.length; i++) {
      for (let j = i + 1; j < selectedUsers.length; j++) {
        pairs.push({
          a: selectedUsers[i],
          b: selectedUsers[j],
          score: computeSimilarity(selectedUsers[i], selectedUsers[j], pipeline.activities),
        });
      }
    }
    const avgScore = pairs.reduce((s, p) => s + p.score, 0) / pairs.length;
    return { avgScore, pairs };
  }, [selectedUsers, pipeline.activities]);

  // Time-axis ticks for single-user view
  const hourTicks = useMemo(() => {
    if (timelines.length !== 1) return [];
    const totalSeconds = timelines[0].blocks.reduce((s, b) => s + b.durationSeconds, 0);
    if (totalSeconds === 0) return [];
    const ticks: { label: string; fraction: number }[] = [{ label: '9:00', fraction: 0 }];
    for (let h = 1; h * 3600 < totalSeconds; h++) {
      ticks.push({ label: `${9 + h}:00`, fraction: (h * 3600) / totalSeconds });
    }
    return ticks;
  }, [timelines]);

  const isMultiUser = selectedUsers.length > 1;

  if (users.length === 0) {
    return (
      <div className="py-16 text-center text-zinc-500 text-sm">
        No performer data available in this process log.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h3 className="text-sm font-semibold text-zinc-100">User Journey Timeline</h3>
        <p className="text-xs text-zinc-500 mt-0.5">
          {isMultiUser
            ? 'Compare reconstructed workdays across selected employees'
            : "One employee's reconstructed workday — blocks sized by duration and colored by activity type"}
        </p>
      </div>

      {/* User picker (multi-select) */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-zinc-500 font-medium shrink-0">Users:</span>
        {users.map(user => (
          <button
            key={user}
            onClick={() => setSelectedUsers(prev =>
              prev.includes(user)
                ? prev.filter(u => u !== user)
                : [...prev, user]
            )}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-all border ${
              selectedUsers.includes(user)
                ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-900/40'
                : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600'
            }`}
          >
            {formatUserId(user)}
          </button>
        ))}
      </div>

      {/* Similarity badge */}
      {similarityInfo && (
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-950/40 border border-indigo-800/40 text-xs">
            <svg className="w-3.5 h-3.5 text-indigo-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
            <span className="text-indigo-300 font-medium">
              {Math.round(similarityInfo.avgScore * 100)}% similar activities
            </span>
            {similarityInfo.pairs.length === 1 && (
              <span className="text-indigo-500">
                ({formatUserId(similarityInfo.pairs[0].a)} vs {formatUserId(similarityInfo.pairs[0].b)})
              </span>
            )}
            {similarityInfo.pairs.length > 1 && (
              <span className="text-indigo-500">
                (avg across {similarityInfo.pairs.length} pairs)
              </span>
            )}
          </div>
        </div>
      )}

      {/* Empty state */}
      {selectedUsers.length === 0 && (
        <div className="py-10 text-center text-zinc-600 text-sm">
          Select one or more users above to view their timeline.
        </div>
      )}

      {/* Stats row */}
      {selectedUsers.length > 0 && (
        <div className="grid grid-cols-4 gap-3">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
            <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">
              {isMultiUser ? 'Total Duration' : 'Day Duration'}
            </div>
            <div className="text-xl font-semibold text-zinc-100">{formatDuration(aggregateStats.totalSeconds)}</div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
            <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Events Recorded</div>
            <div className="text-xl font-semibold text-zinc-100">
              {aggregateStats.totalEvents.toLocaleString()}
            </div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
            <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">
              {isMultiUser ? 'Unique Activities' : 'Distinct Activities'}
            </div>
            <div className="text-xl font-semibold text-zinc-100">{aggregateStats.userActCount}</div>
          </div>
          <div
            className={`border rounded-lg p-3 ${
              aggregateStats.wastePercent >= 40
                ? 'bg-red-950/40 border-red-900/50'
                : aggregateStats.wastePercent >= 20
                ? 'bg-amber-950/40 border-amber-900/50'
                : 'bg-zinc-900 border-zinc-800'
            }`}
          >
            <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Automation Waste</div>
            <div
              className={`text-xl font-semibold ${
                aggregateStats.wastePercent >= 40 ? 'text-red-400' : aggregateStats.wastePercent >= 20 ? 'text-amber-400' : 'text-green-400'
              }`}
            >
              {aggregateStats.wastePercent}%
            </div>
          </div>
        </div>
      )}

      {/* Single-user timeline */}
      {selectedUsers.length === 1 && timelines.length === 1 && (
        <div
          className="relative bg-zinc-900 border border-zinc-800 rounded-xl"
          onMouseMove={e => {
            if (tooltip) setTooltip(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : null);
          }}
          onMouseLeave={() => setTooltip(null)}
        >
          {timelines[0].blocks.length === 0 ? (
            <div className="py-10 text-center text-zinc-600 text-sm">
              No activity data for this user.
            </div>
          ) : (
            <>
              {/* Block row */}
              <div className="relative flex h-24 mx-4 mt-4 mb-8 rounded-lg overflow-hidden gap-px">
                {timelines[0].blocks.map(block => (
                  <TimelineBlockEl
                    key={block.id}
                    block={block}
                    tooltip={tooltip}
                    setTooltip={setTooltip}
                    onActivityClick={onActivityClick}
                  />
                ))}
              </div>

              {/* Time axis */}
              <div className="absolute bottom-2 left-4 right-4 pointer-events-none">
                <div className="relative h-5">
                  {hourTicks.map(tick => (
                    <div
                      key={tick.label}
                      className="absolute flex flex-col items-center"
                      style={{ left: `${tick.fraction * 100}%`, transform: 'translateX(-50%)' }}
                    >
                      <div className="w-px h-1.5 bg-zinc-700" />
                      <span className="text-[9px] text-zinc-600 whitespace-nowrap mt-0.5">{tick.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Axis baseline */}
              <div className="absolute bottom-7 left-4 right-4 h-px bg-zinc-800 pointer-events-none" />
            </>
          )}
        </div>
      )}

      {/* Multi-user stacked timelines */}
      {isMultiUser && (
        <div
          className="space-y-4"
          onMouseMove={e => {
            if (tooltip) setTooltip(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : null);
          }}
          onMouseLeave={() => setTooltip(null)}
        >
          {timelines.map(({ user, blocks }) => {
            const stats = computeUserStats(user, blocks, pipeline);
            return (
              <div key={user} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-xs font-medium text-zinc-300 w-20 shrink-0">{formatUserId(user)}</span>
                  <div className="flex items-center gap-3 text-[10px] text-zinc-500">
                    <span>{formatDuration(stats.totalSeconds)}</span>
                    <span>{stats.userActCount} activities</span>
                    <span
                      className={
                        stats.wastePercent >= 40 ? 'text-red-400' : stats.wastePercent >= 20 ? 'text-amber-400' : 'text-green-400'
                      }
                    >
                      {stats.wastePercent}% waste
                    </span>
                  </div>
                </div>
                {blocks.length === 0 ? (
                  <div className="py-4 text-center text-zinc-600 text-xs">
                    No activity data for this user.
                  </div>
                ) : (
                  <div className="relative flex h-16 rounded-lg overflow-hidden gap-px">
                    {blocks.map(block => (
                      <TimelineBlockEl
                        key={block.id}
                        block={block}
                        tooltip={tooltip}
                        setTooltip={setTooltip}
                        onActivityClick={onActivityClick}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Legend + insight */}
      {selectedUsers.length > 0 && (
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4 flex-wrap">
            {(Object.entries(CLASS_CONFIG) as [BlockClass, (typeof CLASS_CONFIG)[BlockClass]][]).map(([cls, cfg]) => (
              <div key={cls} className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: cfg.color }} />
                <span className="text-xs text-zinc-400">{cfg.label}</span>
              </div>
            ))}
          </div>

          {aggregateStats.wastePercent > 0 && (
            <div
              className={`shrink-0 text-xs px-3 py-1.5 rounded-md border font-medium ${
                aggregateStats.wastePercent >= 40
                  ? 'bg-red-950/50 text-red-300 border-red-900/40'
                  : 'bg-amber-950/50 text-amber-300 border-amber-900/40'
              }`}
            >
              {aggregateStats.wastePercent}% of {isMultiUser ? 'selected users\'' : "this user's"} day is a direct automation target
            </div>
          )}
        </div>
      )}

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{ left: tooltip.x + 14, top: tooltip.y - 10 }}
        >
          <BlockTooltip block={tooltip.block} />
        </div>
      )}
    </div>
  );
}

function TimelineBlockEl({
  block,
  tooltip,
  setTooltip,
  onActivityClick,
}: {
  block: TimelineBlock;
  tooltip: { block: TimelineBlock; x: number; y: number } | null;
  setTooltip: (t: { block: TimelineBlock; x: number; y: number } | null) => void;
  onActivityClick?: (activityName: string) => void;
}) {
  const cfg = CLASS_CONFIG[block.class];
  const widthPct = block.widthFraction * 100;
  const isHovered = tooltip?.block.id === block.id;

  return (
    <div
      key={block.id}
      className="relative h-full shrink-0 cursor-pointer"
      style={{
        width: `${widthPct}%`,
        backgroundColor: cfg.color,
        opacity: tooltip && !isHovered ? 0.45 : isHovered ? 1 : 0.88,
        transition: 'opacity 0.1s, filter 0.1s',
        filter: isHovered ? 'brightness(1.12)' : 'none',
      }}
      onMouseEnter={e => setTooltip({ block, x: e.clientX, y: e.clientY })}
      onClick={() => {
        if (onActivityClick && block.activity) {
          onActivityClick(block.activity.name);
        }
      }}
    >
      {/* Diagonal stripe for bottleneck blocks */}
      {block.class === 'bottleneck' && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage:
              'repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(0,0,0,0.22) 5px, rgba(0,0,0,0.22) 10px)',
          }}
        />
      )}
      {/* Label — only if block is wide enough */}
      {widthPct > 9 && (
        <div
          className="absolute inset-0 flex items-center justify-center px-2 pointer-events-none"
          style={{ color: cfg.textColor }}
        >
          <span className="text-[11px] font-semibold truncate text-center leading-tight drop-shadow-sm">
            {block.label}
          </span>
        </div>
      )}
    </div>
  );
}

function BlockTooltip({ block }: { block: TimelineBlock }) {
  const cfg = CLASS_CONFIG[block.class];
  const act = block.activity;
  const bn = block.bottleneck;

  return (
    <div className="bg-zinc-900 border border-zinc-700/80 rounded-lg shadow-2xl p-3.5 w-64 text-xs">
      <div className="flex items-center gap-2 mb-2.5">
        <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: cfg.color }} />
        <span className="font-semibold text-zinc-100 truncate">{block.label}</span>
      </div>

      <div className="space-y-1.5 text-zinc-400">
        <Row label="Duration" value={formatDuration(block.durationSeconds)} />
        <Row label="Type" value={cfg.label} />

        {act && (
          <>
            <Row
              label="Copy-paste ops"
              value={String(act.copy_paste_count)}
              highlight={act.copy_paste_count >= 60 ? 'amber' : undefined}
            />
            <Row
              label="Context switches"
              value={String(act.context_switch_count)}
              highlight={act.context_switch_count > 10 ? 'amber' : undefined}
            />
            <Row label="Manual interactions" value={act.manual_interaction_count.toLocaleString()} />
            {act.applications.length > 0 && (
              <div className="pt-1.5 mt-1.5 border-t border-zinc-800">
                <span className="text-zinc-500">Apps: </span>
                <span className="text-zinc-300">{act.applications.slice(0, 4).join(', ')}</span>
              </div>
            )}
          </>
        )}

        {bn && (
          <>
            <Row label="Severity" value={bn.severity} highlight="red" />
            <Row label="Avg wait" value={formatDuration(bn.avg_wait_seconds)} highlight="red" />
            <div className="pt-1.5 mt-1.5 border-t border-zinc-800 text-zinc-500 leading-relaxed">
              {bn.from_activity} → {bn.to_activity}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: 'amber' | 'red' }) {
  const valueClass =
    highlight === 'red' ? 'text-red-400' : highlight === 'amber' ? 'text-amber-400' : 'text-zinc-200';
  return (
    <div className="flex justify-between gap-2">
      <span className="shrink-0">{label}</span>
      <span className={`${valueClass} text-right capitalize`}>{value}</span>
    </div>
  );
}
