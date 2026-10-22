import AuthGate from "@/components/AuthGate";

export default function AccountLayout({ children }) {
  return (
    <AuthGate callbackPath="/account/orders">
      <div className="mx-auto w-full max-w-4xl p-6">
        <h1 className="mb-4 text-2xl font-semibold">My account</h1>
        {children}
      </div>
    </AuthGate>
  );
}
