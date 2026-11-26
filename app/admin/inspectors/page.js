/* app/admin/inspectors/page.js
 * Inspector Account Management Portal
 *
 * Allows Railway Administration to create, view, activate, and suspend
 * Quality Inspector accounts and monitor their investigation workload.
 */

"use client";

import { useState, useEffect } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { createClient } from "@/lib/supabase/client";
import styles from "./inspectors.module.css";

export default function InspectorsPage() {
  const toast = useToast();
  const [inspectors, setInspectors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmInspector, setConfirmInspector] = useState(null);
  const [toggling, setToggling] = useState(false);

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
      const { data: profiles, error: profErr } = await supabase
        .from("profiles")
        .select("id, full_name, email, phone, role, status, created_at")
        .eq("role", "inspector")
        .order("created_at", { ascending: false });

      if (profErr || !profiles) {
        setInspectors([]);
        setLoading(false);
        return;
      }

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
          status: p.status || "active",
          totalAssigned: assignedComps.length,
          activeCases: activeComps.length,
          reportsCount: submittedReports.length,
        };
      });

      setInspectors(enriched);
    } catch (err) {
      console.error("Error fetching inspectors:", err);
      toast.error("Failed to load inspectors.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchInspectors();
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleRegisterInspector(e) {
    e.preventDefault();
    if (!formData.password || formData.password.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch("/api/admin/create-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.email.trim(),
          password: formData.password,
          full_name: formData.full_name.trim(),
          phone: formData.phone.trim() || null,
          role: "inspector",
        }),
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || "Failed to create inspector account.");
      }

      toast.success(`Inspector "${formData.full_name}" registered. They can sign in at /auth/login.`);
      setFormData({ full_name: "", email: "", phone: "", password: "" });
      setModalOpen(false);
      fetchInspectors();
    } catch (err) {
      toast.error("Error registering inspector: " + err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirmToggle() {
    if (!confirmInspector) return;
    const nextStatus = confirmInspector.status === "active" ? "suspended" : "active";
    setToggling(true);

    try {
      const res = await fetch("/api/admin/toggle-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityType: "inspector",
          entityId: confirmInspector.id,
          nextStatus,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update inspector status.");

      toast.success(
        nextStatus === "suspended"
          ? `Inspector "${confirmInspector.full_name}" suspended.`
          : `Inspector "${confirmInspector.full_name}" reactivated.`
      );
      setConfirmInspector(null);
      fetchInspectors();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setToggling(false);
    }
  }

  return (
    <AdminLayout title="Quality Inspectorate & Field Officers">
      <div className={styles.container}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
          <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>
            Registered Quality Inspectors: <strong>{inspectors.length}</strong> (Active:{" "}
            <strong>{inspectors.filter((i) => i.status === "active").length}</strong>)
          </p>
          <Button variant="primary" onClick={() => setModalOpen(true)}>
            + Create Inspector Account
          </Button>
        </div>

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
            description="Create a Quality Inspector account so they can investigate assigned passenger complaints at /auth/login."
            action={
              <Button variant="primary" onClick={() => setModalOpen(true)}>
                + Create First Inspector Account
              </Button>
            }
          />
        ) : (
          <div className={styles.grid}>
            {inspectors.map((ins) => (
              <div key={ins.id} className={styles.inspectorCard}>
                <div className={styles.cardHead}>
                  <div className={styles.avatar}>
                    {(ins.full_name || "Q").slice(0, 1).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 className={styles.name}>{ins.full_name || "Quality Officer"}</h3>
                    <p className={styles.email}>{ins.email}</p>
                  </div>
                  <span
                    style={{
                      padding: "3px 9px",
                      borderRadius: "4px",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      background: ins.status === "active" ? "#f0fdf4" : "#fef2f2",
                      color: ins.status === "active" ? "#166534" : "#991b1b",
                    }}
                  >
                    {ins.status}
                  </span>
                </div>

                {ins.phone && <p className={styles.phone}>Phone: {ins.phone}</p>}

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

                <div style={{ display: "flex", justifyContent: "flex-end", borderTop: "1px solid var(--border)", paddingTop: "12px", marginTop: "12px" }}>
                  <Button
                    variant={ins.status === "active" ? "danger" : "outline"}
                    size="sm"
                    onClick={() => setConfirmInspector(ins)}
                  >
                    {ins.status === "active" ? "Suspend Account" : "Activate Account"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {modalOpen && (
          <div className={styles.modalOverlay} onClick={() => setModalOpen(false)}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
              <h2 className={styles.modalTitle}>Create Quality Inspector Account</h2>
              <form onSubmit={handleRegisterInspector}>
                <div className={styles.formGroup}>
                  <label>Officer Full Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    placeholder="e.g. Inspector Suresh Sharma"
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Official Email Address *</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="suresh.inspector@railguard.gov.in"
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Contact Phone Number</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
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
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="••••••••"
                  />
                </div>
                <div className={styles.modalActions}>
                  <Button variant="ghost" onClick={() => setModalOpen(false)} disabled={submitting}>
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

        <ConfirmDialog
          open={Boolean(confirmInspector)}
          title={confirmInspector?.status === "active" ? "Suspend Inspector Account?" : "Activate Inspector Account?"}
          message={
            confirmInspector?.status === "active"
              ? `Suspending "${confirmInspector?.full_name}" will prevent them from signing into the Inspector Portal or modifying any assigned complaints.`
              : `Reactivating "${confirmInspector?.full_name}" will restore their Inspector Portal access.`
          }
          confirmLabel={confirmInspector?.status === "active" ? "Suspend Inspector" : "Activate Inspector"}
          variant={confirmInspector?.status === "active" ? "danger" : "primary"}
          loading={toggling}
          onConfirm={handleConfirmToggle}
          onCancel={() => setConfirmInspector(null)}
        />
      </div>
    </AdminLayout>
  );
}
