"use client";

import { useCallback, useEffect, useState } from "react";
import TableCard from "@/components/dashboard/TableCard";
import { EmptyState, PageAlert } from "@/components/PageAlert";
import { apiFetch } from "@/lib/api";
import { useClientSession } from "@/lib/use-client-session";

export default function TablesFloor() {
  const { data: session } = useClientSession();
  const isAdmin = session?.user?.role === "admin";

  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [formError, setFormError] = useState("");
  const [adding, setAdding] = useState(false);
  const [numberInput, setNumberInput] = useState("");
  const [seatsInput, setSeatsInput] = useState("");

  const loadTables = useCallback(() => {
    setLoading(true);
    setError("");
    return apiFetch("/api/tables")
      .then((result) => {
        if (!result.ok) {
          setError(result.error || "Could not load tables");
          setTables([]);
          return;
        }
        setTables(Array.isArray(result.data) ? result.data : []);
      })
      .catch(() => {
        setError("Could not load tables");
        setTables([]);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadTables();
  }, [loadTables]);

  async function handleSetStatus(id, status) {
    setBusyId(id);
    setError("");
    const result = await apiFetch(`/api/tables/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    setBusyId("");
    if (!result.ok) {
      setError(result.error || "Could not update table");
      return;
    }
    setTables((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...result.data } : t))
    );
  }

  async function handleAddTable(e) {
    e.preventDefault();
    setFormError("");
    const number = Number(numberInput);
    const seats = Number(seatsInput);
    if (!Number.isInteger(number) || number < 1) {
      setFormError("Table number must be a positive whole number.");
      return;
    }
    if (!Number.isInteger(seats) || seats < 1) {
      setFormError("Seats must be a positive whole number.");
      return;
    }
    setAdding(true);
    const result = await apiFetch("/api/tables", {
      method: "POST",
      body: JSON.stringify({ number, seats }),
    });
    setAdding(false);
    if (!result.ok) {
      setFormError(result.error || "Could not add table");
      return;
    }
    setNumberInput("");
    setSeatsInput("");
    setTables((prev) =>
      [...prev, result.data].sort((a, b) => a.number - b.number)
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-2xl font-semibold">Tables</h1>
      <p className="mt-1 text-sm text-base-content/70">
        Set floor status for each table. Customers only see available tables at
        checkout.
      </p>

      {error ? <PageAlert type="error">{error}</PageAlert> : null}

      {isAdmin ? (
        <div className="card card-border bg-base-100 my-6 shadow-sm">
          <div className="card-body">
            <h2 className="card-title text-base">Add table</h2>
            <form
              className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end"
              onSubmit={handleAddTable}
            >
              <label className="form-control w-full sm:w-40">
                <span className="label-text">Number</span>
                <input
                  type="number"
                  min={1}
                  step={1}
                  className="input input-bordered"
                  value={numberInput}
                  onChange={(e) => setNumberInput(e.target.value)}
                  required
                />
              </label>
              <label className="form-control w-full sm:w-40">
                <span className="label-text">Seats</span>
                <input
                  type="number"
                  min={1}
                  step={1}
                  className="input input-bordered"
                  value={seatsInput}
                  onChange={(e) => setSeatsInput(e.target.value)}
                  required
                />
              </label>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={adding}
              >
                {adding ? (
                  <span className="loading loading-spinner loading-sm" />
                ) : (
                  "Add table"
                )}
              </button>
            </form>
            {formError ? (
              <p className="text-sm text-error">{formError}</p>
            ) : null}
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className="flex justify-center py-16">
          <span className="loading loading-spinner loading-lg" />
        </div>
      ) : tables.length === 0 ? (
        <EmptyState
          title="No tables yet"
          description={
            isAdmin
              ? "Add your first table using the form above."
              : "Ask an admin to add tables to the floor plan."
          }
        />
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {tables.map((table) => (
            <TableCard
              key={table.id}
              table={table}
              busy={busyId === table.id}
              onSetStatus={handleSetStatus}
            />
          ))}
        </div>
      )}
    </div>
  );
}
