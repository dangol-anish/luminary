"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

export default function SignInPage() {
  const router = useRouter();

  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signInLoading, setSignInLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let subscription: { unsubscribe: () => void } | null = null;

    const init = async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data.session);
      setAuthLoading(false);
    };

    void init();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_, nextSession) => {
        setSession(nextSession);
      },
    );

    subscription = authListener.subscription;

    return () => {
      subscription?.unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    if (!authLoading && session) {
      router.replace("/");
    }
  }, [authLoading, session, router]);

  const signIn = async () => {
    setError(null);

    if (!email.trim()) {
      setError("Please enter your email.");
      return;
    }
    if (!password) {
      setError("Please enter your password.");
      return;
    }

    setSignInLoading(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) {
        setError(signInError.message);
      }
    } finally {
      setSignInLoading(false);
    }
  };

  const signInWithGoogle = async () => {
    setError(null);
    setGoogleLoading(true);
    try {
      const redirectTo = typeof window !== "undefined" ? window.location.origin : undefined;
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: redirectTo ? { redirectTo } : undefined,
      });
      if (oauthError) {
        setError(oauthError.message);
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  if (authLoading) {
    return <main className="min-h-screen p-8">Loading auth...</main>;
  }

  return (
    <main className="min-h-screen bg-gray-950 text-gray-100 p-8">
      <div className="max-w-md mx-auto">
        <h1 className="text-2xl font-bold mb-4">Sign in to Luminary</h1>

        <input
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full p-2 rounded-md mb-2 bg-gray-900 border border-gray-700 text-sm"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full p-2 rounded-md mb-3 bg-gray-900 border border-gray-700 text-sm"
        />

        {error && <p className="text-sm text-red-300 mb-3">{error}</p>}

        <button
          onClick={signIn}
          disabled={signInLoading}
          className="w-full bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white py-2 rounded-md"
        >
          {signInLoading ? "Signing in..." : "Sign in"}
        </button>

        <button
          onClick={signInWithGoogle}
          disabled={googleLoading}
          className="w-full mt-3 bg-white hover:bg-gray-100 disabled:opacity-50 text-gray-900 py-2 rounded-md border border-gray-300"
        >
          {googleLoading ? "Redirecting..." : "Continue with Google"}
        </button>

        <p className="text-sm text-gray-400 mt-4">
          No account?{" "}
          <a className="text-indigo-300 hover:text-indigo-200" href="/sign-up">
            Create one
          </a>
        </p>
      </div>
    </main>
  );
}

