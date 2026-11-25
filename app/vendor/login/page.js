import PortalLoginForm from "@/components/auth/PortalLoginForm";
import styles from "@/app/auth/auth.module.css";

export default function VendorLoginPage() {
  return (
    <PortalLoginForm
      expectedRole="vendor"
      badgeText="Authorized Catering Vendor"
      badgeClass={styles.badgePassenger}
      title="Vendor Portal Sign In"
      subtitle="Sign in to upload food packages, generate QR codes, and monitor passenger ratings and complaints."
      redirectPath="/vendor"
      placeholderEmail="vendor@catering.in"
      footerNote="Vendor accounts are created and activated by Railway Administration."
    />
  );
}
