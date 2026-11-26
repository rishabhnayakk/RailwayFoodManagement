/* app/vendor/packages/page.js
 * Vendor Food Package Upload & QR Code Generation Portal
 *
 * Allows authenticated vendors to:
 * - Upload complete food package information + food image
 * - Automatically generate a unique, unpredictable QR code & scan URL
 * - Download QR codes as PNG
 * - View package approval status (pending / approved / rejected)
 * - Edit or activate/deactivate their own packages
 */

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import VendorLayout from "@/components/layout/VendorLayout";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { ApprovalBadge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { BUCKETS, FOOD_CATEGORIES, MAX_IMAGE_BYTES, ALLOWED_MIME } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import { getCurrentUserProfile } from "@/lib/auth";
import { formatDate, generateToken } from "@/lib/utils";
import styles from "../vendor.module.css";

const EMPTY_FORM = {
  package_name: "",
  category: "Meals",
  description: "",
  price: "",
  ingredients: "",
  prepared_at: "",
  expires_at: "",
  fssai_license: "",
  train_info: "",
  status: "active",
};

function toDateTimeLocal(isoStr) {
  if (!isoStr) return "";
  const d = new Date(isoStr);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function VendorPackagesPage() {
  const router = useRouter();
  const toast = useToast();
  const [vendor, setVendor] = useState(null);
  const [userId, setUserId] = useState(null);
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Add / Edit package modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPkg, setEditingPkg] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");

  // QR modal
  const [qrPkg, setQrPkg] = useState(null);
  const [qrUrl, setQrUrl] = useState("");
  const [generatingQrId, setGeneratingQrId] = useState(null);

  // Confirm status toggle
  const [confirmTogglePkg, setConfirmTogglePkg] = useState(null);

  async function loadPackages() {
    setLoading(true);
    setError("");
    try {
      const account = await getCurrentUserProfile();
      if (!account?.profile || account.profile.role !== "vendor") {
        router.replace("/auth/login");
        return;
      }
      setUserId(account.user.id);

      const supabase = createClient();
      if (!supabase) throw new Error("Supabase is not configured.");

      const { data: vendorData, error: vErr } = await supabase
        .from("vendors")
        .select("*")
        .eq("owner_user_id", account.user.id)
        .single();

      if (vErr || !vendorData) {
        throw new Error("No vendor profile is linked to your account. Contact Admin.");
      }
      setVendor(vendorData);

      const { data: pkgData, error: pkgErr } = await supabase
        .from("food_packages")
        .select(`
          *,
          qr_codes (
            id,
            qr_token,
            is_active,
            created_at
          )
        `)
        .eq("vendor_id", vendorData.id)
        .order("created_at", { ascending: false });

      if (pkgErr) throw pkgErr;
      setPackages(pkgData || []);
    } catch (e) {
      setError(e.message || "Failed to load packages.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      loadPackages();
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  function openAddModal() {
    if (vendor?.status === "suspended") {
      toast.error("Your vendor account is suspended. You cannot upload new packages.");
      return;
    }
    setEditingPkg(null);
    setFormData({
      ...EMPTY_FORM,
      fssai_license: vendor?.license_number || "",
    });
    setImageFile(null);
    setImagePreview("");
    setModalOpen(true);
  }

  function openEditModal(pkg) {
    setEditingPkg(pkg);
    setFormData({
      package_name: pkg.package_name || "",
      category: pkg.category || "Meals",
      description: pkg.description || "",
      price: pkg.price != null ? String(pkg.price) : "",
      ingredients: pkg.ingredients || "",
      prepared_at: toDateTimeLocal(pkg.prepared_at),
      expires_at: toDateTimeLocal(pkg.expires_at),
      fssai_license: pkg.fssai_license || vendor?.license_number || "",
      train_info: pkg.train_info || "",
      status: pkg.status || "active",
    });
    setImageFile(null);
    setImagePreview(pkg.image_url || "");
    setModalOpen(true);
  }

  function handleImageSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ALLOWED_MIME.includes(file.type)) {
      toast.error("Only JPEG, PNG, or WebP images are supported.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error("Food image must be 5 MB or smaller.");
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  async function renderQrModal(pkg, qrRecord) {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const scanLink = `${origin}/scan/${qrRecord.qr_token}`;
    const dataUrl = await QRCode.toDataURL(scanLink, {
      width: 320,
      margin: 2,
      color: { dark: "#0f172a", light: "#ffffff" },
    });
    setQrPkg({
      ...pkg,
      qrToken: qrRecord.qr_token,
      qrActive: qrRecord.is_active,
      scanLink,
    });
    setQrUrl(dataUrl);
  }

  async function createUniqueQrForPackage(supabase, packageId) {
    const token = generateToken(24);
    const { data, error } = await supabase
      .from("qr_codes")
      .insert([
        {
          package_id: packageId,
          qr_token: token,
          is_active: true,
          created_by: userId,
        },
      ])
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async function handleSavePackage(e) {
    e.preventDefault();
    if (!vendor) return;
    if (vendor.status === "suspended") {
      toast.error("Your vendor account is suspended.");
      return;
    }

    if (!formData.package_name.trim() || !formData.description.trim() || !formData.ingredients.trim()) {
      toast.error("Please fill in Food Name, Description, and Ingredients.");
      return;
    }
    if (!formData.price || Number(formData.price) <= 0) {
      toast.error("Please enter a valid food price greater than 0.");
      return;
    }
    if (formData.prepared_at && formData.expires_at) {
      if (new Date(formData.expires_at) <= new Date(formData.prepared_at)) {
        toast.error("Expiry date/time must be after preparation date/time.");
        return;
      }
    }

    setSubmitting(true);
    try {
      const supabase = createClient();
      let imageUrl = editingPkg?.image_url || null;

      if (imageFile) {
        const ext = imageFile.name.split(".").pop() || "jpg";
        const filePath = `packages/${vendor.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from(BUCKETS.FOOD_IMAGES)
          .upload(filePath, imageFile);

        if (uploadErr) {
          throw new Error(`Food image upload failed: ${uploadErr.message}`);
        }
        const { data: urlData } = supabase.storage.from(BUCKETS.FOOD_IMAGES).getPublicUrl(filePath);
        imageUrl = urlData.publicUrl;
      }

      const payload = {
        package_name: formData.package_name.trim(),
        category: formData.category || "Meals",
        description: formData.description.trim(),
        price: parseFloat(formData.price),
        image_url: imageUrl,
        ingredients: formData.ingredients.trim(),
        prepared_at: formData.prepared_at ? new Date(formData.prepared_at).toISOString() : null,
        expires_at: formData.expires_at ? new Date(formData.expires_at).toISOString() : null,
        fssai_license: formData.fssai_license.trim() || vendor.license_number,
        train_info: formData.train_info.trim() || null,
        status: formData.status || "active",
        updated_at: new Date().toISOString(),
      };

      if (editingPkg) {
        const { error: upErr } = await supabase
          .from("food_packages")
          .update(payload)
          .eq("id", editingPkg.id);
        if (upErr) throw upErr;

        toast.success("Food package updated.");
        setModalOpen(false);
        await loadPackages();
      } else {
        const res = await fetch("/api/vendor/packages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const result = await res.json();
        if (!res.ok) {
          throw new Error(result.error || "Failed to upload food package.");
        }

        toast.success(
          `Food item ${result.package?.package_code || ""} uploaded and unique QR code generated!`
        );
        setModalOpen(false);
        await loadPackages();
        if (result.package && result.qr) {
          await renderQrModal(result.package, result.qr);
        }
      }
    } catch (e) {
      toast.error("Error saving package: " + e.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGenerateQr(pkg) {
    if (vendor?.status === "suspended") {
      toast.error("Suspended vendors cannot generate QR codes.");
      return;
    }
    setGeneratingQrId(pkg.id);
    try {
      const supabase = createClient();
      const existing = Array.isArray(pkg.qr_codes) ? pkg.qr_codes[0] : pkg.qr_codes;
      if (existing?.qr_token) {
        await renderQrModal(pkg, existing);
        return;
      }
      const qrRecord = await createUniqueQrForPackage(supabase, pkg.id);
      toast.success("Unique QR code generated for package.");
      await loadPackages();
      await renderQrModal(pkg, qrRecord);
    } catch (e) {
      toast.error("Could not generate QR code: " + e.message);
    } finally {
      setGeneratingQrId(null);
    }
  }

  async function handleConfirmToggleStatus() {
    if (!confirmTogglePkg) return;
    const nextStatus = confirmTogglePkg.status === "active" ? "inactive" : "active";
    try {
      const supabase = createClient();
      const { error: upErr } = await supabase
        .from("food_packages")
        .update({ status: nextStatus, updated_at: new Date().toISOString() })
        .eq("id", confirmTogglePkg.id);
      if (upErr) throw upErr;

      toast.success(`Package "${confirmTogglePkg.package_name}" marked ${nextStatus}.`);
      setPackages((prev) =>
        prev.map((p) => (p.id === confirmTogglePkg.id ? { ...p, status: nextStatus } : p))
      );
      setConfirmTogglePkg(null);
    } catch (e) {
      toast.error("Failed to update status: " + e.message);
    }
  }

  return (
    <VendorLayout title="My Food Packages & QR Codes">
      {loading ? (
        <div className={styles.loading}>Loading your food packages…</div>
      ) : error ? (
        <div className={styles.errorBox} role="alert">
          <strong>⚠️ {error}</strong>
        </div>
      ) : (
        <div className={styles.page}>
          {vendor?.status === "suspended" && (
            <div className={styles.errorBox}>
              Your vendor account is suspended. Public scanning of all your packages is disabled.
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
            <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
              Managing packages for <strong>{vendor?.business_name}</strong> ({packages.length} uploaded)
            </p>
            <Button variant="primary" onClick={openAddModal} disabled={vendor?.status === "suspended"}>
              + Upload Food Package & Generate QR
            </Button>
          </div>

          {packages.length === 0 ? (
            <EmptyState
              icon="📦"
              title="No food packages uploaded yet"
              description="Upload your railway meal package with ingredients, pricing, and photo to generate a unique printable QR code."
              action={
                <Button variant="primary" onClick={openAddModal} disabled={vendor?.status === "suspended"}>
                  + Upload First Food Package
                </Button>
              }
            />
          ) : (
            <section className={styles.section}>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Food Package</th>
                      <th>Category & Tariff</th>
                      <th>Approval Status</th>
                      <th>Active Status</th>
                      <th>QR Code</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {packages.map((pkg) => {
                      const qrRecord = Array.isArray(pkg.qr_codes) ? pkg.qr_codes[0] : pkg.qr_codes;
                      return (
                        <tr key={pkg.id}>
                          <td>
                            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                              {pkg.image_url ? (
                                <img
                                  src={pkg.image_url}
                                  alt={pkg.package_name}
                                  style={{ width: "44px", height: "44px", objectFit: "cover", borderRadius: "6px", border: "1px solid var(--border)", flexShrink: 0 }}
                                />
                              ) : (
                                <div style={{ width: "44px", height: "44px", borderRadius: "6px", background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem", color: "var(--text-muted)", flexShrink: 0 }}>
                                  IMG
                                </div>
                              )}
                              <div>
                                <div className={styles.bold}>{pkg.package_name}</div>
                                {pkg.package_code && (
                                  <div style={{ fontSize: "0.74rem", fontFamily: "monospace", color: "var(--navy)" }}>
                                    ID: {pkg.package_code}
                                  </div>
                                )}
                                {pkg.train_info && (
                                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                                    Train: {pkg.train_info}
                                  </div>
                                )}
                                {pkg.rejection_reason && pkg.approval_status === "rejected" && (
                                  <div style={{ fontSize: "0.74rem", color: "#dc2626" }}>
                                    Reason: {pkg.rejection_reason}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td>
                            <div>{pkg.category || "Meals"}</div>
                            <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                              {pkg.price != null ? `₹${Number(pkg.price).toFixed(2)}` : "—"}
                            </div>
                          </td>
                          <td>
                            <ApprovalBadge status={pkg.approval_status || "pending"} />
                          </td>
                          <td>
                            <span className={pkg.status === "active" ? styles.badgeGreen : styles.badgeRed}>
                              {pkg.status}
                            </span>
                          </td>
                          <td>
                            {qrRecord?.qr_token ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => renderQrModal(pkg, qrRecord)}
                              >
                                View / Download QR
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="primary"
                                loading={generatingQrId === pkg.id}
                                onClick={() => handleGenerateQr(pkg)}
                              >
                                Generate QR
                              </Button>
                            )}
                          </td>
                          <td>
                            <div style={{ display: "flex", gap: "8px" }}>
                              <Button variant="outline" size="sm" onClick={() => openEditModal(pkg)}>
                                Edit
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => setConfirmTogglePkg(pkg)}>
                                {pkg.status === "active" ? "Deactivate" : "Activate"}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Add / Edit Food Package Modal */}
          {modalOpen && (
            <div
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.55)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 100,
                padding: "16px",
              }}
              onClick={() => setModalOpen(false)}
            >
              <div
                style={{
                  background: "#ffffff",
                  borderRadius: "12px",
                  padding: "24px",
                  width: "100%",
                  maxWidth: "620px",
                  maxHeight: "90vh",
                  overflowY: "auto",
                  boxShadow: "var(--shadow-lg)",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <h2 style={{ fontSize: "1.15rem", fontWeight: 700, marginBottom: "14px" }}>
                  {editingPkg ? "Edit Food Package" : "Upload Food Package & Generate QR Code"}
                </h2>

                <form onSubmit={handleSavePackage} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {/* Read-only Vendor Context */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", padding: "10px 12px", background: "#f8fafc", borderRadius: "8px", border: "1px solid var(--border)" }}>
                    <div>
                      <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", display: "block" }}>
                        Vendor Name
                      </label>
                      <input
                        type="text"
                        readOnly
                        value={vendor?.business_name || ""}
                        style={{ width: "100%", padding: "6px 8px", border: "1px solid var(--border)", borderRadius: "6px", background: "#eef2f7", fontSize: "0.84rem" }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", display: "block" }}>
                        Vendor ID
                      </label>
                      <input
                        type="text"
                        readOnly
                        value={vendor?.id || ""}
                        style={{ width: "100%", padding: "6px 8px", border: "1px solid var(--border)", borderRadius: "6px", background: "#eef2f7", fontSize: "0.78rem", fontFamily: "monospace" }}
                      />
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    <div>
                      <label style={{ fontSize: "0.82rem", fontWeight: 600, display: "block", marginBottom: "4px" }}>
                        Food Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.package_name}
                        onChange={(e) => setFormData({ ...formData, package_name: e.target.value })}
                        placeholder="e.g. Standard Veg Thali"
                        style={{ width: "100%", padding: "8px 10px", border: "1px solid var(--border)", borderRadius: "6px" }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: "0.82rem", fontWeight: 600, display: "block", marginBottom: "4px" }}>
                        Food Category *
                      </label>
                      <select
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        style={{ width: "100%", padding: "8px 10px", border: "1px solid var(--border)", borderRadius: "6px" }}
                      >
                        {FOOD_CATEGORIES.map((cat) => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    <div>
                      <label style={{ fontSize: "0.82rem", fontWeight: 600, display: "block", marginBottom: "4px" }}>
                        Food Price (₹) *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="1"
                        required
                        value={formData.price}
                        onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                        placeholder="120.00"
                        style={{ width: "100%", padding: "8px 10px", border: "1px solid var(--border)", borderRadius: "6px" }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: "0.82rem", fontWeight: 600, display: "block", marginBottom: "4px" }}>
                        FSSAI Licence Number
                      </label>
                      <input
                        type="text"
                        value={formData.fssai_license}
                        onChange={(e) => setFormData({ ...formData, fssai_license: e.target.value })}
                        placeholder="e.g. FSSAI-1002301100045"
                        style={{ width: "100%", padding: "8px 10px", border: "1px solid var(--border)", borderRadius: "6px" }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: "0.82rem", fontWeight: 600, display: "block", marginBottom: "4px" }}>
                      Food Description *
                    </label>
                    <textarea
                      rows={2}
                      required
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Describe meal items, portion size, and packaging type..."
                      style={{ width: "100%", padding: "8px 10px", border: "1px solid var(--border)", borderRadius: "6px" }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: "0.82rem", fontWeight: 600, display: "block", marginBottom: "4px" }}>
                      Ingredients *
                    </label>
                    <textarea
                      rows={2}
                      required
                      value={formData.ingredients}
                      onChange={(e) => setFormData({ ...formData, ingredients: e.target.value })}
                      placeholder="e.g. Basmati rice, paneer, whole wheat flour, lentils, vegetable oil, spices"
                      style={{ width: "100%", padding: "8px 10px", border: "1px solid var(--border)", borderRadius: "6px" }}
                    />
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    <div>
                      <label style={{ fontSize: "0.82rem", fontWeight: 600, display: "block", marginBottom: "4px" }}>
                        Preparation Date & Time
                      </label>
                      <input
                        type="datetime-local"
                        value={formData.prepared_at}
                        onChange={(e) => setFormData({ ...formData, prepared_at: e.target.value })}
                        style={{ width: "100%", padding: "8px 10px", border: "1px solid var(--border)", borderRadius: "6px" }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: "0.82rem", fontWeight: 600, display: "block", marginBottom: "4px" }}>
                        Expiry Date & Time
                      </label>
                      <input
                        type="datetime-local"
                        value={formData.expires_at}
                        onChange={(e) => setFormData({ ...formData, expires_at: e.target.value })}
                        style={{ width: "100%", padding: "8px 10px", border: "1px solid var(--border)", borderRadius: "6px" }}
                      />
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    <div>
                      <label style={{ fontSize: "0.82rem", fontWeight: 600, display: "block", marginBottom: "4px" }}>
                        Train Number / Name (Optional)
                      </label>
                      <input
                        type="text"
                        value={formData.train_info}
                        onChange={(e) => setFormData({ ...formData, train_info: e.target.value })}
                        placeholder="e.g. 12951 Mumbai Rajdhani"
                        style={{ width: "100%", padding: "8px 10px", border: "1px solid var(--border)", borderRadius: "6px" }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: "0.82rem", fontWeight: 600, display: "block", marginBottom: "4px" }}>
                        Package Status
                      </label>
                      <select
                        value={formData.status}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                        style={{ width: "100%", padding: "8px 10px", border: "1px solid var(--border)", borderRadius: "6px" }}
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive (Draft)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: "0.82rem", fontWeight: 600, display: "block", marginBottom: "4px" }}>
                      Food Image (JPEG, PNG, WebP up to 5 MB)
                    </label>
                    <input type="file" accept="image/*" onChange={handleImageSelect} />
                    {imagePreview && (
                      <img
                        src={imagePreview}
                        alt="Food preview"
                        style={{ marginTop: "8px", maxHeight: "140px", borderRadius: "8px", border: "1px solid var(--border)" }}
                      />
                    )}
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "8px" }}>
                    <Button variant="ghost" onClick={() => setModalOpen(false)} disabled={submitting}>
                      Cancel
                    </Button>
                    <Button type="submit" variant="primary" loading={submitting}>
                      {editingPkg ? "Save Changes" : "Upload & Generate QR Code"}
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* QR View / Download Modal */}
          {qrPkg && (
            <div
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.5)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 100,
                padding: "16px",
              }}
              onClick={() => setQrPkg(null)}
            >
              <div
                style={{
                  background: "#ffffff",
                  borderRadius: "12px",
                  padding: "24px",
                  width: "100%",
                  maxWidth: "420px",
                  textAlign: "center",
                  boxShadow: "var(--shadow-lg)",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.06em", color: "var(--navy)", marginBottom: "4px" }}>
                  RAILGUARD PACKAGING QR STICKER
                </div>
                <h3 style={{ fontSize: "1.15rem", fontWeight: 700, marginBottom: "6px" }}>
                  {qrPkg.package_name}
                </h3>
                {qrPkg.package_code && (
                  <p style={{ fontFamily: "monospace", fontSize: "0.78rem", color: "var(--navy)", fontWeight: 700, marginBottom: "6px" }}>
                    Item Code: {qrPkg.package_code}
                  </p>
                )}
                <div style={{ marginBottom: "12px" }}>
                  <ApprovalBadge status={qrPkg.approval_status || "pending"} />
                </div>

                {qrUrl && (
                  <img
                    src={qrUrl}
                    alt={`QR for ${qrPkg.package_name}`}
                    style={{ width: "220px", height: "220px", margin: "0 auto 12px", borderRadius: "8px", border: "1px solid var(--border)" }}
                  />
                )}

                <p style={{ fontFamily: "monospace", fontSize: "0.72rem", color: "var(--text-muted)", wordBreak: "break-all", marginBottom: "8px" }}>
                  Token: {qrPkg.qrToken}
                </p>

                {qrPkg.approval_status !== "approved" && (
                  <p style={{ fontSize: "0.78rem", color: "#92400e", background: "#fef3c7", padding: "8px 10px", borderRadius: "6px", marginBottom: "14px" }}>
                    Pending Railway Admin approval. Public QR scanning activates automatically once approved.
                  </p>
                )}

                <div style={{ display: "flex", gap: "10px", justifyContent: "center", flexWrap: "wrap" }}>
                  {qrUrl && (
                    <a
                      href={qrUrl}
                      download={`railguard-qr-${qrPkg.package_name.toLowerCase().replace(/\s+/g, "-")}.png`}
                      style={{
                        background: "var(--navy)",
                        color: "#ffffff",
                        padding: "9px 16px",
                        borderRadius: "6px",
                        fontSize: "0.85rem",
                        fontWeight: 600,
                      }}
                    >
                      ⬇ Download QR Code (PNG)
                    </a>
                  )}
                  <Button variant="ghost" onClick={() => setQrPkg(null)}>
                    Close
                  </Button>
                </div>
              </div>
            </div>
          )}

          <ConfirmDialog
            open={Boolean(confirmTogglePkg)}
            title={confirmTogglePkg?.status === "active" ? "Deactivate Food Package?" : "Activate Food Package?"}
            message={
              confirmTogglePkg?.status === "active"
                ? `Deactivating "${confirmTogglePkg?.package_name}" will block passengers from scanning its QR code.`
                : `Reactivating "${confirmTogglePkg?.package_name}" will make it active (subject to Admin approval).`
            }
            confirmLabel={confirmTogglePkg?.status === "active" ? "Deactivate" : "Activate"}
            variant={confirmTogglePkg?.status === "active" ? "danger" : "primary"}
            onConfirm={handleConfirmToggleStatus}
            onCancel={() => setConfirmTogglePkg(null)}
          />
        </div>
      )}
    </VendorLayout>
  );
}
