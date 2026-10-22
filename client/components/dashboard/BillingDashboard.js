"use client";

import { useCallback, useEffect, useState } from "react";
import { PageAlert } from "@/components/PageAlert";
import StatusBadge from "@/components/StatusBadge";
import { apiFetch } from "@/lib/api";
import { formatCents } from "@/lib/format";

export default function BillingDashboard() {
  const [orders, setOrders] = useState([]);
  const [bills, setBills] = useState([]);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    Promise.all([apiFetch("/api/orders"), apiFetch("/api/bills")]).then(
      ([oRes, bRes]) => {
        if (oRes.ok) setOrders(oRes.data || []);
        if (bRes.ok) setBills(bRes.data || []);
      }
    );
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const servedNoBill = orders.filter(
    (o) =>
      o.status === "served" &&
      !bills.some((b) => b.orderId === o.id && b.status !== "void")
  );
  const unpaid = bills.filter((b) => b.status === "unpaid");

  async function createBill(orderId) {
    const res = await apiFetch("/api/bills", {
      method: "POST",
      body: JSON.stringify({ orderId }),
    });
    if (!res.ok) setError(res.error || "Create bill failed");
    else load();
  }

  async function payBill(billId, method) {
    const res = await apiFetch(`/api/bills/${billId}/pay`, {
      method: "PATCH",
      body: JSON.stringify({ method }),
    });
    if (!res.ok) setError(res.error || "Payment failed");
    else load();
  }

  async function voidBill(billId) {
    const res = await apiFetch(`/api/bills/${billId}/void`, {
      method: "PATCH",
      body: JSON.stringify({}),
    });
    if (!res.ok) setError(res.error || "Void failed");
    else load();
  }

  return (
    <div className="space-y-8">
      {error ? <PageAlert type="error">{error}</PageAlert> : null}
      <section>
        <h2 className="mb-3 text-lg font-semibold">Served — create bill</h2>
        {servedNoBill.length === 0 ? (
          <p className="text-sm opacity-70">No served orders waiting.</p>
        ) : (
          <ul className="space-y-2">
            {servedNoBill.map((o) => (
              <li
                key={o.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-box bg-base-100 p-3"
              >
                <span>
                  Order {o.id.slice(-6)} · {formatCents(o.subtotal)}
                </span>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => createBill(o.id)}
                >
                  Create bill
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <h2 className="mb-3 text-lg font-semibold">Unpaid bills</h2>
        {unpaid.length === 0 ? (
          <p className="text-sm opacity-70">No unpaid bills.</p>
        ) : (
          <ul className="space-y-2">
            {unpaid.map((b) => (
              <li
                key={b.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-box bg-base-100 p-3"
              >
                <div>
                  <span className="font-medium">{formatCents(b.total)}</span>
                  <StatusBadge status={b.status} className="ml-2" />
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn btn-success btn-sm"
                    onClick={() => payBill(b.id, "cash")}
                  >
                    Cash
                  </button>
                  <button
                    type="button"
                    className="btn btn-success btn-outline btn-sm"
                    onClick={() => payBill(b.id, "card")}
                  >
                    Card (manual)
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => voidBill(b.id)}
                  >
                    Void
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
