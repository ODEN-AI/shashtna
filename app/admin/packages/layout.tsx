import { Forbidden } from "@/app/components/admin/Forbidden";
import { requireStaffPage } from "@/src/server/auth";

// Pre-redesign editor, kept for its working CRUD. Server-side permission
// check here; the page's API calls are checked again on the server.
export default async function Layout({ children }: { children: React.ReactNode }) {
  const { allowed } = await requireStaffPage("/admin", "catalogue");

  return allowed ? <div className="legacy-ui">{children}</div> : <Forbidden />;
}
