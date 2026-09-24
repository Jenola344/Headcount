import Link from 'next/link';
import * as fs from 'fs';
import * as path from 'path';
import type { RunOutput } from '@engine/types';
import { resolveMetadata } from '@engine/types';
import TokenCard from '@/components/TokenCard';
import { ShieldCheck, ArrowRight, Layers, Terminal } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function FindingsPage() {
  const cataloguePath = path.join(process.cwd(), 'logs', 'catalogue.jsonl');
  let runs: RunOutput[] = [];
  
  try {
    if (fs.existsSync(cataloguePath)) {
      const content = fs.readFileSync(cataloguePath, 'utf8');
      runs = content.trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
    }
  } catch (err) {
    console.error('Failed to read catalogue', err);
  }

  const total = runs.length;
  let organic = 0;
  let concentrated = 0;
  let manufactured = 0;
  let unverifiable = 0;

  for (const run of runs) {
    if (run.verdict.verdict === 'ORGANIC') organic++;
    else if (run.verdict.verdict === 'CONCENTRATED') concentrated++;
    else if (run.verdict.verdict === 'MANUFACTURED') manufactured++;
    else if (run.verdict.verdict === 'UNVERIFIABLE') unverifiable++;
  }

  return (
    <div className="space-y-10 pt-2 pb-16">
      
      {/* Header */}
      <div className="border-b border-[#1E2030] pb-6 space-y-3">
        <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-[#14F195]">
          <Terminal className="w-4 h-4" />
          <span>AUDIT CATALOGUE</span>
          <span>·</span>
          <span className="text-gray-400">VERIFIABLE RUNS ({total})</span>
        </div>

        <h1 className="text-4xl font-extrabold text-white font-heading tracking-tight">
          Findings & Forensics Catalogue
        </h1>

        <p className="text-gray-400 text-sm max-w-3xl leading-relaxed">
          Transparent record of deterministic background scans. Includes sybil ring breakdown, holder birth dispersion metrics, and cryptographic receipts.
        </p>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="ORGANIC" value={organic} total={total} color="text-[#14F195]" border="border-[#14F195]/30" bg="bg-[#14F195]/10" />
        <StatCard label="CONCENTRATED" value={concentrated} total={total} color="text-[#F59E0B]" border="border-[#F59E0B]/30" bg="bg-[#F59E0B]/10" />
        <StatCard label="MANUFACTURED" value={manufactured} total={total} color="text-[#EF4444]" border="border-[#EF4444]/30" bg="bg-[#EF4444]/10" />
        <StatCard label="UNVERIFIABLE" value={unverifiable} total={total} color="text-gray-400" border="border-gray-500/30" bg="bg-gray-500/10" />
      </div>

      {total === 0 ? (
        <div className="bg-[#10111A] border border-[#202334] rounded-2xl p-12 text-center space-y-4">
          <div className="inline-flex p-4 rounded-2xl bg-[#181A28] border border-[#2B2E46]">
            <ShieldCheck className="w-8 h-8 text-[#14F195]" />
          </div>
          <h3 className="text-lg font-bold text-white">No Catalogue Scans Yet</h3>
          <p className="text-xs font-mono text-gray-400 max-w-md mx-auto">
            Background sweeps populate this catalogue. Try running an on-demand scan from the home page.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white text-black font-extrabold text-xs font-mono uppercase hover:bg-[#14F195] transition-colors"
          >
            Launch First Scan &rarr;
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {runs.map((run, i) => {
            const symbol = resolveMetadata(run.context.token.symbol, run.context.token.address);
            const name = resolveMetadata(run.context.token.name, run.context.token.address);
            return (
              <TokenCard
                key={i}
                address={run.context.token.address}
                status="complete"
                verdict={run.verdict.verdict as any}
                tag={`#${typeof symbol === 'string' ? symbol.toLowerCase() : run.context.token.address.slice(0, 10)}`}
                summary={run.narration || `Deterministic audit run executed for ${name}`}
              />
            );
          })}
        </div>
      )}

    </div>
  );
}

function StatCard({ label, value, total, color, border, bg }: { label: string; value: number; total: number; color: string; border: string; bg: string }) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div className={`border ${border} ${bg} rounded-2xl p-4 font-mono`}>
      <div className={`text-[11px] font-bold tracking-wider mb-1 ${color}`}>{label}</div>
      <div className="text-3xl font-extrabold text-white">{value}</div>
      <div className="text-[11px] text-gray-400 mt-1">{pct.toFixed(0)}% of scanned</div>
    </div>
  );
}
