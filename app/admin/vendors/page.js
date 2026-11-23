/* app/admin/vendors/page.js
 * Vendor Management Portal
 *
 * Railway quality administration monitors all licensed pantry & food vendors.
 * Connects to Supabase `vendors` table. Shows real empty states.
 * NO mock records. NO external icon library.
 */

"use client";

import { useState, useEffect } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { createClient } from "@/lib/supabase/client";
import styles from "./vendors.module.css";

export default function VendorsPage() {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    business_name: "",
    license_number: "",
    contact_name: "",
    phone: "",
    email: "",
  });
  const [submitting, setSubmitting] = useState(false);

  async function loadVendors() {
    setLoading(true);
    const supabase = createClient();
    if (!supabase) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("vendors")
        .select("*")
        .order("created_at", { ascending: false });

      if (!error && data) {
        setVendors(data);
      }
    } catch (err) {
      console.error("Error loading vendors:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadVendors();
  }, []);

  async function handleCreateVendor(e) {
    e.preventDefault();
    setSubmitting(true);
    const supabase = createClient();
    if (!supabase) {
      alert("Please configure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local first.");
      setSubmitting(false);
      return;
    }

    try {
      const { error } = await supabase.from("vendors").insert([formData]);
      if (error) throw error;

      setFormData({
        business_name: "",
        license_number: "",
        contact_name: "",
        phone: "",
        email: "",
      });
      setModalOpen(false);
      loadVendors();
    } catch (err) {
      alert("Error adding vendor: " + err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const filtered = vendors.filter((v) => {
    const term = search.toLowerCase();
    return (
      !term ||
      v.business_name?.toLowerCase().includes(term) ||
      v.license_number?.toLowerCase().includes(term) ||
      v.contact_name?.toLowerCase().includes(term)
    );
  });

  return (
    <AdminLayout title="Vendor Management">
      <div className={styles.container}>
        {/* Top Control Bar */}
        <div className={styles.topBar}>
          <input
            type="text"
            placeholder="Search vendors by name or license..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={styles.search}
          />
          <Button variant="primary" onClick={() => setModalOpen(true)}>
            + Register Vendor
          </Button>
        </div>

        {/* Vendors Grid */}
        {loading ? (
          <div className={styles.grid}>
            {[1, 2, 3].map((i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="🏪"
            title="No vendors found"
            description={
              vendors.length === 0
                ? "No food vendors have been registered yet. Add authorized railway catering vendors to begin tracking quality audits."
                : "No registered vendors match your search term."
            }
            action={
              <Button variant="primary" onClick={() => setModalOpen(true)}>
                + Add First Vendor
              </Button>
            }
          />
        ) : (
          <div className={styles.grid}>
            {filtered.map((v) => (
              <div key={v.id} className={styles.vendorCard}>
                <div className={styles.cardHead}>
                  <div>
                    <h3 className={styles.vendorName}>{v.business_name}</h3>
                    <span className={styles.license}>Lic: {v.license_number || "—"}</span>
                  </div>
                  <span
                    className={`${styles.statusPill} ${
                      styles[v.status] || styles.active
                    }`}
                  >
                    {v.status || "active"}
                  </span>
                </div>

                <div className={styles.contactRow}>
                  {v.contact_name && <span>👤 Contact: {v.contact_name}</span>}
                  {v.phone && <span>📞 Phone: {v.phone}</span>}
                  {v.email && <span>✉️ Email: {v.email}</span>}
                </div>

                <div className={styles.cardFooter}>
                  <button
                    className={styles.footerBtn}
                    onClick={() => alert(`Viewing vendor ${v.business_name}`)}
                  >
                    View Details & Packages →
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal: Add Vendor */}
        {modalOpen && (
          <div className={styles.modalOverlay} onClick={() => setModalOpen(false)}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
              <h2 className={styles.modalTitle}>Register Railway Food Vendor</h2>
              <form onSubmit={handleCreateVendor}>
                <div className={styles.formGroup}>
                  <label>Business Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.business_name}
                    onChange={(e) =>
                      setFormData({ ...formData, business_name: e.target.value })
                    }
                    placeholder="e.g. Northern Railways Catering Services"
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>FSSAI / Railway License Number *</label>
                  <input
                    type="text"
                    required
                    value={formData.license_number}
                    onChange={(e) =>
                      setFormData({ ...formData, license_number: e.target.value })
                    }
                    placeholder="e.g. FSSAI-2025-09871"
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Contact Person</label>
                  <input
                    type="text"
                    value={formData.contact_name}
                    onChange={(e) =>
                      setFormData({ ...formData, contact_name: e.target.value })
                    }
                    placeholder="e.g. Rajesh Kumar"
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Phone Number</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                    placeholder="+91 98765 43210"
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Email Address</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    placeholder="vendor@pantryservices.com"
                  />
                </div>
                <div className={styles.modalActions}>
                  <Button
                    variant="ghost"
                    onClick={() => setModalOpen(false)}
                    disabled={submitting}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary" loading={submitting}>
                    Save Vendor
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
