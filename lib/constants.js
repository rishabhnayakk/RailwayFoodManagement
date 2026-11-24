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
  PASSENGER: "passenger",
};

export const ROLE_LABELS = {
  admin: "Railway Administrator",
  inspector: "Quality Inspector",
  passenger: "Passenger",
};

/* Official 6-stage Complaint Lifecycle (plus Reopened) */
export const COMPLAINT_STATUS = {
  SUBMITTED: "submitted",
  PENDING_REVIEW: "pending_review",
  ASSIGNED: "assigned",
  IN_PROGRESS: "in_progress",
  REPORT_SUBMITTED: "report_submitted",
  RESOLVED: "resolved",
  REOPENED: "reopened",
};

export const STATUS_LABELS = {
  submitted: "Submitted",
  pending_review: "Pending Review",
  assigned: "Assigned",
  in_progress: "In Progress",
  report_submitted: "Report Submitted",
  resolved: "Resolved / Closed",
  reopened: "Reopened",
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

/* Common food hygiene issue categories */
export const HYGIENE_ISSUES = [
  { value: "foreign_object", label: "Foreign Object Found (Hair, Metal, Plastic)" },
  { value: "bad_odour", label: "Foul / Bad Odour" },
  { value: "expired_food", label: "Expired / Stale / Spoiled Food" },
  { value: "undercooked", label: "Undercooked / Uncooked Food" },
  { value: "packaging_damage", label: "Damaged / Broken Packaging Seal" },
  { value: "insect_pest", label: "Insects / Pests Encountered" },
  { value: "wrong_quantity", label: "Incorrect Quantity / Incomplete Meal" },
  { value: "overpriced", label: "Overcharging Above Official Railway Tariff" },
  { value: "other", label: "Other Quality / Hygiene Concern" },
];

/* Supabase Storage bucket names */
export const BUCKETS = {
  FOOD_IMAGES: "food-images",
};

/* File upload restrictions */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB
export const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"];

/* Navigation menus */
export const ADMIN_NAV = [
  { label: "Dashboard", href: "/admin", icon: "🏠" },
  { label: "Complaints", href: "/admin/complaints", icon: "⚠️" },
  { label: "Vendors", href: "/admin/vendors", icon: "🏪" },
  { label: "QR Packages", href: "/admin/qr-codes", icon: "📱" },
  { label: "Inspectors", href: "/admin/inspectors", icon: "🔍" },
  { label: "Analytics", href: "/admin/analytics", icon: "📊" },
  { label: "Audit Logs", href: "/admin/audit-logs", icon: "📋" },
];

export const INSPECTOR_NAV = [
  { label: "Overview", href: "/inspector", icon: "🏠" },
  { label: "Assigned Cases", href: "/inspector/cases", icon: "📋" },
  { label: "Investigation History", href: "/inspector/history", icon: "✅" },
];

export const PASSENGER_NAV = [
  { label: "My Dashboard", href: "/passenger", icon: "🏠" },
  { label: "My Complaints", href: "/passenger/complaints", icon: "⚠️" },
  { label: "My Ratings", href: "/passenger/feedback", icon: "⭐" },
  { label: "Scan Food QR", href: "/scan", icon: "📱" },
];
