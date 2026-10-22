"use client";

import Navbar from "@/components/Navbar";

export default function ClientShell({ children }) {
  return (
    <>
      <Navbar />
      <main className="flex-1">{children}</main>
    </>
  );
}
