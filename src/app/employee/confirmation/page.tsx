import { Suspense } from "react";
import { CURRENT_USER_BY_ROLE } from "@/data/mockData";
import Layout from "@/components/Layout";
import ConfirmationScreen from "@/screens/employee/Confirmation";

export default function ConfirmationPage() {
  const user = CURRENT_USER_BY_ROLE.employee!;
  return (
    <Layout user={user} currentView="employee-confirmation">
      <Suspense fallback={<div className="p-8 text-center text-sm text-gray-500">Loading...</div>}>
        <ConfirmationScreen />
      </Suspense>
    </Layout>
  );
}
