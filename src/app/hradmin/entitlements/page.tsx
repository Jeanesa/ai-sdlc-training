import { CURRENT_USER_BY_ROLE } from "@/data/mockData";
import Layout from "@/components/Layout";
import EntitlementManagementScreen from "@/screens/hradmin/EntitlementManagement";

export default function EntitlementsPage() {
  const user = CURRENT_USER_BY_ROLE.hradmin!;
  return (
    <Layout user={user} currentView="hradmin-entitlements">
      <EntitlementManagementScreen />
    </Layout>
  );
}
