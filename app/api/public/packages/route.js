/* app/api/public/packages/route.js
 * Public Food Catalog API for the Homepage
 *
 * Returns active food items from active vendors stored in Supabase.
 * Falls back gracefully if newer schema columns haven't been migrated yet.
 * Exposes `qr_token` only for approved items with active QR codes.
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || (!serviceKey && !anonKey) || url.includes("placeholder")) {
    return NextResponse.json({ configured: false, packages: [] }, { status: 200 });
  }

  try {
    const key = serviceKey && !serviceKey.includes("placeholder") ? serviceKey : anonKey;
    const supabase = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data, error } = await supabase
      .from("food_packages")
      .select(`
        *,
        vendors (
          id,
          business_name,
          station_location,
          status
        ),
        qr_codes (
          qr_token,
          is_active
        )
      `)
      .eq("status", "active")
      .order("created_at", { ascending: false });

    if (error) throw error;

    const packages = (data || [])
      .filter((pkg) => {
        const vendorActive = !pkg.vendors || pkg.vendors.status === "active";
        const approval = pkg.approval_status || "approved";
        return vendorActive && approval !== "rejected";
      })
      .map((pkg) => {
        const qr = Array.isArray(pkg.qr_codes) ? pkg.qr_codes[0] : pkg.qr_codes;
        const approvalStatus = pkg.approval_status || "approved";
        const isApproved = approvalStatus === "approved";
        const qrActive = qr ? Boolean(qr.is_active) : false;

        return {
          id: pkg.id,
          package_code: pkg.package_code || pkg.id.slice(0, 8).toUpperCase(),
          package_name: pkg.package_name,
          category: pkg.category,
          description: pkg.description,
          price: pkg.price,
          image_url: pkg.image_url || null,
          ingredients: pkg.ingredients || null,
          prepared_at: pkg.prepared_at || null,
          expires_at: pkg.expires_at || null,
          fssai_license: pkg.fssai_license || null,
          train_info: pkg.train_info || null,
          approval_status: approvalStatus,
          created_at: pkg.created_at,
          vendor_name: pkg.vendors?.business_name || "Authorized Catering Vendor",
          station_location: pkg.vendors?.station_location || null,
          has_qr: Boolean(qr?.qr_token),
          qr_token: isApproved && qrActive ? qr.qr_token : null,
        };
      });

    return NextResponse.json({ configured: true, packages });
  } catch (err) {
    console.error("GET /api/public/packages error:", err);
    const isMissingTables =
      err?.code === "PGRST205" ||
      String(err?.message || "").includes("schema cache") ||
      String(err?.message || "").includes("does not exist");
    return NextResponse.json(
      {
        configured: true,
        packages: [],
        error: isMissingTables
          ? "Supabase is connected, but the database tables have not been created yet. Run supabase/schema.sql and supabase/seed_2_food_items.sql in your Supabase Dashboard SQL Editor."
          : err.message || "Unable to load food catalog right now.",
      },
      { status: 500 }
    );
  }
}
