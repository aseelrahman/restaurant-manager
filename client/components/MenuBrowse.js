"use client";

import { useEffect, useMemo, useState } from "react";
import MenuCard from "@/components/MenuCard";
import { EmptyState, PageAlert } from "@/components/PageAlert";
import { apiFetch } from "@/lib/api";
import { addToCart } from "@/lib/cart";
import { useClientSession } from "@/lib/use-client-session";

const CATEGORY_ORDER = ["starters", "mains", "drinks", "desserts"];

const CATEGORY_LABELS = {
  starters: "Starters",
  mains: "Mains",
  drinks: "Drinks",
  desserts: "Desserts",
};

function categoryLabel(key) {
  return CATEGORY_LABELS[key] || key.replace(/_/g, " ");
}

function groupByCategory(items) {
  const groups = new Map();
  for (const item of items) {
    const key = item.category || "other";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }

  const keys = [...groups.keys()];
  keys.sort((a, b) => {
    const ai = CATEGORY_ORDER.indexOf(a);
    const bi = CATEGORY_ORDER.indexOf(b);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return a.localeCompare(b);
  });

  return keys.map((key) => ({ key, label: categoryLabel(key), items: groups.get(key) }));
}

export default function MenuBrowse() {
  const { data: session, isPending: sessionPending } = useClientSession();
  const signedIn = Boolean(session?.user);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  useEffect(() => {
    let active = true;
    apiFetch("/api/menu")
      .then((result) => {
        if (!active) return;
        if (!result.ok) {
          setError(result.error || "Could not load menu");
          setItems([]);
          return;
        }
        setItems(Array.isArray(result.data) ? result.data : []);
      })
      .catch(() => {
        if (!active) return;
        setError("Could not load menu");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const sections = useMemo(() => groupByCategory(items), [items]);

  function handleAddToCart(item) {
    addToCart({
      menuItemId: item.id,
      name: item.name,
      price: item.price,
      qty: 1,
    });
    setToast(`${item.name} added to cart`);
    window.setTimeout(() => setToast(""), 2500);
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  return (
    <div>
      {error ? <PageAlert type="error">{error}</PageAlert> : null}
      {toast ? <PageAlert type="success">{toast}</PageAlert> : null}

      {!error && items.length === 0 ? (
        <EmptyState
          title="Menu coming soon"
          description="Nothing is available right now. Check back later."
        />
      ) : null}

      {!error && items.length > 0 ? (
        <div className="space-y-10">
          {sections.map((section) => (
            <section key={section.key}>
              <h2 className="mb-4 text-2xl font-semibold capitalize">{section.label}</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {section.items.map((item) => (
                  <MenuCard
                    key={item.id}
                    item={item}
                    sessionReady={!sessionPending}
                    signedIn={signedIn}
                    onAddToCart={handleAddToCart}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : null}
    </div>
  );
}
