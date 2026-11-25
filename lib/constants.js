/* lib/constants.js
 * Application-wide constant values for RailGuard.
 * Single source of truth for user roles, complaint statuses, severity levels,
 * navigation bars, and storage buckets.
 */

export const APP_NAME = "RailGuard";
export const APP_TAGLINE = "Passenger Food Feedback & Railway Quality Audit Platform";

/* Application user roles — accounts in the `profiles` table */
export const ROLES = {
  ADMIN: "admin",
  INSPECTOR: "inspector",
  VENDOR: "vendor",
  PASSENGER: "passenger",
};

export const ROLE_LABELS = {
  admin: "Railway Administrator",
  inspector: "Quality Inspector",
  vendor: "Catering Vendor",
  passenger: "Passenger",
};

/* Official Complaint Lifecycle */
export const COMPLAINT_STATUS = {
  SUBMITTED: "submitted",
  PENDING_REVIEW: "pending_review",
  ASSIGNED: "assigned",
  IN_PROGRESS: "in_progress",
  REPORT_SUBMITTED: "report_submitted",
  UNABLE_TO_RESOLVE: "unable_to_resolve",
  ESCALATED: "escalated",
  RESOLVED: "resolved",
  REOPENED: "reopened",
};

export const STATUS_LABELS = {
  submitted: "Submitted",
  pending_review: "Pending Review",
  assigned: "Assigned",
  in_progress: "In Progress",
  report_submitted: "Report Submitted",
  unable_to_resolve: "Unable to Resolve",
  escalated: "Escalated",
  resolved: "Resolved",
  reopened: "Reopened",
};

export const PACKAGE_APPROVAL_STATUS = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
};

export const PACKAGE_APPROVAL_LABELS = {
  pending: "Pending Approval",
  approved: "Approved",
  rejected: "Rejected",
};

/* Severity / Priority levels */
export const SEVERITY = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
  CRITICAL: "critical",
};

export const SEVERITY_LABELS = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

/* Food package categories */
export const FOOD_CATEGORIES = [
  "Meals",
  "Breakfast",
  "Snacks",
  "Beverages",
  "Combo",
  "Packaged",
];

/* Complaint categories matching RailGuard passenger reporting workflow */
export const HYGIENE_ISSUES = [
  { value: "poor_food_quality", label: "Poor food quality" },
  { value: "hygiene_issue", label: "Hygiene issue" },
  { value: "stale_or_expired_food", label: "Stale or expired food" },
  { value: "poor_food_packaging", label: "Poor food packaging" },
  { value: "food_quantity_issue", label: "Food quantity issue" },
  { value: "foreign_object", label: "Foreign object in food" },
  { value: "other", label: "Other" },
];

/* Supabase Storage bucket names */
export const BUCKETS = {
  FOOD_IMAGES: "food-images",
  COMPLAINT_EVIDENCE: "complaint-evidence",
  INSPECTION_EVIDENCE: "inspection-evidence",
};

/* File upload restrictions */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB
export const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"];

/* Navigation menus */
export const ADMIN_NAV = [
  { label: "Dashboard", href: "/admin", icon: "dashboard" },
  { label: "Complaints", href: "/admin/complaints", icon: "complaints" },
  { label: "Feedback", href: "/admin/feedback", icon: "feedback" },
  { label: "Vendors", href: "/admin/vendors", icon: "vendors" },
  { label: "Package Approvals", href: "/admin/qr-codes", icon: "packages" },
  { label: "Inspectors", href: "/admin/inspectors", icon: "inspectors" },
  { label: "Analytics", href: "/admin/analytics", icon: "analytics" },
  { label: "Audit Logs", href: "/admin/audit-logs", icon: "audit" },
];

export const VENDOR_NAV = [
  { label: "Dashboard", href: "/vendor", icon: "dashboard" },
  { label: "Packages & QR", href: "/vendor/packages", icon: "packages" },
  { label: "Feedback", href: "/vendor/feedback", icon: "feedback" },
  { label: "Complaints", href: "/vendor/complaints", icon: "complaints" },
];

export const INSPECTOR_NAV = [
  { label: "Overview", href: "/inspector", icon: "dashboard" },
  { label: "Assigned Cases", href: "/inspector/cases", icon: "audit" },
  { label: "Report History", href: "/inspector/history", icon: "history" },
];

export const PASSENGER_NAV = [
  { label: "Dashboard", href: "/passenger", icon: "dashboard" },
  { label: "My Complaints", href: "/passenger/complaints", icon: "complaints" },
  { label: "My Ratings", href: "/passenger/feedback", icon: "feedback" },
  { label: "Scan QR", href: "/scan", icon: "qr" },
];
