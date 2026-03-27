'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';

interface BpmnViewerProps {
  xml: string;
}

function BpmnViewerInner({ xml }: BpmnViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let viewer: { destroy: () => void } | null = null;

    async function initViewer() {
      if (!containerRef.current) return;

      try {
        // Dynamic import to avoid SSR issues with bpmn-js
        const BpmnViewerModule = await import(
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          'bpmn-js/dist/bpmn-viewer.development.js'
        );
        const BpmnViewerClass =
          BpmnViewerModule.default ?? BpmnViewerModule;

        viewer = new BpmnViewerClass({
          container: containerRef.current,
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (viewer as any).importXML(xml);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (viewer as any).get('canvas').zoom('fit-viewport');
        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to render BPMN');
        setLoading(false);
      }
    }

    initViewer();

    return () => {
      if (viewer) {
        viewer.destroy();
      }
    };
  }, [xml]);

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-red-400">
        Failed to render BPMN: {error}
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-zinc-500">
          Loading BPMN diagram…
        </div>
      )}
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}

// Wrap with dynamic to disable SSR
const BpmnViewerDynamic = dynamic(
  () => Promise.resolve(BpmnViewerInner),
  { ssr: false }
);

export function BpmnViewer({ xml }: BpmnViewerProps) {
  return (
    <div className="w-full h-[500px] bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden">
      <BpmnViewerDynamic xml={xml} />
    </div>
  );
}
