'use client';

import { useMemo, useState } from 'react';
import type { ProcessMap } from '@/lib/types';

interface ProcessFlowDiagramProps {
  processMap: ProcessMap;
}

const NODE_PRESETS = [
  { label: '8', value: 8, maxEdges: 12 },
  { label: '12', value: 12, maxEdges: 18 },
  { label: '20', value: 20, maxEdges: 28 },
];

const SIZE = 600;
const CENTER = SIZE / 2;
const INNER_R = 160;
const OUTER_R = 240;
const MIN_NODE_R = 24;
const MAX_NODE_R = 44;

interface LayoutNode {
  id: string;
  label: string;
  frequency: number;
  x: number;
  y: number;
  r: number;
  isHub: boolean;
}

function computeLayout(
  nodes: ProcessMap['nodes'],
  edges: ProcessMap['edges'],
  maxNodes: number,
  maxEdges: number,
) {
  if (!nodes.length) return null;

  // Top N nodes by frequency
  const sorted = [...nodes].sort((a, b) => (b.frequency ?? 0) - (a.frequency ?? 0));
  const topNodes = sorted.slice(0, maxNodes);
  const topIds = new Set(topNodes.map((n) => n.id));

  // Hub = most frequent node
  const hub = topNodes[0];
  const ring = topNodes.slice(1);

  // Edges between top nodes, sorted by weight
  const filteredEdges = edges
    .filter((e) => topIds.has(e.source) && topIds.has(e.target) && e.source !== e.target)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, maxEdges);

  // Frequency range for sizing
  const maxFreq = hub.frequency ?? 1;
  const minFreq = Math.min(...topNodes.map((n) => n.frequency ?? 0));
  const freqRange = Math.max(maxFreq - minFreq, 1);

  function nodeRadius(freq: number): number {
    const t = (freq - minFreq) / freqRange;
    return MIN_NODE_R + t * (MAX_NODE_R - MIN_NODE_R);
  }

  // Position hub at center
  const hubR = MAX_NODE_R;
  const layoutNodes: LayoutNode[] = [{
    id: hub.id,
    label: hub.label,
    frequency: hub.frequency ?? 0,
    x: CENTER,
    y: CENTER,
    r: hubR,
    isHub: true,
  }];

  // Sort ring nodes: those connected to hub come closer, others further
  const hubConnections = new Set<string>();
  for (const e of filteredEdges) {
    if (e.source === hub.id) hubConnections.add(e.target);
    if (e.target === hub.id) hubConnections.add(e.source);
  }

  // Place connected nodes on inner ring, others on outer ring
  const innerNodes = ring.filter((n) => hubConnections.has(n.id));
  const outerNodes = ring.filter((n) => !hubConnections.has(n.id));

  function placeOnRing(items: typeof ring, radius: number, startAngle: number) {
    const count = items.length;
    if (count === 0) return;
    const angleStep = (2 * Math.PI) / Math.max(count, 1);
    for (let i = 0; i < count; i++) {
      const angle = startAngle + i * angleStep - Math.PI / 2;
      const n = items[i];
      const r = nodeRadius(n.frequency ?? 0);
      layoutNodes.push({
        id: n.id,
        label: n.label,
        frequency: n.frequency ?? 0,
        x: CENTER + radius * Math.cos(angle),
        y: CENTER + radius * Math.sin(angle),
        r,
        isHub: false,
      });
    }
  }

  placeOnRing(innerNodes, INNER_R, 0);
  placeOnRing(outerNodes, OUTER_R, Math.PI / (outerNodes.length || 1));

  const posMap = new Map(layoutNodes.map((n) => [n.id, n]));
  const maxWeight = filteredEdges.length > 0 ? filteredEdges[0].weight : 1;

  return { layoutNodes, filteredEdges, posMap, maxWeight, maxFreq };
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + '\u2026' : s;
}

export function ProcessFlowDiagram({ processMap }: ProcessFlowDiagramProps) {
  const { nodes, edges } = processMap;
  const [presetIdx, setPresetIdx] = useState(0);
  const preset = NODE_PRESETS[presetIdx];

  const layout = useMemo(
    () => computeLayout(nodes, edges, preset.value, preset.maxEdges),
    [nodes, edges, preset.value, preset.maxEdges],
  );

  if (!layout || !layout.layoutNodes.length) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-8 text-center text-zinc-500 text-sm">
        No process map data available.
      </div>
    );
  }

  const { layoutNodes, filteredEdges, posMap, maxWeight, maxFreq } = layout;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
        <h3 className="text-sm font-medium text-zinc-200">Activity Map</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500 mr-1">Show:</span>
          {NODE_PRESETS.map((p, i) => (
            <button
              key={p.label}
              onClick={() => setPresetIdx(i)}
              className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                i === presetIdx
                  ? 'bg-blue-600 text-white'
                  : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex justify-center p-4 overflow-x-auto">
        <svg
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="max-w-full"
        >
          {/* Edges — drawn first so nodes sit on top */}
          {filteredEdges.map((edge, i) => {
            const from = posMap.get(edge.source);
            const to = posMap.get(edge.target);
            if (!from || !to) return null;

            const t = edge.weight / maxWeight;
            const opacity = 0.15 + t * 0.5;
            const strokeWidth = 0.8 + t * 2.2;

            // Straight line from edge of source circle to edge of target circle
            const dx = to.x - from.x;
            const dy = to.y - from.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 1) return null;
            const nx = dx / dist;
            const ny = dy / dist;

            const x1 = from.x + nx * from.r;
            const y1 = from.y + ny * from.r;
            const x2 = to.x - nx * to.r;
            const y2 = to.y - ny * to.r;

            return (
              <line
                key={`e-${i}`}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="#3b82f6"
                strokeWidth={strokeWidth}
                opacity={opacity}
              />
            );
          })}

          {/* Nodes */}
          {layoutNodes.map((node) => {
            const freqT = maxFreq > 0 ? node.frequency / maxFreq : 0;
            const fillOpacity = node.isHub ? 0.5 : 0.12 + freqT * 0.3;
            const strokeColor = node.isHub ? '#3b82f6' : '#3f3f46';
            const strokeW = node.isHub ? 2 : 1.2;
            const maxChars = node.r > 34 ? 18 : 14;

            return (
              <g key={node.id}>
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={node.r}
                  fill={`rgba(59, 130, 246, ${fillOpacity})`}
                  stroke={strokeColor}
                  strokeWidth={strokeW}
                />
                <text
                  x={node.x}
                  y={node.y - 5}
                  textAnchor="middle"
                  fill="#e4e4e7"
                  fontSize={node.isHub ? 11 : 10}
                  fontFamily="system-ui, sans-serif"
                  fontWeight={node.isHub ? 600 : 400}
                >
                  {truncate(node.label, maxChars)}
                </text>
                <text
                  x={node.x}
                  y={node.y + 10}
                  textAnchor="middle"
                  fill="#71717a"
                  fontSize={9}
                  fontFamily="system-ui, sans-serif"
                >
                  {node.frequency.toLocaleString()}x
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="px-4 py-2 border-t border-zinc-800 flex gap-4 text-xs text-zinc-500">
        <span>Center = most frequent activity</span>
        <span>Circle size = occurrence count</span>
        <span>Line thickness = transition frequency</span>
      </div>
    </div>
  );
}
