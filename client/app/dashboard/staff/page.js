import AuthGate from "@/components/AuthGate";
import StaffAdmin from "@/components/dashboard/StaffAdmin";

export default function DashboardStaffPage() {
  return (
    <AuthGate callbackPath="/dashboard/staff" roles={["admin"]}>
      <StaffAdmin />
    </AuthGate>
  );
}
