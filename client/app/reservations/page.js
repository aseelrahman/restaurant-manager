import ReservationsPanel from "@/components/ReservationsPanel";

export default function ReservationsPage() {
  return (
    <>
      <header className="mb-8">
        <h1 className="text-3xl font-bold">Reservations</h1>
        <p className="mt-2 text-base-content/70">
          Book a table for a future visit. You can cancel pending or confirmed
          bookings below.
        </p>
      </header>
      <ReservationsPanel />
    </>
  );
}
