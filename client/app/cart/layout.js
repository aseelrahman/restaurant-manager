import AuthGate from "@/components/AuthGate";

export default function CartLayout({ children }) {
  return (
    <AuthGate callbackPath="/cart">
      <div className="mx-auto w-full max-w-3xl p-6">{children}</div>
    </AuthGate>
  );
}
