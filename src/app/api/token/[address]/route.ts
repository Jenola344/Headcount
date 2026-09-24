import { NextRequest, NextResponse } from 'next/server';
import { createBaseClient } from '@sources/rpc';
import { runHeadcount } from '@engine/runner';
import type { RunConfig, TraceEvent } from '@engine/types';
import { createTraceEmitter } from '@engine/utils';

export const maxDuration = 300; // 5 minutes max for Vercel

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  const { address } = await params;
  const tokenAddress = address.toLowerCase() as `0x${string}`;

  // Check if client wants SSE stream
  const isStream = request.headers.get('accept') === 'text/event-stream';

  const rpcUrl = process.env.BASE_RPC_URL || 'https://mainnet.base.org';
  const client = createBaseClient(rpcUrl);

  const config: RunConfig = {
    tokenAddress,
    holderCap: parseInt(process.env.DEFAULT_HOLDER_CAP || '250', 10),
    probeBudget: parseInt(process.env.PROBE_BUDGET || '6', 10),
    rpcUrl,
    alchemyApiKey: process.env.ALCHEMY_API_KEY,
    basescanApiKey: process.env.BASESCAN_API_KEY,
    groqApiKey: process.env.GROQ_API_KEY,
  };

  if (!isStream) {
    // Standard JSON response (for programmatic API consumers)
    try {
      const output = await runHeadcount(client, config);
      return NextResponse.json(output);
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Unknown error' },
        { status: 500 }
      );
    }
  }

  // ─── SSE Stream ─────────────────────────────────────────────────────────────
  
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (event: TraceEvent) => {
        // SSE format: data: {...}\n\n
        const data = `data: ${JSON.stringify(event)}\n\n`;
        controller.enqueue(encoder.encode(data));
      };

      const tracer = createTraceEmitter(sendEvent);

      try {
        await runHeadcount(client, config, tracer);
      } catch (error) {
        sendEvent({
          type: 'ERROR',
          timestamp: new Date().toISOString(),
          data: { message: error instanceof Error ? error.message : 'Unknown error' }
        });
      } finally {
        controller.close();
      }
    }
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    },
  });
}
