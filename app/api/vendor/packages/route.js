/* app/api/vendor/packages/route.js
 * Vendor Food Package Creation API
 *
 * Atomically creates a vendor food package with a unique `package_code` (FD-YYYY-XXXXXX)
 * and a unique QR token in `qr_codes` at the exact time the vendor submits the food item.
 */

import crypto from "crypto";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateFallbackPackageCode() {
  const year = new Date().getUTCFullYear();
  let suffix = "";
  for (let i = 0; i < 6; i += 1) {
    suffix += CODE_ALPHABET[crypto.randomInt(0, CODE_ALPHABET.length)];
  }
  return `FD-${year}-${suffix}`;
}

export async function POST(request) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || (!anonKey && !serviceKey) || url.includes("placeholder")) {
      return NextResponse.json({ error: "Database is not configured." }, { status: 503 });
    }

    const serverSupabase = await createServerClient();
    const {
      data: { user },
      error: authError,
    } = await serverSupabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorised — please sign in." }, { status: 401 });
    }

    const { data: profile } = await serverSupabase
      .from("profiles")
      .select("role, status")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "vendor" || profile?.status === "suspended") {
      return NextResponse.json({ error: "Forbidden — active vendor account required." }, { status: 403 });
    }

    const db =
      serviceKey && !serviceKey.includes("placeholder")
        ? createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
        : serverSupabase;

    const { data: vendor, error: vErr } = await db
      .from("vendors")
      .select("*")
      .eq("owner_user_id", user.id)
      .single();

    if (vErr || !vendor) {
      return NextResponse.json({ error: "No vendor record linked to your account." }, { status: 404 });
    }

    if (vendor.status !== "active") {
      return NextResponse.json({ error: "Suspended vendors cannot submit food items." }, { status: 403 });
    }

    const body = await request.json();
    const packageName = String(body.package_name || "").trim();
    const category = String(body.category || "Meals").trim();
    const description = String(body.description || "").trim();
    const ingredients = String(body.ingredients || "").trim();
    const price = Number(body.price);
    const imageUrl = body.image_url ? String(body.image_url).trim() : null;
    const preparedAt = body.prepared_at || null;
    const expiresAt = body.expires_at || null;
    const fssaiLicense = String(body.fssai_license || vendor.license_number || "").trim();
    const trainInfo = body.train_info ? String(body.train_info).trim() : null;
    const status = body.status === "inactive" ? "inactive" : "active";

    if (!packageName || !description || !ingredients) {
      return NextResponse.json(
        { error: "Food name, description, and ingredients are required." },
        { status: 400 }
      );
    }
    if (!Number.isFinite(price) || price <= 0) {
      return NextResponse.json({ error: "Price must be a valid positive amount." }, { status: 400 });
    }
    if (preparedAt && expiresAt && new Date(expiresAt) <= new Date(preparedAt)) {
      return NextResponse.json(
        { error: "Expiry date/time must be after preparation date/time." },
        { status: 400 }
      );
    }

    const basePayload = {
      vendor_id: vendor.id,
      package_name: packageName,
      category,
      description,
      price,
      image_url: imageUrl,
      ingredients,
      prepared_at: preparedAt,
      expires_at: expiresAt,
      fssai_license: fssaiLicense || null,
      train_info: trainInfo,
      status,
      approval_status: "pending",
    };

    // Let PostgreSQL trigger/default generate unique package_code + qr_codes row;
    // retry safely on 23505 or fall back if trigger isn't installed yet.
    let insertedPkg = null;
    let lastErr = null;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const payload =
        attempt === 0 ? basePayload : { ...basePayload, package_code: generateFallbackPackageCode() };

      const { data, error } = await db
        .from("food_packages")
        .insert([payload])
        .select("*")
        .single();

      if (!error && data) {
        insertedPkg = data;
        break;
      }
      lastErr = error;
      if (error?.code === "23505" || error?.code === "23502") continue;
      break;
    }

    if (!insertedPkg) {
      throw lastErr || new Error("Failed to create food package.");
    }

    // Fallback if DB lacked package_code trigger
    if (!insertedPkg.package_code) {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const code = generateFallbackPackageCode();
        const { data: updated, error: upErr } = await db
          .from("food_packages")
          .update({ package_code: code })
          .eq("id", insertedPkg.id)
          .is("package_code", null)
          .select("*")
          .maybeSingle();
        if (!upErr && updated) {
          insertedPkg = updated;
          break;
        }
        if (upErr?.code === "23505") continue;
        if (upErr) throw upErr;
      }
    }

    // Ensure unique QR code exists immediately upon food item submission
    let { data: qrRecord } = await db
      .from("qr_codes")
      .select("*")
      .eq("package_id", insertedPkg.id)
      .maybeSingle();

    if (!qrRecord) {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const token = crypto.randomBytes(24).toString("hex");
        const { data: createdQr, error: qrErr } = await db
          .from("qr_codes")
          .insert([
            {
              package_id: insertedPkg.id,
              qr_token: token,
              is_active: true,
              created_by: user.id,
            },
          ])
          .select("*")
          .single();

        if (!qrErr && createdQr) {
          qrRecord = createdQr;
          break;
        }
        if (qrErr?.code === "23505") continue;
        throw qrErr;
      }
    } else if (!qrRecord.created_by) {
      const { data: updatedQr } = await db
        .from("qr_codes")
        .update({ created_by: user.id })
        .eq("id", qrRecord.id)
        .select("*")
        .maybeSingle();
      if (updatedQr) qrRecord = updatedQr;
    }

    await db.from("audit_logs").insert([
      {
        user_id: user.id,
        action: "VENDOR_UPLOAD_PACKAGE_AND_QR",
        target_entity: "food_package",
        details: {
          package_id: insertedPkg.id,
          package_code: insertedPkg.package_code,
          package_name: insertedPkg.package_name,
          vendor_id: vendor.id,
        },
      },
    ]);

    return NextResponse.json({ package: insertedPkg, qr: qrRecord }, { status: 201 });
  } catch (err) {
    console.error("POST /api/vendor/packages error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to submit food package." },
      { status: 500 }
    );
  }
}
