const STATUS_CLASS = {
  awaiting_payment: "badge-warning",
  pending: "badge-warning",
  preparing: "badge-info",
  ready: "badge-primary",
  served: "badge-secondary",
  paid: "badge-success",
  cancelled: "badge-error",
  confirmed: "badge-info",
  seated: "badge-primary",
  no_show: "badge-ghost",
  unpaid: "badge-warning",
  void: "badge-ghost",
  available: "badge-success",
  occupied: "badge-error",
  reserved: "badge-warning",
};

export default function StatusBadge({ status, className = "" }) {
  const key = String(status || "").toLowerCase();
  const badgeClass = STATUS_CLASS[key] || "badge-ghost";
  const label = key.replace(/_/g, " ") || "unknown";

  return (
    <span className={`badge badge-sm capitalize ${badgeClass} ${className}`}>
      {label}
    </span>
  );
}
