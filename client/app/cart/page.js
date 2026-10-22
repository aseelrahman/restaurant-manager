import { Suspense } from "react";
import CartCheckout from "@/components/cart/CartCheckout";

export default function CartPage() {
  return (
    <>
      <h1 className="mb-6 text-3xl font-bold">Cart</h1>
      <Suspense
        fallback={<span className="loading loading-spinner loading-lg" />}
      >
        <CartCheckout />
      </Suspense>
    </>
  );
}
