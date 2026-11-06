"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function LoginContent() {
  const searchParams = useSearchParams();

  const isSignUp =
    searchParams.get("mode") === "signup";

  const requestedNext =
    searchParams.get("next") || "/";

  // Allow only internal website paths.
  const next =
    requestedNext.startsWith("/") &&
    !requestedNext.startsWith("//") &&
    !requestedNext.includes("\\")
      ? requestedNext
      : "/";

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleGoogleLogin() {
    setLoading(true);
    setError("");

    try {
      const supabase = createClient();

      const callbackURL =
        `${window.location.origin}/auth/callback` +
        `?next=${encodeURIComponent(next)}`;

      const { error: loginError } =
        await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: callbackURL,
          },
        });

      if (loginError) {
        setError(loginError.message);
        setLoading(false);
      }
    } catch {
      setError(
        "Something went wrong. Please try again."
      );
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col bg-[#080b12] text-white">
      {/* NAVIGATION */}
      <nav className="border-b border-white/10 px-6 py-6">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <Link
            href="/"
            className="text-2xl font-black"
          >
            SILVA
            <span className="text-blue-500">.</span>
          </Link>

          <Link
            href="/"
            className="text-sm font-semibold text-blue-400 hover:text-blue-300"
          >
            ← Back to Store
          </Link>
        </div>
      </nav>

      {/* LOGIN SECTION */}
      <section className="flex flex-1 items-center justify-center px-6 py-16">
        <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#111827] p-8 shadow-2xl md:p-10">
          <div className="text-center">
            {/* SILVA'S PICTURE */}
            <img
              src="/silva-profile.jpg"
              alt="Silva Celebrity Dealer"
              className="mx-auto h-32 w-32 rounded-full border-4 border-blue-500 object-cover shadow-lg shadow-blue-500/20"
            />

            <h1 className="mt-7 text-3xl font-black leading-tight">
              {isSignUp ? "Join" : "Welcome to"}

              <span className="mt-2 block text-blue-400">
                SILVA GADGET
              </span>

              CELEBRITY DEALER
            </h1>

            <p className="mt-5 leading-7 text-gray-400">
              {isSignUp
                ? "Create your customer account to order your favourite gadgets."
                : "Sign in to your account to explore and order your favourite gadgets."}
            </p>
          </div>

          {/* GOOGLE LOGIN */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading}
            className="mt-10 flex w-full items-center justify-center gap-4 rounded-xl bg-white px-6 py-4 font-bold text-gray-900 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 48 48"
              aria-hidden="true"
            >
              <path
                fill="#EA4335"
                d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 5.38 6.51 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
              />
              <path
                fill="#4285F4"
                d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.28 5.48-4.81 7.18l7.73 6C44.37 38.03 46.98 31.88 46.98 24.55z"
              />
              <path
                fill="#FBBC05"
                d="M10.53 28.59A14.5 14.5 0 019.75 24c0-1.59.27-3.13.77-4.59l-7.98-6.19A23.87 23.87 0 000 24c0 3.87.92 7.51 2.54 10.78l7.99-6.19z"
              />
              <path
                fill="#34A853"
                d="M24 48c6.48 0 11.93-2.13 15.91-5.8l-7.73-6c-2.14 1.44-4.89 2.3-8.18 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
              />
            </svg>

            {loading
              ? "Connecting to Google..."
              : isSignUp
                ? "Sign Up with Google"
                : "Sign In with Google"}
          </button>

          {/* ERROR MESSAGE */}
          {(error ||
            searchParams.get("error") ===
              "authentication_failed") && (
            <div
              role="alert"
              className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400"
            >
              {error ||
                "Google authentication failed. Please try again."}
            </div>
          )}

          {/* SWITCH SIGN IN / SIGN UP */}
          <div className="mt-8 text-center">
            {isSignUp ? (
              <p className="text-sm text-gray-400">
                Already have an account?{" "}
                <Link
                  href={`/login?next=${encodeURIComponent(next)}`}
                  className="font-bold text-blue-400 hover:underline"
                >
                  Sign In
                </Link>
              </p>
            ) : (
              <p className="text-sm text-gray-400">
                Don&apos;t have an account?{" "}
                <Link
                  href={`/login?mode=signup&next=${encodeURIComponent(next)}`}
                  className="font-bold text-blue-400 hover:underline"
                >
                  Sign Up
                </Link>
              </p>
            )}
          </div>

          <div className="mt-8 border-t border-white/10 pt-7">
            <p className="text-center text-sm leading-7 text-gray-500">
              Sign in to view your orders, track special
              phone requests and verify your deliveries
              from the homepage.
            </p>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/10 px-6 py-8 text-center text-sm text-gray-500">
        © 2026 SILVA CELEBRITY DEALER.
        All rights reserved.
      </footer>
    </main>
  );
}

// Prevent Next.js URL-reading errors.
export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#080b12] text-white">
          Loading login...
        </main>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
