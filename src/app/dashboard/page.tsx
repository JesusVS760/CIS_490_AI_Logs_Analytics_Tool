import { requireAuthPage } from "@/lib/requireAuthPage";
import DashboardClient from "./DashboardClient";

export default async function DashboardPage() {
  await requireAuthPage();
  return <DashboardClient />;
}