/* app/scan/[token]/page.js
 * Verified QR Code Feedback & Complaint Submission Page
 *
 * Verifies the food package and vendor from Supabase.
 * Allows passenger to:
 * 1. Submit star rating and written feedback.
 * 2. Submit hygiene/quality complaints with photo evidence and optional journey details.
 */

"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import { Input, Textarea, Select } from "@/components/ui/Input";
import { SkeletonCard, SkeletonLine } from "@/components/ui/Skeleton";
import { HYGIENE_ISSUES } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import { getCurrentUserProfile } from "@/lib/auth";
import styles from "./feedback.module.css";

const RATING_DESCRIPTIONS = {
  1: "Very Poor – Unacceptable Quality",
  2: "Poor – Needs Significant Improvement",
  3: "Average – Met Basic Expectations",
  4: "Good – Satisfactory Quality & Taste",
  5: "Excellent – Exceeded Standards",
};

export default function VerifiedPackageFeedbackPage({ params }) {
  const resolvedParams = use(params);
  const token = resolvedParams?.token;
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [packageData, setPackageData] = useState(null);
  const [activeTab, setActiveTab] = useState("rating"); // "rating" | "complaint"

  // User session state
  const [userProfile, setUserProfile] = useState(null);

  // Rating Form State
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [passengerName, setPassengerName] = useState("");
  const [submittingRating, setSubmittingRating] = useState(false);

  // Complaint Form State
  const [issueType, setIssueType] = useState("foreign_object");
  const [severity, setSeverity] = useState("medium");
  const [description, setDescription] = useState("");
  const [passengerContact, setPassengerContact] = useState("");
  const [pnrNumber, setPnrNumber] = useState("");
  const [trainNumber, setTrainNumber] = useState("");
  const [coachSeat, setCoachSeat] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [submittingComplaint, setSubmittingComplaint] = useState(false);

  // Submission confirmation state
  const [confirmation, setConfirmation] = useState(null);

  useEffect(() => {
    async function verifyAndLoad() {
      setLoading(true);
      setError("");

      try {
        // Fetch current user if logged in
        const authData = await getCurrentUserProfile();
        if (authData) {
          setUserProfile(authData);
          setPassengerName(authData.profile?.full_name || "");
          setPassengerContact(authData.profile?.phone || authData.user?.email || "");
        }

        // Verify QR token with backend
        const res = await fetch(`/api/qr/verify?token=${encodeURIComponent(token)}`);
        const data = await res.json();

        if (!res.ok || !data.valid) {
          setError(data.error || "Package verification failed. QR token is invalid.");
          return;
        }

        setPackageData(data.package);
      } catch (err) {
        setError("Error connecting to railway verification service: " + err.message);
      } finally {
        setLoading(false);
      }
    }

    if (token) {
      verifyAndLoad();
    }
  }, [token]);

  // Handle Photo File Selection
  function handleImageChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please select a valid image file (JPEG, PNG, WebP).");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert("Image size exceeds the maximum limit of 5 MB.");
      return;
    }

    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  // Handle Rating Submission
  async function handleSubmitRating(e) {
    e.preventDefault();
    setSubmittingRating(true);

    const supabase = createClient();
    if (!supabase) {
      alert("Database connection is not configured.");
      setSubmittingRating(false);
      return;
    }

    try {
      const { data, error: insertErr } = await supabase.from("feedback").insert([
        {
          package_id: packageData.id,
          passenger_id: userProfile?.user?.id || null,
          passenger_name: passengerName || "Anonymous Passenger",
          rating: rating,
          comment: comment || null,
        },
      ]);

      if (insertErr) throw insertErr;

      setConfirmation({
        type: "feedback",
        title: "Rating & Feedback Recorded!",
        message: "Thank you for contributing to Indian Railways food quality monitoring. Your feedback directly impacts vendor ratings.",
      });
    } catch (err) {
      alert("Failed to submit feedback: " + err.message);
    } finally {
      setSubmittingRating(false);
    }
  }

  // Handle Complaint Submission
  async function handleSubmitComplaint(e) {
    e.preventDefault();
    setSubmittingComplaint(true);

    const supabase = createClient();
    if (!supabase) {
      alert("Database connection is not configured.");
      setSubmittingComplaint(false);
      return;
    }

    try {
      let uploadedImageUrl = null;

      // Upload image to Supabase Storage if attached
      if (imageFile) {
        const fileExt = imageFile.name.split(".").pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `evidence/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("food-images")
          .upload(filePath, imageFile);

        if (!uploadError) {
          const { data: urlData } = supabase.storage
            .from("food-images")
            .getPublicUrl(filePath);
          uploadedImageUrl = urlData.publicUrl;
        }
      }

      // Insert Complaint
      const { data: complaintData, error: complaintErr } = await supabase
        .from("complaints")
        .insert([
          {
            package_id: packageData.id,
            passenger_id: userProfile?.user?.id || null,
            issue_type: issueType,
            description: description,
            severity: severity,
            status: "submitted",
            image_url: uploadedImageUrl,
            passenger_contact: passengerContact || null,
            pnr_number: pnrNumber || null,
            train_number: trainNumber || null,
            coach_seat: coachSeat || null,
          },
        ])
        .select()
        .single();

      if (complaintErr) throw complaintErr;

      // Insert Initial Status History Audit
      await supabase.from("complaint_status_history").insert([
        {
          complaint_id: complaintData.id,
          changed_by: userProfile?.user?.id || null,
          old_status: null,
          new_status: "submitted",
          remarks: "Complaint filed by passenger via QR scan portal.",
        },
      ]);

      setConfirmation({
        type: "complaint",
        refId: complaintData.id,
        title: "Hygiene Complaint Registered",
        message: "Your complaint has been queued for Railway Quality Authority review and assignment to a field inspector.",
      });
    } catch (err) {
      alert("Failed to submit complaint: " + err.message);
    } finally {
      setSubmittingComplaint(false);
    }
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <Link href="/scan" className={styles.backLink}>
          ← Scan Another Package
        </Link>
        <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>
          🛡️ RailGuard Verified
        </div>
      </header>

      <main className={styles.main}>
        {/* Loading state */}
        {loading && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <SkeletonCard />
            <SkeletonCard />
          </div>
        )}

        {/* Error / Invalid QR state */}
        {!loading && error && (
          <div className={styles.packageCard} style={{ textAlign: "center", padding: "48px 24px" }}>
            <div style={{ fontSize: "3rem", marginBottom: "16px" }}>⚠️</div>
            <h2 style={{ color: "var(--red)", fontSize: "1.3rem", fontWeight: 700, marginBottom: "8px" }}>
              Invalid or Unrecognized QR Code
            </h2>
            <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", maxWidth: "480px", margin: "0 auto 24px", lineHeight: 1.6 }}>
              {error}
            </p>
            <Button variant="primary" onClick={() => router.push("/scan")}>
              Return to QR Scanner
            </Button>
          </div>
        )}

        {/* Confirmation Screen */}
        {!loading && confirmation && (
          <div className={styles.successBox}>
            <div className={styles.successIcon}>
              {confirmation.type === "complaint" ? "📋" : "⭐"}
            </div>
            <h2 style={{ fontSize: "1.4rem", fontWeight: 700, marginBottom: "8px" }}>
              {confirmation.title}
            </h2>
            <p style={{ color: "var(--text-muted)", fontSize: "0.95rem", maxWidth: "480px", margin: "0 auto", lineHeight: 1.6 }}>
              {confirmation.message}
            </p>

            {confirmation.refId && (
              <div>
                <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "16px" }}>
                  Your Official Tracking Reference Number:
                </p>
                <div className={styles.refCode}>{confirmation.refId}</div>
              </div>
            )}

            <div style={{ display: "flex", gap: "12px", justifyContent: "center", marginTop: "24px" }}>
              {userProfile ? (
                <Button variant="primary" onClick={() => router.push("/passenger/complaints")}>
                  Track in My Dashboard →
                </Button>
              ) : (
                <Button variant="outline" onClick={() => router.push("/auth/login")}>
                  Sign In to Track Updates
                </Button>
              )}
              <Button variant="ghost" onClick={() => router.push("/")}>
                Home
              </Button>
            </div>
          </div>
        )}

        {/* Verified Package & Form View */}
        {!loading && !error && !confirmation && packageData && (
          <>
            {/* Package & Vendor Credentials Card */}
            <div className={styles.packageCard}>
              <span className={styles.badgeVerified}>
                ✓ Verified Railway Authorized Meal
              </span>
              <h1 className={styles.packageName}>{packageData.package_name}</h1>
              {packageData.price && (
                <div className={styles.packagePrice}>
                  Tariff: ₹{Number(packageData.price).toFixed(2)}
                </div>
              )}
              {packageData.description && (
                <p style={{ fontSize: "0.875rem", color: "var(--text-muted)", marginBottom: "16px" }}>
                  {packageData.description}
                </p>
              )}

              {/* Vendor & Station Info */}
              <div className={styles.metaGrid}>
                <div className={styles.metaItem}>
                  <strong>Licensed Vendor</strong>
                  {packageData.vendors?.business_name || "Railway Catering Contractor"}
                </div>
                <div className={styles.metaItem}>
                  <strong>FSSAI / Railway License</strong>
                  {packageData.vendors?.license_number || "Verified Contractor"}
                </div>
                <div className={styles.metaItem}>
                  <strong>Station / Base Kitchen</strong>
                  {packageData.vendors?.station_location || "Indian Railways Network"}
                </div>
                <div className={styles.metaItem}>
                  <strong>Category</strong>
                  {packageData.category || "Catering Service"}
                </div>
              </div>
            </div>

            {/* Tab Selector */}
            <div className={styles.tabRow}>
              <button
                type="button"
                className={`${styles.tabBtn} ${activeTab === "rating" ? styles.tabBtnActive : ""}`}
                onClick={() => setActiveTab("rating")}
              >
                ⭐ Rate Food & Feedback
              </button>
              <button
                type="button"
                className={`${styles.tabBtn} ${activeTab === "complaint" ? styles.tabBtnActive : ""}`}
                onClick={() => setActiveTab("complaint")}
              >
                ⚠️ Report Hygiene Complaint
              </button>
            </div>

            {/* Tab 1: Food Rating Form */}
            {activeTab === "rating" && (
              <form onSubmit={handleSubmitRating} className={styles.formCard}>
                <div className={styles.ratingSection}>
                  <p className={styles.ratingLabel}>
                    {RATING_DESCRIPTIONS[rating]}
                  </p>
                  <div className={styles.starRow}>
                    {[1, 2, 3, 4, 5].map((s) => (
                      <button
                        key={s}
                        type="button"
                        className={`${styles.starBtn} ${s <= rating ? styles.starFilled : ""}`}
                        onClick={() => setRating(s)}
                        title={`${s} Stars`}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                  <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                    Click a star to change your rating (1 to 5)
                  </span>
                </div>

                <Input
                  label="Your Name (Optional)"
                  placeholder="e.g. Ramesh Kumar (Leave blank for anonymous)"
                  value={passengerName}
                  onChange={(e) => setPassengerName(e.target.value)}
                />

                <Textarea
                  label="Written Comments & Taste Feedback"
                  placeholder="Tell us about the freshness, temperature, packaging, and presentation of the food..."
                  rows={4}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                />

                <Button type="submit" variant="primary" full loading={submittingRating}>
                  Submit Verified Rating →
                </Button>
              </form>
            )}

            {/* Tab 2: Hygiene / Food Quality Complaint Form */}
            {activeTab === "complaint" && (
              <form onSubmit={handleSubmitComplaint} className={styles.formCard}>
                <div>
                  <h3 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "4px" }}>
                    File an Official Quality Violation Complaint
                  </h3>
                  <p style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
                    Complaints are directly forwarded to the Railway Quality Control Cell for investigative action.
                  </p>
                </div>

                <Select
                  label="Hygiene / Defect Category"
                  required
                  value={issueType}
                  onChange={(e) => setIssueType(e.target.value)}
                >
                  {HYGIENE_ISSUES.map((issue) => (
                    <option key={issue.value} value={issue.value}>
                      {issue.label}
                    </option>
                  ))}
                </Select>

                {/* Severity Selection */}
                <div>
                  <label style={{ fontSize: "0.85rem", fontWeight: 600, display: "block", marginBottom: "6px" }}>
                    Issue Severity Level *
                  </label>
                  <div className={styles.severityRow}>
                    {["low", "medium", "high", "critical"].map((lvl) => (
                      <button
                        key={lvl}
                        type="button"
                        className={`${styles.severityBtn} ${
                          severity === lvl ? styles[`severityActive_${lvl}`] : ""
                        }`}
                        onClick={() => setSeverity(lvl)}
                      >
                        {lvl}
                      </button>
                    ))}
                  </div>
                </div>

                <Textarea
                  label="Detailed Complaint Description"
                  required
                  rows={4}
                  placeholder="Describe the issue clearly (e.g. found foreign particle in dal, meal seal was broken, food had sour taste)..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />

                {/* Evidence Upload */}
                <div>
                  <label style={{ fontSize: "0.85rem", fontWeight: 600, display: "block", marginBottom: "6px" }}>
                    Photograph Evidence (Optional but Recommended)
                  </label>
                  <div
                    className={styles.uploadBox}
                    onClick={() => document.getElementById("evidence-upload").click()}
                  >
                    <input
                      id="evidence-upload"
                      type="file"
                      accept="image/*"
                      style={{ display: "none" }}
                      onChange={handleImageChange}
                    />
                    <div style={{ fontSize: "1.8rem", marginBottom: "6px" }}>📷</div>
                    <p style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--navy)" }}>
                      {imageFile ? imageFile.name : "Tap to upload or take a photo"}
                    </p>
                    <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                      JPEG, PNG or WebP up to 5 MB
                    </p>
                  </div>
                  {imagePreview && (
                    <img src={imagePreview} alt="Preview" className={styles.uploadPreview} />
                  )}
                </div>

                {/* Optional Journey Specifics */}
                <div style={{ borderTop: "1px solid var(--border)", paddingTop: "14px", display: "flex", flexDirection: "column", gap: "12px" }}>
                  <p style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text)" }}>
                    Optional Journey Details (For on-board pantry investigations)
                  </p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    <Input
                      label="PNR Number"
                      placeholder="e.g. 2451234567"
                      value={pnrNumber}
                      onChange={(e) => setPnrNumber(e.target.value)}
                    />
                    <Input
                      label="Train Number / Name"
                      placeholder="e.g. 12951 / Rajdhani Exp"
                      value={trainNumber}
                      onChange={(e) => setTrainNumber(e.target.value)}
                    />
                  </div>
                  <Input
                    label="Coach & Berth / Seat Number"
                    placeholder="e.g. B3, Berth 42"
                    value={coachSeat}
                    onChange={(e) => setCoachSeat(e.target.value)}
                  />
                  <Input
                    label="Passenger Contact (Mobile / Email)"
                    placeholder="For inspector resolution contact"
                    value={passengerContact}
                    onChange={(e) => setPassengerContact(e.target.value)}
                  />
                </div>

                <Button type="submit" variant="danger" full loading={submittingComplaint}>
                  File Official Quality Complaint →
                </Button>
              </form>
            )}
          </>
        )}
      </main>
    </div>
  );
}
