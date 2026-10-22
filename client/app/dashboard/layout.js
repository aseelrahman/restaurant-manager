import AuthGate from "@/components/AuthGate";
import Sidebar from "@/components/dashboard/Sidebar";

export default function DashboardLayout({ children }) {
  return (
    <AuthGate callbackPath="/dashboard" roles={["staff", "admin"]}>
      <div className="drawer lg:drawer-open">
        <input id="dashboard-drawer" type="checkbox" className="drawer-toggle" />
        <div className="drawer-content flex flex-col p-4 lg:p-6">
          <label
            htmlFor="dashboard-drawer"
            className="btn btn-ghost drawer-button mb-4 lg:hidden"
          >
            Menu
          </label>
          {children}
        </div>
        <div className="drawer-side z-40">
          <label
            htmlFor="dashboard-drawer"
            aria-label="Close sidebar"
            className="drawer-overlay"
          />
          <Sidebar />
        </div>
      </div>
    </AuthGate>
  );
}
