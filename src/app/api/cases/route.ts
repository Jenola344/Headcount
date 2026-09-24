import { NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import { resolveMetadata } from '@engine/types';

export async function GET() {
  const cataloguePath = path.join(process.cwd(), 'logs', 'catalogue.jsonl');
  let runs = [];
  
  try {
    if (fs.existsSync(cataloguePath)) {
      const content = fs.readFileSync(cataloguePath, 'utf8');
      runs = content.trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
    }
  } catch (err) {
    console.error('Failed to read catalogue', err);
  }

  const cases = runs.map(run => {
    const symbol = resolveMetadata(run.context.token.symbol, run.context.token.address);
    const name = resolveMetadata(run.context.token.name, run.context.token.address);
    return {
      address: run.context.token.address,
      tag: `#${typeof symbol === 'string' ? symbol.toLowerCase() : run.context.token.address.slice(0, 10)}`,
      status: 'complete',
      verdict: run.verdict.verdict,
      summary: run.narration || `Deterministic audit run executed for ${name}`,
      updated_at: new Date().toISOString(),
    };
  });

  return NextResponse.json({ cases });
}
