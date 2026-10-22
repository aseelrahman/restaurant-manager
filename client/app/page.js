import Link from "next/link";

export default function HomePage() {
  return (
    <div className="hero min-h-[70vh] bg-base-100">
      <div className="hero-content flex-col text-center lg:flex-row lg:text-left">
        <div className="max-w-xl">
          <h1 className="text-4xl font-bold">Harbor &amp; Hearth</h1>
          <p className="py-4 text-base-content/80">
            Seasonal plates, a waterfront view, and a kitchen that keeps it
            simple. Browse the menu, book a table, or order when you are signed
            in.
          </p>
          <p className="text-sm font-medium">Open daily · 11:00 – 22:00</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3 lg:justify-start">
            <Link href="/menu" className="btn btn-primary">
              View menu
            </Link>
            <Link href="/reservations" className="btn btn-outline">
              Reserve a table
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
