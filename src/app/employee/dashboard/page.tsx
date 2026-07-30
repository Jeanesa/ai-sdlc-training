import { CURRENT_USER_BY_ROLE } from "@/data/mockData";
import Layout from "@/components/Layout";
import DashboardScreen from "@/screens/employee/Dashboard";

export default function EmployeeDashboardPage() {
  const user = CURRENT_USER_BY_ROLE.employee!;
  return (
    <Layout user={user} currentView="employee-dashboard">
      <DashboardScreen user={user} />
    </Layout>
  );
}
