import { CURRENT_USER_BY_ROLE, PENDING_FOR_MANAGER } from "@/data/mockData";
import Layout from "@/components/Layout";
import RequestDetailScreen from "@/screens/manager/RequestDetail";

export default async function RequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = CURRENT_USER_BY_ROLE.manager!;
  return (
    <Layout user={user} currentView="manager-request-detail" pendingCount={PENDING_FOR_MANAGER.length}>
      <RequestDetailScreen requestId={id} />
    </Layout>
  );
}
