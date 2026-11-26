import { redirect } from "next/navigation";

export default function InspectorLoginRedirect() {
  redirect("/auth/login");
}
