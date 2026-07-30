import { CURRENT_USER_BY_ROLE } from "@/data/mockData";
import Layout from "@/components/Layout";
import MyRequestsScreen from "@/screens/employee/MyRequests";

export default function MyRequestsPage() {
  const user = CURRENT_USER_BY_ROLE.employee!;
  return (
    <Layout user={user} currentView="employee-my-requests">
      <MyRequestsScreen />
    </Layout>
  );
}
