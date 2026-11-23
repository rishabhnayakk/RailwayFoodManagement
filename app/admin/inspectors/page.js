/* app/admin/inspectors/page.js
 * Inspector Management Portal
 *
 * Railway administrators view registered quality inspectors.
 * Connects to the Supabase `profiles` table filtering by role = 'inspector'.
 * NO fake records. Real empty state.
 */

"use client";

import { useState, useEffect } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import EmptyState from "@/components/ui/EmptyState";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { createClient } from "@/lib/supabase/client";
import styles from "./inspectors.module.css";

export default function InspectorsPage() {
  const [inspectors, setInspectors] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchInspectors() {
      setLoading(true);
      const supabase = createClient();
      if (!supabase) {
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("id, full_name, email, phone, role, created_at")
          .eq("role", "inspector")
          .order("created_at", { ascending: false });

        if (!error && data) {
          setInspectors(data);
        }
      } catch (err) {
        console.error("Error fetching inspectors:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchInspectors();
  }, []);

  return (
    <AdminLayout title="Inspector Management">
      <div className={styles.container}>
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
            description="Inspectors will appear here once accounts with the 'inspector' role are created in Supabase Auth and profiles table."
          />
        ) : (
          <div className={styles.grid}>
            {inspectors.map((ins) => (
              <div key={ins.id} className={styles.inspectorCard}>
                <div className={styles.cardHead}>
                  <div className={styles.avatar}>🔍</div>
                  <div>
                    <h3 className={styles.name}>
                      {ins.full_name || "Quality Officer"}
                    </h3>
                    <p className={styles.email}>{ins.email}</p>
                  </div>
                </div>
                {ins.phone && (
                  <p className={styles.phone}>📞 Phone: {ins.phone}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
