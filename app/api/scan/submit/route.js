/* app/api/scan/submit/route.js
 * Server-Side QR Feedback & Complaint Submission API
 *
 * Re-verifies the QR token, package approval, and vendor active status server-side,
 * resolves any authenticated passenger ID from cookies, handles optional complaint
 * evidence photo upload into `complaint-evidence`, and writes feedback/complaint records.
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { BUCKETS, MAX_IMAGE_BYTES, ALLOWED_MIME } from "@/lib/constants";

export async function POST(request) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || (!anonKey && !serviceKey) || url.includes("placeholder")) {
      return NextResponse.json({ error: "Database is not configured." }, { status: 503 });
    }

    const formData = await request.formData();
    const token = String(formData.get("token") || "").trim();
    const rating = Number(formData.get("rating") || 0);
    const foodQualityRating = Number(formData.get("food_quality_rating") || rating || 0);
    const tasteRating = Number(formData.get("taste_rating") || rating || 0);
    const packagingRating = Number(formData.get("packaging_rating") || rating || 0);
    const hygieneRating = Number(formData.get("hygiene_rating") || rating || 0);
    const comment = String(formData.get("comment") || "").trim();
    const passengerName = String(formData.get("passenger_name") || "").trim();
    const registerComplaint = String(formData.get("register_complaint") || "false") === "true";

    const issueType = String(formData.get("issue_type") || "").trim();
    const severity = String(formData.get("severity") || "medium").trim();
    const description = String(formData.get("description") || "").trim();
    const passengerContact = String(formData.get("passenger_contact") || "").trim();
    const trainNumber = String(formData.get("train_number") || "").trim();
    const pnrNumber = String(formData.get("pnr_number") || "").trim();
    const coachSeat = String(formData.get("coach_seat") || "").trim();
    const evidenceFile = formData.get("evidence");

    if (!token) {
      return NextResponse.json({ error: "QR token is required." }, { status: 400 });
    }
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return NextResponse.json({ error: "Please provide a valid 1-to-5 star rating." }, { status: 400 });
    }
    if (registerComplaint) {
      if (!passengerName) {
        return NextResponse.json({ error: "Passenger name is required to register a complaint." }, { status: 400 });
      }
      if (!issueType || !description) {
        return NextResponse.json({ error: "Complaint category and description are required." }, { status: 400 });
      }
      if (!["low", "medium", "high", "critical"].includes(severity)) {
        return NextResponse.json({ error: "Invalid severity value." }, { status: 400 });
      }
      if (pnrNumber && !/^\d{10}$/.test(pnrNumber)) {
        return NextResponse.json({ error: "PNR must be 10 digits if provided." }, { status: 400 });
      }
    }

    // Resolve optional authenticated user from cookies
    const serverSupabase = await createServerClient();
    const {
      data: { user },
    } = await serverSupabase.auth.getUser().catch(() => ({ data: { user: null } }));

    const dbKey = serviceKey && !serviceKey.includes("placeholder") ? serviceKey : anonKey;
    const db = createClient(url, dbKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Re-verify QR token -> approved active package -> active vendor
    const { data: qrData, error: qrErr } = await db
      .from("qr_codes")
      .select(`
        id,
        is_active,
        expires_at,
        food_packages (
          id,
          status,
          approval_status,
          vendors ( id, status )
        )
      `)
      .eq("qr_token", token)
      .maybeSingle();

    if (qrErr) throw qrErr;
    const pkg = qrData?.food_packages;
    const vendor = pkg?.vendors;

    if (
      !qrData ||
      !qrData.is_active ||
      (qrData.expires_at && new Date(qrData.expires_at) < new Date()) ||
      !pkg ||
      pkg.status !== "active" ||
      (pkg.approval_status || "pending") !== "approved" ||
      !vendor ||
      vendor.status !== "active"
    ) {
      return NextResponse.json(
        { error: "This QR code is invalid, revoked, unapproved, or its vendor is suspended." },
        { status: 403 }
      );
    }

    // 1. Save Feedback
    const baseFeedback = {
      package_id: pkg.id,
      passenger_id: user?.id || null,
      passenger_name: passengerName || "Anonymous Passenger",
      rating,
      comment: comment || null,
    };

    const { data: fbRow, error: fbErr } = await db
      .from("feedback")
      .insert([
        {
          ...baseFeedback,
          food_quality_rating: foodQualityRating || rating,
          taste_rating: tasteRating || rating,
          packaging_rating: packagingRating || rating,
          hygiene_rating: hygieneRating || rating,
        },
      ])
      .select("id")
      .single();

    if (fbErr) throw fbErr;

    // 2. Optionally upload evidence & save Complaint
    let complaintId = null;
    if (registerComplaint) {
      let uploadedImageUrl = null;

      if (evidenceFile && typeof evidenceFile === "object" && evidenceFile.size > 0) {
        if (!ALLOWED_MIME.includes(evidenceFile.type)) {
          return NextResponse.json(
            { error: "Unsupported evidence image format. Use JPEG, PNG, or WebP." },
            { status: 400 }
          );
        }
        if (evidenceFile.size > MAX_IMAGE_BYTES) {
          return NextResponse.json(
            { error: "Evidence image must be 5 MB or smaller." },
            { status: 400 }
          );
        }

        const ext = evidenceFile.name?.split(".").pop() || "jpg";
        const filePath = `complaints/${pkg.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const bytes = await evidenceFile.arrayBuffer();

        const { error: uploadErr } = await db.storage
          .from(BUCKETS.COMPLAINT_EVIDENCE)
          .upload(filePath, Buffer.from(bytes), { contentType: evidenceFile.type });

        if (uploadErr) {
          throw new Error(`Evidence upload failed: ${uploadErr.message}`);
        }

        const { data: urlData } = db.storage.from(BUCKETS.COMPLAINT_EVIDENCE).getPublicUrl(filePath);
        uploadedImageUrl = urlData.publicUrl;
      }

      const { data: compRow, error: compErr } = await db
        .from("complaints")
        .insert([
          {
            package_id: pkg.id,
            passenger_id: user?.id || null,
            passenger_name: passengerName,
            passenger_contact: passengerContact || null,
            train_number: trainNumber || null,
            pnr_number: pnrNumber || null,
            coach_seat: coachSeat || null,
            issue_type: issueType,
            severity,
            description,
            status: "submitted",
            image_url: uploadedImageUrl,
          },
        ])
        .select("id")
        .single();

      if (compErr) throw compErr;
      complaintId = compRow.id;

      await db.from("complaint_status_history").insert([
        {
          complaint_id: complaintId,
          changed_by: user?.id || null,
          old_status: null,
          new_status: "submitted",
          remarks: "Complaint submitted by passenger via RailGuard QR scan portal.",
        },
      ]);
    }

    return NextResponse.json(
      {
        success: true,
        feedbackId: fbRow.id,
        complaintId,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("QR submission error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to submit feedback." },
      { status: 500 }
    );
  }
}
