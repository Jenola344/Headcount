'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, ArrowRight } from 'lucide-react';

const BASE_ADDR_RE = /^0x[0-9a-fA-F]{40}$/;

const SAMPLES = [
  { name: 'USDC',  address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' },
  { name: 'AERO',  address: '0x940181a94A35A4569E4529A3CDfB74e38FD98631' },
  { name: 'DEGEN', address: '0x4ed4E862860bed51a9570b96d89af5E1B0Efefed' },
  { name: 'TOSHI', address: '0xAC1Bd2447a101b00EA8A2078446CDed1a713b947' },
];

export default function SearchSection() {
  const router = useRouter();
  const [address, setAddress] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const validate = (val: string) => {
    if (!val) return '';
    if (!BASE_ADDR_RE.test(val)) return "That doesn't look like a Base address — expected 0x followed by 40 hex characters.";
    return '';
  };

  const handleChange = (val: string) => {
    setAddress(val);
    if (error) setError(validate(val));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const err = validate(address);
    if (err) { setError(err); return; }
    setIsLoading(true);
    router.push(`/token/${address}`);
  };

  return (
    <div className="w-full space-y-8 pt-4 pb-10">
      
      {/* Eyebrow label */}
      <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-text-muted">
        <span className="text-green">◆</span>
        <span>BROWSE</span>
        <span>·</span>
        <span className="text-text font-bold">DETERMINISTIC FORENSICS ENGINE</span>
      </div>

      {/* Hero headline */}
      <div className="space-y-4">
        <h1 className="text-5xl sm:text-7xl font-extrabold tracking-tight text-text font-heading leading-tight">
          Head
          <span className="bg-paper text-ink px-3 sm:px-4 py-0.5 rounded font-black mx-1.5 inline-block uppercase tracking-tighter shadow-2xl">
            count
          </span>
          <span className="inline-block w-8 sm:w-10 h-3.5 sm:h-4 bg-green ml-1 align-baseline" style={{boxShadow: '0 0 15px var(--green)'}}></span>
        </h1>
        <p className="text-text-muted text-lg sm:text-xl max-w-3xl leading-relaxed font-normal">
          Browse Base ERC-20 tokens seeking verification, currently active forensics, and past cryptographic audit receipts.
        </p>
      </div>

      {/* Paste bar */}
      <form onSubmit={handleSubmit} className="relative max-w-3xl group">
        <div className="relative flex items-center bg-panel border border-line rounded-xl shadow-2xl p-1.5 focus-within:border-green transition-all">
          <div className="pl-4 pr-2">
            <Search className="w-5 h-5 text-text-faint group-focus-within:text-green transition-colors" />
          </div>
          
          <input
            type="text"
            value={address}
            onChange={(e) => handleChange(e.target.value)}
            placeholder="Paste a Base ERC-20 contract address (0x…)"
            className="flex-1 bg-transparent px-2 py-3.5 text-text font-mono text-sm sm:text-base placeholder-text-faint focus:outline-none"
            disabled={isLoading}
            id="address-input"
            autoComplete="off"
            spellCheck={false}
          />

          <button
            type="submit"
            disabled={isLoading}
            id="analyze-btn"
            className="flex items-center gap-2 rounded-lg bg-green text-green-ink px-6 py-3 font-bold hover:brightness-110 transition-all duration-200 disabled:opacity-50 text-sm font-mono uppercase tracking-wide shrink-0"
          >
            {isLoading ? (
              <>Scanning <span className="animate-pulse">...</span></>
            ) : (
              <>Analyse <ArrowRight className="w-4 h-4" /></>
            )}
          </button>
        </div>

        {/* Inline validation error */}
        {error && (
          <p className="mt-2 text-sm font-mono text-red" role="alert">
            {error}
          </p>
        )}

        {/* Quick-fill sample tokens */}
        <div className="flex flex-wrap items-center gap-2 mt-4 text-xs text-text-muted font-mono">
          <span className="text-text-faint">Try:</span>
          {SAMPLES.map((t) => (
            <button
              key={t.name}
              type="button"
              onClick={() => { setAddress(t.address); setError(''); }}
              className="px-2.5 py-1 rounded bg-panel-2 border border-line hover:border-green/40 hover:text-text transition-colors"
            >
              ${t.name}
            </button>
          ))}
        </div>
      </form>
    </div>
  );
}

