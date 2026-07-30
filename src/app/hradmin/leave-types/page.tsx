import { CURRENT_USER_BY_ROLE } from "@/data/mockData";
import Layout from "@/components/Layout";
import LeaveTypesScreen from "@/screens/hradmin/LeaveTypes";

export default function LeaveTypesPage() {
  const user = CURRENT_USER_BY_ROLE.hradmin!;
  return (
    <Layout user={user} currentView="hradmin-leave-types">
      <LeaveTypesScreen />
    </Layout>
  );
}
