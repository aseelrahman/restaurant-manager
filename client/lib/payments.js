import { apiFetch } from "@/lib/api";

export async function fetchPaymentConfig() {
  return apiFetch("/api/payments/config");
}

export async function startStripeCheckout(billId) {
  return apiFetch(`/api/bills/${billId}/stripe/checkout`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}
