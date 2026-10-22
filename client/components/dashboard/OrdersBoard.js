"use client";

import { useCallback, useEffect, useState } from "react";
import { PageAlert } from "@/components/PageAlert";
import StatusBadge from "@/components/StatusBadge";
import { apiFetch } from "@/lib/api";
import { formatCents } from "@/lib/format";

const KITCHEN_COLUMNS = ["pending", "preparing", "ready", "served"];

const NEXT = {
  pending: "preparing",
  preparing: "ready",
  ready: "served",
};

export default function OrdersBoard() {
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState("");
  const [walkOpen, setWalkOpen] = useState(false);
  const [menuItems, setMenuItems] = useState([]);
  const [walkTable, setWalkTable] = useState("");
  const [walkItem, setWalkItem] = useState("");
  const [tables, setTables] = useState([]);

  const load = useCallback(() => {
    apiFetch("/api/orders").then((res) => {
      if (res.ok) setOrders(res.data || []);
      else setError(res.error || "Failed to load orders");
    });
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  async function advance(order, next) {
    const res = await apiFetch(`/api/orders/${order.id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: next }),
    });
    if (res.ok) load();
    else setError(res.error || "Update failed");
  }

  async function cancel(order) {
    await advance(order, "cancelled");
  }

  async function submitWalkIn(e) {
    e.preventDefault();
    const item = menuItems.find((m) => m.id === walkItem);
    if (!item) return;
    const res = await apiFetch("/api/orders", {
      method: "POST",
      body: JSON.stringify({
        walkIn: true,
        tableId: walkTable || undefined,
        items: [{ menuItemId: item.id, qty: 1 }],
      }),
    });
    if (res.ok) {
      setWalkOpen(false);
      load();
    } else setError(res.error || "Walk-in failed");
  }

  useEffect(() => {
    if (walkOpen) {
      apiFetch("/api/menu").then((r) => {
        if (r.ok) setMenuItems((r.data || []).filter((m) => m.available));
      });
      apiFetch("/api/tables").then((r) => {
        if (r.ok) setTables(r.data || []);
      });
    }
  }, [walkOpen]);

  const active = orders.filter(
    (o) =>
      o.status !== "paid" &&
      o.status !== "cancelled" &&
      o.status !== "awaiting_payment"
  );

  return (
    <div className="space-y-4">
      {error ? (
        <PageAlert type="error">{error}</PageAlert>
      ) : null}
      <button
        type="button"
        className="btn btn-outline btn-sm"
        onClick={() => setWalkOpen(true)}
      >
        Walk-in order
      </button>
      {walkOpen ? (
        <form
          className="card bg-base-100 shadow"
          onSubmit={submitWalkIn}
        >
          <div className="card-body gap-3">
            <h3 className="font-semibold">New walk-in</h3>
            <select
              className="select select-bordered"
              value={walkItem}
              onChange={(e) => setWalkItem(e.target.value)}
              required
            >
              <option value="">Menu item</option>
              {menuItems.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            <select
              className="select select-bordered"
              value={walkTable}
              onChange={(e) => setWalkTable(e.target.value)}
            >
              <option value="">No table (takeaway)</option>
              {tables.map((t) => (
                <option key={t.id} value={t.id}>
                  Table {t.number}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <button type="submit" className="btn btn-primary btn-sm">
                Create
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setWalkOpen(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </form>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-4">
        {KITCHEN_COLUMNS.map((col) => (
          <div key={col} className="rounded-box bg-base-100 p-3">
            <h3 className="mb-2 font-semibold capitalize">{col}</h3>
            <ul className="space-y-2">
              {active
                .filter((o) => o.status === col)
                .map((order) => (
                  <li
                    key={order.id}
                    className="rounded-lg border border-base-300 p-2 text-sm"
                  >
                    <div className="flex justify-between gap-1">
                      <span>{formatCents(order.subtotal)}</span>
                      <StatusBadge status={order.status} />
                    </div>
                    <p className="text-xs opacity-70">
                      {order.tableId ? "Dine-in" : "Takeaway"}
                    </p>
                    {NEXT[col] ? (
                      <button
                        type="button"
                        className="btn btn-primary btn-xs mt-2"
                        onClick={() => advance(order, NEXT[col])}
                      >
                        → {NEXT[col]}
                      </button>
                    ) : null}
                    {(col === "pending" || col === "preparing") && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs mt-1 block"
                        onClick={() => cancel(order)}
                      >
                        Cancel
                      </button>
                    )}
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
