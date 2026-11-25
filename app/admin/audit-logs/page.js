/* app/admin/audit-logs/page.js
 * Audit Logs Management
 *
 * Displays chronological system logs of administrative actions,
 * status changes, inspector assignments, and package registrations.
 * Connects to Supabase `audit_logs` table. Shows real empty state.
 * NO mock rows. NO external icon library.
 */

"use client";

import { useState, useEffect } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import { SkeletonLine } from "@/components/ui/Skeleton";
import { formatDateTime } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import styles from "./auditlogs.module.css";

export default function AuditLogsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadLogs() {
      setLoading(true);
      const supabase = createClient();
      if (!supabase) {
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("audit_logs")
          .select("*")
          .order("created_at", { ascending: false });

        if (!error && data) {
          setLogs(data);
        }
      } catch (err) {
        console.error("Error loading audit logs:", err);
      } finally {
        setLoading(false);
      }
    }

    loadLogs();
  }, []);

  return (
    <AdminLayout title="Audit Logs">
      <div className={styles.container}>
        <Card>
          <CardHeader>
            <CardTitle>System Activity & Quality Audit Trail</CardTitle>
          </CardHeader>
          <CardBody style={{ padding: 0 }}>
            {loading ? (
              <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "12px" }}>
                {[1, 2, 3, 4].map((i) => (
                  <SkeletonLine key={i} height={18} />
                ))}
              </div>
            ) : logs.length === 0 ? (
              <EmptyState
                icon="📋"
                title="No audit logs recorded yet"
                description="Administrative modifications, complaint lifecycle updates, and inspector actions will be recorded here automatically."
              />
            ) : (
              <div className={styles.logList}>
                {logs.map((log) => (
                  <div key={log.id} className={styles.logItem}>
                    <div style={{ flex: 1 }}>
                      <p className={styles.logAction}>{log.action}</p>
                      <p className={styles.logMeta}>
                        Entity: {log.target_entity || "System"} • Recorded at{" "}
                        {formatDateTime(log.created_at)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </AdminLayout>
  );
}
