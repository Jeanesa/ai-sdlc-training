import { CURRENT_USER_BY_ROLE, PENDING_FOR_MANAGER } from "@/data/mockData";
import Layout from "@/components/Layout";
import PendingApprovalsScreen from "@/screens/manager/PendingApprovals";

export default function PendingApprovalsPage() {
  const user = CURRENT_USER_BY_ROLE.manager!;
  return (
    <Layout user={user} currentView="manager-pending" pendingCount={PENDING_FOR_MANAGER.length}>
      <PendingApprovalsScreen />
    </Layout>
  );
}
