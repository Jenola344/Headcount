'use client';

import { useState } from 'react';
import SearchSection from '@/components/SearchSection';
import FilterTabs from '@/components/FilterTabs';
import TokenCard, { CaseCardData } from '@/components/TokenCard';
import { Terminal } from 'lucide-react';

const MOCK_CASES: CaseCardData[] = [
  {
    address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    tag: '#stablecoin',
    status: 'complete',
    verdict: 'ORGANIC',
    summary: '142,050 effective holders. Independence ratio 99.8%. Fully dispersed institutional and retail liquidity.',
    updated_at: '2026-09-24T10:02:11Z',
  },
  {
    address: '0x940181a94A35A4569E4529A3CDfB74e38FD98631',
    tag: '#dex-protocol',
    status: 'complete',
    verdict: 'ORGANIC',
    summary: '42,100 effective holders. High retail dispersion across AMM LPs and veAERO lockers.',
    updated_at: '2026-09-24T09:41:05Z',
  },
  {
    address: '0x4ed4E862860bed51a9570b96d89af5E1B0Efefed',
    tag: '#social-tipping',
    status: 'complete',
    verdict: 'ORGANIC',
    summary: '68,400 effective holders. Organic community distribution via Farcaster tipping networks.',
    updated_at: '2026-09-24T08:15:33Z',
  },
  {
    address: '0xAC1Bd2447a101b00EA8A2078446CDed1a713b947',
    tag: '#meme-token',
    status: 'complete',
    verdict: 'CONCENTRATED',
    summary: '18,200 effective holders. Moderate wallet cluster overlap detected among top 250 LPs.',
    updated_at: '2026-09-23T22:07:18Z',
  },
  {
    address: '0x0000000000000000000000000000000000000001',
    tag: '#sybil-ring',
    status: 'complete',
    verdict: 'MANUFACTURED',
    summary: '24 effective holders behind a claim of 4,200. One funder, 61 wallets.',
    updated_at: '2026-09-23T19:55:00Z',
  },
  {
    address: '0x1234567890abcdef1234567890abcdef12345678',
    tag: '#new-launch',
    status: 'analysing',
    verdict: null,
    current_probe: 'FUNDING_GRAPH',
    updated_at: '2026-09-24T10:05:00Z',
  },
];

export default function Home() {
  const [activeTab, setActiveTab] = useState('all');

  const filtered = MOCK_CASES.filter((c) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'organic') return c.verdict === 'ORGANIC';
    if (activeTab === 'concentrated') return c.verdict === 'CONCENTRATED';
    if (activeTab === 'manufactured') return c.verdict === 'MANUFACTURED';
    if (activeTab === 'analysing') return c.status === 'analysing';
    return true;
  });

  const count = (fn: (c: CaseCardData) => boolean) => MOCK_CASES.filter(fn).length;

  const filterTabs = [
    { id: 'all',          label: 'All',          count: MOCK_CASES.length },
    { id: 'organic',      label: 'Organic',      count: count(c => c.verdict === 'ORGANIC') },
    { id: 'concentrated', label: 'Concentrated', count: count(c => c.verdict === 'CONCENTRATED') },
    { id: 'manufactured', label: 'Manufactured', count: count(c => c.verdict === 'MANUFACTURED') },
    { id: 'analysing',    label: 'Live',         count: count(c => c.status === 'analysing') },
  ];

  return (
    <div className="space-y-12">
      <SearchSection />

      <div className="space-y-6">
        <FilterTabs tabs={filterTabs} activeTab={activeTab} onChange={setActiveTab} />

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 border border-line rounded-2xl bg-panel text-center gap-4">
            <span className="text-4xl">🔍</span>
            <p className="text-text-muted font-mono text-sm">No cases match this filter yet.</p>
            <p className="text-text-faint font-mono text-xs">Paste an address above to run the first check.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((c) => (
              <TokenCard key={c.address} {...c} />
            ))}
          </div>
        )}
      </div>

      <div className="mt-20 pt-12 border-t border-line space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-green mb-2">
              <Terminal className="w-4 h-4" />
              <span>DETERMINISTIC PIPELINE</span>
            </div>
            <h2 className="text-3xl font-extrabold text-text font-heading">
              7-Stage Forensics Engine
            </h2>
          </div>
          <p className="text-sm font-mono text-text-muted max-w-md">
            Unbiased on-chain analysis replacing vanity holder metrics with cryptographic truth.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { step: 'STAGE 01', title: 'Deep On-Chain Scan',     desc: 'Ingests all raw Transfer logs from genesis. Builds total holder state bypassing third-party aggregated APIs.' },
            { step: 'STAGE 02', title: 'Funding Graph Tracing',  desc: 'Traces ETH and stablecoin origin for top holders up to 3 hops to identify common parent entities.' },
            { step: 'STAGE 03', title: 'Sybil & CEX Collapsing', desc: 'Identifies exchange hot wallets and collapses sybil rings funded by single dispatches into unified clusters.' },
            { step: 'STAGE 04', title: 'SHA-256 Proof Receipt',  desc: 'Generates a deterministic SHA-256 evidence digest cryptographically guaranteeing audit verifiability.' },
          ].map((s, i) => (
            <div key={i} className="bg-panel border border-line p-6 rounded-2xl group hover:border-green/30 transition-colors">
              <span className="font-mono text-[10px] font-bold tracking-wider text-text-faint bg-panel-2 px-2 py-1 rounded border border-line mb-4 inline-block">
                {s.step}
              </span>
              <h3 className="text-lg font-bold text-text mb-2 group-hover:text-green transition-colors font-heading">
                {s.title}
              </h3>
              <p className="text-xs text-text-muted leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
