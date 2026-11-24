import { redirect } from "next/navigation";

// Legacy URL: all account types use the shared sign-in page.
export default function AdminLoginRedirect() {
  redirect("/auth/login");
}
