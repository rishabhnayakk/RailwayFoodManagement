/* app/api/admin/stats/route.js
 * Authenticated Admin Statistics API Route
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !anonKey || url.includes("placeholder")) {
      return NextResponse.json(
        { error: "Supabase not configured in .env.local" },
        { status: 503 }
      );
    }

    const serverSupabase = await createServerClient();
    const {
      data: { user },
      error: authError,
    } = await serverSupabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorised — not authenticated." }, { status: 401 });
    }

    const { data: profile, error: profErr } = await serverSupabase
      .from("profiles")
      .select("role, status")
      .eq("id", user.id)
      .single();

    if (profErr || profile?.role !== "admin" || profile?.status === "suspended") {
      return NextResponse.json({ error: "Forbidden — active admin access required." }, { status: 403 });
    }

    const supabase = serviceKey && !serviceKey.includes("placeholder")
      ? createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
      : serverSupabase;

    const [
      feedbackCountRes,
      complaintsCountRes,
      submittedCountRes,
      pendingReviewCountRes,
      assignedCountRes,
      inProgressCountRes,
      reportSubmittedCountRes,
      unableCountRes,
      escalatedCountRes,
      resolvedCountRes,
      reopenedCountRes,
      totalVendorsRes,
      activeVendorsRes,
      suspendedVendorsRes,
      inspectorsCountRes,
      pendingPackagesRes,
      ratingRes,
      recentComplaintsRes,
      allComplaintsRes,
    ] = await Promise.all([
      supabase.from("feedback").select("*", { count: "exact", head: true }),
      supabase.from("complaints").select("*", { count: "exact", head: true }),
      supabase.from("complaints").select("*", { count: "exact", head: true }).eq("status", "submitted"),
      supabase.from("complaints").select("*", { count: "exact", head: true }).eq("status", "pending_review"),
      supabase.from("complaints").select("*", { count: "exact", head: true }).eq("status", "assigned"),
      supabase.from("complaints").select("*", { count: "exact", head: true }).eq("status", "in_progress"),
      supabase.from("complaints").select("*", { count: "exact", head: true }).eq("status", "report_submitted"),
      supabase.from("complaints").select("*", { count: "exact", head: true }).eq("status", "unable_to_resolve"),
      supabase.from("complaints").select("*", { count: "exact", head: true }).eq("status", "escalated"),
      supabase.from("complaints").select("*", { count: "exact", head: true }).eq("status", "resolved"),
      supabase.from("complaints").select("*", { count: "exact", head: true }).eq("status", "reopened"),
      supabase.from("vendors").select("*", { count: "exact", head: true }),
      supabase.from("vendors").select("*", { count: "exact", head: true }).eq("status", "active"),
      supabase.from("vendors").select("*", { count: "exact", head: true }).eq("status", "suspended"),
      supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "inspector"),
      supabase.from("food_packages").select("*", { count: "exact", head: true }).eq("approval_status", "pending"),
      supabase.from("feedback").select("rating"),
      supabase
        .from("complaints")
        .select(`
          id,
          status,
          severity,
          created_at,
          food_packages (
            package_name,
            vendors (
              business_name
            )
          )
        `)
        .order("created_at", { ascending: false })
        .limit(6),
      supabase.from("complaints").select("issue_type"),
    ]);

    let avg_rating = 0;
    if (ratingRes.data && ratingRes.data.length > 0) {
      const sum = ratingRes.data.reduce((acc, curr) => acc + (curr.rating || 0), 0);
      avg_rating = sum / ratingRes.data.length;
    }

    const issueMap = {};
    if (allComplaintsRes.data) {
      allComplaintsRes.data.forEach((item) => {
        const type = item.issue_type || "other";
        issueMap[type] = (issueMap[type] || 0) + 1;
      });
    }

    const hygieneCounts = Object.entries(issueMap).map(([issue_type, count]) => ({
      issue_type,
      count,
    }));

    const pendingComplaints = (submittedCountRes.count ?? 0) + (pendingReviewCountRes.count ?? 0);
    const inProgressComplaints = (assignedCountRes.count ?? 0) + (inProgressCountRes.count ?? 0);

    return NextResponse.json({
      stats: {
        total_feedback: feedbackCountRes.count ?? 0,
        total_complaints: complaintsCountRes.count ?? 0,
        pending_complaints: pendingComplaints,
        assigned_complaints: assignedCountRes.count ?? 0,
        in_progress_complaints: inProgressCountRes.count ?? 0,
        investigating_complaints: inProgressComplaints,
        report_submitted_complaints: reportSubmittedCountRes.count ?? 0,
        unable_to_resolve_complaints: unableCountRes.count ?? 0,
        escalated_complaints: escalatedCountRes.count ?? 0,
        resolved_complaints: resolvedCountRes.count ?? 0,
        reopened_complaints: reopenedCountRes.count ?? 0,
        total_vendors: totalVendorsRes.count ?? 0,
        active_vendors: activeVendorsRes.count ?? 0,
        suspended_vendors: suspendedVendorsRes.count ?? 0,
        total_inspectors: inspectorsCountRes.count ?? 0,
        pending_packages: pendingPackagesRes.count ?? 0,
        avg_rating: avg_rating ? avg_rating.toFixed(1) : null,
      },
      recentComplaints: recentComplaintsRes.data ?? [],
      hygieneCounts,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to load database stats", details: err.message },
      { status: 500 }
    );
  }
}
