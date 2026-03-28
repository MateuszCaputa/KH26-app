'use client';

import { useMemo, useState } from 'react';
import type { PipelineOutput, Recommendation } from '@/lib/types';

/* ── visual constants ─────────────────────────────────────────── */
const MAX_NODES  = 14;
const NODE_W     = 22;
const COL_STEP   = 260;
const MAX_NODE_H = 170;
const MIN_NODE_H = 28;
const V_GAP      = 18;
const ORIGIN_X   = 20;
const ORIGIN_Y   = 40;
const MAX_EDGE_W = 40;
const MIN_EDGE_W = 2;
const LABEL_PAD  = 10;
const CANVAS_PAD = 80;

/* ── palette ──────────────────────────────────────────────────── */
const COLORS = {
  automation: { fill: '#22c55e', stroke: '#16a34a', text: '#86efac', dark: '#052e16' },
  bottleneck:  { fill: '#f87171', stroke: '#dc2626', text: '#fca5a5', dark: '#450a0a' },
  copypaste:   { fill: '#60a5fa', stroke: '#2563eb', text: '#93c5fd', dark: '#172554' },
  default:     { fill: '#64748b', stroke: '#475569', text: '#cbd5e1', dark: '#1e293b' },
} as const;
type ColorKey = keyof typeof COLORS;

/* ── types ────────────────────────────────────────────────────── */
interface SNode {
  id: string;
  label: string;
  freq: number;
  level: number;
  color: ColorKey;
  x: number;
  y: number;
  height: number;
  outOffset: number;
  inOffset: number;
}

interface SEdge {
  idx: number;
  source: string;
  target: string;
  weight: number;
  w: number;       // display stroke width
  srcY: number;    // center-y of edge at source right side
  tgtY: number;    // center-y of edge at target left side
  srcColor: ColorKey;
}

