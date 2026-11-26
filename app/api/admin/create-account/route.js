/* app/api/admin/create-account/route.js
 * Server-Side Account Provisioning API
 *
 * Allows the authenticated Admin to create Inspector and Vendor user accounts
 * without affecting the Admin's own session. Uses the Supabase service-role key
 * (available only server-side) so the Admin client never switches sessions.
 *
 * Required env vars:
 *   NEXT_PUBLIC_SUPABASE_URL          — public Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY         — service role secret (never expose client-side)
 *
 * Request body (JSON):
 *   {
 *     email:     string   (required)
 *     password:  string   (required, min 6 chars)
 *     full_name: string   (required)
 *     phone:     string   (optional)
 *     role:      "inspector" | "vendor"  (required)
 *   }
 *
 * Response:
 *   201 { userId, message }
 *   4xx { error }
 *   500 { error, details }
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

const ALLOWED_ROLES = ["inspector", "vendor"];

export async function POST(request) {
  try {
    // Verify requesting user is an active admin
    const serverSupabase = await createServerClient();
    const {
      data: { user },
      error: authError,
    } = await serverSupabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorised — not authenticated." }, { status: 401 });
    }

    const { data: adminProfile, error: profileErr } = await serverSupabase
      .from("profiles")
      .select("role, status")
      .eq("id", user.id)
      .single();

    if (profileErr || adminProfile?.role !== "admin" || adminProfile?.status === "suspended") {
      return NextResponse.json({ error: "Forbidden — active admin access required." }, { status: 403 });
    }

    // Validate request payload
    const body = await request.json();
    const { email, password, full_name, phone, role, vendor_id } = body;

    if (!email || !password || !full_name || !role) {
      return NextResponse.json(
        { error: "Missing required fields: email, password, full_name, role." },
        { status: 400 }
      );
    }

    if (!ALLOWED_ROLES.includes(role)) {
      return NextResponse.json(
        { error: `Invalid role. Must be one of: ${ALLOWED_ROLES.join(", ")}.` },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters." },
        { status: 400 }
      );
    }

    // Create auth user via service role so admin session stays intact
    const serviceUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!serviceUrl || !serviceKey || serviceKey.includes("placeholder")) {
      return NextResponse.json(
        { error: "Server is not configured with the service role key." },
        { status: 503 }
      );
    }

    const adminClient = createClient(serviceUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // createUser skips email confirmation — account is immediately usable
    const { data: createdUser, error: createError } = await adminClient.auth.admin.createUser({
      email: email.trim(),
      password,
      email_confirm: true,
      user_metadata: {
        full_name: full_name.trim(),
        phone: phone?.trim() || null,
        role,
      },
    });

    if (createError) {
      return NextResponse.json(
        { error: createError.message },
        { status: 400 }
      );
    }

    const newUserId = createdUser.user.id;

    // Override default passenger role from handle_new_user trigger
    const { error: profileUpsertErr } = await adminClient.from("profiles").upsert({
      id: newUserId,
      email: email.trim(),
      full_name: full_name.trim(),
      phone: phone?.trim() || null,
      role,
      status: "active",
    });

    if (profileUpsertErr) {
      // Non-fatal: the auth user was created; profile might be set by trigger.
      console.error("Profile upsert warning:", profileUpsertErr.message);
    }

    // Link vendor profile to the vendors table when vendor_id is provided
    if (role === "vendor" && vendor_id) {
      const { error: linkErr } = await adminClient
        .from("vendors")
        .update({ owner_user_id: newUserId, updated_at: new Date().toISOString() })
        .eq("id", vendor_id);
      if (linkErr) {
        console.error("Vendor owner link warning:", linkErr.message);
      }
    }

    // Record account provisioning in audit_logs
    await serverSupabase.from("audit_logs").insert([
      {
        user_id: user.id,
        action: `CREATE_${role.toUpperCase()}_ACCOUNT`,
        target_entity: "profile",
        details: {
          created_user_id: newUserId,
          full_name: full_name.trim(),
          email: email.trim(),
          role,
        },
      },
    ]);

    return NextResponse.json(
      { userId: newUserId, message: `${role} account created successfully.` },
      { status: 201 }
    );
  } catch (err) {
    console.error("create-account API error:", err);
    return NextResponse.json(
      { error: "An unexpected server error occurred.", details: err.message },
      { status: 500 }
    );
  }
}
