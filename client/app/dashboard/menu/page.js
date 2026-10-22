import AuthGate from "@/components/AuthGate";
import MenuAdmin from "@/components/dashboard/MenuAdmin";

export default function DashboardMenuPage() {
  return (
    <AuthGate callbackPath="/dashboard/menu" roles={["admin"]}>
      <MenuAdmin />
    </AuthGate>
  );
}
