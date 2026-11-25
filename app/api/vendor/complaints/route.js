/* app/api/vendor/complaints/route.js
 * Vendor Scoped Complaints API
 *
 * Returns non-PII complaint summaries for the authenticated vendor's food packages.
 * Reporter identity (passenger_name, passenger_contact, pnr_number, train_number,
 * coach_seat, passenger_id) and private inspection findings are intentionally omitted.
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const serverSupabase = await createServerClient();
    const {
      data: { user },
      error: authError,
    } = await serverSupabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
    }

    const { data: profile } = await serverSupabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "vendor" && profile?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const serviceUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!serviceUrl || (!serviceKey && !anonKey) || serviceUrl.includes("placeholder")) {
      return NextResponse.json({ error: "Supabase not configured." }, { status: 503 });
    }

    const db = serviceKey
      ? createClient(serviceUrl, serviceKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        })
      : serverSupabase;

    // 1. Resolve vendor owned by this user
    const { data: vendor, error: vendorErr } = await db
      .from("vendors")
      .select("id")
      .eq("owner_user_id", user.id)
      .maybeSingle();

    if (vendorErr) throw vendorErr;
    if (!vendor) {
      return NextResponse.json({ complaints: [] });
    }

    // 2. Get vendor's package IDs
    const { data: pkgs, error: pkgErr } = await db
      .from("food_packages")
      .select("id")
      .eq("vendor_id", vendor.id);

    if (pkgErr) throw pkgErr;
    const pkgIds = (pkgs || []).map((p) => p.id);
    if (pkgIds.length === 0) {
      return NextResponse.json({ complaints: [] });
    }

    // 3. Fetch only non-PII complaint columns for this vendor's packages
    const { data: complaints, error: compErr } = await db
      .from("complaints")
      .select(`
        id,
        package_id,
        issue_type,
        severity,
        status,
        description,
        created_at,
        updated_at,
        food_packages (
          package_name,
          category
        )
      `)
      .in("package_id", pkgIds)
      .order("created_at", { ascending: false });

    if (compErr) throw compErr;

    return NextResponse.json({ complaints: complaints || [] });
  } catch (err) {
    console.error("Vendor complaints API error:", err);
    return NextResponse.json(
      { error: "Failed to load vendor complaints", details: err.message },
      { status: 500 }
    );
  }
}
