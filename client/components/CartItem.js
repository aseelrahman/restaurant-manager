"use client";

import { formatCents } from "@/lib/format";

export default function CartItem({ line, onQty, onNotes, onRemove }) {
  return (
    <li className="card bg-base-100 shadow-sm">
      <div className="card-body gap-2 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="font-medium">{line.name}</h3>
            <p className="text-sm text-base-content/70">
              {formatCents(line.price)} × {line.qty}
            </p>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-xs"
            onClick={onRemove}
          >
            Remove
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm">Qty</span>
          <button
            type="button"
            className="btn btn-square btn-xs"
            onClick={() => onQty(Math.max(1, line.qty - 1))}
          >
            −
          </button>
          <span>{line.qty}</span>
          <button
            type="button"
            className="btn btn-square btn-xs"
            onClick={() => onQty(line.qty + 1)}
          >
            +
          </button>
        </div>
        <input
          type="text"
          className="input input-bordered input-sm"
          placeholder="Line notes"
          value={line.notes || ""}
          onChange={(e) => onNotes(e.target.value)}
        />
      </div>
    </li>
  );
}
