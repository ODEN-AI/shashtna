import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AccountMobileTabs } from "@/app/components/account/AccountMobileTabs";
import { AccountNav } from "@/app/components/account/AccountNav";
import { getSessionUser } from "@/src/server/auth";
import { countUnreadNotifications } from "@/src/server/notifications";

// Private area: never indexed.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();

  // Each page also calls requireCustomer with its own path so the visitor
  // returns to the exact page after signing in; this is a safety net.
  if (!user) {
    redirect("/login?redirect=/dashboard");
  }

  const unread = await countUnreadNotifications(user.id).catch(() => 0);

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-6 sm:px-6 sm:py-10 lg:grid-cols-[250px_1fr] lg:px-8">
      <aside className="hidden lg:block">
        <AccountNav unread={unread} name={user.name} />
      </aside>
      <div className="min-w-0">
        <AccountMobileTabs unread={unread} />
        {children}
      </div>
    </div>
  );
}
