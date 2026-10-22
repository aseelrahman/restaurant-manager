"use client";

import Link from "next/link";
import { formatCents } from "@/lib/format";

export default function MenuCard({ item, sessionReady, signedIn, onAddToCart }) {
  return (
    <div className="card card-border bg-base-100 shadow-sm">
      {item.imageUrl ? (
        <figure>
          <img src={item.imageUrl} alt="" className="h-40 w-full object-cover" />
        </figure>
      ) : null}
      <div className="card-body gap-2">
        <h3 className="card-title text-lg">{item.name}</h3>
        {item.description ? (
          <p className="text-sm text-base-content/70">{item.description}</p>
        ) : null}
        <p className="font-semibold">{formatCents(item.price)}</p>
        <div className="card-actions justify-end">
          {!sessionReady ? (
            <span className="loading loading-spinner loading-sm" />
          ) : signedIn ? (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => onAddToCart(item)}
            >
              Add to cart
            </button>
          ) : (
            <Link href="/sign-in?callbackUrl=/menu" className="btn btn-outline btn-sm">
              Sign in to order
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
