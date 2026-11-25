/* app/scan/[token]/page.js
 * Verified QR Code Passenger Form
 *
 * Mobile-friendly 4-section submission workflow:
 * - Section 1: Food Details (verified package, photo, vendor, ingredients, dates)
 * - Section 2: Food Rating (1 to 5 stars + optional dimension ratings)
 * - Section 3: Food Feedback (comments)
 * - Section 4: Complaint Registration (Yes / No toggle, category, description, photo, optional journey/contact)
 */

"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import { Input, Textarea, Select } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { HYGIENE_ISSUES, MAX_IMAGE_BYTES, ALLOWED_MIME } from "@/lib/constants";
import { getCurrentUserProfile } from "@/lib/auth";
import { formatDateTime } from "@/lib/utils";
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
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [packageData, setPackageData] = useState(null);
  const [userProfile, setUserProfile] = useState(null);

  // Section 2 & 3: Rating & Feedback
  const [rating, setRating] = useState(5);
  const [foodQualityRating, setFoodQualityRating] = useState(5);
  const [tasteRating, setTasteRating] = useState(5);
  const [packagingRating, setPackagingRating] = useState(5);
  const [hygieneRating, setHygieneRating] = useState(5);
  const [comment, setComment] = useState("");

  // Section 4: Optional Complaint Registration
  const [registerComplaint, setRegisterComplaint] = useState(false);
  const [issueType, setIssueType] = useState(HYGIENE_ISSUES[0].value);
  const [severity, setSeverity] = useState("medium");
  const [description, setDescription] = useState("");
  const [passengerName, setPassengerName] = useState("");
  const [passengerContact, setPassengerContact] = useState("");
  const [trainNumber, setTrainNumber] = useState("");
  const [pnrNumber, setPnrNumber] = useState("");
  const [coachSeat, setCoachSeat] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);

  const [submitting, setSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState(null);
  const [copiedId, setCopiedId] = useState(false);

  useEffect(() => {
    async function verifyAndLoad() {
      setLoading(true);
      setError("");

      try {
        const authData = await getCurrentUserProfile().catch(() => null);
        if (authData) {
          setUserProfile(authData);
          setPassengerName(authData.profile?.full_name || "");
          setPassengerContact(authData.profile?.phone || "");
        }

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

    if (token) verifyAndLoad();
  }, [token]);

  function handleImageChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_MIME.includes(file.type)) {
      toast.error("Please select a valid image file (JPEG, PNG, or WebP).");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error("Image size exceeds the maximum limit of 5 MB.");
      return;
    }

    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (registerComplaint) {
      if (!passengerName.trim()) {
        toast.error("Please enter your name to register a complaint.");
        return;
      }
      if (!description.trim()) {
        toast.error("Please describe the issue in your complaint.");
        return;
      }
      if (pnrNumber.trim() && pnrNumber.trim().length !== 10) {
        toast.error("PNR number must be 10 digits if provided.");
        return;
      }
    }

    setSubmitting(true);
    try {
      const form = new FormData();
      form.append("token", token);
      form.append("rating", String(rating));
      form.append("food_quality_rating", String(foodQualityRating));
      form.append("taste_rating", String(tasteRating));
      form.append("packaging_rating", String(packagingRating));
      form.append("hygiene_rating", String(hygieneRating));
      form.append("comment", comment.trim());
      form.append("passenger_name", passengerName.trim());
      form.append("register_complaint", registerComplaint ? "true" : "false");

      if (registerComplaint) {
        form.append("issue_type", issueType);
        form.append("severity", severity);
        form.append("description", description.trim());
        form.append("passenger_contact", passengerContact.trim());
        form.append("train_number", trainNumber.trim());
        form.append("pnr_number", pnrNumber.trim());
        form.append("coach_seat", coachSeat.trim());
        if (imageFile) form.append("evidence", imageFile);
      }

      const res = await fetch("/api/scan/submit", {
        method: "POST",
        body: form,
      });
      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || "Submission failed.");
      }

      toast.success(
        registerComplaint
          ? "Feedback & complaint registered successfully!"
          : "Thank you! Your food rating and feedback have been recorded."
      );

      setConfirmation({
        type: registerComplaint ? "complaint" : "feedback",
        refId: result.complaintRef || result.complaintId || null,
        title: registerComplaint
          ? "Complaint Registered Successfully!"
          : "Rating & Feedback Recorded!",
        message: registerComplaint
          ? "Please save your Complaint ID. You will need it to track your complaint status."
          : "Thank you for contributing to Indian Railways food quality monitoring.",
      });
    } catch (err) {
      toast.error(err.message || "Failed to submit.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCopyComplaintId(idText) {
    if (!idText) return;
    try {
      await navigator.clipboard.writeText(idText);
      setCopiedId(true);
      toast.success("Complaint ID copied to clipboard.");
      setTimeout(() => setCopiedId(false), 2500);
    } catch {
      toast.error("Could not copy automatically. Please select and copy your Complaint ID.");
    }
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <Link href="/scan" className={styles.backLink}>
          ← Scan Another Package
        </Link>
        <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>
          RailGuard Verification
        </div>
      </header>

      <main className={styles.main}>
        {loading && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <SkeletonCard />
            <SkeletonCard />
          </div>
        )}

        {!loading && error && (
          <div className={styles.packageCard} style={{ textAlign: "center", padding: "36px 24px" }}>
            <h2 style={{ color: "var(--red)", fontSize: "1.15rem", fontWeight: 700, marginBottom: "8px" }}>
              QR Verification Blocked
            </h2>
            <p style={{ color: "var(--text-muted)", fontSize: "0.88rem", maxWidth: "460px", margin: "0 auto 20px", lineHeight: 1.55 }}>
              {error}
            </p>
            <Button variant="primary" onClick={() => router.push("/scan")}>
              Return to QR Scanner
            </Button>
          </div>
        )}

        {!loading && confirmation && (
          <div className={styles.successBox}>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "8px", color: "var(--navy)" }}>
              {confirmation.title}
            </h2>

            {confirmation.refId && (
              <div style={{ margin: "14px 0" }}>
                <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "6px" }}>
                  Your Complaint ID:
                </p>
                <div className={styles.refCode}>{confirmation.refId}</div>
              </div>
            )}

            <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", maxWidth: "460px", margin: "0 auto", lineHeight: 1.55 }}>
              {confirmation.message}
            </p>

            <div style={{ display: "flex", gap: "10px", justifyContent: "center", marginTop: "22px", flexWrap: "wrap" }}>
              {confirmation.refId && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleCopyComplaintId(confirmation.refId)}
                  >
                    {copiedId ? "Copied!" : "Copy Complaint ID"}
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    onClick={() => router.push(`/track?id=${encodeURIComponent(confirmation.refId)}`)}
                  >
                    Track Complaint
                  </Button>
                </>
              )}
              {!confirmation.refId && userProfile && (
                <Button variant="primary" onClick={() => router.push("/passenger/complaints")}>
                  My Complaints
                </Button>
              )}
              <Button type="button" variant="ghost" onClick={() => router.push("/")}>
                Back to Homepage
              </Button>
            </div>
          </div>
        )}

        {!loading && !error && !confirmation && packageData && (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {/* SECTION 1: FOOD DETAILS */}
            <section className={styles.packageCard}>
              <span className={styles.badgeVerified}>
                ✓ Verified Railway Authorized Meal
              </span>
              {packageData.image_url && (
                <img
                  src={packageData.image_url}
                  alt={packageData.package_name}
                  style={{ width: "100%", maxHeight: "240px", objectFit: "cover", borderRadius: "10px", marginBottom: "14px", border: "1px solid var(--border)" }}
                />
              )}
              <h1 className={styles.packageName}>{packageData.package_name}</h1>
              {packageData.price != null && (
                <div className={styles.packagePrice}>
                  Tariff: ₹{Number(packageData.price).toFixed(2)}
                </div>
              )}
              {packageData.description && (
                <p style={{ fontSize: "0.875rem", color: "var(--text-muted)", marginBottom: "12px" }}>
                  {packageData.description}
                </p>
              )}

              <div className={styles.metaGrid}>
                <div className={styles.metaItem}>
                  <strong>Licensed Vendor</strong>
                  {packageData.vendors?.business_name || "Railway Catering Contractor"}
                </div>
                <div className={styles.metaItem}>
                  <strong>FSSAI License</strong>
                  {packageData.fssai_license || packageData.vendors?.license_number || "Verified Contractor"}
                </div>
                <div className={styles.metaItem}>
                  <strong>Station / Base Kitchen</strong>
                  {packageData.vendors?.station_location || "Indian Railways Network"}
                </div>
                <div className={styles.metaItem}>
                  <strong>Category</strong>
                  {packageData.category || "Meals"}
                </div>
                {packageData.ingredients && (
                  <div className={styles.metaItem} style={{ gridColumn: "1 / -1" }}>
                    <strong>Ingredients</strong>
                    {packageData.ingredients}
                  </div>
                )}
                {packageData.prepared_at && (
                  <div className={styles.metaItem}>
                    <strong>Prepared At</strong>
                    {formatDateTime(packageData.prepared_at)}
                  </div>
                )}
                {packageData.expires_at && (
                  <div className={styles.metaItem}>
                    <strong>Best Before / Expiry</strong>
                    {formatDateTime(packageData.expires_at)}
                  </div>
                )}
                {packageData.train_info && (
                  <div className={styles.metaItem} style={{ gridColumn: "1 / -1" }}>
                    <strong>Train Service</strong>
                    {packageData.train_info}
                  </div>
                )}
              </div>
            </section>

            {/* SECTION 2: FOOD RATING */}
            <section className={styles.formCard}>
              <h2 style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--text)" }}>
                2. Rate Food Quality (1 to 5 Stars)
              </h2>

              <div className={styles.ratingSection}>
                <p className={styles.ratingLabel}>
                  Overall Rating: {RATING_DESCRIPTIONS[rating]}
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
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", padding: "12px", background: "#f8fafc", borderRadius: "8px", border: "1px solid var(--border)" }}>
                {[
                  { label: "Food Quality", value: foodQualityRating, setter: setFoodQualityRating },
                  { label: "Taste", value: tasteRating, setter: setTasteRating },
                  { label: "Packaging", value: packagingRating, setter: setPackagingRating },
                  { label: "Hygiene", value: hygieneRating, setter: setHygieneRating },
                ].map((dim) => (
                  <div key={dim.label} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text)" }}>
                      {dim.label} ({dim.value}/5)
                    </span>
                    <div style={{ display: "flex", gap: "4px" }}>
                      {[1, 2, 3, 4, 5].map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => dim.setter(s)}
                          style={{
                            background: "none",
                            border: "none",
                            fontSize: "1.15rem",
                            color: s <= dim.value ? "#f59e0b" : "#cbd5e1",
                            padding: 0,
                            lineHeight: 1,
                          }}
                        >
                          ★
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* SECTION 3: FOOD FEEDBACK */}
            <section className={styles.formCard}>
              <h2 style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--text)" }}>
                3. Food Feedback
              </h2>

              <Input
                label={registerComplaint ? "Passenger Name *" : "Your Name (Optional)"}
                placeholder="e.g. Ramesh Kumar"
                value={passengerName}
                onChange={(e) => setPassengerName(e.target.value)}
                required={registerComplaint}
              />

              <Textarea
                label="Food Quality Feedback"
                placeholder="Share your thoughts on taste, freshness, temperature, and packaging..."
                rows={3}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
            </section>

            {/* SECTION 4: COMPLAINT REGISTRATION */}
            <section className={styles.formCard}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
                <div>
                  <h2 style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--text)" }}>
                    4. Register a Complaint?
                  </h2>
                  <p style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
                    Only enable this if you experienced a hygiene, safety, or quality issue requiring investigation.
                  </p>
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <Button
                    type="button"
                    size="sm"
                    variant={!registerComplaint ? "primary" : "outline"}
                    onClick={() => setRegisterComplaint(false)}
                  >
                    No, Feedback Only
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={registerComplaint ? "danger" : "outline"}
                    onClick={() => setRegisterComplaint(true)}
                  >
                    Yes, Register Complaint
                  </Button>
                </div>
              </div>

              {registerComplaint && (
                <div style={{ display: "flex", flexDirection: "column", gap: "14px", borderTop: "1px solid var(--border)", paddingTop: "14px" }}>
                  <Select
                    label="Complaint Category *"
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
                    label="Complaint Description *"
                    required
                    rows={4}
                    placeholder="Describe the hygiene or quality issue in detail..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    <Input
                      label="Contact Details (Optional)"
                      placeholder="Phone or email for updates"
                      value={passengerContact}
                      onChange={(e) => setPassengerContact(e.target.value)}
                    />
                    <Input
                      label="Train Number (Optional)"
                      placeholder="e.g. 12951"
                      value={trainNumber}
                      onChange={(e) => setTrainNumber(e.target.value)}
                    />
                    <Input
                      label="PNR Number (Optional)"
                      placeholder="10-digit PNR"
                      value={pnrNumber}
                      onChange={(e) =>
                        setPnrNumber(
                          e.target.value.split("").filter((c) => c >= "0" && c <= "9").join("").slice(0, 10)
                        )
                      }
                    />
                    <Input
                      label="Coach / Seat Details (Optional)"
                      placeholder="e.g. B2 / 42"
                      value={coachSeat}
                      onChange={(e) => setCoachSeat(e.target.value)}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: "0.85rem", fontWeight: 600, display: "block", marginBottom: "6px" }}>
                      Photograph Evidence (Optional)
                    </label>
                    <div
                      className={styles.uploadBox}
                      onClick={() => document.getElementById("evidence-upload")?.click()}
                    >
                      <input
                        id="evidence-upload"
                        type="file"
                        accept="image/*"
                        style={{ display: "none" }}
                        onChange={handleImageChange}
                      />
                      <p style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--navy)" }}>
                        {imageFile ? imageFile.name : "Select or capture an image file"}
                      </p>
                      <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                        JPEG, PNG or WebP up to 5 MB
                      </p>
                    </div>
                    {imagePreview && (
                      <img src={imagePreview} alt="Preview" className={styles.uploadPreview} />
                    )}
                  </div>
                </div>
              )}

              <Button
                type="submit"
                variant={registerComplaint ? "danger" : "primary"}
                full
                loading={submitting}
              >
                {registerComplaint ? "Submit Feedback & Register Complaint →" : "Submit Food Rating & Feedback →"}
              </Button>
            </section>
          </form>
        )}
      </main>
    </div>
  );
}
