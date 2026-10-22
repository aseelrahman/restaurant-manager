"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import CartItem from "@/components/CartItem";
import { PageAlert } from "@/components/PageAlert";
import { apiFetch } from "@/lib/api";
import {
  clearCart,
  getCart,
  removeFromCart,
  updateLineNotes,
  updateQty,
} from "@/lib/cart";
import { formatCents } from "@/lib/format";

export default function CartCheckout() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [lines, setLines] = useState([]);
  const [tables, setTables] = useState([]);
  const [mode, setMode] = useState("takeaway");
  const [tableId, setTableId] = useState("");
  const [orderNotes, setOrderNotes] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  function refreshCart() {
    setLines(getCart());
  }

  useEffect(() => {
    refreshCart();
    apiFetch("/api/tables").then((res) => {
      if (res.ok) setTables(res.data || []);
    });
    if (searchParams.get("cancelled") === "1") {
      setInfo("Checkout was cancelled. Your payment was not taken.");
    }
  }, [searchParams]);

  async function placeOrder(e) {
    e.preventDefault();
    setError("");
    if (lines.length === 0) {
      setError("Your cart is empty.");
      return;
    }
    if (mode === "dine-in" && !tableId) {
      setError("Choose a table for dine-in.");
      return;
    }
    setLoading(true);
    const body = {
      items: lines.map((l) => ({
        menuItemId: l.menuItemId,
        qty: l.qty,
        notes: l.notes,
      })),
      notes: orderNotes,
    };
    if (mode === "dine-in") body.tableId = tableId;

    const res = await apiFetch("/api/orders", {
      method: "POST",
      body: JSON.stringify(body),
    });
    setLoading(false);
    if (!res.ok) {
      setError(res.error || "Could not place order");
      return;
    }
    if (res.data?.checkoutUrl) {
      clearCart();
      window.location.href = res.data.checkoutUrl;
      return;
    }
    clearCart();
    router.push("/account/orders");
    router.refresh();
  }

  const subtotal = lines.reduce((s, l) => s + l.price * l.qty, 0);

  return (
    <div className="space-y-6">
      {error ? <PageAlert type="error">{error}</PageAlert> : null}
      {info ? <PageAlert type="info">{info}</PageAlert> : null}
      {lines.length === 0 ? (
        <div className="rounded-box bg-base-100 p-8 text-center">
          <p>Your cart is empty.</p>
          <Link href="/menu" className="btn btn-primary btn-sm mt-4">
            Browse menu
          </Link>
        </div>
      ) : (
        <>
          <ul className="space-y-3">
            {lines.map((line) => (
              <CartItem
                key={line.menuItemId}
                line={line}
                onQty={(qty) => {
                  updateQty(line.menuItemId, qty);
                  refreshCart();
                }}
                onNotes={(notes) => {
                  updateLineNotes(line.menuItemId, notes);
                  refreshCart();
                }}
                onRemove={() => {
                  removeFromCart(line.menuItemId);
                  refreshCart();
                }}
              />
            ))}
          </ul>
          <p className="text-right text-lg font-semibold">
            Subtotal: {formatCents(subtotal)}
          </p>
          <form className="card bg-base-100 shadow" onSubmit={placeOrder}>
            <div className="card-body gap-4">
              <fieldset className="flex flex-wrap gap-4">
                <label className="label cursor-pointer gap-2">
                  <input
                    type="radio"
                    className="radio"
                    checked={mode === "takeaway"}
                    onChange={() => setMode("takeaway")}
                  />
                  Takeaway
                </label>
                <label className="label cursor-pointer gap-2">
                  <input
                    type="radio"
                    className="radio"
                    checked={mode === "dine-in"}
                    onChange={() => setMode("dine-in")}
                  />
                  Dine-in
                </label>
              </fieldset>
              {mode === "dine-in" ? (
                <label className="form-control">
                  <span className="label-text">Table</span>
                  <select
                    className="select select-bordered"
                    value={tableId}
                    onChange={(e) => setTableId(e.target.value)}
                    required
                  >
                    <option value="">Select table</option>
                    {tables.map((t) => (
                      <option key={t.id} value={t.id}>
                        Table {t.number} ({t.seats} seats)
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <label className="form-control">
                <span className="label-text">Order notes</span>
                <textarea
                  className="textarea textarea-bordered"
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  rows={2}
                />
              </label>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading}
              >
                {loading ? "Starting checkout…" : "Order now"}
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}
