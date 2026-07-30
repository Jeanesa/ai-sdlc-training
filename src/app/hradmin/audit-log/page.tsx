import { CURRENT_USER_BY_ROLE } from "@/data/mockData";
import Layout from "@/components/Layout";
import AuditLogScreen from "@/screens/hradmin/AuditLog";

export default function AuditLogPage() {
  const user = CURRENT_USER_BY_ROLE.hradmin!;
  return (
    <Layout user={user} currentView="hradmin-audit-log">
      <AuditLogScreen />
    </Layout>
  );
}
