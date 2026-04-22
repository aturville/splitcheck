import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';

const dataDir = path.join(process.cwd(), 'data');

export async function POST(req: NextRequest) {
  const receipt = await req.json();
  const id = uuidv4();
  const session = {
    id,
    receipt,
    claims: {},
    createdAt: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(dataDir, `${id}.json`), JSON.stringify(session));
  return NextResponse.json({ id });
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'No id' }, { status: 400 });
  const filePath = path.join(dataDir, `${id}.json`);
  if (!fs.existsSync(filePath)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const session = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  return NextResponse.json(session);
}

export async function PATCH(req: NextRequest) {
  const { id, itemIndex, name } = await req.json();
  const filePath = path.join(dataDir, `${id}.json`);
  if (!fs.existsSync(filePath)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const session = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  session.claims[itemIndex] = name;
  fs.writeFileSync(filePath, JSON.stringify(session));
  return NextResponse.json(session);
}