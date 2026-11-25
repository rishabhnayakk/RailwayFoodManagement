/* app/api/vendor/complaints/route.js
 * Vendor Scoped Complaints API
 * Returns non-PII complaint summaries and high-level inspection status for the vendor's packages.
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
      .select("role, status")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "vendor" || profile?.status === "suspended") {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const serviceUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!serviceUrl || (!serviceKey && !anonKey) || serviceUrl.includes("placeholder")) {
      return NextResponse.json({ error: "Supabase not configured." }, { status: 503 });
    }

    const db =
      serviceKey && !serviceKey.includes("placeholder")
        ? createClient(serviceUrl, serviceKey, {
            auth: { autoRefreshToken: false, persistSession: false },
          })
        : serverSupabase;

    const { data: vendor, error: vendorErr } = await db
      .from("vendors")
      .select("id")
      .eq("owner_user_id", user.id)
      .maybeSingle();

    if (vendorErr) throw vendorErr;
    if (!vendor) {
      return NextResponse.json({ complaints: [] });
    }

    const { data: pkgs, error: pkgErr } = await db
      .from("food_packages")
      .select("id")
      .eq("vendor_id", vendor.id);

    if (pkgErr) throw pkgErr;
    const pkgIds = (pkgs || []).map((p) => p.id);
    if (pkgIds.length === 0) {
      return NextResponse.json({ complaints: [] });
    }

    const { data: complaints, error: compErr } = await db
      .from("complaints")
      .select(`
        id,
        package_id,
        issue_type,
        severity,
        status,
        description,
        assigned_inspector_id,
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

    const sanitized = (complaints || []).map((c) => {
      let inspection_status = "Awaiting Assignment";
      if (c.status === "resolved") inspection_status = "Resolved & Verified";
      else if (c.status === "report_submitted") inspection_status = "Inspection Report Filed";
      else if (c.status === "unable_to_resolve") inspection_status = "Unable to Resolve";
      else if (c.status === "escalated") inspection_status = "Escalated";
      else if (c.status === "in_progress") inspection_status = "Inspection In Progress";
      else if (c.assigned_inspector_id || c.status === "assigned") inspection_status = "Inspector Assigned";

      return {
        id: c.id,
        package_id: c.package_id,
        issue_type: c.issue_type,
        severity: c.severity,
        status: c.status,
        description: c.description,
        created_at: c.created_at,
        updated_at: c.updated_at,
        food_packages: c.food_packages,
        inspection_status,
      };
    });

    return NextResponse.json({ complaints: sanitized });
  } catch (err) {
    console.error("Vendor complaints API error:", err);
    return NextResponse.json(
      { error: "Failed to load vendor complaints", details: err.message },
      { status: 500 }
    );
  }
}
