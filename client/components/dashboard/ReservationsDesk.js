"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { EmptyState, PageAlert } from "@/components/PageAlert";
import StatusBadge from "@/components/StatusBadge";
import { apiFetch } from "@/lib/api";
import { formatDateTime } from "@/lib/format";

function dayBounds(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const start = new Date(y, m - 1, d);
  const end = new Date(y, m - 1, d + 1);
  return { start, end };
}

function toDateInputValue(d = new Date()) {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${da}`;
}

export default function ReservationsDesk() {
  const [day, setDay] = useState(() => toDateInputValue());
  const [rows, setRows] = useState([]);
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [walkOpen, setWalkOpen] = useState(false);
  const [walkGuest, setWalkGuest] = useState("");
  const [walkParty, setWalkParty] = useState("2");
  const [walkWhen, setWalkWhen] = useState(() => {
    const t = new Date();
    t.setMinutes(t.getMinutes() + 15);
    return t.toISOString().slice(0, 16);
  });

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    return Promise.all([
      apiFetch("/api/reservations"),
      apiFetch("/api/tables"),
    ])
      .then(([resRes, resTables]) => {
        if (!resRes.ok) {
          setError(resRes.error || "Could not load reservations");
          setRows([]);
        } else {
          setRows(Array.isArray(resRes.data) ? resRes.data : []);
        }
        if (resTables.ok) {
          setTables(Array.isArray(resTables.data) ? resTables.data : []);
        }
      })
      .catch(() => {
        setError("Could not load reservations");
        setRows([]);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [load]);

  const filtered = useMemo(() => {
    const { start, end } = dayBounds(day);
    return rows
      .filter((r) => {
        const dt = new Date(r.datetime);
        return dt >= start && dt < end;
      })
      .sort(
        (a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime()
      );
  }, [rows, day]);

  const tableLabel = (tableId) => {
    if (!tableId) return "—";
    const t = tables.find((x) => x.id === tableId);
    return t ? `Table ${t.number}` : tableId;
  };

  async function patchStatus(id, status, extra = {}) {
    setBusyId(id);
    setError("");
    const res = await apiFetch(`/api/reservations/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status, ...extra }),
    });
    setBusyId("");
    if (!res.ok) {
      setError(res.error || "Update failed");
      return;
    }
    load();
  }

  async function confirmWithTable(row) {
    const suitable = tables.filter(
      (t) =>
        t.seats >= row.partySize &&
        (t.status === "available" || t.id === row.tableId)
    );
    if (suitable.length === 0) {
      setError("No available table fits this party size");
      return;
    }
    const pick =
      suitable.find((t) => t.id === row.tableId) ||
      suitable.find((t) => t.status === "available") ||
      suitable[0];
    await patchStatus(row.id, "confirmed", { tableId: pick.id });
  }

  async function submitWalkIn(e) {
    e.preventDefault();
    setError("");
    const res = await apiFetch("/api/reservations", {
      method: "POST",
      body: JSON.stringify({
        guestName: walkGuest.trim(),
        partySize: Number(walkParty),
        datetime: new Date(walkWhen).toISOString(),
      }),
    });
    if (!res.ok) {
      setError(res.error || "Walk-in failed");
      return;
    }
    setWalkOpen(false);
    setWalkGuest("");
    load();
  }

  return (
    <div>
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Reservations</h1>
          <p className="mt-2 text-base-content/70">
            Confirm, assign tables, seat guests, and handle no-shows.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setWalkOpen(true)}
        >
          Walk-in booking
        </button>
      </header>

      {error ? <PageAlert type="error">{error}</PageAlert> : null}

      <label className="form-control w-full max-w-xs mb-6">
        <span className="label-text">Day</span>
        <input
          type="date"
          className="input input-bordered"
          value={day}
          onChange={(e) => setDay(e.target.value)}
        />
      </label>

      {loading ? (
        <div className="flex justify-center py-12">
          <span className="loading loading-spinner loading-lg" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No reservations this day"
          description="Try another date or add a walk-in booking."
        />
      ) : (
        <div className="overflow-x-auto rounded-box border border-base-200">
          <table className="table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Guest</th>
                <th>Party</th>
                <th>Table</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => {
                const busy = busyId === row.id;
                return (
                  <tr key={row.id}>
                    <td className="whitespace-nowrap">
                      {formatDateTime(row.datetime)}
                    </td>
                    <td>{row.guestName}</td>
                    <td>{row.partySize}</td>
                    <td>{tableLabel(row.tableId)}</td>
                    <td>
                      <StatusBadge status={row.status} />
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {row.status === "pending" ? (
                          <button
                            type="button"
                            className="btn btn-xs btn-primary"
                            disabled={busy}
                            onClick={() => confirmWithTable(row)}
                          >
                            Confirm
                          </button>
                        ) : null}
                        {row.status === "confirmed" ? (
                          <button
                            type="button"
                            className="btn btn-xs btn-secondary"
                            disabled={busy}
                            onClick={() => patchStatus(row.id, "seated")}
                          >
                            Seat
                          </button>
                        ) : null}
                        {row.status === "pending" || row.status === "confirmed" ? (
                          <>
                            <button
                              type="button"
                              className="btn btn-xs btn-ghost"
                              disabled={busy}
                              onClick={() => patchStatus(row.id, "no_show")}
                            >
                              No-show
                            </button>
                            <button
                              type="button"
                              className="btn btn-xs btn-error btn-outline"
                              disabled={busy}
                              onClick={() => patchStatus(row.id, "cancelled")}
                            >
                              Cancel
                            </button>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {walkOpen ? (
        <dialog className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg">Walk-in reservation</h3>
            <form className="mt-4 flex flex-col gap-3" onSubmit={submitWalkIn}>
              <label className="form-control">
                <span className="label-text">Guest name</span>
                <input
                  className="input input-bordered"
                  value={walkGuest}
                  onChange={(e) => setWalkGuest(e.target.value)}
                  required
                />
              </label>
              <label className="form-control">
                <span className="label-text">Party size</span>
                <input
                  type="number"
                  min={1}
                  className="input input-bordered"
                  value={walkParty}
                  onChange={(e) => setWalkParty(e.target.value)}
                  required
                />
              </label>
              <label className="form-control">
                <span className="label-text">Date & time</span>
                <input
                  type="datetime-local"
                  className="input input-bordered"
                  value={walkWhen}
                  onChange={(e) => setWalkWhen(e.target.value)}
                  required
                />
              </label>
              <div className="modal-action">
                <button
                  type="button"
                  className="btn"
                  onClick={() => setWalkOpen(false)}
                >
                  Close
                </button>
                <button type="submit" className="btn btn-primary">
                  Create
                </button>
              </div>
            </form>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button type="button" onClick={() => setWalkOpen(false)}>
              close
            </button>
          </form>
        </dialog>
      ) : null}
    </div>
  );
}
