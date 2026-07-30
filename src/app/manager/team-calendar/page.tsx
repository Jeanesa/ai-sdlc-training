import { CURRENT_USER_BY_ROLE } from "@/data/mockData";
import Layout from "@/components/Layout";
import TeamCalendarScreen from "@/screens/manager/TeamCalendar";

export default function TeamCalendarPage() {
  const user = CURRENT_USER_BY_ROLE.manager!;
  return (
    <Layout user={user} currentView="manager-team-calendar">
      <TeamCalendarScreen />
    </Layout>
  );
}
