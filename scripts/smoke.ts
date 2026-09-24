/**
 * Headcount Engine — Smoke Test
 * 
 * Simple script to run Stages 0 and 1 against a real token to verify RPC connectivity,
 * event pagination, and basic holder extraction.
 */

import { createBaseClient } from '@sources/rpc';
import { runHeadcount } from '@engine/runner';
import type { RunConfig, TraceEvent } from '@engine/types';
import { createTraceEmitter } from '@engine/utils';

// USDC on Base
const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

async function main() {
  console.log(`\n💨 Running smoke test on USDC Base (${USDC_BASE})...`);

  const rpcUrl = process.env.BASE_RPC_URL || 'https://mainnet.base.org';
  const client = createBaseClient(rpcUrl);

  const config: RunConfig = {
    tokenAddress: USDC_BASE,
    holderCap: 50, // Small cap for quick test
    probeBudget: 0,
    rpcUrl,
    basescanApiKey: process.env.BASESCAN_API_KEY,
  };

  const tracer = createTraceEmitter((event: TraceEvent) => {
    switch (event.type) {
      case 'RUN_OPENED':
        console.log(`✅ Stage 0: Admitted token ${(event.data.token as any).symbol} at block ${event.data.block}`);
        break;
      case 'HOLDER_SET':
        console.log(`✅ Stage 1: Built holder set. Analysed ${event.data.analysed} holders (Coverage: ${(Number(event.data.supply_coverage) * 100).toFixed(1)}%). Pages: ${event.data.log_pages}`);
        break;
      case 'ERROR':
      case 'REFUSAL':
        console.log(`❌ ${event.type}:`, event.data);
        break;
    }
  });

  try {
    const output = await runHeadcount(client, config, tracer);
    console.log(`\n🎉 Smoke test completed successfully!`);
    console.log(`   Effective holders: ${output.verdict.effective_holders}`);
    console.log(`   Verdict: ${output.verdict.verdict}`);
  } catch (err) {
    console.error('\n💥 Smoke test failed:', err);
    process.exit(1);
  }
}

main().catch(console.error);
