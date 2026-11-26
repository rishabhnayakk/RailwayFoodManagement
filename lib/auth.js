/* lib/auth.js
 * Supabase Authentication and Role Resolution Helpers.
 * Client-side utilities for managing sessions and verifying active profiles.
 */

import { createClient } from "./supabase/client";

/**
 * Signs in a user with email and password and checks account suspension status.
 */
export async function signInUser(email, password) {
  const supabase = createClient();
  if (!supabase) throw new Error("Supabase is not configured.");

  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });

  if (error) throw error;

  if (data?.user) {
    const { data: profile, error: profErr } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", data.user.id)
      .single();

    if (profErr || !profile) {
      await supabase.auth.signOut();
      throw new Error("Your RailGuard profile could not be verified. Contact the administrator.");
    }

    if (profile.status === "suspended") {
      await supabase.auth.signOut();
      throw new Error("This account has been suspended by Railway Administration.");
    }
  }

  return data;
}

/**
 * Registers a new passenger account without email verification and signs in immediately.
 * Server route enforces role = 'passenger' regardless of client input.
 */
export async function registerPassenger({ email, password, fullName, phone }) {
  const res = await fetch("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: email.trim(),
      password,
      fullName: fullName.trim(),
      phone: phone?.trim() || null,
    }),
  });

  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(payload.error || "Registration failed. Please try again.");
  }

  return signInUser(email, password);
}

/**
 * Signs out the current user session and clears local cookies.
 */
export async function signOutUser() {
  const supabase = createClient();
  if (!supabase) return;
  await supabase.auth.signOut();
}

/**
 * Retrieves the currently authenticated user's session and database profile.
 * Returns null if Supabase is unconfigured or user is unauthenticated.
 * Signs out and throws if profile is suspended.
 */
export async function getCurrentUserProfile() {
  const supabase = createClient();
  if (!supabase) return null;

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user) return null;

  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (profileErr || !profile) {
    throw new Error("Your RailGuard profile could not be verified. Please contact the administrator.");
  }

  if (profile.status === "suspended") {
    await supabase.auth.signOut();
    throw new Error("Your account has been suspended by Railway Administration.");
  }

  return { user, profile };
}

export async function requestPasswordReset(email, redirectTo) {
  const supabase = createClient();
  if (!supabase) throw new Error("Supabase is not configured.");

  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo,
  });
  if (error) throw error;
}

export async function updateUserPassword(newPassword) {
  const supabase = createClient();
  if (!supabase) throw new Error("Supabase is not configured.");

  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });
  if (error) throw error;
}

export function getPortalHomeForRole(role) {
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
