import { createClient } from '@supabase/supabase-js';

// Fallback to the keys you provided if they aren't set in the Environment Variables menu.
// WARNING: It is generally best practice to keep these entirely in your environment variables, 
// though the publishable anon key is technically safe for the browser.
const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL || 'https://kzbjmrkhnwughmhnimvq.supabase.co';
const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_YPWI6L6r1QwlNOyuakrQ9g_3COeSflP';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase URL or Anon Key is missing. Check your environment configuration.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
