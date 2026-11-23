/* lib/supabase/client.js
 * Browser-side Supabase client.
 *
 * Used inside React components marked "use client".
 * Uses the PUBLIC anon key — this is safe because Supabase Row Level
 * Security policies control what a user can read/write.
 *
 * HOW TO EXPLAIN TO PROFESSOR:
 * "createBrowserClient creates a Supabase connection in the user's browser.
 *  It reads the URL and key from environment variables — never hardcoded."
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
