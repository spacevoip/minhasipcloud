import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

function buildHeaders(req: NextRequest) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const auth = req.headers.get('authorization');
  if (auth) headers['Authorization'] = auth;
  return headers;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const search = url.search ? url.search : '';
  const target = `${BACKEND_URL}/api/agents${search}`;
  const res = await fetch(target, {
    method: 'GET',
    headers: buildHeaders(req),
    cache: 'no-store'
  });
  const text = await res.text();
  return new NextResponse(text, { status: res.status, headers: { 'Content-Type': res.headers.get('content-type') || 'application/json' } });
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const target = `${BACKEND_URL}/api/agents`;
  const res = await fetch(target, {
    method: 'POST',
    headers: buildHeaders(req),
    body
  });
  const text = await res.text();
  return new NextResponse(text, { status: res.status, headers: { 'Content-Type': res.headers.get('content-type') || 'application/json' } });
}
