'use client';

import { useState } from 'react';
import { X, Sparkles } from 'lucide-react';

export default function BannerNotification() {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) return null;

  return (
    <div className="w-full bg-[#130D20] border-b border-[#2A1B4E] px-4 py-2 text-xs md:text-sm text-gray-300 flex items-center justify-between gap-4 transition-all">
      <div className="flex items-center gap-2 overflow-hidden text-ellipsis whitespace-nowrap">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#9945FF]/20 text-[#A855F7] font-bold text-xs shrink-0">
          <Sparkles className="w-3 h-3" />
        </span>
        <span className="font-mono text-gray-300">
          <span className="text-[#A855F7] font-semibold">Deterministic On-Chain Forensics:</span> Analyze Base ERC-20 tokens &amp; detect sybil clusters.
        </span>
      </div>

      <div className="flex items-center gap-3 shrink-0">
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
