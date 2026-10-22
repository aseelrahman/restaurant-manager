"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { EmptyState, PageAlert } from "@/components/PageAlert";
import { apiFetch } from "@/lib/api";
import {
  centsToDollarInput,
  formatCents,
  parseDollarsToCents,
} from "@/lib/format";

const CATEGORIES = [
  { value: "starters", label: "Starters" },
  { value: "mains", label: "Mains" },
  { value: "drinks", label: "Drinks" },
  { value: "desserts", label: "Desserts" },
];

const emptyForm = {
  name: "",
  description: "",
  priceDollars: "",
  category: "mains",
  available: true,
  imageUrl: "",
};

export default function MenuAdmin() {
  const dialogRef = useRef(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const loadItems = useCallback(() => {
    setLoading(true);
    setError("");
    return apiFetch("/api/menu")
      .then((result) => {
        if (!result.ok) {
          setError(result.error || "Could not load menu");
          setItems([]);
          return;
        }
        setItems(Array.isArray(result.data) ? result.data : []);
      })
      .catch(() => {
        setError("Could not load menu");
        setItems([]);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setFormError("");
    dialogRef.current?.showModal();
  }

  function openEdit(item) {
    setEditingId(item.id);
    setForm({
      name: item.name,
      description: item.description || "",
      priceDollars: centsToDollarInput(item.price),
      category: item.category,
      available: item.available,
      imageUrl: item.imageUrl || "",
    });
    setFormError("");
    dialogRef.current?.showModal();
  }

  function closeModal() {
    dialogRef.current?.close();
  }

  async function handleSave(e) {
    e.preventDefault();
    setFormError("");
    const price = parseDollarsToCents(form.priceDollars);
    if (price == null) {
      setFormError("Enter a valid price in dollars (e.g. 12.50).");
      return;
    }
    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      price,
      category: form.category,
      available: form.available,
      imageUrl: form.imageUrl.trim(),
    };
    if (!payload.name) {
      setFormError("Name is required.");
      return;
    }

    setSaving(true);
    const result = editingId
      ? await apiFetch(`/api/menu/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        })
      : await apiFetch("/api/menu", {
          method: "POST",
          body: JSON.stringify(payload),
        });
    setSaving(false);

    if (!result.ok) {
      setFormError(result.error || "Could not save item");
      return;
    }

    closeModal();
    if (editingId) {
      setItems((prev) =>
        prev.map((i) => (i.id === editingId ? result.data : i))
      );
    } else {
      setItems((prev) =>
        [...prev, result.data].sort((a, b) => {
          if (a.category !== b.category) {
            return a.category.localeCompare(b.category);
          }
          return a.name.localeCompare(b.name);
        })
      );
    }
  }

  async function toggleAvailable(item) {
    setBusyId(item.id);
    setError("");
    const result = await apiFetch(`/api/menu/${item.id}`, {
      method: "PATCH",
      body: JSON.stringify({ available: !item.available }),
    });
    setBusyId("");
    if (!result.ok) {
      setError(result.error || "Could not update item");
      return;
    }
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? result.data : i))
    );
  }

  async function handleDelete(item) {
    if (
      !window.confirm(
        `Delete "${item.name}"? Prefer hiding if it may appear on past orders.`
      )
    ) {
      return;
    }
    setBusyId(item.id);
    setError("");
    const result = await apiFetch(`/api/menu/${item.id}`, {
      method: "DELETE",
    });
    setBusyId("");
    if (!result.ok) {
      setError(result.error || "Could not delete item");
      return;
    }
    setItems((prev) => prev.filter((i) => i.id !== item.id));
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Menu</h1>
          <p className="mt-1 text-sm text-base-content/70">
            Add dishes, edit prices, and hide items from the public menu.
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={openCreate}>
          Add dish
        </button>
      </div>

      {error ? <PageAlert type="error">{error}</PageAlert> : null}

      {loading ? (
        <div className="flex justify-center py-16">
          <span className="loading loading-spinner loading-lg" />
        </div>
      ) : null}

      {!loading && !error && items.length === 0 ? (
        <EmptyState
          title="No menu items yet"
          description="Add your first dish to show it on the public menu when available."
        />
      ) : null}

      {!loading && items.length > 0 ? (
        <div className="mt-6 overflow-x-auto rounded-box border border-base-300 bg-base-100">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Category</th>
                <th>Price</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className={!item.available ? "opacity-60" : ""}>
                  <td>
                    <div className="font-medium">{item.name}</div>
                    {item.description ? (
                      <div className="text-xs text-base-content/60 line-clamp-1">
                        {item.description}
                      </div>
                    ) : null}
                  </td>
                  <td className="capitalize">{item.category}</td>
                  <td>{formatCents(item.price)}</td>
                  <td>
                    {item.available ? (
                      <span className="badge badge-success badge-outline">Available</span>
                    ) : (
                      <span className="badge badge-ghost">Hidden</span>
                    )}
                  </td>
                  <td>
                    <div className="flex flex-wrap justify-end gap-1">
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs"
                        onClick={() => openEdit(item)}
                        disabled={busyId === item.id}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs"
                        onClick={() => toggleAvailable(item)}
                        disabled={busyId === item.id}
                      >
                        {item.available ? "Hide" : "Show"}
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs text-error"
                        onClick={() => handleDelete(item)}
                        disabled={busyId === item.id}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <dialog ref={dialogRef} className="modal">
        <div className="modal-box max-w-lg">
          <h2 className="text-lg font-semibold">
            {editingId ? "Edit dish" : "Add dish"}
          </h2>
          <form className="mt-4 space-y-3" onSubmit={handleSave}>
            {formError ? (
              <PageAlert type="error">{formError}</PageAlert>
            ) : null}
            <label className="form-control w-full">
              <span className="label-text">Name</span>
              <input
                className="input input-bordered"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </label>
            <label className="form-control w-full">
              <span className="label-text">Description</span>
              <textarea
                className="textarea textarea-bordered"
                rows={2}
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />
            </label>
            <div className="flex flex-col gap-3 sm:flex-row">
              <label className="form-control w-full sm:flex-1">
                <span className="label-text">Price (USD)</span>
                <input
                  type="text"
                  inputMode="decimal"
                  className="input input-bordered"
                  placeholder="12.50"
                  value={form.priceDollars}
                  onChange={(e) =>
                    setForm({ ...form, priceDollars: e.target.value })
                  }
                  required
                />
              </label>
              <label className="form-control w-full sm:flex-1">
                <span className="label-text">Category</span>
                <select
                  className="select select-bordered"
                  value={form.category}
                  onChange={(e) =>
                    setForm({ ...form, category: e.target.value })
                  }
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="form-control w-full">
              <span className="label-text">Image URL (optional)</span>
              <input
                type="url"
                className="input input-bordered"
                value={form.imageUrl}
                onChange={(e) =>
                  setForm({ ...form, imageUrl: e.target.value })
                }
              />
            </label>
            <label className="label cursor-pointer justify-start gap-3">
              <input
                type="checkbox"
                className="checkbox"
                checked={form.available}
                onChange={(e) =>
                  setForm({ ...form, available: e.target.checked })
                }
              />
              <span className="label-text">Show on public menu</span>
            </label>
            <div className="modal-action">
              <button
                type="button"
                className="btn"
                onClick={closeModal}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={saving}
              >
                {saving ? (
                  <span className="loading loading-spinner loading-sm" />
                ) : editingId ? (
                  "Save changes"
                ) : (
                  "Create dish"
                )}
              </button>
            </div>
          </form>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button type="submit">close</button>
        </form>
      </dialog>
    </div>
  );
}
