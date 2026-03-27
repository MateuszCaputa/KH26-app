'use client';

import { useMemo } from 'react';
import type { ProcessMap } from '@/lib/types';

interface ProcessFlowDiagramProps {
  processMap: ProcessMap;
}

const NODE_W = 160;
const NODE_H = 52;
const LAYER_GAP = 80;
const NODE_GAP = 24;
const PAD_X = 40;
const PAD_Y = 40;

interface LayoutNode {
  id: string;
  label: string;
  frequency: number;
  layer: number;
  index: number;
  x: number;
  y: number;
}

export function ProcessFlowDiagram({ processMap }: ProcessFlowDiagramProps) {
  const { nodes, edges } = processMap;

  const layout = useMemo(() => {
    if (!nodes.length) return null;

    // Build adjacency
    const outEdges = new Map<string, string[]>();
    const inDegree = new Map<string, number>();
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));

    for (const n of nodes) {
      outEdges.set(n.id, []);
      inDegree.set(n.id, 0);
    }
    for (const e of edges) {
      if (nodeMap.has(e.source) && nodeMap.has(e.target)) {
        outEdges.get(e.source)!.push(e.target);
        inDegree.set(e.target, (inDegree.get(e.target) ?? 0) + 1);
      }
    }

    // Assign layers via longest path from sources (handles cycles gracefully)
    const layers = new Map<string, number>();
    const visited = new Set<string>();

    function assignLayer(id: string, depth: number, stack: Set<string>) {
      if (stack.has(id)) return; // cycle
      if ((layers.get(id) ?? -1) >= depth && visited.has(id)) return;
      layers.set(id, Math.max(layers.get(id) ?? 0, depth));
      visited.add(id);
      stack.add(id);
      for (const next of outEdges.get(id) ?? []) {
        assignLayer(next, depth + 1, stack);
      }
      stack.delete(id);
    }

    // Start from nodes with no incoming edges, or all if cyclic
    const sources = nodes.filter((n) => (inDegree.get(n.id) ?? 0) === 0);
    const starts = sources.length > 0 ? sources : [nodes[0]];
    for (const s of starts) {
      assignLayer(s.id, 0, new Set());
    }
    // Ensure all nodes have a layer
    for (const n of nodes) {
      if (!layers.has(n.id)) layers.set(n.id, 0);
    }

    // Group by layer
    const layerGroups = new Map<number, string[]>();
    for (const [id, layer] of layers) {
      if (!layerGroups.has(layer)) layerGroups.set(layer, []);
      layerGroups.get(layer)!.push(id);
    }

    // Max frequency for scaling
    const maxFreq = Math.max(...nodes.map((n) => n.frequency ?? 1), 1);

    // Position nodes
    const layoutNodes: LayoutNode[] = [];
    const posMap = new Map<string, { x: number; y: number }>();

    const sortedLayers = [...layerGroups.keys()].sort((a, b) => a - b);
    let maxY = 0;

    for (const layer of sortedLayers) {
      const group = layerGroups.get(layer)!;
      // Sort by frequency desc within layer for visual clarity
      group.sort((a, b) => (nodeMap.get(b)?.frequency ?? 0) - (nodeMap.get(a)?.frequency ?? 0));

      for (let i = 0; i < group.length; i++) {
        const id = group[i];
        const node = nodeMap.get(id)!;
        const x = PAD_X + layer * (NODE_W + LAYER_GAP);
        const y = PAD_Y + i * (NODE_H + NODE_GAP);
        posMap.set(id, { x, y });
        layoutNodes.push({
          id,
          label: node.label,
          frequency: node.frequency ?? 0,
          layer,
          index: i,
          x,
          y,
        });
        maxY = Math.max(maxY, y + NODE_H);
      }
    }

    const totalLayers = sortedLayers.length;
    const svgW = PAD_X * 2 + totalLayers * (NODE_W + LAYER_GAP) - LAYER_GAP;
    const svgH = maxY + PAD_Y;

    // Max edge weight for scaling
    const maxWeight = Math.max(...edges.map((e) => e.weight), 1);

    return { layoutNodes, posMap, svgW, svgH, maxFreq, maxWeight };
  }, [nodes, edges]);

  if (!layout || !layout.layoutNodes.length) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-8 text-center text-zinc-500 text-sm">
        No process map data available.
      </div>
    );
  }

  const { layoutNodes, posMap, svgW, svgH, maxFreq, maxWeight } = layout;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-zinc-800">
        <h3 className="text-sm font-medium text-zinc-200">Process Flow</h3>
      </div>
      <div className="overflow-x-auto p-4">
        <svg
          width={svgW}
          height={svgH}
          viewBox={`0 0 ${svgW} ${svgH}`}
          className="min-w-full"
        >
          <defs>
            <marker
              id="arrowhead"
              markerWidth="8"
              markerHeight="6"
              refX="8"
              refY="3"
              orient="auto"
            >
              <polygon points="0 0, 8 3, 0 6" fill="#71717a" />
            </marker>
          </defs>

          {/* Edges */}
          {edges.map((edge, i) => {
            const from = posMap.get(edge.source);
            const to = posMap.get(edge.target);
            if (!from || !to) return null;

            const x1 = from.x + NODE_W;
            const y1 = from.y + NODE_H / 2;
            const x2 = to.x;
            const y2 = to.y + NODE_H / 2;

            const opacity = 0.3 + (edge.weight / maxWeight) * 0.7;
            const strokeWidth = 1 + (edge.weight / maxWeight) * 2.5;

            // Curved path
            const dx = x2 - x1;
            const cp = Math.max(Math.abs(dx) * 0.4, 40);

            const d =
              x2 > x1
                ? `M ${x1} ${y1} C ${x1 + cp} ${y1}, ${x2 - cp} ${y2}, ${x2} ${y2}`
                : `M ${x1} ${y1} C ${x1 + 60} ${y1 - 40}, ${x2 - 60} ${y2 - 40}, ${x2} ${y2}`;

            return (
              <path
                key={`edge-${i}`}
                d={d}
                fill="none"
                stroke="#3b82f6"
                strokeWidth={strokeWidth}
                opacity={opacity}
                markerEnd="url(#arrowhead)"
              />
            );
          })}

          {/* Nodes */}
          {layoutNodes.map((node) => {
            const freqRatio = maxFreq > 0 ? (node.frequency / maxFreq) : 0;
            const bgOpacity = 0.15 + freqRatio * 0.4;

            return (
              <g key={node.id}>
                <rect
                  x={node.x}
                  y={node.y}
                  width={NODE_W}
                  height={NODE_H}
                  rx={8}
                  fill={`rgba(59, 130, 246, ${bgOpacity})`}
                  stroke="#3f3f46"
                  strokeWidth={1.5}
                />
                <text
                  x={node.x + NODE_W / 2}
                  y={node.y + 22}
                  textAnchor="middle"
                  fill="#e4e4e7"
                  fontSize={11}
                  fontFamily="system-ui, sans-serif"
                >
                  {node.label.length > 22
                    ? node.label.slice(0, 20) + '...'
                    : node.label}
                </text>
                <text
                  x={node.x + NODE_W / 2}
                  y={node.y + 38}
                  textAnchor="middle"
                  fill="#71717a"
                  fontSize={10}
                  fontFamily="system-ui, sans-serif"
                >
                  {node.frequency}x
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
