/* lib/constants.js
 * Application-wide constant values.
 * Keeping these in one file means changing a label or value
 * here updates it everywhere automatically.
 */

export const APP_NAME = "RailGuard";
export const APP_TAGLINE = "Railway Food Quality Audit Platform";

/* User roles — must match the role column in the profiles table */
export const ROLES = {
  ADMIN:     "admin",
  INSPECTOR: "inspector",
  VENDOR:    "vendor",
};

/* Complaint status values — match the complaints table constraint */
export const COMPLAINT_STATUS = {
  PENDING:      "pending",
  UNDER_REVIEW: "under_review",
  RESOLVED:     "resolved",
  REJECTED:     "rejected",
};

export const STATUS_LABELS = {
  pending:      "Pending",
  under_review: "Under Review",
  resolved:     "Resolved",
  rejected:     "Rejected",
};

/* Severity / Priority levels */
export const SEVERITY = {
  LOW:      "low",
  MEDIUM:   "medium",
  HIGH:     "high",
  CRITICAL: "critical",
};

export const SEVERITY_LABELS = {
  low:      "Low",
  medium:   "Medium",
  high:     "High",
  critical: "Critical",
};

/* Hygiene issue options shown on the passenger feedback form */
export const HYGIENE_ISSUES = [
  { value: "foreign_object",   label: "Foreign Object Found" },
  { value: "bad_odour",        label: "Bad Odour" },
  { value: "expired_food",     label: "Expired / Stale Food" },
  { value: "packaging_damage", label: "Damaged Packaging" },
  { value: "insect_pest",      label: "Insect / Pest Found" },
  { value: "wrong_quantity",   label: "Incorrect Quantity" },
  { value: "overpriced",       label: "Overcharging" },
  { value: "other",            label: "Other" },
];

/* Supabase Storage bucket names */
export const BUCKETS = {
  FOOD_IMAGES: "food-images",
};

/* Max image upload size: 5 MB */
export const MAX_IMAGE_BYTES  = 5 * 1024 * 1024;
export const ALLOWED_MIME     = ["image/jpeg", "image/png", "image/webp"];

/* Admin sidebar navigation links */
export const ADMIN_NAV = [
  { label: "Dashboard",  href: "/admin"            },
  { label: "Complaints", href: "/admin/complaints"  },
  { label: "Vendors",    href: "/admin/vendors"     },
  { label: "QR Codes",   href: "/admin/qr-codes"   },
  { label: "Inspectors", href: "/admin/inspectors"  },
  { label: "Audit Logs", href: "/admin/audit-logs"  },
];
