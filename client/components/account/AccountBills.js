"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { EmptyState, PageAlert } from "@/components/PageAlert";
import StatusBadge from "@/components/StatusBadge";
import { apiFetch } from "@/lib/api";
import { formatCents } from "@/lib/format";

function AccountBillsInner() {
  const searchParams = useSearchParams();
  const [bills, setBills] = useState([]);
  const [stripeEnabled, setStripeEnabled] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(true);
  const [payingId, setPayingId] = useState(null);

  useEffect(() => {
    if (searchParams.get("paid") === "1") {
      setInfo("Payment received — thank you! Your bill will update shortly.");
    }
    if (searchParams.get("cancelled") === "1") {
      setInfo("Checkout was cancelled.");
    }
  }, [searchParams]);

  function load() {
    setLoading(true);
    Promise.all([
      apiFetch("/api/bills"),
      apiFetch("/api/payments/config"),
    ]).then(([bRes, cRes]) => {
      setLoading(false);
      if (!bRes.ok) {
        setError(bRes.error || "Failed to load bills");
        return;
      }
      setBills(bRes.data || []);
      if (cRes.ok) setStripeEnabled(Boolean(cRes.data?.stripeEnabled));
    });
  }

  useEffect(() => {
    load();
  }, []);

  async function payWithStripe(billId) {
    setPayingId(billId);
    setError("");
    const res = await apiFetch(`/api/bills/${billId}/stripe/checkout`, {
      method: "POST",
      body: JSON.stringify({}),
    });
    setPayingId(null);
    if (!res.ok) {
      setError(res.error || "Could not start checkout");
      return;
    }
    if (res.data?.checkoutUrl) {
      window.location.href = res.data.checkoutUrl;
    }
  }

  if (loading) {
    return <span className="loading loading-spinner loading-lg" />;
  }
  if (error) {
    return <PageAlert type="error">{error}</PageAlert>;
  }

  return (
    <div className="space-y-4">
      {info ? <PageAlert type="success">{info}</PageAlert> : null}
      {bills.length === 0 ? (
        <EmptyState
          title="No bills yet"
          description="Bills appear after staff create them from served orders."
        />
      ) : (
        <ul className="space-y-3">
          {bills.map((bill) => (
            <li key={bill.id} className="card bg-base-100 shadow">
              <div className="card-body gap-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">
                    Bill · {formatCents(bill.total)}
                  </span>
                  <StatusBadge status={bill.status} />
                </div>
                <p className="text-sm text-base-content/70">
                  Subtotal {formatCents(bill.subtotal)} + tax{" "}
                  {formatCents(bill.tax)}
                </p>
                {bill.status === "paid" && bill.method ? (
                  <p className="text-sm capitalize">
                    Paid via {bill.paymentProvider || "manual"} ({bill.method})
                  </p>
                ) : null}
                {bill.status === "unpaid" && stripeEnabled ? (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm w-fit"
                    disabled={payingId === bill.id}
                    onClick={() => payWithStripe(bill.id)}
                  >
                    {payingId === bill.id ? "Redirecting…" : "Pay with card (Stripe)"}
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function AccountBills() {
  return (
    <Suspense fallback={<span className="loading loading-spinner" />}>
      <AccountBillsInner />
    </Suspense>
  );
}
