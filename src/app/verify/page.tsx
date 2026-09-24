'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ShieldCheck, ShieldAlert, ArrowLeft, FileCode, CheckCircle2, XCircle } from 'lucide-react';
import { motion } from 'framer-motion';

export default function VerifyPage() {
  const [jsonInput, setJsonInput] = useState('');
  const [result, setResult] = useState<{ match: boolean; expected: string; computed: string } | null>(null);
  const [error, setError] = useState<string | null>(null);


  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);

    try {
      const parsed = JSON.parse(jsonInput);
      if (!parsed.hash || !parsed.canonical) {
        throw new Error('Invalid receipt format. Receipt JSON must contain "hash" and "canonical" fields.');
      }

      const encoder = new TextEncoder();
      const data = encoder.encode(typeof parsed.canonical === 'object' ? JSON.stringify(parsed.canonical) : parsed.canonical);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const computedHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      setResult({
        match: computedHash === parsed.hash,
        expected: parsed.hash,
        computed: computedHash,
      });

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse JSON receipt.');
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 pt-2 pb-16">
      
      {/* Back Link */}
      <Link href="/" className="inline-flex items-center gap-2 font-mono text-xs text-gray-400 hover:text-white transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" /> &larr; Return to Home
      </Link>

      {/* Header */}
      <div className="space-y-3 border-b border-[#1E2030] pb-6">
        <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-[#14F195]">
          <ShieldCheck className="w-4 h-4" />
          <span>CRYPTOGRAPHIC VERIFIER</span>
        </div>

        <h1 className="text-4xl font-extrabold text-white font-heading tracking-tight">
          Verify SHA-256 Receipt
        </h1>

        <p className="text-gray-400 text-sm leading-relaxed">
          Paste a Headcount forensic receipt payload below. We recompute the SHA-256 cryptographic digest client-side 
          in your browser to independently prove the verdict output matching exact evidence logs.
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleVerify} className="space-y-4">
        <div className="flex items-center justify-between">
          <label className="font-mono text-xs text-gray-300 font-bold flex items-center gap-2">
            <FileCode className="w-4 h-4 text-[#00F0FF]" /> Receipt JSON Payload
          </label>
        </div>

        <textarea
          value={jsonInput}
          onChange={(e) => setJsonInput(e.target.value)}
          placeholder='{"hash": "e3b0c44...", "canonical": "{...}"}'
          className="w-full h-60 rounded-2xl bg-[#08090D] border border-[#202334] p-4 font-mono text-xs text-gray-200 focus:border-[#14F195] focus:outline-none transition-colors"
          required
        />

        <button
          type="submit"
          className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-white text-black font-extrabold font-mono text-sm uppercase hover:bg-[#14F195] transition-colors"
        >
          Recompute SHA-256 Hash &rarr;
        </button>
      </form>

      {/* Error Alert */}
      {error && (
        <div className="bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-2xl p-5 text-[#EF4444] font-mono text-xs">
          <div className="font-bold mb-1 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4" /> Verification Error
          </div>
          {error}
        </div>
      )}

      {/* Verification Result Card */}
      {result && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`border rounded-2xl p-6 ${
            result.match ? 'bg-[#14F195]/10 border-[#14F195]/40 shadow-[0_0_30px_rgba(20,241,149,0.15)]' : 'bg-[#EF4444]/10 border-[#EF4444]/40'
          }`}
        >
          <div className="flex items-center gap-3 mb-4">
            {result.match ? (
              <CheckCircle2 className="w-6 h-6 text-[#14F195]" />
            ) : (
              <XCircle className="w-6 h-6 text-[#EF4444]" />
            )}
            <h3 className={`font-bold text-xl font-heading ${result.match ? 'text-[#14F195]' : 'text-[#EF4444]'}`}>
              {result.match ? 'Cryptographic Hash Matches Perfectly' : 'Hash Mismatch Detected'}
            </h3>
          </div>
          
          <div className="space-y-4 font-mono text-xs break-all bg-[#08090D] p-4 rounded-xl border border-[#1E2030]">
            <div>
              <span className="text-gray-500 block text-[10px] uppercase tracking-wider mb-1">Expected Hash (From Receipt)</span>
              <span className="text-gray-200 font-bold">{result.expected}</span>
            </div>
            <div>
              <span className="text-gray-500 block text-[10px] uppercase tracking-wider mb-1">Recomputed Hash (Client-Side SHA-256)</span>
              <span className={`font-bold ${result.match ? 'text-[#14F195]' : 'text-[#EF4444]'}`}>{result.computed}</span>
            </div>
          </div>
        </motion.div>
      )}

    </div>
  );
}
