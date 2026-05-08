import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

interface Claim {
  name: string;
  quantity?: number;
  amount?: number;
}

export async function POST(req: NextRequest) {
  const receipt = await req.json();
  const id = uuidv4();
  const session = {
    id,
    receipt,
    claims: {},
    createdAt: new Date().toISOString(),
  };
  await redis.set(id, JSON.stringify(session), { ex: 86400 });
  return NextResponse.json({ id });
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'No id' }, { status: 400 });
  const data = await redis.get(id);
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const session = typeof data === 'string' ? JSON.parse(data) : data;
  return NextResponse.json(session);
}

export async function PATCH(req: NextRequest) {
  const { id, itemIndex, name, quantity, amount, unclaim } = await req.json();
  const data = await redis.get(id);
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const session = typeof data === 'string' ? JSON.parse(data) : data;
  if (!session.claims[itemIndex]) session.claims[itemIndex] = [];

  // Always remove existing claim from this person first
  session.claims[itemIndex] = session.claims[itemIndex].filter((c: Claim) => c.name !== name);

  if (!unclaim) {
    const newClaim: Claim = { name };
    if (amount !== undefined && amount !== null) newClaim.amount = amount;
    if (quantity !== undefined && quantity !== null) newClaim.quantity = quantity;
    session.claims[itemIndex].push(newClaim);
  }

  await redis.set(id, JSON.stringify(session), { ex: 86400 });
  return NextResponse.json(session);
}