import Link from "next/link";

export default function StatCard({ title, value, href, loading }) {
  return (
    <div className="card bg-base-100 shadow-sm border border-base-200">
      <div className="card-body gap-2">
        <h2 className="text-sm font-medium uppercase tracking-wide opacity-60">
          {title}
        </h2>
        {loading ? (
          <span className="loading loading-dots loading-md" aria-label="Loading" />
        ) : (
          <p className="text-3xl font-bold tabular-nums">{value ?? "—"}</p>
        )}
        {href ? (
          <Link href={href} className="link link-primary text-sm mt-1">
            View details
          </Link>
        ) : null}
      </div>
    </div>
  );
}
