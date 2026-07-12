import type { EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { reportUnexpectedAuthError } from "@/lib/observability/auth-errors";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  if (tokenHash && type) {
    const supabase = await createClient();

    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });

    if (!error) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    
    reportUnexpectedAuthError(error, "confirm_email");
  }

  const errorUrl = new URL("/sign-in", request.url);

  errorUrl.searchParams.set(
    "error",
    "The confirmation link is invalid or has expired.",
  );

  return NextResponse.redirect(errorUrl);
}