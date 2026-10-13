import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/db';

export async function GET(request) {
  return NextResponse.json({ authenticated: isAdmin(request) });
}
