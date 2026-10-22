"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { EmptyState, PageAlert } from "@/components/PageAlert";
import StatusBadge from "@/components/StatusBadge";
import { apiFetch } from "@/lib/api";
import { formatCents } from "@/lib/format";

function AccountOrdersInner() {
  const searchParams = useSearchParams();
  const [orders, setOrders] = useState([]);
  const [bills, setBills] = useState([]);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState(null);
  const [payingId, setPayingId] = useState("");

  useEffect(() => {
    if (searchParams.get("paid") === "1") {
      setInfo("Payment received. The kitchen will see your order shortly.");
    }
  }, [searchParams]);

  useEffect(() => {
    Promise.all([apiFetch("/api/orders"), apiFetch("/api/bills")]).then(
      ([oRes, bRes]) => {
        setLoading(false);
        if (!oRes.ok) {
          setError(oRes.error || "Failed to load orders");
          return;
        }
        setOrders(oRes.data || []);
        if (bRes.ok) setBills(bRes.data || []);
      }
    );
  }, []);

  function billForOrder(orderId) {
    return bills.find((b) => b.orderId === orderId);
  }

  if (loading) {
    return <span className="loading loading-spinner loading-lg" />;
  }
  if (error && orders.length === 0) {
    return <PageAlert type="error">{error}</PageAlert>;
  }
  if (orders.length === 0) {
    return (
      <EmptyState
        title="No orders yet"
        description="Place an order from the menu and cart."
      />
    );
  }

  async function payNow(billId) {
    setPayingId(billId);
    setError("");
    const res = await apiFetch(`/api/bills/${billId}/stripe/checkout`, {
      method: "POST",
      body: JSON.stringify({}),
    });
    setPayingId("");
    if (!res.ok) {
      setError(res.error || "Could not start checkout");
      return;
    }
    if (res.data?.checkoutUrl) {
      window.location.href = res.data.checkoutUrl;
    }
  }

  return (
    <div className="space-y-4">
      {info ? <PageAlert type="success">{info}</PageAlert> : null}
      {error ? <PageAlert type="error">{error}</PageAlert> : null}
    <ul className="space-y-3">
      {orders.map((order) => {
        const bill = billForOrder(order.id);
        const expanded = openId === order.id;
        return (
          <li key={order.id} className="card bg-base-100 shadow">
            <div className="card-body gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  className="text-left font-medium"
                  onClick={() => setOpenId(expanded ? null : order.id)}
                >
                  Order · {new Date(order.createdAt).toLocaleString()}
                </button>
                <StatusBadge status={order.status} />
              </div>
              <p className="text-sm">{formatCents(order.subtotal)} subtotal</p>
              {bill ? (
                <Link
                  href="/account/bills"
                  className="link link-primary text-sm"
                >
                  View bill ({bill.status})
                </Link>
              ) : null}
              {order.status === "awaiting_payment" &&
              bill?.status === "unpaid" ? (
                <button
                  type="button"
                  className="btn btn-primary btn-sm w-fit"
                  disabled={payingId === bill.id}
                  onClick={() => payNow(bill.id)}
                >
                  {payingId === bill.id ? "Redirecting…" : "Pay now"}
                </button>
              ) : null}
              {expanded ? (
                <ul className="mt-2 space-y-1 text-sm">
                  {order.items.map((item, i) => (
                    <li key={i}>
                      {item.qty}× {item.name} — {formatCents(item.price)}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
    </div>
  );
}

export default function AccountOrders() {
  return (
    <Suspense fallback={<span className="loading loading-spinner loading-lg" />}>
      <AccountOrdersInner />
    </Suspense>
  );
}
