/* app/api/qr/verify/route.js
 * Secure Server-Side QR Token Verification API
 *
 * Verifies:
 * 1. Token exists in qr_codes
 * 2. QR code is active and not expired
 * 3. Associated food package is active AND approved by Railway Admin
 * 4. Associated vendor is active (not suspended)
 * Returns only public-safe food & vendor verification details.
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token")?.trim();

  if (!token || token.length > 256) {
    return NextResponse.json(
      { valid: false, error: "A valid QR token is required." },
      { status: 400 }
    );
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || (!serviceKey && !anonKey) || url.includes("placeholder")) {
    return NextResponse.json(
      { valid: false, error: "Database is not configured. Please check the Supabase environment variables." },
      { status: 503 }
    );
  }

  try {
    const key = serviceKey && !serviceKey.includes("placeholder") ? serviceKey : anonKey;
    const supabase = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: qrData, error } = await supabase
      .from("qr_codes")
      .select(`
        id,
        qr_token,
        is_active,
        expires_at,
        food_packages (
          id,
          package_name,
          category,
          description,
          price,
          image_url,
          ingredients,
          prepared_at,
          expires_at,
          fssai_license,
          train_info,
          status,
          approval_status,
          vendors (
            id,
            business_name,
            license_number,
            station_location,
            status
          )
        )
      `)
      .eq("qr_token", token)
      .maybeSingle();

    if (error) throw error;

    if (!qrData) {
      return NextResponse.json(
        { valid: false, error: "Invalid QR code. This package is not registered in the RailGuard database." },
        { status: 404 }
      );
    }

    if (!qrData.is_active) {
      return NextResponse.json(
        { valid: false, error: "This QR code has been revoked or deactivated by Railway Administration." },
        { status: 403 }
      );
    }

    if (qrData.expires_at && new Date(qrData.expires_at) < new Date()) {
      return NextResponse.json(
        { valid: false, error: "This QR code has expired and is no longer valid for scanning." },
        { status: 403 }
      );
    }

    const pkg = qrData.food_packages;
    const vendor = pkg?.vendors;

    if (!pkg || !vendor) {
      return NextResponse.json(
        { valid: false, error: "Package or vendor record is unavailable." },
        { status: 404 }
      );
    }

    if (vendor.status !== "active") {
      return NextResponse.json(
        { valid: false, error: "This catering vendor is currently suspended. Food package verification is disabled." },
        { status: 403 }
      );
    }

    if ((pkg.approval_status || "pending") !== "approved") {
      return NextResponse.json(
        { valid: false, error: "This food package has not been approved by Railway Administration yet." },
        { status: 403 }
      );
    }

    if (pkg.status !== "active") {
      return NextResponse.json(
        { valid: false, error: "This food package is currently inactive." },
        { status: 403 }
      );
    }

    return NextResponse.json({ valid: true, package: pkg, qr_id: qrData.id });
  } catch (error) {
    console.error("QR verification failed:", error);
    return NextResponse.json(
      { valid: false, error: "Unable to verify this QR code right now. Please try again." },
      { status: 500 }
    );
  }
}
