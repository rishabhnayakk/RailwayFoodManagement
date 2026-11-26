// Shared metadata wrapper for /admin/* routes. AdminLayout handles sidebar + auth checks.

export const metadata = {
  title: "RailGuard Admin",
  description: "Railway Quality Audit Administration Panel",
};

export default function AdminRootLayout({ children }) {
  // The AdminLayout component (with sidebar) is used in each page
  // so it can receive the dynamic `title` prop per page.
  // This layout just provides the font and base structure.
  return <>{children}</>;
}
