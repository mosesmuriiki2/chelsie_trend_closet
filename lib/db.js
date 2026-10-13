import { createClient } from '@supabase/supabase-js';
import { ADMIN_COOKIE, getCookieValue, verifyAdminSession } from '@/lib/admin-auth';

export const sb = () => {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY must be configured.');
  }
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
};

export const isAdmin = request => verifyAdminSession(getCookieValue(request, ADMIN_COOKIE));
