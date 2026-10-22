const CART_KEY = "restaurant_cart";

function readRaw() {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CART_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeRaw(items) {
  if (typeof window === "undefined") return;
  localStorage.setItem(CART_KEY, JSON.stringify(items));
}

export function getCart() {
  return readRaw();
}

export function setCart(items) {
  writeRaw(items);
  return items;
}

export function clearCart() {
  writeRaw([]);
}

export function addToCart(line) {
  const items = readRaw();
  const id = line.menuItemId || line.id;
  const existing = items.find((i) => i.menuItemId === id);
  if (existing) {
    existing.qty = (existing.qty || 1) + (line.qty || 1);
    if (line.notes) existing.notes = line.notes;
  } else {
    items.push({
      menuItemId: id,
      name: line.name,
      price: line.price,
      qty: line.qty || 1,
      notes: line.notes || "",
    });
  }
  writeRaw(items);
  return items;
}

export function updateQty(menuItemId, qty) {
  const items = readRaw();
  const next = items
    .map((i) =>
      i.menuItemId === menuItemId ? { ...i, qty: Math.max(1, qty) } : i
    )
    .filter((i) => i.qty > 0);
  writeRaw(next);
  return next;
}

export function updateLineNotes(menuItemId, notes) {
  const items = readRaw();
  const next = items.map((i) =>
    i.menuItemId === menuItemId ? { ...i, notes } : i
  );
  writeRaw(next);
  return next;
}

export function removeFromCart(menuItemId) {
  const items = readRaw().filter((i) => i.menuItemId !== menuItemId);
  writeRaw(items);
  return items;
}

export function cartCount(items = readRaw()) {
  return items.reduce((sum, i) => sum + (i.qty || 0), 0);
}

export function cartSubtotalCents(items = readRaw()) {
  return items.reduce((sum, i) => sum + (i.price || 0) * (i.qty || 0), 0);
}
