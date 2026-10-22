"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useClientSession } from "@/lib/use-client-session";

const STAFF_LINKS = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/orders", label: "Orders" },
  { href: "/dashboard/tables", label: "Tables" },
  { href: "/dashboard/reservations", label: "Reservations" },
  { href: "/dashboard/billing", label: "Billing" },
];

const ADMIN_LINKS = [
  { href: "/dashboard/menu", label: "Menu" },
  { href: "/dashboard/staff", label: "Staff" },
];

function NavLink({ href, label }) {
  const pathname = usePathname();
  const active = pathname === href;
  return (
    <li>
      <Link href={href} className={active ? "active font-medium" : undefined}>
        {label}
      </Link>
    </li>
  );
}

export default function Sidebar() {
  const { data: session } = useClientSession();
  const role = session?.user?.role || "customer";
  const isAdmin = role === "admin";

  return (
    <aside className="min-h-full w-56 bg-base-100 p-4">
      <p className="mb-4 text-xs font-semibold uppercase tracking-wide opacity-60">
        Staff
      </p>
      <ul className="menu rounded-box p-0">
        {STAFF_LINKS.map((link) => (
          <NavLink key={link.href} {...link} />
        ))}
        {isAdmin
          ? ADMIN_LINKS.map((link) => <NavLink key={link.href} {...link} />)
          : null}
      </ul>
    </aside>
  );
}
