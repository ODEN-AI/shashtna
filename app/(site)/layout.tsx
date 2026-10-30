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
      {/* The footer keeps the room under the page for the bottom navigation. */}
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter bottomNav={Boolean(user)} />
      {user ? <CustomerBottomNav /> : null}
      <EntryExperience />
    </div>
  );
}
