'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell, ChevronDown } from 'lucide-react';
import { useAccount, useConnect, useDisconnect, useSwitchChain } from 'wagmi';
import { base } from 'wagmi/chains';
import { useState, useEffect } from 'react';

interface WalletTokenBalance {
  contractAddress: string;
  tokenBalance?: string;
}

interface WalletHoldingsResponse {
  error?: string;
  tokenBalances?: WalletTokenBalance[];
}

function WalletDropdown({ onClose }: { onClose: () => void }) {
  const { address } = useAccount();
  const { disconnect } = useDisconnect();
  const [holdings, setHoldings] = useState<WalletTokenBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!address) return;
    
    fetch(`/api/wallet/holdings?address=${address}`)
      .then(res => res.json())
      .then((data: WalletHoldingsResponse | WalletTokenBalance[]) => {
        if ('error' in data && data.error) {
          setError(data.error);
        } else if ('tokenBalances' in data && data.tokenBalances) {
          setHoldings(data.tokenBalances.filter(t => t.tokenBalance !== '0x0' && t.tokenBalance !== '0'));
        } else if (Array.isArray(data)) {
          setHoldings(data);
        }
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to fetch holdings');
        setLoading(false);
      });
  }, [address]);

  return (
    <div className="absolute top-full right-4 mt-2 w-80 bg-panel border border-line rounded-xl shadow-2xl p-4 z-50">
      <div className="flex items-center justify-between mb-4 border-b border-line-soft pb-2">
        <h3 className="font-mono text-xs font-bold text-text uppercase tracking-widest">Base Holdings</h3>
        <button onClick={onClose} className="text-text-muted hover:text-text">✕</button>
      </div>

      {loading ? (
        <div className="py-8 text-center text-xs font-mono animate-pulse text-text-muted">Loading tokens...</div>
      ) : error ? (
        <div className="py-4 text-center text-xs font-mono text-red-500">{error}</div>
      ) : holdings.length === 0 ? (
        <div className="py-4 text-center text-xs font-mono text-text-muted">No ERC-20 tokens found.</div>
      ) : (
        <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
          {holdings.map((h, i) => {
             const bal = h.tokenBalance ? parseInt(h.tokenBalance, 16) / 1e18 : 0;
             return (
              <div key={i} className="flex justify-between items-center text-xs font-mono bg-panel-2 p-2 rounded border border-line">
                <span className="truncate w-32 text-text-muted" title={h.contractAddress}>{h.contractAddress}</span>
                <span className="text-green font-bold">{bal > 0 ? bal.toFixed(4) : bal}</span>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-4 pt-3 border-t border-line-soft">
        <button 
          onClick={() => { disconnect(); onClose(); }} 
          className="w-full py-2 bg-red-500/10 text-red-500 rounded font-mono text-xs hover:bg-red-500/20 transition-colors"
        >
          Disconnect
        </button>
      </div>
    </div>
  );
}

export default function HeaderNavbar() {
  const pathname = usePathname();
  const { address, isConnected, chain } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { switchChain } = useSwitchChain();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const isWrongNetwork = isConnected && chain?.id !== base.id;

  const activeGuards = isConnected ? 2 : 0;

  const navItems = [
    { name: 'Browse', href: '/' },
    { name: 'Findings', href: '/findings' },
    { name: 'Docs', href: '/docs' },
    { name: 'Verify Receipt', href: '/verify' },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-line bg-ink/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <div className="font-mono text-base font-medium tracking-tight flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-panel border border-line group-hover:border-line-soft transition-colors text-text-muted">
            [ 
            <span className="text-text group-hover:text-green transition-colors">headcount</span>
            . 
            <span>base</span>
            ]
          </div>
        </Link>

        {/* Center Nav Links with active green line bar */}
        <nav className="hidden md:flex items-center space-x-1 lg:space-x-2 h-full">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative px-4 h-full flex items-center text-sm font-medium transition-colors ${
                  isActive ? 'text-green font-bold' : 'text-text-muted hover:text-text'
                }`}
              >
                {item.name}
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-[3px] bg-green rounded-t-full shadow-[0_-2px_10px_rgba(55,226,154,0.5)]" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Right side controls */}
        <div className="flex items-center gap-3">
          
          {/* Notification Icon */}
          <button 
            className="relative p-2 rounded-xl bg-panel border border-line text-text-muted hover:text-text hover:border-line-soft transition-colors"
            aria-label="Notifications"
          >
            <Bell className="w-4 h-4" />
            {activeGuards > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-green text-green-ink text-[10px] font-bold">
                {activeGuards}
              </span>
            )}
          </button>

          {/* Wallet Connection */}
          {isWrongNetwork ? (
            <button 
              onClick={() => switchChain?.({ chainId: base.id })}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/50 text-red-500 hover:bg-red-500/20 transition-colors text-xs font-mono font-medium"
            >
              Wrong Network
            </button>
          ) : (
            <div className="relative">
              <button 
                onClick={() => isConnected ? setIsDropdownOpen(!isDropdownOpen) : connect({ connector: connectors[0] })}
                disabled={isPending}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-panel border border-line hover:border-line-soft transition-colors cursor-pointer disabled:opacity-50"
              >
                {isConnected && address ? (
                  <>
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-green text-green-ink font-bold text-[10px]">
                      0x
                    </div>
                    <span className="hidden sm:inline-block font-mono text-xs text-text font-medium">
                      {address.slice(0, 6)}...{address.slice(-4)}
                    </span>
                    <ChevronDown className={`w-3.5 h-3.5 text-text-muted transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                  </>
                ) : (
                  <span className="font-mono text-xs text-text font-medium py-0.5">
                    {isPending ? 'Connecting...' : 'Connect Wallet'}
                  </span>
                )}
              </button>
              {isDropdownOpen && <WalletDropdown onClose={() => setIsDropdownOpen(false)} />}
            </div>
          )}
        </div>
      </div>

      {/* Mobile nav bar row */}
      <div className="md:hidden flex border-t border-line bg-panel px-4 py-2 justify-around">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`text-xs font-mono py-1 px-2 rounded-md ${
                isActive ? 'bg-green/10 text-green font-bold' : 'text-text-muted'
              }`}
            >
              {item.name}
            </Link>
          );
        })}
      </div>
    </header>
  );
}
