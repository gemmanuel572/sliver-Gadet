import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);

  // Get the authentication code from Google
  const code = searchParams.get("code");

  // Determine where to send the customer after login
  const requestedPath = searchParams.get("next") || "/";

  const next =
    requestedPath.startsWith("/") &&
    !requestedPath.startsWith("//") &&
    !requestedPath.includes("\\")
      ? requestedPath
      : "/";

  if (code) {
    const supabase = await createClient();

    // Exchange the authentication code for a customer session
    const { error } =
      await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Login successful
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Login failed
  return NextResponse.redirect(
    `${origin}/login?error=authentication_failed`
  );
}