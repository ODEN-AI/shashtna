import { redirect } from "next/navigation";

/**
 * The old Insights dashboard moved into Intelligence, which shows each
 * role only the sections it may see (the old page showed revenue to every
 * role with "insights", including those without "finance").
 */
export default function InsightsPage() {
  redirect("/admin/intelligence");
}
