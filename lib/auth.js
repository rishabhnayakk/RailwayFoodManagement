/* lib/auth.js
 * Supabase Authentication and Role Resolution Helpers.
 * Client and server-side utilities for managing sessions and profiles.
 */

import { createClient } from "./supabase/client";

/**
 * Signs in a user with email and password.
 */
export async function signInUser(email, password) {
  const supabase = createClient();
  if (!supabase) throw new Error("Supabase is not configured.");

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;
  return data;
}

/**
 * Registers a new passenger account.
 * Automatically assigns role = 'passenger' in auth metadata,
 * triggering the handle_new_user database trigger.
 */
export async function registerPassenger({ email, password, fullName, phone }) {
  const supabase = createClient();
  if (!supabase) throw new Error("Supabase is not configured.");

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        phone: phone || null,
        role: "passenger",
      },
    },
  });

  if (error) throw error;
  return data;
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
 * Returns { user, profile } or null if unauthenticated.
 */
export async function getCurrentUserProfile() {
  const supabase = createClient();
  if (!supabase) return null;

  const {
    data: { session },
    error: sessionErr,
  } = await supabase.auth.getSession();

  if (sessionErr || !session?.user) return null;

  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", session.user.id)
    .single();

  if (profileErr || !profile) {
    return {
      user: session.user,
      profile: {
        id: session.user.id,
        email: session.user.email,
        full_name: session.user.user_metadata?.full_name || "User",
        role: session.user.user_metadata?.role || "passenger",
      },
    };
  }

  return { user: session.user, profile };
}
