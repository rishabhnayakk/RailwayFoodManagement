/* app/admin/inspectors/page.js
 * Inspector Management Portal
 *
 * Railway administrators view and register authorized Quality Inspection Officers.
 * Tracks workload, assigned complaints, and filed inspection audit reports.
 * Connects to the Supabase `profiles` table filtering by role = 'inspector'.
 * NO fake records. Real empty state.
 */

"use client";

import { useState, useEffect } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { createClient } from "@/lib/supabase/client";
import styles from "./inspectors.module.css";

export default function InspectorsPage() {
  const [inspectors, setInspectors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Inspector Registration Form State
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    phone: "",
    password: "",
  });

  async function fetchInspectors() {
    setLoading(true);
    const supabase = createClient();
    if (!supabase) {
      setLoading(false);
      return;
    }

    try {
      // 1. Fetch all profiles with role = 'inspector'
      const { data: profiles, error: profErr } = await supabase
        .from("profiles")
        .select("id, full_name, email, phone, role, created_at")
        .eq("role", "inspector")
        .order("created_at", { ascending: false });

      if (profErr || !profiles) {
        setInspectors([]);
        setLoading(false);
        return;
      }

      // 2. Fetch complaint and report counts to display workload
      const [compRes, repRes] = await Promise.all([
        supabase.from("complaints").select("id, assigned_inspector_id, status"),
        supabase.from("inspection_reports").select("id, inspector_id"),
      ]);

      const complaintsList = compRes.data || [];
      const reportsList = repRes.data || [];

      const enriched = profiles.map((p) => {
        const assignedComps = complaintsList.filter((c) => c.assigned_inspector_id === p.id);
        const activeComps = assignedComps.filter(
          (c) => c.status === "assigned" || c.status === "in_progress"
        );
        const submittedReports = reportsList.filter((r) => r.inspector_id === p.id);

        return {
          ...p,
          totalAssigned: assignedComps.length,
          activeCases: activeComps.length,
          reportsCount: submittedReports.length,
        };
      });

      setInspectors(enriched);
    } catch (err) {
      console.error("Error fetching inspectors:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchInspectors();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  async function handleRegisterInspector(e) {
    e.preventDefault();
    if (!formData.password || formData.password.length < 6) {
      alert("Password must be at least 6 characters.");
      return;
    }

    setSubmitting(true);

    try {
      // Use the secure server-side API route so the Admin session is NOT replaced
      // by the newly created inspector session (which browser-side signUp would cause).
      const res = await fetch("/api/admin/create-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email:     formData.email.trim(),
          password:  formData.password,
          full_name: formData.full_name.trim(),
          phone:     formData.phone.trim() || null,
          role:      "inspector",
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || "Failed to create inspector account.");
      }

      alert(`Inspector "${formData.full_name}" registered successfully. They may now sign in at /auth/login.`);
      setFormData({ full_name: "", email: "", phone: "", password: "" });
      setModalOpen(false);
      fetchInspectors();
    } catch (err) {
      alert("Error registering inspector: " + err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AdminLayout title="Quality Inspectorate & Field Officers">
      <div className={styles.container}>
        {/* Top Control Bar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
          <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>
            Registered Quality Inspectors: <strong>{inspectors.length}</strong>
          </p>
          <Button variant="primary" onClick={() => setModalOpen(true)}>
            + Register Quality Inspector
          </Button>
        </div>

        {/* Inspectors Grid */}
        {loading ? (
          <div className={styles.grid}>
            {[1, 2, 3].map((i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : inspectors.length === 0 ? (
          <EmptyState
            icon="🔍"
            title="No quality inspectors found"
            description="Inspectors will appear here once registered. Registered officers can log in at /inspector/login to audit assigned cases."
            action={
              <Button variant="primary" onClick={() => setModalOpen(true)}>
                + Register First Quality Inspector
              </Button>
            }
          />
        ) : (
          <div className={styles.grid}>
            {inspectors.map((ins) => (
              <div key={ins.id} className={styles.inspectorCard}>
                <div className={styles.cardHead}>
                  <div className={styles.avatar}>🔍</div>
                  <div style={{ flex: 1 }}>
                    <h3 className={styles.name}>
                      {ins.full_name || "Quality Officer"}
                    </h3>
                    <p className={styles.email}>{ins.email}</p>
                  </div>
                </div>

                {ins.phone && (
                  <p className={styles.phone}>📞 Phone: {ins.phone}</p>
                )}

                {/* Workload Stats */}
                <div className={styles.statsRow}>
                  <div className={styles.statItem}>
                    <span className={styles.statNum}>{ins.activeCases || 0}</span>
                    <span className={styles.statLabel}>Active Cases</span>
                  </div>
                  <div className={styles.statItem}>
                    <span className={styles.statNum}>{ins.totalAssigned || 0}</span>
                    <span className={styles.statLabel}>Total Assigned</span>
                  </div>
                  <div className={styles.statItem}>
                    <span className={styles.statNum}>{ins.reportsCount || 0}</span>
                    <span className={styles.statLabel}>Reports Filed</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal: Register Inspector */}
        {modalOpen && (
          <div className={styles.modalOverlay} onClick={() => setModalOpen(false)}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
              <h2 className={styles.modalTitle}>Register Quality Inspection Officer</h2>
              <form onSubmit={handleRegisterInspector}>
                <div className={styles.formGroup}>
                  <label>Officer Full Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.full_name}
                    onChange={(e) =>
                      setFormData({ ...formData, full_name: e.target.value })
                    }
                    placeholder="e.g. Inspector Suresh Sharma"
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Official Email Address *</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    placeholder="suresh.inspector@railguard.gov.in"
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Contact Phone Number</label>
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
                  <label>Initial Login Password * (Min 6 chars)</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    placeholder="••••••••"
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
                    Create Inspector Account
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
