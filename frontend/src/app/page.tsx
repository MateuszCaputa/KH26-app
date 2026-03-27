'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

type LoadingState = 'idle' | 'demo' | 'uploading' | 'pipeline';

function Spinner() {
  return (
    <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
  );
}

export default function HomePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState<LoadingState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);

  async function handleRunDemo() {
    setLoading('demo');
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/run-local?max_files=3`, {
        method: 'POST',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { detail?: string };
        throw new Error(body.detail ?? `HTTP ${res.status}`);
      }
      const data = await res.json() as { process_id: string };
      router.push(`/process/${data.process_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Demo analysis failed');
      setLoading('idle');
    }
  }

  async function handleUpload(file: File) {
    setLoading('uploading');
    setError(null);
    try {
      // Step 1: upload
      const form = new FormData();
      form.append('file', file);
      const uploadRes = await fetch(`${API_BASE}/api/upload`, {
        method: 'POST',
        body: form,
      });
      if (!uploadRes.ok) {
        const body = await uploadRes.json().catch(() => ({})) as { detail?: string };
        throw new Error(body.detail ?? `Upload failed: HTTP ${uploadRes.status}`);
      }
      const uploadData = await uploadRes.json() as { process_id: string };

      // Step 2: run pipeline
      setLoading('pipeline');
      const pipelineRes = await fetch(
        `${API_BASE}/api/process/${uploadData.process_id}/run-pipeline`,
        { method: 'POST' }
      );
      if (!pipelineRes.ok) {
        const body = await pipelineRes.json().catch(() => ({})) as { detail?: string };
        throw new Error(body.detail ?? `Pipeline failed: HTTP ${pipelineRes.status}`);
      }

      router.push(`/process/${uploadData.process_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
      setLoading('idle');
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.csv')) {
      setError('Only CSV files are accepted');
      return;
    }
    setSelectedFile(file);
    setError(null);
    handleUpload(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    if (!file.name.endsWith('.csv')) {
      setError('Only CSV files are accepted');
      return;
    }
    setSelectedFile(file);
    setError(null);
    handleUpload(file);
  }

  const isBusy = loading !== 'idle';

  return (
    <div className="min-h-[calc(100vh-73px)] flex items-center justify-center px-4">
      <div className="w-full max-w-lg space-y-8">
        {/* Hero */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium mb-2">
            KrakHack 2026
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-100">
            Process-to-Automation Copilot
          </h1>
          <p className="text-zinc-400 text-sm leading-relaxed">
            AI-powered process mining — discover workflows, detect bottlenecks,
            and get automation recommendations from your Task Mining data.
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Loading status */}
        {isBusy && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 flex items-center gap-3 text-sm text-zinc-400">
            <Spinner />
            {loading === 'demo' && 'Running demo analysis on local dataset…'}
            {loading === 'uploading' && `Uploading ${selectedFile?.name ?? 'file'}…`}
            {loading === 'pipeline' && 'Running process pipeline…'}
          </div>
        )}

        {/* Actions */}
        <div className="grid grid-cols-1 gap-4">
          {/* Demo */}
          <button
            onClick={handleRunDemo}
            disabled={isBusy}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-colors"
          >
            {loading === 'demo' ? (
              <>
                <Spinner />
                Running Demo…
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 3l14 9-14 9V3z" />
                </svg>
                Run Demo Analysis
              </>
            )}
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-zinc-800" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-zinc-950 px-3 text-xs text-zinc-600">or</span>
            </div>
          </div>

          {/* Upload CSV */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => !isBusy && fileInputRef.current?.click()}
            className={`
              relative flex flex-col items-center justify-center gap-3 px-6 py-8
              border-2 border-dashed rounded-xl cursor-pointer transition-colors
              ${isBusy ? 'opacity-50 cursor-not-allowed' : ''}
              ${dragging
                ? 'border-blue-500 bg-blue-500/5'
                : 'border-zinc-700 hover:border-zinc-500 bg-zinc-900/50'
              }
            `}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleFileChange}
              disabled={isBusy}
            />

            {loading === 'uploading' || loading === 'pipeline' ? (
              <div className="flex flex-col items-center gap-2">
                <Spinner />
                <span className="text-sm text-zinc-400">
                  {loading === 'uploading' ? 'Uploading…' : 'Running pipeline…'}
                </span>
              </div>
            ) : (
              <>
                <svg className="w-8 h-8 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
                <div className="text-center">
                  <p className="text-sm font-medium text-zinc-300">
                    Upload CSV Event Log
                  </p>
                  <p className="text-xs text-zinc-600 mt-1">
                    Drop a file here or click to browse — Activity Sequence CSV from KYP.ai
                  </p>
                </div>
              </>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-zinc-700">
          Backend: {API_BASE}
        </p>
      </div>
    </div>
  );
}
