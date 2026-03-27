'use client';

import { useState } from 'react';
import { Tooltip } from './tooltip';

interface CollapsibleSectionProps {
  title: string;
  tooltip?: string;
  defaultOpen?: boolean;
  trailing?: React.ReactNode;
  children: React.ReactNode;
}

export function CollapsibleSection({
  title,
  tooltip,
  defaultOpen = true,
  trailing,
  children,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-4 py-3 border-b border-zinc-800 flex items-center justify-between hover:bg-zinc-800/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <svg
            className={`w-4 h-4 text-zinc-500 transition-transform ${open ? 'rotate-90' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          <h3 className="text-sm font-medium text-zinc-200">{title}</h3>
          {tooltip && <Tooltip text={tooltip} />}
        </div>
        {trailing && (
          <div onClick={(e) => e.stopPropagation()}>
            {trailing}
          </div>
        )}
      </button>
      {open && children}
    </div>
  );
}
