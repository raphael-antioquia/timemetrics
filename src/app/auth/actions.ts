"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { reportUnexpectedAuthError } from "@/lib/observability/auth-errors";

function getFormString(formData: FormData, key: string): string {
  const value = formData.get(key);

  return typeof value === "string" ? value : "";
}

function redirectWithMessage(
  path: string,
  type: "error" | "message",
  message: string,
): never {
  redirect(`${path}?${type}=${encodeURIComponent(message)}`);
}

export async function signUp(formData: FormData) {
  const email = getFormString(formData, "email").trim();
  const password = getFormString(formData, "password");
  const confirmPassword = getFormString(formData, "confirmPassword");

  if (!email || !password || !confirmPassword) {
    redirectWithMessage("/sign-up", "error", "All fields are required.");
  }

  if (password !== confirmPassword) {
    redirectWithMessage("/sign-up", "error", "Passwords do not match.");
  }

  if (password.length < 8) {
    redirectWithMessage(
      "/sign-up",
      "error",
      "Password must be at least 8 characters.",
    );
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    reportUnexpectedAuthError(error, "sign_up");

    const message =
      error.status !== undefined && error.status < 500
        ? error.message
        : "We could not create your account right now. Please try again.";

    redirectWithMessage("/sign-up", "error", message);
  }

  redirectWithMessage(
    "/sign-up",
    "message",
    "Account created. Check your email to confirm your account.",
  );
}

export async function signIn(formData: FormData) {
  const email = getFormString(formData, "email").trim();
  const password = getFormString(formData, "password");

  if (!email || !password) {
    redirectWithMessage(
      "/sign-in",
      "error",
      "Email and password are required.",
    );
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    reportUnexpectedAuthError(error, "sign_in");

    const message =
      error.status !== undefined && error.status < 500
        ? error.message
        : "We could not sign you in right now. Please try again.";

    redirectWithMessage("/sign-in", "error", message);
  }

  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();

  const { error } = await supabase.auth.signOut({
    scope: "local",
  });

  // @supabase/auth-js >= 2.110.2 clears the local session even when
  // the remote revoke fails for local/global sign-out. Record the
  // revoke failure, but still redirect because the user is signed out locally.
  if (error) {
    reportUnexpectedAuthError(error, "sign_out");
  }

  redirect("/sign-in");
}