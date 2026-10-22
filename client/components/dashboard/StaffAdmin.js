"use client";

import { useCallback, useEffect, useState } from "react";
import { EmptyState, PageAlert } from "@/components/PageAlert";
import StatusBadge from "@/components/StatusBadge";
import { apiFetch } from "@/lib/api";

const ROLES = ["customer", "staff", "admin"];

export default function StaffAdmin() {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("staff");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    return apiFetch("/api/staff")
      .then((res) => {
        if (!res.ok) {
          setError(res.error || "Could not load staff");
          setStaff([]);
          return;
        }
        setStaff(Array.isArray(res.data) ? res.data : []);
      })
      .catch(() => {
        setError("Could not load staff");
        setStaff([]);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function updateRole(target, newRole) {
    setSaving(true);
    setFormError("");
    const res = await apiFetch("/api/staff", {
      method: "PATCH",
      body: JSON.stringify({ userId: target.id, role: newRole }),
    });
    setSaving(false);
    if (!res.ok) {
      setFormError(res.error || "Update failed");
      return;
    }
    load();
  }

  async function promoteByEmail(e) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) {
      setFormError("Email is required");
      return;
    }
    setSaving(true);
    setFormError("");
    const res = await apiFetch("/api/staff", {
      method: "PATCH",
      body: JSON.stringify({ email: trimmed, role }),
    });
    setSaving(false);
    if (!res.ok) {
      setFormError(res.error || "Could not update user");
      return;
    }
    setEmail("");
    load();
  }

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-3xl font-bold">Staff</h1>
        <p className="mt-2 text-base-content/70">
          Promote accounts by email or change roles for floor staff and admins.
        </p>
      </header>

      {error ? <PageAlert type="error">{error}</PageAlert> : null}
      {formError ? <PageAlert type="error">{formError}</PageAlert> : null}

      <div className="card bg-base-100 shadow-sm border border-base-200 mb-8">
        <div className="card-body">
          <h2 className="card-title text-lg">Set role by email</h2>
          <form
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
            onSubmit={promoteByEmail}
          >
            <label className="form-control flex-1">
              <span className="label-text">Email</span>
              <input
                type="email"
                className="input input-bordered"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@example.com"
                disabled={saving}
              />
            </label>
            <label className="form-control w-full sm:w-40">
              <span className="label-text">Role</span>
              <select
                className="select select-bordered"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                disabled={saving}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving}
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </form>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <span className="loading loading-spinner loading-lg" />
        </div>
      ) : staff.length === 0 ? (
        <EmptyState
          title="No staff yet"
          description="Promote a user to staff or admin using the form above."
        />
      ) : (
        <div className="overflow-x-auto rounded-box border border-base-200">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th className="w-48">Change role</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((row) => (
                <tr key={row.id}>
                  <td>{row.name || "—"}</td>
                  <td>{row.email}</td>
                  <td>
                    <StatusBadge status={row.role} />
                  </td>
                  <td>
                    <select
                      className="select select-bordered select-sm w-full max-w-xs"
                      value={row.role}
                      disabled={saving}
                      onChange={(e) => updateRole(row, e.target.value)}
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
