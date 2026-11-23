/* lib/supabase/server.js
 * Server-side Supabase client for API Route Handlers.
 *
 * "use server" is implied — this file is only imported in server environments.
 * It reads session cookies so the server knows which user is logged in.
 *
 * We only use the PUBLIC anon key here too — RLS policies on the database
 * tables enforce what each user role can access.
 */
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(toSet) {
        try {
          toSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          /* Ignore in Server Components — middleware handles refresh */
        }
      },
    },
  });
}
