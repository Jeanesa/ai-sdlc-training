import { CURRENT_USER_BY_ROLE } from "@/data/mockData";
import Layout from "@/components/Layout";
import UserManagementScreen from "@/screens/sysadmin/UserManagement";

export default function UsersPage() {
  const user = CURRENT_USER_BY_ROLE.sysadmin!;
  return (
    <Layout user={user} currentView="sysadmin-users">
      <UserManagementScreen />
    </Layout>
  );
}
