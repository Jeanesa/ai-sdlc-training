import { CURRENT_USER_BY_ROLE } from "@/data/mockData";
import Layout from "@/components/Layout";
import NewLeaveRequestScreen from "@/screens/employee/NewLeaveRequest";

export default function NewLeaveRequestPage() {
  const user = CURRENT_USER_BY_ROLE.employee!;
  return (
    <Layout user={user} currentView="employee-new-request">
      <NewLeaveRequestScreen />
    </Layout>
  );
}
