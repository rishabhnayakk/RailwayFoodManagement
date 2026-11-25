/* app/api/admin/toggle-status/route.js
 * Admin Account & Vendor Activation / Suspension API
 *
 * Allows authenticated Admin to activate or suspend:
 * - Vendor records (and their linked owner profile + auth user ban)
 * - Inspector accounts (profile status + auth user ban)
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

export async function POST(request) {
  try {
    const serverSupabase = await createServerClient();
    const {
      data: { user },
      error: authError,
    } = await serverSupabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
    }

    const { data: adminProfile } = await serverSupabase
      .from("profiles")
      .select("role, status")
      .eq("id", user.id)
      .single();

    if (adminProfile?.role !== "admin" || adminProfile?.status === "suspended") {
      return NextResponse.json({ error: "Forbidden — admin access required." }, { status: 403 });
    }

    const body = await request.json();
    const { entityType, entityId, nextStatus } = body;

    if (!["vendor", "inspector"].includes(entityType) || !entityId || !["active", "suspended"].includes(nextStatus)) {
      return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
    }

    const serviceUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const adminClient =
      serviceUrl && serviceKey && !serviceKey.includes("placeholder")
        ? createClient(serviceUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
        : null;

    const db = adminClient || serverSupabase;
    const now = new Date().toISOString();

    if (entityType === "vendor") {
      const { data: vendor, error: vErr } = await db
        .from("vendors")
        .update({ status: nextStatus, updated_at: now })
        .eq("id", entityId)
        .select("id, business_name, owner_user_id")
        .single();

      if (vErr || !vendor) {
        return NextResponse.json({ error: vErr?.message || "Vendor not found." }, { status: 400 });
      }

      if (vendor.owner_user_id) {
        await db
          .from("profiles")
          .update({ status: nextStatus, updated_at: now })
          .eq("id", vendor.owner_user_id);

        if (adminClient) {
          await adminClient.auth.admin.updateUserById(vendor.owner_user_id, {
            ban_duration: nextStatus === "suspended" ? "876000h" : "none",
          });
        }
      }

      await db.from("audit_logs").insert([
        {
          user_id: user.id,
          action: nextStatus === "suspended" ? "SUSPEND_VENDOR" : "ACTIVATE_VENDOR",
          target_entity: "vendor",
          details: { vendor_id: vendor.id, business_name: vendor.business_name, new_status: nextStatus },
        },
      ]);

      return NextResponse.json({ success: true, status: nextStatus });
    }

    // Inspector account
    if (entityId === user.id) {
      return NextResponse.json({ error: "You cannot suspend your own account." }, { status: 400 });
    }

    const { data: inspector, error: iErr } = await db
      .from("profiles")
      .update({ status: nextStatus, updated_at: now })
      .eq("id", entityId)
      .eq("role", "inspector")
      .select("id, full_name, email")
      .single();

    if (iErr || !inspector) {
      return NextResponse.json({ error: iErr?.message || "Inspector account not found." }, { status: 400 });
    }

    if (adminClient) {
      await adminClient.auth.admin.updateUserById(inspector.id, {
        ban_duration: nextStatus === "suspended" ? "876000h" : "none",
      });
    }

    await db.from("audit_logs").insert([
      {
        user_id: user.id,
        action: nextStatus === "suspended" ? "SUSPEND_INSPECTOR" : "ACTIVATE_INSPECTOR",
        target_entity: "profile",
        details: { inspector_id: inspector.id, full_name: inspector.full_name, new_status: nextStatus },
      },
    ]);

    return NextResponse.json({ success: true, status: nextStatus });
  } catch (err) {
    console.error("toggle-status API error:", err);
    return NextResponse.json({ error: "Failed to update account status." }, { status: 500 });
  }
}
