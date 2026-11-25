/* app/api/complaints/track/route.js
 * Public Complaint Tracking API (By Unique Complaint ID)
 *
 * Looks up a complaint by `complaint_ref` (e.g. RG-2026-A8F42K) or UUID,
 * returning only non-PII status, package info, assigned inspector name (if assigned),
 * and real chronological status history from Supabase.
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REF_REGEX = /^RG-\d{4}-[A-Z0-9]{4,12}$/i;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const rawId = searchParams.get("id")?.trim();

  if (!rawId) {
    return NextResponse.json(
      { found: false, error: "Please enter a Complaint ID (e.g. RG-2026-A8F42K)." },
      { status: 400 }
    );
  }

  const normalizedRef = rawId.toUpperCase();
  const isUuid = UUID_REGEX.test(rawId);
  const isRef = REF_REGEX.test(normalizedRef);

  if (!isUuid && !isRef) {
    return NextResponse.json(
      {
        found: false,
        error: "Invalid Complaint ID format. Expected format like RG-2026-A8F42K.",
      },
      { status: 400 }
    );
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || (!serviceKey && !anonKey) || url.includes("placeholder")) {
    return NextResponse.json(
      {
        found: false,
        error: "Database is not configured. Please configure Supabase environment variables.",
      },
      { status: 503 }
    );
  }

  try {
    const key = serviceKey && !serviceKey.includes("placeholder") ? serviceKey : anonKey;
    const supabase = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    let query = supabase
      .from("complaints")
      .select(`
        id,
        complaint_ref,
        issue_type,
        description,
        severity,
        status,
        created_at,
        updated_at,
        assigned_inspector_id,
        food_packages (
          package_name,
          category,
          vendors (
            business_name,
            station_location
          )
        ),
        profiles!complaints_assigned_inspector_id_fkey (
          full_name
        ),
        complaint_status_history (
          id,
          old_status,
          new_status,
          remarks,
          created_at
        )
      `);

    query = isRef
      ? query.eq("complaint_ref", normalizedRef)
      : query.eq("id", rawId);

    const { data: complaint, error } = await query.maybeSingle();

    if (error) throw error;

    if (!complaint) {
      return NextResponse.json(
        {
          found: false,
          error: "No complaint was found with that Complaint ID. Please check the ID and try again.",
        },
        { status: 404 }
      );
    }

    const timeline = [...(complaint.complaint_status_history || [])].sort(
      (a, b) => new Date(a.created_at) - new Date(b.created_at)
    );

    return NextResponse.json({
      found: true,
      complaint: {
        id: complaint.id,
        complaint_ref: complaint.complaint_ref || complaint.id,
        issue_type: complaint.issue_type,
        description: complaint.description,
        severity: complaint.severity,
        status: complaint.status,
        created_at: complaint.created_at,
        updated_at: complaint.updated_at,
        package: complaint.food_packages
          ? {
              package_name: complaint.food_packages.package_name,
              category: complaint.food_packages.category,
              vendor_name: complaint.food_packages.vendors?.business_name || null,
              station_location: complaint.food_packages.vendors?.station_location || null,
            }
          : null,
        assigned_inspector_name: complaint.profiles?.full_name || null,
        timeline,
      },
    });
  } catch (err) {
    console.error("Complaint tracking error:", err);
    return NextResponse.json(
      { found: false, error: "Unable to retrieve complaint status right now." },
      { status: 500 }
    );
  }
}
