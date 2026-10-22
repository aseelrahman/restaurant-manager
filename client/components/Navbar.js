"use client";

import Link from "next/link";
import { signOut } from "@/lib/auth-client";
import { useClientSession } from "@/lib/use-client-session";

export default function Navbar() {
  const { data: session, isPending } = useClientSession();
  const user = session?.user;
  const role = user?.role || "customer";
  const showDashboard = role === "staff" || role === "admin";

  return (
    <div className="navbar bg-base-100 shadow-sm">
      <div className="flex-1">
        <Link href="/" className="btn btn-ghost text-xl">
          Harbor &amp; Hearth
        </Link>
      </div>
      <div className="flex-none gap-2">
        <ul className="menu menu-horizontal hidden px-1 sm:flex">
          <li>
            <Link href="/menu">Menu</Link>
          </li>
          <li>
            <Link href="/cart">Cart</Link>
          </li>
          <li>
            <Link href="/reservations">Reserve</Link>
          </li>
          {showDashboard ? (
            <li>
              <Link href="/dashboard">Dashboard</Link>
            </li>
          ) : null}
        </ul>
        {isPending ? (
          <span className="loading loading-spinner loading-sm" />
        ) : user ? (
          <div className="flex items-center gap-2">
            <span className="hidden text-sm sm:inline">Hi, {user.name}</span>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => signOut()}
            >
              Sign out
            </button>
          </div>
        ) : (
          <div className="flex gap-1">
            <Link href="/sign-in" className="btn btn-ghost btn-sm">
              Sign in
            </Link>
            <Link href="/sign-up" className="btn btn-primary btn-sm">
              Sign up
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
