"use client";

import StatusBadge from "@/components/StatusBadge";

export default function TableCard({ table, onSetStatus, busy }) {
  const { number, seats, status, id } = table;

  function setStatus(next) {
    if (busy || status === next) return;
    onSetStatus(id, next);
  }

  return (
    <div className="card card-border bg-base-100 shadow-sm">
      <div className="card-body gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="card-title text-lg">Table {number}</h3>
            <p className="text-sm text-base-content/70">
              {seats} {seats === 1 ? "seat" : "seats"}
            </p>
          </div>
          <StatusBadge status={status} />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-success btn-xs"
            disabled={busy || status === "available"}
            onClick={() => setStatus("available")}
          >
            Available
          </button>
          <button
            type="button"
            className="btn btn-error btn-xs"
            disabled={busy || status === "occupied"}
            onClick={() => setStatus("occupied")}
          >
            Occupy
          </button>
          <button
            type="button"
            className="btn btn-warning btn-xs"
            disabled={busy || status === "reserved"}
            onClick={() => setStatus("reserved")}
          >
            Reserve
          </button>
        </div>
      </div>
    </div>
  );
}
