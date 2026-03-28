'use client';

import { useState } from 'react';
import type { PipelineOutput } from '@/lib/types';
import { formatDuration } from '@/lib/utils';
import { normalizeActivityName, formatBottleneckTransition } from '@/lib/format-names';

const HOURLY_RATE = 50;

interface OverviewAISummaryProps {
  pipeline: PipelineOutput;
}

function buildPrompt(pipeline: PipelineOutput): string {
  const { statistics: stats, bottlenecks, activities } = pipeline;

  const days = Math.max(1, (new Date(stats.end_date).getTime() - new Date(stats.start_date).getTime()) / 86_400_000);
  const monthlyMultiplier = 30 / days;
  const totalWaitSeconds = bottlenecks.reduce((s, bn) => s + bn.avg_wait_seconds * bn.case_count, 0);
  const monthlyWasteHours = Math.round((totalWaitSeconds / 3600) * monthlyMultiplier);
  const monthlyCost = Math.round(monthlyWasteHours * HOURLY_RATE);

  const worstBn = [...bottlenecks].sort((a, b) => b.avg_wait_seconds * b.case_count - a.avg_wait_seconds * a.case_count)[0];
  const topCopyPaste = [...activities].sort((a, b) => b.copy_paste_count - a.copy_paste_count)[0];
  const criticalCount = bottlenecks.filter(b => b.severity === 'critical' || b.severity === 'high').length;

  const bnLines = bottlenecks
    .sort((a, b) => b.avg_wait_seconds * b.case_count - a.avg_wait_seconds * a.case_count)
    .slice(0, 5)
    .map(b => {
      const t = formatBottleneckTransition(b.from_activity, b.to_activity);
      return `- ${t.isReworkLoop ? `"${t.from}" repeated task` : `"${t.from}" → "${t.to}"`}: avg wait ${formatDuration(b.avg_wait_seconds)}, ${b.case_count} cases, severity ${b.severity}`;
    }).join('\n');

  return `You are analysing task mining data from a real company. Here is what was observed:

Employees: ${stats.total_users}
Cases analysed: ${stats.total_cases}
Apps used: ${stats.total_applications}
Different work patterns: ${stats.total_variants}
Avg session length: ${formatDuration(stats.avg_case_duration_seconds)}
Monthly cost of idle wait time: €${monthlyCost.toLocaleString()} (${monthlyWasteHours}h wasted/month)
Bottlenecks found: ${bottlenecks.length} (${criticalCount} critical/high)

Top bottlenecks:
${bnLines}

Most copy-paste heavy activity: "${normalizeActivityName(topCopyPaste?.name ?? '')}" — ${topCopyPaste?.copy_paste_count ?? 0} manual operations

Write a 3-paragraph business summary for a manager who has never seen this data before:
1. What is the biggest problem costing the most money — one concrete sentence with the number.
2. The two most important things to fix first and why — specific, no jargon.
3. What good looks like after fixing these — what changes for the team day-to-day.

Max 40 words per paragraph. No bullet points. No technical terms. Write like a trusted advisor talking to a business owner.`;
}

export function OverviewAISummary({ pipeline }: OverviewAISummaryProps) {
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAsk() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ask-bottleneck', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: buildPrompt(pipeline) }),
      });
      const data = await res.json();
      if (!res.ok || !data.text) throw new Error(data.error ?? 'No response');
      setText(data.text);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not reach AI');
    } finally {
      setLoading(false);
    }
  }

  if (text) {
    return (
      <div className="bg-zinc-900 border border-indigo-900/50 rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-[10px] uppercase tracking-widest text-indigo-400 font-semibold flex items-center gap-1.5">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6L12 2z"/>
            </svg>
            AI Business Summary
          </p>
          <button
            onClick={() => setText(null)}
            className="text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            Hide
          </button>
        </div>
        <div className="space-y-3">
          {text.split('\n\n').filter(Boolean).map((para, i) => (
            <p key={i} className="text-sm text-zinc-300 leading-relaxed">{para}</p>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-4">
      <div>
        <p className="text-sm font-medium text-zinc-200">What does this data mean for my business?</p>
        <p className="text-xs text-zinc-500 mt-0.5">Get a plain-language summary of the most important findings</p>
      </div>
      <button
        onClick={handleAsk}
        disabled={loading}
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors disabled:opacity-60
          border-indigo-800/60 bg-indigo-950/40 text-indigo-300 hover:bg-indigo-900/40 shrink-0 ml-4"
      >
        {loading ? (
          <>
            <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
            </svg>
            Analysing…
          </>
        ) : (
          <>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6L12 2z"/>
            </svg>
            Summarise with AI
          </>
        )}
      </button>
      {error && <p className="text-red-400 text-xs ml-3">{error}</p>}
    </div>
  );
}
