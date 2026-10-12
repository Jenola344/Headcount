import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, BadgeCheck, Blocks, Cpu, FileLock2, Route, ShieldCheck, Terminal } from 'lucide-react';

const pillars = [
  {
    title: 'Deterministic ingestion',
    body: 'Every analysis begins from raw on-chain state: transfers, wallet balances, and historical funding paths are read directly from Base RPC and canonical event logs, without relying on curated marketing metrics.',
    icon: Cpu,
  },
  {
    title: 'Graph-based clustering',
    body: 'The engine models wallets as nodes and traces value movement across funding links to reveal dilution patterns, shared controllers, and sybil clusters that would otherwise masquerade as independent interest.',
    icon: Route,
  },
  {
    title: 'Cryptographic receipts',
    body: 'Each run is pinned to a block and hashed into a SHA-256 receipt so a result can be independently reproduced and verified without trusting the original UI or backend.',
    icon: FileLock2,
  },
];

const stages = [
  'Stage 01 · Hub wallet admission',
  'Stage 02 · Holder expansion and turnover',
  'Stage 03 · Funding graph tracing',
  'Stage 04 · Sybil / exchange collapse',
  'Stage 05 · Score calibration',
  'Stage 06 · Adjudication',
  'Stage 07 · Receipt issuance',
];

const verdicts = [
  { label: 'ORGANIC', color: 'text-[#37E29A]', box: 'border-[#37E29A]/30 bg-[#37E29A]/10', text: 'Broadly dispersed, independently funded, and resistant to common sybil clustering.' },
  { label: 'CONCENTRATED', color: 'text-[#F3BA5A]', box: 'border-[#F3BA5A]/30 bg-[#F3BA5A]/10', text: 'Wallet concentration exists but the signal is not yet tied to coordinated laundering or controlled supply.' },
  { label: 'MANUFACTURED', color: 'text-[#F2748A]', box: 'border-[#F2748A]/30 bg-[#F2748A]/10', text: 'The holdings are dominated by linked wallets, shared funding sources, or short-lived wash patterns.' },
];

