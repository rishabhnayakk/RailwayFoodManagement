/* app/api/auth/register/route.js
 * Public Passenger Registration API
 *
 * Creates a confirmed passenger account server-side using Supabase Admin Auth
 * so registration works immediately without sending confirmation emails or
 * hitting Supabase's built-in email rate limit.
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceKey || url.includes("placeholder") || serviceKey.includes("placeholder")) {
      return NextResponse.json(
        { error: "Registration service is not configured on the server." },
        { status: 503 }
      );
    }

    const body = await request.json();
    const fullName = String(body.fullName || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const phone = String(body.phone || "").trim();
    const password = String(body.password || "");

    if (!fullName || !email || !password) {
      return NextResponse.json(
        { error: "Full name, email address, and password are required." },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters long." },
        { status: 400 }
      );
    }

    const adminClient = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        phone: phone || null,
      },
    });

    if (createError) {
      return NextResponse.json(
        { error: createError.message || "Could not create passenger account." },
        { status: 400 }
      );
    }

    // Always enforce passenger role for public signups
    const { error: profileError } = await adminClient.from("profiles").upsert({
      id: created.user.id,
      email,
      full_name: fullName,
      phone: phone || null,
      role: "passenger",
      status: "active",
    });

    if (profileError) {
      console.error("Passenger profile upsert warning:", profileError.message);
    }

    return NextResponse.json(
      { userId: created.user.id, message: "Passenger account created successfully." },
      { status: 201 }
    );
  } catch (err) {
    console.error("POST /api/auth/register error:", err);
    return NextResponse.json(
      { error: "Unable to complete registration right now." },
      { status: 500 }
    );
  }
}
