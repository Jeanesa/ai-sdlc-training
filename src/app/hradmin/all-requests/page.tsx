import { CURRENT_USER_BY_ROLE } from "@/data/mockData";
import Layout from "@/components/Layout";
import AllRequestsScreen from "@/screens/hradmin/AllRequests";

export default function AllRequestsPage() {
  const user = CURRENT_USER_BY_ROLE.hradmin!;
  return (
    <Layout user={user} currentView="hradmin-all-requests">
      <AllRequestsScreen />
    </Layout>
  );
}
