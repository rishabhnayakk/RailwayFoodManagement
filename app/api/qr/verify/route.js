import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token")?.trim();

  if (!token || token.length > 256) {
    return NextResponse.json({ valid: false, error: "A valid QR token is required." }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key || url.includes("placeholder")) {
    return NextResponse.json(
      { valid: false, error: "Database is not configured. Please check the Supabase environment variables." },
      { status: 503 }
    );
  }

  try {
    const supabase = createClient(url, key);
    const { data: qrData, error } = await supabase
      .from("qr_codes")
      .select(`
        id,
        qr_token,
        is_active,
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
      .maybeSingle();

    if (error) throw error;
    if (!qrData) {
      return NextResponse.json(
        { valid: false, error: "Invalid QR code. This package is not registered in the railway quality database." },
        { status: 404 }
      );
    }
    if (!qrData.is_active) {
      return NextResponse.json(
        { valid: false, error: "This QR code has been deactivated or recalled by the Railway Administration." },
        { status: 403 }
      );
    }

    const pkg = qrData.food_packages;
    const vendor = pkg?.vendors;
    if (!pkg || pkg.status !== "active" || !vendor || vendor.status !== "active") {
      return NextResponse.json(
        { valid: false, error: "This food package or its catering vendor is no longer active." },
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
