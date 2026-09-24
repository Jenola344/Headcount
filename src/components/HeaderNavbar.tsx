'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell, ChevronDown } from 'lucide-react';
import { useState } from 'react';

export default function HeaderNavbar() {
  const pathname = usePathname();
  // We mock a connected state for the scope of this frontend
  const [isConnected, setIsConnected] = useState(false);
  const activeGuards = isConnected ? 2 : 0;

  const navItems = [
    { name: 'Browse', href: '/' },
    { name: 'Findings', href: '/findings' },
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
          <button 
            onClick={() => setIsConnected(!isConnected)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-panel border border-line hover:border-line-soft transition-colors cursor-pointer"
          >
            {isConnected ? (
              <>
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-green text-green-ink font-bold text-[10px]">
                  0x
                </div>
                <span className="hidden sm:inline-block font-mono text-xs text-text font-medium">
                  0x71C...97dE
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-text-muted" />
              </>
            ) : (
              <span className="font-mono text-xs text-text font-medium py-0.5">
                Connect Wallet
              </span>
            )}
          </button>
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
