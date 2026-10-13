import { NextResponse } from 'next/server';
import {
  ADMIN_COOKIE,
  adminCookieOptions,
  createAdminSession,
  isAdminPasswordValid,
  isLoginRateLimited,
} from '@/lib/admin-auth';

export const runtime = 'nodejs';

export async function POST(request) {
  const ip = request.headers.get('x-real-ip') || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (isLoginRateLimited(ip)) {
    return NextResponse.json({ error: 'Too many sign-in attempts. Please wait 15 minutes and try again.' }, { status: 429 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Enter your admin password to sign in.' }, { status: 400 });
  }

  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
    return NextResponse.json({ error: 'Admin sessions are not configured. Add a SESSION_SECRET of at least 32 characters.' }, { status: 500 });
  }
  if (!isAdminPasswordValid(body?.password)) {
    return NextResponse.json({ error: 'Incorrect password.' }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_COOKIE, createAdminSession(), adminCookieOptions());
  return response;
}
