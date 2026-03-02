import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Client-side Supabase client (safe to use in browser)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Server-side Supabase client with elevated permissions
// Only use in API routes / Server Components — never expose to the browser
export const supabaseAdmin = createClient(
  supabaseUrl,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
