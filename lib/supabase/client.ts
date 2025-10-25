import { createBrowserClient } from "@supabase/ssr"

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn("[v0] Supabase environment variables not configured. Client will not work properly.")
    // Return a dummy client to prevent crashes - this allows the app to load
    return createBrowserClient("https://placeholder.supabase.co", "placeholder-key")
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}
