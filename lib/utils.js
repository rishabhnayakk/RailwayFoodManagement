/* lib/utils.js
 * Small helper functions used across the app.
 * No mock data. No external dependencies.
 */

/**
 * formatDate — converts a date string like "2025-11-22T10:30:00Z"
 * into a readable format like "22 Nov 2025".
 */
export function formatDate(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/**
 * formatDateTime — same as formatDate but includes hours:minutes.
 */
export function formatDateTime(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * truncate — shortens a long string with an ellipsis.
 * Example: truncate("Hello World Long Text", 10) → "Hello Worl…"
 */
export function truncate(str, max = 60) {
  if (!str) return "";
  return str.length <= max ? str : str.slice(0, max) + "…";
}

/**
 * generateToken — creates a random hex string for QR codes.
 * Uses the Web Crypto API (available in browser and Node.js).
 * Example output: "a3f9b2c1d4e5f6a7b8c9d0e1f2a3b4c5"
 */
export function generateToken(byteLength = 24) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
