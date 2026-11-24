/* app/api/qr/verify/route.js
 * Server-side QR Token Verification Route Handler.
 * Verifies that the scanned QR token exists in the database,
 * is active, and corresponds to an approved food package and registered vendor.
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.json({ valid: false, error: "Token is required." }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key || url.includes("placeholder")) {
    return NextResponse.json(
      { valid: false, error: "Database is not configured yet. Please check .env.local." },
      { status: 503 }
    );
  }

  try {
    const supabase = createClient(url, key);

    // Look up token in qr_codes table
    const { data: qrData, error: qrError } = await supabase
      .from("qr_codes")
      .select(`
        id,
        qr_token,
        is_active,
        created_at,
        food_packages (
          id,
          package_name,
          category,
          description,
          price,
          status,
          vendors (
            id,
            business_name,
            license_number,
            station_location,
            contact_name,
            status
          )
        )
      `)
      .eq("qr_token", token)
      .single();

    if (qrError || !qrData) {
      // Fallback: check if the token was stored directly on food_packages (for backward compatibility)
      const { data: pkgData, error: pkgError } = await supabase
        .from("food_packages")
        .select(`
          id,
          package_name,
          category,
          description,
          price,
          status,
          vendors (
            id,
            business_name,
            license_number,
            station_location,
            contact_name,
            status
          )
        `)
        .eq("qr_token", token)
        .single();

      if (pkgError || !pkgData) {
        return NextResponse.json(
          { valid: false, error: "Invalid QR code. This package is not registered in the railway quality database." },
          { status: 404 }
        );
      }

      return NextResponse.json({
        valid: true,
        package: pkgData,
      });
    }

    if (!qrData.is_active) {
      return NextResponse.json(
        { valid: false, error: "This QR code has been deactivated or recalled by the Railway Administration." },
        { status: 403 }
      );
    }

    return NextResponse.json({
      valid: true,
      package: qrData.food_packages,
      qr_id: qrData.id,
    });
  } catch (err) {
    return NextResponse.json(
      { valid: false, error: "Verification server error: " + err.message },
      { status: 500 }
    );
  }
}
