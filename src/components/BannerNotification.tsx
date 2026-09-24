'use client';

import { useState } from 'react';
import { X, Sparkles, ArrowRight } from 'lucide-react';

export default function BannerNotification() {
  const [isVisible, setIsVisible] = useState(true);
  const [username, setUsername] = useState('');
  const [isSaved, setIsSaved] = useState(false);

  if (!isVisible) return null;

  return (
    <div className="w-full bg-[#130D20] border-b border-[#2A1B4E] px-4 py-2 text-xs md:text-sm text-gray-300 flex items-center justify-between gap-4 transition-all">
      <div className="flex items-center gap-2 overflow-hidden text-ellipsis whitespace-nowrap">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#9945FF]/20 text-[#A855F7] font-bold text-xs shrink-0">
          @
        </span>
        <span className="font-mono text-gray-300">
          <span className="text-[#A855F7] font-semibold">Deterministic On-Chain Forensics:</span> Analyze Base ERC-20 tokens & detect sybil clusters.
        </span>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        {!isSaved ? (
          <form 
            onSubmit={(e) => { e.preventDefault(); if (username.trim()) setIsSaved(true); }}
            className="hidden sm:flex items-center gap-2"
          >
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="@username"
              className="bg-[#0C0816] border border-[#2A1B4E] rounded-md px-3 py-1 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#9945FF] w-36 font-mono"
            />
            <button
              type="submit"
              className="bg-[#9945FF] hover:bg-[#8B5CF6] text-white px-3 py-1 rounded-md text-xs font-semibold transition-colors flex items-center gap-1"
            >
              Set
            </button>
          </form>
        ) : (
          <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#9945FF]/20 border border-[#9945FF]/40 text-[#A855F7] text-xs font-mono">
            <Sparkles className="w-3 h-3 text-[#14F195]" />
            @{username}
          </span>
        )}

        <button
          onClick={() => setIsVisible(false)}
          className="text-gray-400 hover:text-white p-1 rounded-md hover:bg-white/5 transition-colors"
          aria-label="Dismiss banner"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
