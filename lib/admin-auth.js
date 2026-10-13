import { createHmac, timingSafeEqual } from 'node:crypto';

export const ADMIN_COOKIE = 'ctc_admin';
export const ADMIN_SESSION_SECONDS = 7 * 24 * 60 * 60;
const MAX_LOGIN_ATTEMPTS = 10;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const attemptsByIp = new Map();

function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) throw new Error('SESSION_SECRET must contain at least 32 characters.');
  return value;
}

function signature(payload) {
  return createHmac('sha256', secret()).update(payload).digest('base64url');
}

function safeEqual(left, right) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function createAdminSession() {
  const payload = Buffer.from(JSON.stringify({
    role: 'admin',
    expiresAt: Math.floor(Date.now() / 1000) + ADMIN_SESSION_SECONDS,
  })).toString('base64url');
  return `${payload}.${signature(payload)}`;
}

export function verifyAdminSession(token) {
  if (!token || typeof token !== 'string') return false;
  const separator = token.lastIndexOf('.');
  if (separator < 1) return false;
  const payload = token.slice(0, separator);
  const suppliedSignature = token.slice(separator + 1);
  try {
    if (!safeEqual(signature(payload), suppliedSignature)) return false;
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return session.role === 'admin' && Number.isInteger(session.expiresAt) &&
      session.expiresAt > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

export function isAdminPasswordValid(password) {
  const expected = process.env.ADMIN_PASSWORD;
  return Boolean(expected && typeof password === 'string' && safeEqual(password, expected));
}

export function isLoginRateLimited(ip) {
  const now = Date.now();
  const key = ip || 'unknown';
  const attempts = attemptsByIp.get(key) || [];
  const recent = attempts.filter(timestamp => now - timestamp < LOGIN_WINDOW_MS);
  if (recent.length >= MAX_LOGIN_ATTEMPTS) {
    attemptsByIp.set(key, recent);
    return true;
  }
  recent.push(now);
  attemptsByIp.set(key, recent);
  if (attemptsByIp.size > 1000) {
    for (const [address, values] of attemptsByIp) {
      if (!values.some(timestamp => now - timestamp < LOGIN_WINDOW_MS)) attemptsByIp.delete(address);
    }
  }
  return false;
}

export function adminCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: ADMIN_SESSION_SECONDS,
  };
}

export function getCookieValue(request, name) {
  const cookieHeader = request.headers.get('cookie') || '';
  for (const item of cookieHeader.split(';')) {
    const separator = item.indexOf('=');
    if (separator >= 0 && item.slice(0, separator).trim() === name) {
      return item.slice(separator + 1).trim();
    }
  }
  return '';
}
