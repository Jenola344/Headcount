/**
 * Headcount Engine — Reproduce CLI
 * 
 * Re-runs a specific token at a pinned block using the caller's own RPC.
 * This is a required surface for the hackathon to prove deterministic verdicts.
 */

import { createBaseClient } from '@sources/rpc';
import { runHeadcount } from '@engine/runner';
import type { RunConfig, TraceEvent } from '@engine/types';
import { createTraceEmitter } from '@engine/utils';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const args = process.argv.slice(2);
  const tokenAddress = args[0] as `0x${string}`;
  const pinnedBlockStr = args[1];

  if (!tokenAddress || !tokenAddress.startsWith('0x')) {
    console.error('Usage: npm run reproduce <token_address> [pinned_block]');
    process.exit(1);
  }

  console.log(`\n🔍 Reproducing Headcount run for ${tokenAddress}...`);

  const rpcUrl = process.env.BASE_RPC_URL || 'https://mainnet.base.org';
  console.log(`📡 Using Base RPC: ${rpcUrl}`);
  const client = createBaseClient(rpcUrl);

  const config: RunConfig = {
    tokenAddress,
    holderCap: parseInt(process.env.DEFAULT_HOLDER_CAP || '250', 10),
    probeBudget: parseInt(process.env.PROBE_BUDGET || '6', 10),
    rpcUrl,
    alchemyApiKey: process.env.ALCHEMY_API_KEY,
    basescanApiKey: process.env.BASESCAN_API_KEY,
    pinnedBlock: pinnedBlockStr ? BigInt(pinnedBlockStr) : undefined,
  };

  const tracer = createTraceEmitter((event: TraceEvent) => {
    switch (event.type) {
      case 'RUN_OPENED':
        console.log(`\n📦 Token: ${(event.data.token as any).name} (${(event.data.token as any).symbol})`);
        console.log(`📌 Pinned Block: ${event.data.block}`);
        break;
      case 'HOLDER_SET':
        console.log(`👥 Analysed ${event.data.analysed} holders (Coverage: ${(Number(event.data.supply_coverage) * 100).toFixed(1)}%)`);
        break;
      case 'FUNDING':
        console.log(`🕸️  Funding graph: ${event.data.infra_funded} infra-funded, ${event.data.clusters} clusters`);
        break;
      case 'SIGNALS':
        console.log(`📊 Signals computed (HHI Delta: ${event.data.hhi_delta})`);
        break;
      case 'VERDICT':
        console.log(`\n⚖️  Verdict: ${event.data.verdict} (Rule ${event.data.matched_rule})`);
        break;
      case 'RECEIPT':
        console.log(`\n🔐 Receipt Hash: ${event.data.hash}`);
        break;
      case 'ERROR':
      case 'REFUSAL':
        console.log(`\n❌ ${event.type}:`, event.data);
        break;
    }
  });

  try {
    const startTime = Date.now();
    const output = await runHeadcount(client, config, tracer);
    const durationMs = Date.now() - startTime;

    console.log(`\n✅ Run complete in ${(durationMs / 1000).toFixed(1)}s`);
    
    console.log(`\n📝 Engine Diagnosis:\n${output.narration}\n`);
    
    // Write receipt to disk
    const outDir = path.join(process.cwd(), 'out');
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir);
    }
    
    const receiptPath = path.join(outDir, `${tokenAddress.toLowerCase()}_receipt.json`);
    fs.writeFileSync(receiptPath, output.receipt.canonical, 'utf8');
    
    console.log(`📄 Canonical receipt saved to: ${receiptPath}`);
    console.log(`\nTo verify: sha256sum ${receiptPath} | awk '{print $1}'`);
    console.log(`Expected : ${output.receipt.hash}`);

  } catch (err) {
    console.error('\n💥 Reproduce failed:', err);
    process.exit(1);
  }
}

main().catch(console.error);
