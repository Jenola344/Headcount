'use client';

import { useState, useEffect } from 'react';
import SearchSection from '@/components/SearchSection';
import FilterTabs from '@/components/FilterTabs';
import TokenCard, { CaseCardData } from '@/components/TokenCard';
import { Terminal } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Home() {
  const [activeTab, setActiveTab] = useState('all');
  const [cases, setCases] = useState<CaseCardData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch('/api/cases')
      .then(res => res.json())
      .then(data => {
        setCases(data.cases || []);
        setIsLoading(false);
      })
      .catch(err => {
        console.error(err);
        setIsLoading(false);
      });
  }, []);

  const filtered = cases.filter((c) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'organic') return c.verdict === 'ORGANIC';
    if (activeTab === 'concentrated') return c.verdict === 'CONCENTRATED';
    if (activeTab === 'manufactured') return c.verdict === 'MANUFACTURED';
    if (activeTab === 'analysing') return c.status === 'analysing';
    return true;
  });

  const count = (fn: (c: CaseCardData) => boolean) => cases.filter(fn).length;

  const filterTabs = [
    { id: 'all',          label: 'All',          count: cases.length },
    { id: 'organic',      label: 'Organic',      count: count(c => c.verdict === 'ORGANIC') },
    { id: 'concentrated', label: 'Concentrated', count: count(c => c.verdict === 'CONCENTRATED') },
    { id: 'manufactured', label: 'Manufactured', count: count(c => c.verdict === 'MANUFACTURED') },
    { id: 'analysing',    label: 'Live',         count: count(c => c.status === 'analysing') },
  ];

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      className="space-y-12"
    >
      <SearchSection />

      <div className="space-y-6">
        <FilterTabs tabs={filterTabs} activeTab={activeTab} onChange={setActiveTab} />

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 border border-line rounded-2xl bg-panel text-center gap-4">
            <span className="text-4xl animate-pulse">⏳</span>
            <p className="text-text-muted font-mono text-sm">Loading recent runs...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 border border-line rounded-2xl bg-panel text-center gap-4">
            <span className="text-4xl">🔍</span>
            <p className="text-text-muted font-mono text-sm">No cases match this filter yet.</p>
            <p className="text-text-faint font-mono text-xs">Paste an address above to run the first check.</p>
          </div>
        ) : (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ staggerChildren: 0.1 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            <AnimatePresence>
              {filtered.map((c, i) => (
                <motion.div
                  key={c.address}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.4, delay: i * 0.05 }}
                >
                  <TokenCard {...c} />
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
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
            <motion.div 
              key={i} 
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="bg-panel/60 backdrop-blur-sm border border-line p-6 rounded-2xl group hover:border-green/30 hover:shadow-[0_0_20px_rgba(55,226,154,0.1)] transition-all"
            >
              <span className="font-mono text-[10px] font-bold tracking-wider text-text-faint bg-panel-2 px-2 py-1 rounded border border-line mb-4 inline-block group-hover:text-green/70 transition-colors">
                {s.step}
              </span>
              <h3 className="text-lg font-bold text-text mb-2 group-hover:text-green transition-colors font-heading">
                {s.title}
              </h3>
              <p className="text-xs text-text-muted leading-relaxed">{s.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
