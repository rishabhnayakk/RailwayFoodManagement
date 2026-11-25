// app/admin/layout.js
// Next.js Route Group Layout for all /admin/* pages.
//
// WHAT THIS FILE DOES:
// Every file inside /admin/ automatically gets wrapped by this layout.
// So /admin, /admin/complaints, /admin/vendors, etc. all share the same
// sidebar + header shell WITHOUT copy-pasting it into every page.
//
// This is one of Next.js App Router's most powerful features — nested layouts.
//
// DATABASE: No DB call here. Auth check happens in middleware / layouts.

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
