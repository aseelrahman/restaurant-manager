export function PageAlert({ type = "info", children }) {
  const cls =
    type === "error"
      ? "alert-error"
      : type === "warning"
        ? "alert-warning"
        : type === "success"
          ? "alert-success"
          : "alert-info";
  return (
    <div role="alert" className={`alert ${cls} my-4`}>
      <span>{children}</span>
    </div>
  );
}

export function EmptyState({ title, description }) {
  return (
    <div className="rounded-box border border-dashed border-base-300 bg-base-100 p-8 text-center">
      <h2 className="text-lg font-medium">{title}</h2>
      {description ? (
        <p className="mt-2 text-sm text-base-content/70">{description}</p>
      ) : null}
    </div>
  );
}
