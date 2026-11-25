import PortalLoginForm from "@/components/auth/PortalLoginForm";
import styles from "@/app/auth/auth.module.css";

export default function AdminLoginPage() {
  return (
    <PortalLoginForm
      expectedRole="admin"
      badgeText="Railway Department Admin"
      badgeClass={styles.badgeAdmin}
      title="Admin Portal Sign In"
      subtitle="Sign in with your Railway Quality Administration credentials to manage accounts, approve packages, and monitor complaints."
      redirectPath="/admin"
      placeholderEmail="admin@railguard.gov.in"
      footerNote="Administrator accounts are provisioned directly in Supabase."
    />
  );
}
