import type { Metadata } from 'next';
import { Archivo, IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';
import BannerNotification from '@/components/BannerNotification';
import HeaderNavbar from '@/components/HeaderNavbar';

const archivo = Archivo({ 
  subsets: ['latin'], 
  weight: ['700', '800', '900'],
  style: ['normal', 'italic'],
  variable: '--font-archivo' 
});
const ibmPlexSans = IBM_Plex_Sans({ 
  subsets: ['latin'], 
  weight: ['400', '500', '600'],
  variable: '--font-plex-sans' 
});
const ibmPlexMono = IBM_Plex_Mono({ 
  subsets: ['latin'], 
  weight: ['400', '500'],
  variable: '--font-plex-mono' 
});

export const metadata: Metadata = {
  title: 'Headcount | Deterministic On-Chain Forensics',
  description: 'Deterministic on-chain forensics engine measuring independent human holders behind Base ERC-20 tokens.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${archivo.variable} ${ibmPlexSans.variable} ${ibmPlexMono.variable} min-h-screen bg-ink text-text antialiased flex flex-col`}>
        <BannerNotification />
        <HeaderNavbar />

        <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>

        <footer className="w-full border-t border-line bg-panel py-8 px-4 text-xs font-mono text-text-muted">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-text-faint font-black">[</span>
              <span className="text-text font-bold">headcount</span>
              <span className="h-1.5 w-1.5 rounded-full bg-text-muted"></span>
              <span className="text-text-muted">forensics engine v0.1</span>
              <span className="text-text-faint font-black">]</span>
            </div>
            <div>
              Powered by Base Mainnet · SHA-256 Cryptographic Receipts · 0% Sybil Tolerance
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
