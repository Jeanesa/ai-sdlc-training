"use client";

import { useEffect, useRef, useState } from "react";

import { createClient } from "@/lib/supabase/client";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const successRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (submitted) {
      successRef.current?.focus();
    }
  }, [submitted]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const value = email.trim();
    if (!value) {
      setError("Please enter your email address.");
      return;
    }

    if (!value.toLowerCase().endsWith("@stratpoint.com")) {
      setError("Only @stratpoint.com email addresses are permitted.");
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const origin = window.location.origin;
      const redirectTo = new URLSearchParams(window.location.search).get("redirect_to");
      const baseRedirect = `${origin}/auth/callback`;
      const emailRedirectTo = redirectTo
        ? `${baseRedirect}?redirect_to=${encodeURIComponent(redirectTo)}`
        : baseRedirect;

      const { error: signInError } = await supabase.auth.signInWithOtp({
        email: value,
        options: { emailRedirectTo },
      });
      if (signInError) {
        setError(signInError.message);
        return;
      }
      setSubmitted(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f0f4f8] flex flex-col">
      <div className="px-6 py-4" style={{ backgroundColor: "#0f2540" }}>
        <div className="max-w-6xl mx-auto flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-white/15 flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
              <rect x="3" y="4" width="18" height="18" rx="2" opacity="0.4" />
              <rect x="7" y="8" width="4" height="4" rx="0.5" />
              <rect x="13" y="8" width="4" height="4" rx="0.5" />
              <rect x="7" y="14" width="4" height="4" rx="0.5" />
              <rect x="13" y="14" width="4" height="4" rx="0.5" />
            </svg>
          </div>
          <span className="text-white font-semibold text-sm" style={{ fontFamily: "var(--font-display)" }}>
            Meridian Corp &mdash; Leave Management System
          </span>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-4 py-12">
        <div className="w-full max-w-sm">
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
            <div className="px-8 pt-8 pb-6">
              <h1 className="text-2xl font-semibold text-gray-900 mb-1" style={{ fontFamily: "var(--font-display)" }}>
                Sign in
              </h1>
              <p className="text-sm text-gray-600">Enter your Meridian Corp email to receive a magic link.</p>
            </div>

            <div className="px-8 pb-8">
              {!submitted ? (
                <form onSubmit={handleSubmit} noValidate>
                  <div className="mb-4">
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
                      Work email address
                    </label>
                    <input
                      id="email"
                      type="email"
                      autoComplete="email"
                      autoFocus
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setError("");
                      }}
                      placeholder="you@stratpoint.com"
                      className={`w-full px-3.5 py-2.5 rounded-lg border text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1a3a5c] focus:ring-offset-0 transition-colors ${
                        error ? "border-red-400 bg-red-50" : "border-gray-300 bg-white hover:border-gray-400"
                      }`}
                      aria-describedby={error ? "email-error" : undefined}
                      aria-invalid={!!error}
                    />
                    {error && (
                      <div id="email-error" role="alert" className="mt-2 flex items-start gap-2 text-sm text-red-700">
                        <svg
                          className="w-4 h-4 mt-0.5 flex-shrink-0"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <circle cx="12" cy="12" r="10" />
                          <line x1="12" y1="8" x2="12" y2="12" />
                          <line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                        {error}
                      </div>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 px-4 rounded-lg text-sm font-semibold text-white transition-all focus:outline-none focus:ring-2 focus:ring-[#1a3a5c] focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed"
                    style={{ backgroundColor: "#1a3a5c" }}
                  >
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                          />
                        </svg>
                        Sending link...
                      </span>
                    ) : (
                      "Send magic link"
                    )}
                  </button>
                </form>
              ) : (
                <div className="text-center py-4" role="status">
                  <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                    <svg
                      className="w-6 h-6 text-green-600"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <h2
                    ref={successRef}
                    tabIndex={-1}
                    className="text-base font-semibold text-gray-900 mb-1 focus:outline-none"
                  >
                    Check your @stratpoint.com inbox
                  </h2>
                  <p className="text-sm text-gray-600">
                    We sent a magic link to <strong className="text-gray-700">{email}</strong>. It expires in 10
                    minutes.
                  </p>
                  <button
                    onClick={() => {
                      setSubmitted(false);
                      setEmail("");
                    }}
                    className="mt-4 text-sm text-[#1a3a5c] hover:underline"
                  >
                    Use a different email
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <footer className="py-4 text-center text-xs text-gray-600">
        Meridian Corp &copy; 2026 &middot; Leave Management System v1.0
      </footer>
    </div>
  );
}
