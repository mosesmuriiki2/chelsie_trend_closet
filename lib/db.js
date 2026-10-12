import { createClient } from '@supabase/supabase-js';
export const sb = () => createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
export const isAdmin = (req) => req.headers.get('x-admin-password') === process.env.ADMIN_PASSWORD;
