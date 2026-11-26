/* proxy.js
 * Server-side route protection and Supabase session refresh for RailGuard portals.
 */

import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PORTAL_RULES = [
  { prefix: "/admin", loginPath: "/admin/login", role: "admin" },
  { prefix: "/vendor", loginPath: "/vendor/login", role: "vendor" },
  { prefix: "/inspector", loginPath: "/inspector/login", role: "inspector" },
  { prefix: "/passenger", loginPath: "/auth/login", role: "passenger" },
];

function homeForRole(role) {
  switch (role) {
    case "admin":
      return "/admin";
    case "vendor":
      return "/vendor";
    case "inspector":
      return "/inspector";
    case "passenger":
      return "/passenger";
    default:
      return "/auth/login";
  }
}

export async function proxy(request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey || url.includes("placeholder")) {
    return NextResponse.next();
  }

  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({
          request: { headers: request.headers },
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  const { pathname } = request.nextUrl;
  const matchedPortal = PORTAL_RULES.find(
    (rule) => pathname === rule.prefix || pathname.startsWith(`${rule.prefix}/`)
  );
  const isPortalLogin =
    pathname === "/admin/login" ||
    pathname === "/vendor/login" ||
    pathname === "/inspector/login";
  const isUnifiedAuthPage = pathname === "/auth/login" || pathname === "/auth/register";

  if (!matchedPortal && !isUnifiedAuthPage) {
    return response;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Redirect unauthenticated visitors away from protected portal pages
  if (matchedPortal && !isPortalLogin && !user) {
    return NextResponse.redirect(new URL(matchedPortal.loginPath, request.url));
  }

  if (!user) {
    return response;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, status")
    .eq("id", user.id)
    .single();

  if (!profile || profile.status === "suspended") {
    if (matchedPortal && !isPortalLogin) {
      return NextResponse.redirect(new URL("/auth/login", request.url));
    }
    return response;
  }

  // Redirect already-authenticated users from /auth/login or /auth/register to their portal
  if (isUnifiedAuthPage) {
    return NextResponse.redirect(new URL(homeForRole(profile.role), request.url));
  }

  // Enforce strict role matching on protected portal routes
  if (matchedPortal && !isPortalLogin && profile.role !== matchedPortal.role) {
    return NextResponse.redirect(new URL(homeForRole(profile.role), request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/vendor/:path*",
    "/inspector/:path*",
    "/passenger/:path*",
    "/auth/login",
    "/auth/register",
  ],
};
