'use client';

import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';

export type Verdict = 'ORGANIC' | 'CONCENTRATED' | 'MANUFACTURED' | 'UNVERIFIABLE';
export type Status = 'analysing' | 'queued' | 'complete';

export interface CaseCardData {
  address: string;
  tag?: string;
  status: Status;
  verdict?: Verdict | null;
  summary?: string;
  current_probe?: string | null;
  updated_at?: string;
}

function VerdictPill({ status, verdict }: { status: Status; verdict?: Verdict | null }) {
  if (status === 'analysing') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[11px] uppercase tracking-wider rounded font-mono font-bold pill-live">
        <span className="w-1.5 h-1.5 rounded-full bg-green pulse inline-block" />
        Analysing
      </span>
    );
  }
  if (status === 'queued') {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 text-[11px] uppercase tracking-wider rounded font-mono font-bold pill-queued">
        Queued
      </span>
    );
  }
  const map: Record<Verdict, { label: string; cls: string }> = {
    ORGANIC:      { label: 'Organic',      cls: 'pill-organic' },
    CONCENTRATED: { label: 'Concentrated', cls: 'pill-conc' },
    MANUFACTURED: { label: 'Manufactured', cls: 'pill-man' },
    UNVERIFIABLE: { label: 'Unverifiable', cls: 'pill-unv' },
  };
  const cfg = verdict ? map[verdict] : map.UNVERIFIABLE;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 text-[11px] uppercase tracking-wider rounded font-mono font-bold ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

export default function TokenCard({
  address,
  tag = '#base-erc20',
  status,
  verdict,
  summary,
  current_probe,
}: CaseCardData) {
  const short = `${address.slice(0, 6)}…${address.slice(-4)}`;

  return (
    <Link href={`/token/${address}`}>
      <div className="group relative flex flex-col justify-between h-full bg-panel border border-line rounded-2xl p-6 hover:border-green/30 hover:bg-panel-2 transition-all duration-300 shadow-xl overflow-hidden min-h-[200px]">
        
        {/* Ambient glow on hover */}
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-24 h-24 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-all" style={{ background: 'radial-gradient(circle, rgba(55,226,154,0.08) 0%, transparent 70%)' }} />

        <div className="flex-1">
          {/* Top row */}
          <div className="flex items-center justify-between mb-4">
            <VerdictPill status={status} verdict={verdict} />
            <span className="font-mono text-xs text-text-faint">{tag}</span>
          </div>

          {/* Address */}
          <div className="mb-3">
            <h3 className="text-sm font-mono text-text-muted group-hover:text-text transition-colors tracking-tight">
              {short}
            </h3>
          </div>

          {/* Summary / probe hint */}
          <p className="text-sm text-text-muted line-clamp-3 leading-relaxed">
            {status === 'analysing' && current_probe
              ? `Running probe: ${current_probe}…`
              : summary || `Forensics audit pending for ${short}`}
          </p>
        </div>

        {/* Bottom action link */}
        <div className="mt-4 pt-4 border-t border-line-soft flex items-center justify-between text-xs font-mono">
          <span className="text-text-faint truncate max-w-[180px]">{address}</span>
          <span className="inline-flex items-center gap-1 font-bold text-green group-hover:translate-x-0.5 transition-transform">
            View <ArrowUpRight className="w-3.5 h-3.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}
