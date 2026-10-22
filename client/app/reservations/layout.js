import AuthGate from "@/components/AuthGate";

export default function ReservationsLayout({ children }) {
  return (
    <AuthGate callbackPath="/reservations">
      <div className="mx-auto w-full max-w-3xl p-6">{children}</div>
    </AuthGate>
  );
}
