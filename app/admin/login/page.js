import { redirect } from "next/navigation";

// Keep this legacy URL working, but send every role to the shared login page.
export default function AdminLoginRedirect() {
  redirect("/auth/login");
}
