"use client";

import { onAuthStateChanged } from "firebase/auth";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { auth, connectClientEmulators } from "@/lib/firebase/client";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<AuthStatus>("loading");

  const nextPath = useMemo(() => {
    const query = searchParams.toString();
    return query ? `${pathname}?${query}` : pathname;
  }, [pathname, searchParams]);

  useEffect(() => {
    connectClientEmulators();

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setStatus(user ? "authenticated" : "unauthenticated");
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") {
      const next = encodeURIComponent(nextPath);
      router.replace(`/sign-in?next=${next}`);
    }
  }, [nextPath, router, status]);

  if (status !== "authenticated") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100">
        <p className="text-sm text-slate-300">Checking your session...</p>
      </div>
    );
  }

  return <>{children}</>;
}
