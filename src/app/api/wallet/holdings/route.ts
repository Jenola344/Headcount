import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get('address');
  if (!address) {
    return NextResponse.json({ error: 'Address required' }, { status: 400 });
  }

  const rpcUrl = process.env.BASE_RPC_URL || 'https://mainnet.base.org';
  
  try {
    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'alchemy_getTokenBalances',
        params: [address, "erc20"],
        id: 1,
      }),
    });
    
    if (!res.ok) {
        throw new Error('RPC returned ' + res.status);
    }
    
    const data = await res.json();
    if (data.error) {
        throw new Error(data.error.message || 'RPC error');
    }
    
    return NextResponse.json(data.result);
  } catch (error) {
    console.error('Failed to fetch holdings', error);
    return NextResponse.json({ error: 'Failed to fetch holdings. Ensure your RPC supports alchemy_getTokenBalances or equivalent.' }, { status: 500 });
  }
}
