import { CustomerBottomNav } from "@/app/components/site/CustomerBottomNav";
import { EntryExperience } from "@/app/components/site/EntryExperience";
import { SiteFooter } from "@/app/components/site/SiteFooter";
import { SiteHeader } from "@/app/components/site/SiteHeader";
import { getSessionUser } from "@/src/server/auth";
import { countUnreadNotifications } from "@/src/server/notifications";

export default async function SiteLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getSessionUser().catch(() => null);
  // Feeds the header bell (Notifications is not a bottom-nav tab).
  const unread = user ? await countUnreadNotifications(user.id).catch(() => 0) : 0;

  return (
    <div className="flex min-h-screen flex-col overflow-x-clip">
      <SiteHeader user={user ? { name: user.name, isStaff: user.isStaff } : null} unread={unread} />
      <main id="main" className={user ? "flex-1 pb-safe lg:pb-0" : "flex-1"}>
        {children}
      </main>
      <SiteFooter />
      {user ? <CustomerBottomNav /> : null}
      <EntryExperience />
    </div>
  );
}
