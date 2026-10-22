"use client";

import { useCallback, useEffect, useState } from "react";
import StatCard from "@/components/dashboard/StatCard";
import { PageAlert } from "@/components/PageAlert";
import { apiFetch } from "@/lib/api";

export default function DashboardOverview() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    return apiFetch("/api/dashboard/summary")
      .then((res) => {
        if (!res.ok) {
          setError(res.error || "Could not load summary");
          setSummary(null);
          return;
        }
        setSummary(res.data || null);
      })
      .catch(() => {
        setError("Could not load summary");
        setSummary(null);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="mt-2 text-base-content/70">
          Live counts for the current shift.
        </p>
      </header>

      {error ? <PageAlert type="error">{error}</PageAlert> : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Open orders"
          value={summary?.openOrders}
          href="/dashboard/orders"
          loading={loading}
        />
        <StatCard
          title="Occupied tables"
          value={summary?.occupiedTables}
          href="/dashboard/tables"
          loading={loading}
        />
        <StatCard
          title="Reservations today"
          value={summary?.reservationsToday}
          href="/dashboard/reservations"
          loading={loading}
        />
        <StatCard
          title="Unpaid bills"
          value={summary?.unpaidBills}
          href="/dashboard/billing"
          loading={loading}
        />
      </div>
    </div>
  );
}
