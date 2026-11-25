import PortalLoginForm from "@/components/auth/PortalLoginForm";
import styles from "@/app/auth/auth.module.css";

export default function InspectorLoginPage() {
  return (
    <PortalLoginForm
      expectedRole="inspector"
      badgeText="Quality Inspectorate"
      badgeClass={styles.badgeInspector}
      title="Inspector Portal Sign In"
      subtitle="Sign in with your assigned Quality Inspector credentials to investigate complaints and file audit reports."
      redirectPath="/inspector"
      placeholderEmail="inspector@railguard.gov.in"
      footerNote="Inspector accounts are created and activated by Railway Administration."
    />
  );
}
