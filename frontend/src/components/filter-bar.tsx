'use client';

import { useState, useRef, useEffect } from 'react';
import type { Filters } from '@/hooks/use-filters';
import type { BottleneckSeverity } from '@/lib/types';

const SEVERITIES: BottleneckSeverity[] = ['critical', 'high', 'medium', 'low'];

const SEV_COLORS: Record<BottleneckSeverity, string> = {
  critical: 'border-red-700 bg-red-900/30 text-red-300',
  high: 'border-orange-700 bg-orange-900/30 text-orange-300',
  medium: 'border-yellow-700 bg-yellow-900/30 text-yellow-300',
  low: 'border-zinc-600 bg-zinc-800 text-zinc-400',
};

const SEV_ACTIVE: Record<BottleneckSeverity, string> = {
  critical: 'border-red-500 bg-red-800/60 text-red-200 ring-1 ring-red-500',
  high: 'border-orange-500 bg-orange-800/60 text-orange-200 ring-1 ring-orange-500',
  medium: 'border-yellow-500 bg-yellow-800/60 text-yellow-200 ring-1 ring-yellow-500',
  low: 'border-zinc-400 bg-zinc-700 text-zinc-200 ring-1 ring-zinc-400',
};

/** Compact dropdown with checkbox list */
function MultiSelectDropdown({
  label,
  options,
  selected,
  onToggle,
  renderOption,
}: {
  label: string;
  options: string[];
  selected: string[];
  onToggle: (v: string) => void;
  renderOption?: (v: string) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  const count = selected.length;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
          count > 0
            ? 'bg-blue-900/30 border-blue-600 text-blue-300'
            : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-zinc-200'
        }`}
        aria-expanded={open}
      >
        {label}
        {count > 0 && (
          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-blue-600 text-white text-[9px] font-bold leading-none">
            {count}
          </span>
        )}
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
          className={`transition-transform ${open ? 'rotate-180' : ''}`}
        >
          <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && options.length > 0 && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl min-w-[200px] max-h-60 overflow-y-auto">
          {options.map((opt) => {
            const checked = selected.includes(opt);
            return (
              <label
                key={opt}
                className="flex items-center gap-2.5 px-3 py-2 text-xs cursor-pointer hover:bg-zinc-800 transition-colors"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggle(opt)}
                  className="accent-blue-500 w-3.5 h-3.5 flex-shrink-0"
                />
                <span className={`truncate max-w-[160px] ${checked ? 'text-zinc-100' : 'text-zinc-400'}`}>
                  {renderOption ? renderOption(opt) : opt}
                </span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface FilterBarProps {
  filters: Filters;
  isActive: boolean;
  availableUsers: string[];
  availableApps: string[];
  onToggleUser: (u: string) => void;
  onToggleSeverity: (s: BottleneckSeverity) => void;
  onToggleApplication: (a: string) => void;
  onSetSearch: (s: string) => void;
  onClear: () => void;
}

export function FilterBar({
  filters,
  isActive,
  availableUsers,
  availableApps,
  onToggleUser,
  onToggleSeverity,
  onToggleApplication,
  onSetSearch,
  onClear,
}: FilterBarProps) {
  // Map user UUIDs to short labels for display
  const userLabels = Object.fromEntries(
    availableUsers.map((u, i) => [u, `User ${String.fromCharCode(65 + i)}`]),
  );

  const totalActiveCount =
    filters.users.length + filters.severities.length + filters.applications.length +
    (filters.search ? 1 : 0) + (filters.minDurationSeconds > 0 ? 1 : 0);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative">
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none"
          >
            <circle cx="5" cy="5" r="3.5" stroke="currentColor" strokeWidth="1.2" />
            <path d="M8 8L10.5 10.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            placeholder="Search activities…"
            value={filters.search}
            onChange={(e) => onSetSearch(e.target.value)}
            className="pl-7 pr-3 py-1.5 text-xs bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 w-44"
          />
        </div>

        {/* User filter */}
        {availableUsers.length > 0 && (
          <MultiSelectDropdown
            label="Users"
            options={availableUsers}
            selected={filters.users}
            onToggle={onToggleUser}
            renderOption={(u) => userLabels[u] ?? u.slice(0, 8) + '…'}
          />
        )}

        {/* Severity filter */}
        <div className="flex items-center gap-1">
          {SEVERITIES.map((sev) => {
            const active = filters.severities.includes(sev);
            return (
              <button
                key={sev}
                onClick={() => onToggleSeverity(sev)}
                className={`px-2 py-1 text-[10px] font-medium rounded border capitalize transition-colors ${
                  active ? SEV_ACTIVE[sev] : SEV_COLORS[sev]
                }`}
                aria-pressed={active}
                title={`Filter by ${sev} severity bottlenecks`}
              >
                {sev}
              </button>
            );
          })}
        </div>

        {/* Application filter */}
        {availableApps.length > 0 && (
          <MultiSelectDropdown
            label="Apps"
            options={availableApps}
            selected={filters.applications}
            onToggle={onToggleApplication}
          />
        )}

        {/* Clear */}
        {isActive && (
          <button
            onClick={onClear}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 bg-zinc-800 border border-zinc-700 rounded-lg transition-colors"
            aria-label="Clear all filters"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M2 2L8 8M8 2L2 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            Clear {totalActiveCount > 0 ? `(${totalActiveCount})` : ''}
          </button>
        )}
      </div>

      {/* Active user pills */}
      {filters.users.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <span className="text-[10px] text-zinc-500 self-center">Filtered to:</span>
          {filters.users.map((u) => (
            <span
              key={u}
              className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] bg-blue-900/30 border border-blue-700 text-blue-300 rounded-full"
            >
              {userLabels[u] ?? u.slice(0, 8) + '…'}
              <button
                onClick={() => onToggleUser(u)}
                className="hover:text-blue-100 ml-0.5"
                aria-label={`Remove ${userLabels[u] ?? u} filter`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
