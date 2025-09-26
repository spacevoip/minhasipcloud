import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function buildHeaders(req: NextRequest) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const auth = req.headers.get('authorization');
  if (auth) headers['Authorization'] = auth;
  return headers;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const target = `${BACKEND_URL}/api/agents/${id}`;
  const res = await fetch(target, {
    method: 'GET',
    headers: buildHeaders(req)
  });
  const text = await res.text();
  return new NextResponse(text, { status: res.status, headers: { 'Content-Type': res.headers.get('content-type') || 'application/json' } });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.text();
  const target = `${BACKEND_URL}/api/agents/${id}`;
  const res = await fetch(target, {
    method: 'PUT',
    headers: buildHeaders(req),
    body
  });
  const text = await res.text();
  return new NextResponse(text, { status: res.status, headers: { 'Content-Type': res.headers.get('content-type') || 'application/json' } });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const target = `${BACKEND_URL}/api/agents/${id}`;
  const res = await fetch(target, {
    method: 'DELETE',
    headers: buildHeaders(req)
  });
  const text = await res.text();
  return new NextResponse(text, { status: res.status, headers: { 'Content-Type': res.headers.get('content-type') || 'application/json' } });
}
