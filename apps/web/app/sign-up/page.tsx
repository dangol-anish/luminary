"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

export default function SignUpPage() {
  const router = useRouter();

  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signUpLoading, setSignUpLoading] = useState(false);
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

  const signUp = async () => {
    setError(null);

    if (!email.trim()) {
      setError("Please enter your email.");
      return;
    }
    if (!password) {
      setError("Please enter your password.");
      return;
    }

    setSignUpLoading(true);
    try {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });
      if (signUpError) {
        setError(signUpError.message);
        return;
      }

      // With confirmation disabled, Supabase typically signs the user in automatically.
      // If confirmations are enabled, you'll need the confirmation flow.
    } finally {
      setSignUpLoading(false);
    }
  };

  if (authLoading) {
    return <main className="min-h-screen p-8">Loading auth...</main>;
  }

  return (
    <main className="min-h-screen bg-gray-950 text-gray-100 p-8">
      <div className="max-w-md mx-auto">
        <h1 className="text-2xl font-bold mb-4">Create account</h1>

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
          onClick={signUp}
          disabled={signUpLoading}
          className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white py-2 rounded-md"
        >
          {signUpLoading ? "Creating..." : "Sign up"}
        </button>

        <p className="text-sm text-gray-400 mt-4">
          Already have an account?{" "}
          <a className="text-indigo-300 hover:text-indigo-200" href="/sign-in">
            Sign in
          </a>
        </p>
      </div>
    </main>
  );
}

