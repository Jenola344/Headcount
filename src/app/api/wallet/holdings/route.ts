import { NextRequest, NextResponse } from 'next/server';

const FREE_BASE_RPCS = [
  'https://base-rpc.publicnode.com',
  'https://base.gateway.tenderly.co',
  'https://base.drpc.org',
  'https://mainnet.base.org',
];

export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get('address');
  if (!address) {
    return NextResponse.json({ error: 'Address required' }, { status: 400 });
  }

  // If user has an Alchemy RPC configured, use alchemy_getTokenBalances
  const userRpc = process.env.BASE_RPC_URL;
  if (userRpc && userRpc.includes('alchemy.com')) {
    try {
      const res = await fetch(userRpc, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'alchemy_getTokenBalances',
          params: [address, "erc20"],
          id: 1,
        }),
      });

      if (!res.ok) throw new Error('RPC returned ' + res.status);
      const data = await res.json();
      if (data.error) throw new Error(data.error.message || 'RPC error');
      return NextResponse.json(data.result);
    } catch {
      // Fall through to generic RPC approach
    }
  }

  // Fallback: use eth_getBalance from free RPCs
  const rpcs = userRpc ? [userRpc, ...FREE_BASE_RPCS] : FREE_BASE_RPCS;

  for (const rpcUrl of rpcs) {
    try {
      const res = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_getBalance',
          params: [address, 'latest'],
          id: 1,
        }),
      });

      if (!res.ok) continue;
      const data = await res.json();
      if (data.error) continue;

      return NextResponse.json({
        address,
        ethBalance: data.result,
        tokenBalances: [],
        note: 'Token balance enumeration requires an Alchemy-compatible RPC. Set BASE_RPC_URL to an Alchemy endpoint for full token holdings.',
      });
    } catch {
      continue;
    }
  }

  return NextResponse.json(
    { error: 'All RPC endpoints failed. Try again later or set BASE_RPC_URL to a dedicated provider.' },
    { status: 502 }
  );
}
