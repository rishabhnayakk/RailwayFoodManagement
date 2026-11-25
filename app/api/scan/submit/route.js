/* app/api/scan/submit/route.js
 * Server-Side QR Feedback & Complaint Submission API
 *
 * Re-verifies the QR token, package approval, and vendor active status server-side,
 * resolves any authenticated passenger ID from cookies, handles optional complaint
 * evidence photo upload into `complaint-evidence`, inserts feedback/complaint records,
 * and returns the database-generated unique Complaint Reference ID (RG-YYYY-XXXXXX).
 */

import crypto from "crypto";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { BUCKETS, MAX_IMAGE_BYTES, ALLOWED_MIME } from "@/lib/constants";

const REF_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateFallbackComplaintRef() {
  const year = new Date().getUTCFullYear();
  let suffix = "";
  for (let i = 0; i < 6; i += 1) {
    suffix += REF_ALPHABET[crypto.randomInt(0, REF_ALPHABET.length)];
  }
  return `RG-${year}-${suffix}`;
}

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

    const serverSupabase = await createServerClient();
    const {
      data: { user },
    } = await serverSupabase.auth.getUser().catch(() => ({ data: { user: null } }));

    const dbKey = serviceKey && !serviceKey.includes("placeholder") ? serviceKey : anonKey;
    const db = createClient(url, dbKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

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
    const { data: fbRow, error: fbErr } = await db
      .from("feedback")
      .insert([
        {
          package_id: pkg.id,
          passenger_id: user?.id || null,
          passenger_name: passengerName || "Anonymous Passenger",
          rating,
          food_quality_rating: foodQualityRating || rating,
          taste_rating: tasteRating || rating,
          packaging_rating: packagingRating || rating,
          hygiene_rating: hygieneRating || rating,
          comment: comment || null,
        },
      ])
      .select("id")
      .single();

    if (fbErr) throw fbErr;

    // 2. Optionally upload evidence & save Complaint with DB-generated unique Complaint ID
    let complaintId = null;
    let complaintRef = null;

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

      const baseComplaintPayload = {
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
      };

      // Let the PostgreSQL trigger/default generate complaint_ref; retry safely on 23505 collisions
      // and fall back to server-side crypto generation if the DB trigger has not been applied yet.
      let compRow = null;
      let lastInsertErr = null;

      for (let attempt = 0; attempt < 5; attempt += 1) {
        const payload =
          attempt === 0
            ? baseComplaintPayload
            : { ...baseComplaintPayload, complaint_ref: generateFallbackComplaintRef() };

        const { data: inserted, error: compErr } = await db
          .from("complaints")
          .insert([payload])
          .select("id, complaint_ref")
          .single();

        if (!compErr && inserted) {
          compRow = inserted;
          break;
        }

        lastInsertErr = compErr;
        if (compErr?.code === "23505" || compErr?.code === "23502") {
          continue;
        }
        break;
      }

      if (!compRow) {
        throw lastInsertErr || new Error("Failed to register complaint.");
      }

      // If DB didn't have the trigger yet and returned null complaint_ref, assign a unique one once.
      if (!compRow.complaint_ref) {
        for (let attempt = 0; attempt < 5; attempt += 1) {
          const candidate = generateFallbackComplaintRef();
          const { data: updated, error: upErr } = await db
            .from("complaints")
            .update({ complaint_ref: candidate })
            .eq("id", compRow.id)
            .is("complaint_ref", null)
            .select("id, complaint_ref")
            .maybeSingle();

          if (!upErr && updated?.complaint_ref) {
            compRow = updated;
            break;
          }
          if (upErr?.code === "23505") continue;
          if (upErr) throw upErr;
        }
      }

      complaintId = compRow.id;
      complaintRef = compRow.complaint_ref;

      await db.from("complaint_status_history").insert([
        {
          complaint_id: complaintId,
          changed_by: user?.id || null,
          old_status: null,
          new_status: "submitted",
          remarks: `Complaint registered (${complaintRef || complaintId.slice(0, 8)}) via RailGuard QR portal.`,
        },
      ]);
    }

    return NextResponse.json(
      {
        success: true,
        feedbackId: fbRow.id,
        complaintId,
        complaintRef,
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