/* ── helpers ─────────────────────────────────────────────────── */
function isClean(s: string): boolean {
  if (!s || s.length > 52) return false;
  if (s.includes('://') || s.toLowerCase().includes('http')) return false;
  if (s.includes('?') && s.includes('=')) return false;
  if ((s.match(/\//g) ?? []).length > 1) return false;
  if (/^[0-9a-f]{8,}$/i.test(s)) return false;
  return true;
}

function colorOf(name: string, pipeline: PipelineOutput, recs: Recommendation[] | null): ColorKey {
  const l = name.toLowerCase();
  const isBot = pipeline.bottlenecks.some(
    b => (b.severity === 'critical' || b.severity === 'high') &&
         (b.from_activity.toLowerCase() === l || b.to_activity.toLowerCase() === l)
  );
  const isAuto = (recs ?? []).some(
    r => (r.type === 'automate' || r.automation_type) && r.target.toLowerCase() === l
  );
  const isCopy = pipeline.activities.some(
    a => a.name.toLowerCase() === l && (a.copy_paste_count ?? 0) > 2
  );
  if (isAuto) return 'automation';
  if (isBot)  return 'bottleneck';
  if (isCopy) return 'copypaste';
  return 'default';
}

/* ── layout ──────────────────────────────────────────────────── */
function buildSankey(pipeline: PipelineOutput, recs: Recommendation[] | null) {
  const pm = pipeline.process_map;
  if (!pm?.nodes?.length || !pm.edges?.length) return null;

  /* 1 – top N clean nodes */
  const top = [...pm.nodes]
    .filter(n => isClean(n.label ?? n.id))
    .sort((a, b) => (b.frequency ?? 0) - (a.frequency ?? 0))
    .slice(0, MAX_NODES);
  const idSet = new Set(top.map(n => n.id));

  /* 2 – filter edges (forward only in later step) */
  const rawEdges = pm.edges.filter(
    e => idSet.has(e.source) && idSet.has(e.target) && e.source !== e.target
  );

  /* 3 – assign levels (BFS longest-path) */
  const inDeg = new Map<string, number>();
  const outAdj = new Map<string, string[]>();
  for (const id of idSet) { inDeg.set(id, 0); outAdj.set(id, []); }
  for (const e of rawEdges) {
    inDeg.set(e.target, (inDeg.get(e.target) ?? 0) + 1);
    outAdj.get(e.source)?.push(e.target);
  }
  const lvl = new Map<string, number>();
  const sources = top.filter(n => (inDeg.get(n.id) ?? 0) === 0).map(n => n.id);
  if (!sources.length) sources.push(top[0].id);
  for (const s of sources) lvl.set(s, 0);
  const visitCount = new Map<string, number>();
  const q = [...sources];
  while (q.length) {
    const cur = q.shift()!;
    const visits = (visitCount.get(cur) ?? 0) + 1;
    visitCount.set(cur, visits);
    if (visits > MAX_NODES) continue;  // cycle guard
    const cl = lvl.get(cur) ?? 0;
    for (const nxt of (outAdj.get(cur) ?? [])) {
      if ((lvl.get(nxt) ?? -1) < cl + 1) { lvl.set(nxt, cl + 1); q.push(nxt); }
    }
  }
  const maxLvl = Math.max(...Array.from(lvl.values()), 0);
  for (const n of top) if (!lvl.has(n.id)) lvl.set(n.id, maxLvl + 1);

  /* 4 – group by level, sort by freq desc */
  const byLvl = new Map<number, typeof top>();
  for (const n of top) {
    const l = lvl.get(n.id) ?? 0;
    if (!byLvl.has(l)) byLvl.set(l, []);
    byLvl.get(l)!.push(n);
  }
  for (const arr of byLvl.values()) arr.sort((a, b) => (b.frequency ?? 0) - (a.frequency ?? 0));

  /* 5 – node heights */
  const maxFreq = Math.max(...top.map(n => n.frequency ?? 0), 1);
  const nodeH = (f: number) => MIN_NODE_H + (f / maxFreq) * (MAX_NODE_H - MIN_NODE_H);

  /* 6 – position nodes (vertically centered per column) */
  const sNodes = new Map<string, SNode>();
  for (const [l, nodes] of byLvl) {
    const totalH = nodes.reduce((s, n) => s + nodeH(n.frequency ?? 0), 0) + (nodes.length - 1) * V_GAP;
    let curY = ORIGIN_Y + Math.max(0, (MAX_NODE_H * 2 - totalH) / 2);
    for (const n of nodes) {
      const h = nodeH(n.frequency ?? 0);
      sNodes.set(n.id, {
        id: n.id,
        label: n.label ?? n.id,
        freq: n.frequency ?? 0,
        level: l,
        color: colorOf(n.label ?? n.id, pipeline, recs),
        x: ORIGIN_X + l * COL_STEP,
        y: curY,
        height: h,
        outOffset: 0,
        inOffset: 0,
      });
      curY += h + V_GAP;
    }
  }

  /* 7 – build edges (skip back-edges where target.level <= source.level) */
  const outSum = new Map<string, number>();
  const inSum  = new Map<string, number>();
  for (const e of rawEdges) {
    const src = sNodes.get(e.source);
    const tgt = sNodes.get(e.target);
    if (!src || !tgt || tgt.level <= src.level) continue;
    outSum.set(e.source, (outSum.get(e.source) ?? 0) + e.weight);
    inSum.set(e.target,  (inSum.get(e.target)  ?? 0) + e.weight);
  }

  const forward = rawEdges
    .filter(e => {
      const src = sNodes.get(e.source), tgt = sNodes.get(e.target);
      return src && tgt && tgt.level > src.level;
    })
    .sort((a, b) => b.weight - a.weight);

  const sEdges: SEdge[] = [];
  for (let idx = 0; idx < forward.length; idx++) {
    const e = forward[idx];
    const src = sNodes.get(e.source)!;
    const tgt = sNodes.get(e.target)!;
    const wSrc = (e.weight / (outSum.get(e.source) ?? 1)) * src.height;
    const wTgt = (e.weight / (inSum.get(e.target)  ?? 1)) * tgt.height;
    const w = Math.max(Math.min(wSrc, wTgt, MAX_EDGE_W), MIN_EDGE_W);

    sEdges.push({
      idx,
      source: e.source,
      target: e.target,
      weight: e.weight,
      w,
      srcY: src.y + src.outOffset + w / 2,
      tgtY: tgt.y + tgt.inOffset  + w / 2,
      srcColor: src.color,
    });
    src.outOffset += w;
    tgt.inOffset  += w;
  }

  /* 8 – canvas size */
  const numLvl = Math.max(...Array.from(lvl.values()), 0) + 1;
  const canvasW = ORIGIN_X + numLvl * COL_STEP + 200; // extra for labels
  const maxY = Math.max(...Array.from(sNodes.values()).map(n => n.y + n.height), 200);
  const canvasH = maxY + CANVAS_PAD;

  return { sNodes: Array.from(sNodes.values()), sEdges, canvasW, canvasH };
}

/* ── SVG components ──────────────────────────────────────────── */
function Edge({ e, nodeMap }: { e: SEdge; nodeMap: Map<string, SNode> }) {
  const src = nodeMap.get(e.source)!;
  const tgt = nodeMap.get(e.target)!;
  const x0 = src.x + NODE_W, y0 = e.srcY;
  const x1 = tgt.x,          y1 = e.tgtY;
  const cx = x0 + (x1 - x0) * 0.5;
  const gid = `sg${e.idx}`;
  const srcFill = COLORS[e.srcColor].fill;
  const tgtFill = COLORS[tgt.color].fill;

  return (
    <>
      <defs>
        <linearGradient id={gid} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%"   stopColor={srcFill} stopOpacity={0.55} />
          <stop offset="100%" stopColor={tgtFill} stopOpacity={0.25} />
        </linearGradient>
      </defs>
      <path
        d={`M${x0},${y0} C${cx},${y0} ${cx},${y1} ${x1},${y1}`}
        fill="none"
        stroke={`url(#${gid})`}
        strokeWidth={e.w}
      />
    </>
  );
}

function Node({ n, hovered, onHover }: { n: SNode; hovered: boolean; onHover: (id: string | null) => void }) {
  const c = COLORS[n.color];
  const freq = n.freq >= 1000 ? `${(n.freq / 1000).toFixed(0)}k` : String(n.freq);
  const label = n.label.length > 24 ? n.label.slice(0, 23) + '…' : n.label;
  const midY = n.y + n.height / 2;

  return (
    <g
      onMouseEnter={() => onHover(n.id)}
      onMouseLeave={() => onHover(null)}
      style={{ cursor: 'default' }}
    >
      {/* glow when hovered */}
      {hovered && (
        <rect x={n.x - 4} y={n.y - 4} width={NODE_W + 8} height={n.height + 8}
          rx={5} fill={c.fill} opacity={0.2} />
      )}
      {/* bar */}
      <rect x={n.x} y={n.y} width={NODE_W} height={n.height}
        rx={3} fill={c.fill} stroke={c.stroke} strokeWidth={1.5}
        opacity={hovered ? 1 : 0.85} />
      {/* freq label inside bar (only if tall enough) */}
      {n.height >= 44 && (
        <text x={n.x + NODE_W / 2} y={midY + 4}
          textAnchor="middle" fill="#fff" fontSize={8.5}
          fontWeight={700} fontFamily="system-ui,sans-serif" opacity={0.8}>
          ×{freq}
        </text>
      )}
      {/* activity name (right of bar) */}
      <text x={n.x + NODE_W + LABEL_PAD} y={midY + 4}
        fill={hovered ? c.fill : c.text}
        fontSize={11} fontWeight={600} fontFamily="system-ui,sans-serif">
        {label}
      </text>
      {/* tooltip on hover */}
      {hovered && (
        <g>
          <rect x={n.x + NODE_W + LABEL_PAD - 4} y={n.y - 26}
            width={Math.min(label.length * 7 + 8, 220)} height={20}
            rx={4} fill={c.dark} stroke={c.stroke} strokeWidth={1} />
          <text x={n.x + NODE_W + LABEL_PAD} y={n.y - 12}
            fill={c.text} fontSize={9.5} fontFamily="system-ui,sans-serif">
            {n.label} · ×{n.freq.toLocaleString()}
          </text>
        </g>
      )}
    </g>
  );
}

/* ── public component ────────────────────────────────────────── */
export interface SankeyViewerProps {
  pipeline: PipelineOutput;
  recommendations: Recommendation[] | null;
}

export function SankeyViewer({ pipeline, recommendations }: SankeyViewerProps) {
  const [hovered, setHovered] = useState<string | null>(null);

  const result = useMemo(
    () => buildSankey(pipeline, recommendations),
    [pipeline, recommendations]
  );

  if (!result) {
    return (
      <div className="flex items-center justify-center h-40 text-white/40 text-sm">
        Brak danych procesu do wyświetlenia.
      </div>
    );
  }

  const { sNodes, sEdges, canvasW, canvasH } = result;
  const nodeMap = new Map(sNodes.map(n => [n.id, n]));

  return (
    <div className="w-full rounded-xl overflow-hidden border border-white/10 shadow-2xl shadow-black/60">
      {/* header */}
      <div className="flex items-center gap-2.5 px-4 py-2.5 bg-[#0d1017] border-b border-white/10">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
          <div className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
          <div className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
        </div>
        <span className="text-[11px] text-white/40 font-medium tracking-wide ml-1">
          Sankey — Process Flow
        </span>
        <span className="text-[10px] text-white/25 ml-2">
          grubość = liczba przejść · wysokość = łączna liczba zdarzeń
        </span>
        <div className="ml-auto">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-green-950/60 border border-green-700/40 text-[10px] font-semibold text-green-400">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            Live Data
          </span>
        </div>
      </div>

      {/* canvas */}
      <div className="overflow-x-auto overflow-y-auto max-h-[620px] bg-[#080b10]">
        <svg width={canvasW} height={canvasH} xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="sk-dots" x="0" y="0" width="28" height="28" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="1" fill="#ffffff08" />
            </pattern>
          </defs>
          <rect width={canvasW} height={canvasH} fill="url(#sk-dots)" />

          {/* edges behind nodes */}
          {sEdges.map(e => <Edge key={e.idx} e={e} nodeMap={nodeMap} />)}

          {/* nodes */}
          {sNodes.map(n => (
            <Node key={n.id} n={n} hovered={hovered === n.id} onHover={setHovered} />
          ))}
        </svg>
      </div>

      {/* legend */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3 bg-[#0a0d14] border-t border-white/10">
        <span className="text-[10px] font-bold uppercase tracking-widest text-white/30">Legenda</span>
        {(Object.entries(COLORS) as [ColorKey, typeof COLORS[ColorKey]][]).map(([key, c]) => (
          <div key={key} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: c.fill, border: `1.5px solid ${c.stroke}` }} />
            <span className="text-[11px] text-white/50">
              {key === 'automation' ? 'Kandydat do automatyzacji' :
               key === 'bottleneck'  ? 'Wąskie gardło' :
               key === 'copypaste'   ? 'Dużo copy-paste' : 'Krok manualny'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
