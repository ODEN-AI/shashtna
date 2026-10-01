import { redirect } from "next/navigation";

/**
 * Revenue moved to Intelligence → Revenue, which reads the Finance engine
 * and requires the "finance" permission (the old page was open to every
 * role with "insights").
 */
export default function RevenuePage() {
  redirect("/admin/intelligence/revenue");
}
