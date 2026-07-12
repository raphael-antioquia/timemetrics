"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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
    redirectWithMessage("/sign-up", "error", error.message || "Unknown error");
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
    redirectWithMessage("/sign-in", "error", error.message);
  }

  redirect("/");
}