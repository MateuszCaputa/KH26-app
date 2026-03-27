import Link from 'next/link';
import { ProcessTabs } from '@/components/process-tabs';
import type { PipelineOutput } from '@/lib/types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

interface PageProps {
  params: Promise<{ id: string }>;
}

async function fetchPipeline(id: string): Promise<PipelineOutput | null> {
  try {
    const res = await fetch(`${API_BASE}/api/process/${id}`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return res.json() as Promise<PipelineOutput>;
  } catch {
    return null;
  }
}

export default async function ProcessPage({ params }: PageProps) {
  const { id } = await params;
  const pipeline = await fetchPipeline(id);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <Link
            href="/"
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors inline-flex items-center gap-1"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </Link>
          <h2 className="text-xl font-semibold tracking-tight text-zinc-100">
            Process{' '}
            <span className="font-mono text-blue-400">{id}</span>
          </h2>
        </div>
      </div>

      <div className="h-px bg-zinc-800" />

      {/* Content */}
      {!pipeline ? (
        <PipelineNotReady id={id} />
      ) : (
        <ProcessTabs pipeline={pipeline} processId={id} />
      )}
    </div>
  );
}

function PipelineNotReady({ id }: { id: string }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-8 text-center space-y-4">
      <div>
        <p className="text-zinc-200 font-medium">Pipeline not ready</p>
        <p className="text-sm text-zinc-500 mt-1">
          The analysis for process <span className="font-mono text-zinc-400">{id}</span> is
          not available yet or still running.
        </p>
      </div>
      <div className="flex justify-center gap-3">
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium rounded-lg border border-zinc-700 transition-colors"
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
}
