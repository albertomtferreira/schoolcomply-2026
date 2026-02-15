"use client";

import { createUserWithEmailAndPassword, onAuthStateChanged } from "firebase/auth";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { bootstrapUserProfile } from "@/lib/firebase/bootstrapClient";
import { auth, connectClientEmulators } from "@/lib/firebase/client";
import { getAuthErrorMessage } from "@/lib/firebase/authErrors";

function normalizeNextPath(candidate: string | null): string {
  if (!candidate) {
    return "/app";
  }

  return candidate.startsWith("/app") ? candidate : "/app";
}

export default function SignUpPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const nextPath = useMemo(
    () => normalizeNextPath(searchParams.get("next")),
    [searchParams],
  );

  useEffect(() => {
    connectClientEmulators();

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        router.replace(nextPath);
      }
    });

    return unsubscribe;
  }, [nextPath, router]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");

    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);

    try {
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      await bootstrapUserProfile(credential.user);
      router.replace(nextPath);
    } catch (error: unknown) {
      if (error instanceof Error && error.message === "Failed to bootstrap user profile.") {
        setErrorMessage(
          "Account created, but profile setup failed. Please sign in again to retry setup.",
        );
      } else {
        setErrorMessage(getAuthErrorMessage(error));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-16 text-slate-100 sm:px-10">
      <main className="mx-auto w-full max-w-md rounded-xl border border-slate-700 bg-slate-900/70 p-8">
        <h1 className="text-2xl font-semibold">Create your SchoolTrack account</h1>
        <p className="mt-2 text-sm text-slate-300">
          Start with secure sign-up and continue into the platform.
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <label className="block">
            <span className="mb-2 block text-sm text-slate-200">Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              className="w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-sm outline-none ring-teal-300 focus:ring-2"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm text-slate-200">Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={8}
              className="w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-sm outline-none ring-teal-300 focus:ring-2"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm text-slate-200">
              Confirm password
            </span>
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
              minLength={8}
              className="w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-sm outline-none ring-teal-300 focus:ring-2"
            />
          </label>

          {errorMessage ? (
            <p className="text-sm text-rose-300">{errorMessage}</p>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-md bg-teal-300 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-teal-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Creating account..." : "Create account"}
          </button>
        </form>

        <p className="mt-6 text-sm text-slate-300">
          Already have an account?{" "}
          <Link href="/sign-in" className="font-medium text-teal-300 hover:text-teal-200">
            Sign in
          </Link>
        </p>
      </main>
    </div>
  );
}
