"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { EmptyState, PageAlert } from "@/components/PageAlert";
import StatusBadge from "@/components/StatusBadge";
import { apiFetch } from "@/lib/api";
import { formatDateTime } from "@/lib/format";

const UPCOMING_STATUSES = new Set(["pending", "confirmed"]);

function isUpcoming(row) {
  if (!UPCOMING_STATUSES.has(row.status)) return false;
  const when = new Date(row.datetime);
  return !Number.isNaN(when.getTime()) && when.getTime() >= Date.now();
}

function defaultGuestName(session) {
  const name = session?.user?.name?.trim();
  return name || "";
}

export default function ReservationsPanel() {
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [partySize, setPartySize] = useState("2");
  const [datetime, setDatetime] = useState("");
  const [notes, setNotes] = useState("");

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [cancellingId, setCancellingId] = useState(null);

  const load = useCallback(() => {
    setError("");
    return apiFetch("/api/reservations").then((result) => {
      if (!result.ok) {
        setError(result.error || "Could not load reservations");
        setRows([]);
        return;
      }
      setRows(Array.isArray(result.data) ? result.data : []);
    });
  }, []);

  useEffect(() => {
    let active = true;
    apiFetch("/api/me")
      .then((result) => {
        if (!active || !result.ok) return;
        setGuestName((prev) => prev || defaultGuestName({ user: result.data }));
      })
      .catch(() => {});

    load()
      .catch(() => {
        if (active) setError("Could not load reservations");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [load]);

  const upcoming = useMemo(
    () =>
      rows
        .filter(isUpcoming)
        .sort(
          (a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime()
        ),
    [rows]
  );

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError("");
    setSuccess("");
    setSubmitting(true);

    const result = await apiFetch("/api/reservations", {
      method: "POST",
      body: JSON.stringify({
        guestName: guestName.trim(),
        guestPhone: guestPhone.trim() || undefined,
        partySize: Number(partySize),
        datetime: datetime ? new Date(datetime).toISOString() : "",
        notes: notes.trim() || undefined,
      }),
    });

    setSubmitting(false);

    if (!result.ok) {
      setFormError(result.error || "Could not save reservation");
      return;
    }

    setSuccess("Reservation submitted — we will confirm shortly.");
    setDatetime("");
    setNotes("");
    await load();
  }

  async function handleCancel(id) {
    setError("");
    setCancellingId(id);
    const result = await apiFetch(`/api/reservations/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "cancelled" }),
    });
    setCancellingId(null);

    if (!result.ok) {
      setError(result.error || "Could not cancel reservation");
      return;
    }
    await load();
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {error ? <PageAlert type="error">{error}</PageAlert> : null}
      {success ? <PageAlert type="success">{success}</PageAlert> : null}

      <section className="card bg-base-100 shadow-md">
        <div className="card-body">
          <h2 className="card-title text-xl">Book a table</h2>
          <p className="text-sm text-base-content/70">
            Tell us when you are coming. Bookings start as pending until staff
            confirms.
          </p>

          {formError ? <PageAlert type="error">{formError}</PageAlert> : null}

          <form className="mt-2 space-y-4" onSubmit={handleSubmit}>
            <label className="form-control w-full">
              <span className="label-text">Guest name</span>
              <input
                type="text"
                className="input input-bordered w-full"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                required
                autoComplete="name"
              />
            </label>

            <label className="form-control w-full">
              <span className="label-text">Phone (optional)</span>
              <input
                type="tel"
                className="input input-bordered w-full"
                value={guestPhone}
                onChange={(e) => setGuestPhone(e.target.value)}
                autoComplete="tel"
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="form-control w-full">
                <span className="label-text">Party size</span>
                <input
                  type="number"
                  min={1}
                  step={1}
                  className="input input-bordered w-full"
                  value={partySize}
                  onChange={(e) => setPartySize(e.target.value)}
                  required
                />
              </label>

              <label className="form-control w-full">
                <span className="label-text">Date & time</span>
                <input
                  type="datetime-local"
                  className="input input-bordered w-full"
                  value={datetime}
                  onChange={(e) => setDatetime(e.target.value)}
                  required
                />
              </label>
            </div>

            <label className="form-control w-full">
              <span className="label-text">Notes (optional)</span>
              <textarea
                className="textarea textarea-bordered w-full"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="High chair, window seat, allergies…"
              />
            </label>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
            >
              {submitting ? (
                <span className="loading loading-spinner loading-sm" />
              ) : (
                "Request reservation"
              )}
            </button>
          </form>
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-xl font-semibold">Upcoming reservations</h2>

        {upcoming.length === 0 ? (
          <EmptyState
            title="No upcoming bookings"
            description="When you reserve a table, it will show up here until the visit or you cancel."
          />
        ) : (
          <ul className="space-y-3">
            {upcoming.map((row) => (
              <li
                key={row.id}
                className="card bg-base-100 shadow-sm border border-base-200"
              >
                <div className="card-body flex-row flex-wrap items-center justify-between gap-4 py-4">
                  <div>
                    <p className="font-medium">{row.guestName}</p>
                    <p className="text-sm text-base-content/70">
                      {formatDateTime(row.datetime)} · Party of {row.partySize}
                    </p>
                    {row.notes ? (
                      <p className="mt-1 text-sm text-base-content/60">
                        {row.notes}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={row.status} />
                    {(row.status === "pending" || row.status === "confirmed") && (
                      <button
                        type="button"
                        className="btn btn-outline btn-error btn-sm"
                        disabled={cancellingId === row.id}
                        onClick={() => handleCancel(row.id)}
                      >
                        {cancellingId === row.id ? (
                          <span className="loading loading-spinner loading-xs" />
                        ) : (
                          "Cancel"
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
