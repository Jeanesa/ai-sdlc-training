import { CURRENT_USER_BY_ROLE } from "@/data/mockData";
import Layout from "@/components/Layout";
import NewLeaveRequestScreen from "@/screens/employee/NewLeaveRequest";

// preserve through TASK-031: searchParams prop read passes the TASK-028 notice
export default async function NewLeaveRequestPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const user = CURRENT_USER_BY_ROLE.employee!;
  return (
    <Layout user={user} currentView="employee-new-request">
      <NewLeaveRequestScreen notice={typeof params.notice === "string" ? params.notice : null} />
    </Layout>
  );
}
