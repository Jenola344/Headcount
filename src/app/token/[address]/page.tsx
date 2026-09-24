'use client';

import { useEffect, useState, use } from 'react';
import type { TraceEvent } from '@engine/types';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, CheckCircle2, ShieldAlert, Cpu, Activity, Users, Database, Copy, Check, Terminal, ExternalLink, ShieldCheck } from 'lucide-react';

export default function TokenPage({ params }: { params: Promise<{ address: string }> }) {
  const { address } = use(params);
  const [events, setEvents] = useState<TraceEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isFinished, setIsFinished] = useState(false);
  const [narrative, setNarrative] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const eventSource = new EventSource(`/api/token/${address}`);
    
    eventSource.onmessage = (e) => {
      try {
        const event: TraceEvent = JSON.parse(e.data);
        setEvents((prev) => [...prev, event]);
        
        if (event.type === 'ERROR') {
          setError(String(event.data.message));
          eventSource.close();
          setIsFinished(true);
        } else if (event.type === 'RECEIPT') {
          eventSource.close();
          setIsFinished(true);
          fetch(`/api/token/${address}`, { headers: { 'Accept': 'application/json' } })
            .then(res => res.json())
            .then(data => {
              if (data.narration) setNarrative(data.narration);
            })
            .catch(err => console.error('Failed to fetch full output', err));
        } else if (event.type === 'REFUSAL') {
          eventSource.close();
          setIsFinished(true);
        }
      } catch (err) {
        console.error('Failed to parse SSE data', err);
      }
    };

    eventSource.onerror = (e) => {
      console.error('SSE Error', e);
      setError('Connection lost while streaming results.');
      eventSource.close();
      setIsFinished(true);
    };

    return () => {
      eventSource.close();
    };
  }, [address]);

  const verdictEvent = events.find(e => e.type === 'VERDICT');
  const refusalEvent = events.find(e => e.type === 'REFUSAL');
  const receiptEvent = events.find(e => e.type === 'RECEIPT');
  const openEvent = events.find(e => e.type === 'RUN_OPENED');
  const fundingEvent = events.find(e => e.type === 'FUNDING');
  const tokenData = openEvent?.data.token;
  const tokenName = tokenData && typeof tokenData === 'object' && 'name' in tokenData && typeof tokenData.name === 'string'
    ? tokenData.name
    : `Token ${address.slice(0, 10)}…`;
  const tokenSymbol = tokenData && typeof tokenData === 'object' && 'symbol' in tokenData && typeof tokenData.symbol === 'string'
    ? tokenData.symbol
    : null;

  const copyAddress = () => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getVerdictStyle = (verdict: string) => {
    switch (verdict) {
      case 'ORGANIC':
        return 'text-[#14F195] border-[#14F195]/40 bg-[#14F195]/10 shadow-[0_0_25px_rgba(20,241,149,0.2)]';
      case 'CONCENTRATED':
        return 'text-[#F59E0B] border-[#F59E0B]/40 bg-[#F59E0B]/10 shadow-[0_0_25px_rgba(245,158,11,0.2)]';
      case 'MANUFACTURED':
        return 'text-[#EF4444] border-[#EF4444]/40 bg-[#EF4444]/10 shadow-[0_0_25px_rgba(239,68,68,0.2)]';
      default:
        return 'text-gray-400 border-gray-500/30 bg-gray-500/10';
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 pt-2 pb-20">
      
      {/* Back Button */}
      <Link href="/" className="inline-flex items-center gap-2 font-mono text-xs text-gray-400 hover:text-white transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" /> &larr; Return to Token Scan
      </Link>
      
      {/* Header Info Bar */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-[#1E2030] pb-6 gap-6 bg-[#0E0F17] p-6 rounded-2xl border">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-extrabold tracking-tight text-white font-heading">
              {openEvent ? tokenName : 'Scanning Token...'}
            </h1>
            {openEvent && (
              <span className="px-2.5 py-0.5 rounded bg-[#181A28] border border-[#2B2E46] text-xs font-mono font-bold text-gray-300">
                {tokenSymbol
                  ? `$${tokenSymbol}`
                  : `${address.slice(0, 8)}…`}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs font-mono text-gray-400">
            <span className="truncate max-w-sm sm:max-w-md">{address}</span>
            <button 
              onClick={copyAddress}
              className="p-1 hover:text-white rounded bg-[#161824] border border-[#232638] transition-colors"
              title="Copy Address"
            >
              {copied ? <Check className="w-3 h-3 text-[#14F195]" /> : <Copy className="w-3 h-3" />}
            </button>
            <a 
              href={`https://basescan.org/token/${address}`} 
              target="_blank" 
              rel="noreferrer" 
              className="p-1 hover:text-[#14F195] rounded bg-[#161824] border border-[#232638] transition-colors"
              title="View on Basescan"
            >
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
        
        {/* Verdict Badge */}
        <AnimatePresence>
          {verdictEvent && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`px-6 py-2.5 rounded-xl border font-mono font-black tracking-widest text-base uppercase ${getVerdictStyle(String(verdictEvent.data.verdict))}`}
            >
              {String(verdictEvent.data.verdict)}
            </motion.div>
          )}
          {refusalEvent && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`px-6 py-2.5 rounded-xl border font-mono font-black tracking-widest text-base uppercase ${getVerdictStyle('UNVERIFIABLE')}`}
            >
              UNVERIFIABLE
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Error Alert */}
      {error && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-2xl p-6 flex items-start gap-4 text-[#EF4444]">
          <ShieldAlert className="w-6 h-6 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-bold text-base mb-1">Analysis Stream Interrupted</h3>
            <p className="font-mono text-xs opacity-90">{error}</p>
          </div>
        </motion.div>
      )}

      {/* AI Forensics Narrative Box */}
      <AnimatePresence>
        {narrative && (
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative overflow-hidden bg-gradient-to-br from-[#1A0B2E] to-[#0D1527] border border-[#9945FF]/40 rounded-2xl p-6 shadow-2xl"
          >
            <div className="absolute top-0 right-0 p-8 opacity-5">
              <Cpu className="w-32 h-32 text-[#9945FF]" />
            </div>
            <div className="relative z-10 space-y-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-[#9945FF]/20 rounded-lg border border-[#9945FF]/40">
                  <Cpu className="w-4 h-4 text-[#A855F7]" />
                </div>
                <h2 className="text-xs font-mono font-bold text-[#A855F7] tracking-wider uppercase">AI Forensics Diagnosis</h2>
              </div>
              <p className="text-lg text-gray-200 leading-relaxed font-medium">
                {narrative}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats Cards Grid */}
      <AnimatePresence>
        {fundingEvent && (
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
          >
            <div className="bg-[#10111A] border border-[#202334] rounded-2xl p-6 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><Users className="w-16 h-16 text-[#14F195]" /></div>
              <div className="text-gray-400 font-mono text-xs uppercase tracking-wider mb-2">Effective Holders</div>
              <div className="text-4xl font-extrabold text-white font-mono">{String(fundingEvent.data.effective_holders)}</div>
              <div className="text-xs text-gray-500 mt-2 font-mono">Independent funding origins</div>
            </div>
            
            <div className="bg-[#10111A] border border-[#202334] rounded-2xl p-6 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><Activity className="w-16 h-16 text-[#00F0FF]" /></div>
              <div className="text-gray-400 font-mono text-xs uppercase tracking-wider mb-2">Independence Ratio</div>
              <div className="text-4xl font-extrabold text-[#14F195] font-mono">{(Number(fundingEvent.data.independence_ratio) * 100).toFixed(1)}%</div>
              <div className="text-xs text-gray-500 mt-2 font-mono">Effective / Analyzed Cap</div>
            </div>
            
            <div className="bg-[#10111A] border border-[#202334] rounded-2xl p-6 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><Database className="w-16 h-16 text-[#9945FF]" /></div>
              <div className="text-gray-400 font-mono text-xs uppercase tracking-wider mb-2">Sybil Clusters</div>
              <div className="text-4xl font-extrabold text-white font-mono">{String(fundingEvent.data.clusters)}</div>
              <div className="text-xs text-gray-500 mt-2 font-mono">Collapsed funding rings</div>
            </div>

            <div className="bg-[#10111A] border border-[#202334] rounded-2xl p-6 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><ShieldCheck className="w-16 h-16 text-[#14F195]" /></div>
              <div className="text-gray-400 font-mono text-xs uppercase tracking-wider mb-2">Excluded Infra</div>
              <div className="text-4xl font-extrabold text-white font-mono">{String(fundingEvent.data.infra_funded)}</div>
              <div className="text-xs text-gray-500 mt-2 font-mono">CEX/Bridge origins (ignored)</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Terminal Live Trace Window */}
      <div className="bg-[#090A0F] border border-[#202334] rounded-2xl overflow-hidden shadow-2xl">
        
        {/* Terminal Header */}
        <div className="bg-[#0D0E15] border-b border-[#1E2030] px-5 py-3.5 flex justify-between items-center">
          <div className="flex items-center gap-3 font-mono text-xs font-semibold text-gray-300">
            <Terminal className="w-4 h-4 text-[#14F195]" />
            {!isFinished ? (
              <span className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#14F195] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#14F195]"></span>
                </span>
                <span className="text-[#14F195]">Live Forensics Trace Streaming...</span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-gray-400">
                <CheckCircle2 className="w-4 h-4 text-[#14F195]" /> Execution Completed
              </span>
            )}
          </div>

          {receiptEvent && (
            <Link 
              href="/verify" 
              className="flex items-center gap-1.5 font-mono text-xs font-bold text-[#14F195] bg-[#14F195]/10 border border-[#14F195]/30 px-3 py-1 rounded-lg hover:bg-[#14F195]/20 transition-colors"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              Verify SHA-256 Receipt &rarr;
            </Link>
          )}
        </div>

        {/* Console Log Area */}
        <div className="p-5 font-mono text-xs text-gray-300 h-[380px] overflow-y-auto space-y-3 bg-[#08090D]">
          {events.map((e, i) => (
            <motion.div 
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              key={i} 
              className="flex items-start gap-3 border-l-2 pl-3 py-1 leading-relaxed"
              style={{ borderLeftColor: e.type === 'ERROR' ? '#ef4444' : e.type === 'VERDICT' ? '#14F195' : '#9945FF' }}
            >
              <span className="text-gray-500 shrink-0">{new Date(e.timestamp).toISOString().split('T')[1].replace('Z', '')}</span>
              <span className={`font-bold shrink-0 ${e.type === 'ERROR' ? 'text-red-400' : e.type === 'VERDICT' ? 'text-[#14F195]' : 'text-[#00F0FF]'}`}>
                [{e.type}]
              </span>
              <span className="text-gray-300 break-all flex-1">
                {JSON.stringify(e.data)}
              </span>
            </motion.div>
          ))}

          {!isFinished && (
            <div className="flex items-center gap-3 animate-pulse pt-2 text-gray-500">
              <span className="w-20">--:--:--</span>
              <span className="text-gray-600">[AWAIT]</span>
              <span>Executing stage pipeline...</span>
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
