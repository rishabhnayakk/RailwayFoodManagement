/* lib/supabase/client.js
 * Browser-side Supabase client (uses public anon key; access enforced by RLS).
 */
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key || url.includes("placeholder")) {
    // Return null so pages can detect missing config and show a setup message.
    return null;
  }

  return createBrowserClient(url, key);
}
