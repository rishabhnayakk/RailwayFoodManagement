/* app/api/admin/stats/route.js
 * Admin Statistics API Route
 *
 * Route Handler querying Supabase for real dashboard metrics:
 * - total feedback
 * - total complaints
 * - counts by status (pending_review, assigned, in_progress, report_submitted, resolved, reopened)
 * - average food rating
 * - total vendors
 * - recent complaints
 * - hygiene issue breakdown
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !key || url.includes("placeholder")) {
      return NextResponse.json(
        { error: "Supabase not configured in .env.local" },
        { status: 503 }
      );
    }

    const supabase = createClient(url, key);

    // Run parallel count and aggregate queries
    const [
      feedbackCountRes,
      complaintsCountRes,
      pendingCountRes,
      assignedCountRes,
      inProgressCountRes,
      reportSubmittedCountRes,
      resolvedCountRes,
      reopenedCountRes,
      vendorsCountRes,
      inspectorsCountRes,
      ratingRes,
      recentComplaintsRes,
      allComplaintsRes,
    ] = await Promise.all([
      supabase.from("feedback").select("*", { count: "exact", head: true }),
      supabase.from("complaints").select("*", { count: "exact", head: true }),
      // 'pending_review' is the initial status when a complaint is submitted
      supabase.from("complaints").select("*", { count: "exact", head: true }).eq("status", "pending_review"),
      // 'assigned' — complaint assigned to an inspector, awaiting investigation start
      supabase.from("complaints").select("*", { count: "exact", head: true }).eq("status", "assigned"),
      // 'in_progress' — inspector is actively investigating
      supabase.from("complaints").select("*", { count: "exact", head: true }).eq("status", "in_progress"),
      // 'report_submitted' — inspector submitted findings, awaiting admin review
      supabase.from("complaints").select("*", { count: "exact", head: true }).eq("status", "report_submitted"),
      // 'resolved' — admin closed complaint
      supabase.from("complaints").select("*", { count: "exact", head: true }).eq("status", "resolved"),
      // 'reopened' — admin reopened a previously resolved complaint
      supabase.from("complaints").select("*", { count: "exact", head: true }).eq("status", "reopened"),
      supabase.from("vendors").select("*", { count: "exact", head: true }),
      supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "inspector"),
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
        .limit(5),
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

    // Active = complaints not yet resolved or closed
    const activeComplaints =
      (pendingCountRes.count ?? 0) +
      (assignedCountRes.count ?? 0) +
      (inProgressCountRes.count ?? 0) +
      (reportSubmittedCountRes.count ?? 0) +
      (reopenedCountRes.count ?? 0);

    return NextResponse.json({
      stats: {
        total_feedback: feedbackCountRes.count ?? 0,
        total_complaints: complaintsCountRes.count ?? 0,
        pending_complaints: pendingCountRes.count ?? 0,
        assigned_complaints: assignedCountRes.count ?? 0,
        in_progress_complaints: inProgressCountRes.count ?? 0,
        report_submitted_complaints: reportSubmittedCountRes.count ?? 0,
        resolved_complaints: resolvedCountRes.count ?? 0,
        reopened_complaints: reopenedCountRes.count ?? 0,
        active_complaints: activeComplaints,
        total_vendors: vendorsCountRes.count ?? 0,
        total_inspectors: inspectorsCountRes.count ?? 0,
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
