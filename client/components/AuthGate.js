"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useClientSession } from "@/lib/use-client-session";

export default function AuthGate({
  children,
  callbackPath,
  roles = null,
}) {
  const { data: session, isPending } = useClientSession();
  const router = useRouter();
  const pathname = usePathname();
  const redirectTo = callbackPath || pathname;

  useEffect(() => {
    if (isPending) return;
    const user = session?.user;
    if (!user) {
      router.replace(
        `/sign-in?callbackUrl=${encodeURIComponent(redirectTo)}`
      );
      return;
    }
    if (roles && !roles.includes(user.role || "customer")) {
      router.replace("/");
    }
  }, [isPending, session, router, redirectTo, roles]);

  if (isPending) {
    return (
      <div className="flex justify-center p-12">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  const user = session?.user;
  if (!user) return null;
  if (roles && !roles.includes(user.role || "customer")) return null;

  return children;
}