export default function DocsPage() {
  return (
    <div className="space-y-10 pb-16">
      <section className="rounded-[28px] border border-line bg-panel/70 p-6 md:p-8 lg:p-10 shadow-[0_0_30px_rgba(55,226,154,0.08)]">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-4">
            <div className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-green">
              <Terminal className="h-4 w-4" />
              <span>technical documentation</span>
            </div>

            <h1 className="font-heading text-4xl font-black tracking-tight text-text md:text-5xl">
              Headcount is a deterministic on-chain forensics engine.
            </h1>

            <p className="max-w-2xl text-sm leading-7 text-text-muted md:text-base">
              The product measures independent human holder quality by reconstructing wallet relationships,
              tracing funding origins, and collapsing manipulative clusters before a verdict is ever rendered.
            </p>
          </div>

          <div className="flex items-center gap-3 self-start rounded-full border border-line bg-panel-2 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-text-muted">
            <ShieldCheck className="h-4 w-4 text-green" />
            <span>audit-ready</span>
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.5fr_0.8fr]">
          <div className="overflow-hidden rounded-2xl border border-line bg-panel-2">
            <Image
              src="/images/docs/system-overview.svg"
              alt="Headcount architecture overview"
              width={1200}
              height={760}
              className="h-full w-full object-cover"
            />
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-line bg-panel-2 p-5">
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-text-faint">Current model</div>
              <div className="mt-4 text-3xl font-black text-text">7-stage</div>
              <div className="mt-1 text-sm text-text-muted">evidence pipeline across Base on-chain state</div>
            </div>

            <div className="rounded-2xl border border-line bg-panel-2 p-5">
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-text-faint">Trace output</div>
              <div className="mt-4 text-3xl font-black text-text">SHA-256</div>
              <div className="mt-1 text-sm text-text-muted">receipt hash for reproducible verification</div>
            </div>

            <div className="rounded-2xl border border-line bg-panel-2 p-5">
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-text-faint">Filter</div>
              <div className="mt-4 text-3xl font-black text-text">0% sybil</div>
              <div className="mt-1 text-sm text-text-muted">tolerance for unverified clustering</div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-3">
        {pillars.map(({ title, body, icon: Icon }) => (
          <div key={title} className="rounded-2xl border border-line bg-panel/60 p-6">
            <div className="mb-4 inline-flex rounded-xl border border-line bg-panel-2 p-3 text-green">
              <Icon className="h-5 w-5" />
            </div>
            <h2 className="mb-3 text-xl font-bold text-text font-heading">{title}</h2>
            <p className="text-sm leading-7 text-text-muted">{body}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-3xl border border-line bg-panel/60 p-6">
          <div className="mb-4 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.24em] text-text-faint">
            <Blocks className="h-4 w-4 text-green" />
            <span>signal pipeline</span>
          </div>

          <h2 className="mb-5 text-3xl font-black text-text font-heading">How the engine processes a token</h2>

          <div className="space-y-3">
            {stages.map((stage, index) => (
              <div key={stage} className="flex items-center gap-4 rounded-2xl border border-line bg-panel-2 p-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-panel text-xs font-bold text-green">
                  {index + 1}
                </div>
                <div className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted">{stage}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="overflow-hidden rounded-3xl border border-line bg-panel-2">
          <Image
            src="/images/docs/holder-flow.svg"
            alt="Holder flow graph diagram"
            width={1200}
            height={760}
            className="h-full w-full object-cover"
          />
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="overflow-hidden rounded-3xl border border-line bg-panel-2">
          <Image
            src="/images/docs/receipt-proof.svg"
            alt="Proof and receipt architecture diagram"
            width={1200}
            height={760}
            className="h-full w-full object-cover"
          />
        </div>

        <div className="rounded-3xl border border-line bg-panel/60 p-6">
          <div className="mb-4 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.24em] text-text-faint">
            <BadgeCheck className="h-4 w-4 text-green" />
            <span>evidence layer</span>
          </div>

          <h2 className="mb-5 text-3xl font-black text-text font-heading">Why the receipts are trustworthy</h2>

          <div className="space-y-4 text-sm leading-7 text-text-muted">
            <p>
              Every run is executed against a pinned block and summarized into an evidence digest. That digest is
              generated from the same factual inputs used to decide the verdict, which means the result is
              reproducible outside the UI.
            </p>
            <p>
              If a holder distribution, funding path, or wallet cluster changes, the hash changes as well. The
              receipt keeps the underlying logic honest by preserving the exact state used at the time of analysis.
            </p>
          </div>

          <div className="mt-6 rounded-2xl border border-line bg-panel-2 p-4 font-mono text-[11px] text-text-muted">
            <div className="text-text-faint uppercase tracking-[0.18em]">receipt sample</div>
            <div className="mt-3 whitespace-pre-wrap break-words text-green">
              {`block_number: 24614035\nwallet_cluster: 14\nfunding_hops: 3\nsha256: 2d7c4e1f...f7a8cc05\nverdict: CONCENTRATED`}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-line bg-panel/60 p-6 md:p-8">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-text-faint">verdict taxonomy</div>
            <h2 className="mt-2 text-3xl font-black text-text font-heading">How signals become a classification</h2>
          </div>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-line bg-panel-2 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-text-muted transition-colors hover:text-green"
          >
            Launch scan
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {verdicts.map(({ label, color, box, text }) => (
            <div key={label} className={`rounded-2xl border p-5 ${box}`}>
              <div className={`font-mono text-[10px] uppercase tracking-[0.2em] ${color}`}>{label}</div>
              <p className="mt-4 text-sm leading-7 text-text">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-line bg-panel/60 p-6 md:p-8">
        <div className="mb-6">
          <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-text-faint">meet the team</div>
          <h2 className="mt-2 text-3xl font-black text-text font-heading">Headcount Founder</h2>
        </div>

        <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="rounded-[28px] border border-line bg-panel-2 p-6">
            <div className="flex h-40 w-40 items-center justify-center rounded-full border border-green/30 bg-gradient-to-br from-green/20 via-panel-2 to-purple/20 text-4xl font-black text-green shadow-[0_0_30px_rgba(55,226,154,0.12)]">
              JO
            </div>
            <div className="mt-6 space-y-2">
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-green">founder</div>
              <div className="text-2xl font-black text-text font-heading">Jesutola Olusegun</div>
              <div className="text-sm text-text-muted">Web3 Developer • Builder • Developer Relations</div>
            </div>
          </div>

          <div className="space-y-5 rounded-[28px] border border-line bg-panel-2 p-6">
            <p className="text-lg leading-8 text-text">
              Jesutola Olusegun (Jenola) is a Web3 developer and Developer Relations-focused builder interested in
              blockchain infrastructure, ecosystem growth, and practical on-chain applications.
            </p>

            <p className="text-sm leading-7 text-text-muted">
              He is the founder and builder of Headcount, an on-chain analytics project focused on distinguishing
              wallet counts from evidence-backed estimates of independent participants.
            </p>

            <p className="text-sm leading-7 text-text-muted">
              His technical interests include frontend development, smart contracts, blockchain infrastructure, and
              Web3 ecosystem development, with experience exploring technologies across EVM and other blockchain
              ecosystems.
            </p>

            <div className="rounded-2xl border border-line bg-panel p-4">
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-text-faint">approach to headcount</div>
              <ul className="mt-3 space-y-2 text-sm text-text-muted">
                <li>• Deterministic on-chain analysis</li>
                <li>• Evidence over assumptions</li>
                <li>• Reproducibility</li>
                <li>• Blockchain transparency</li>
                <li>• Independent-holder measurement</li>
                <li>• Openly documenting limitations and incorrect results</li>
              </ul>
            </div>

            <blockquote className="border-l-2 border-green/50 pl-4 text-base italic text-text">
              Building transparent, reproducible tools for understanding on-chain communities.
            </blockquote>
          </div>
        </div>
      </section>
    </div>
  );
}
