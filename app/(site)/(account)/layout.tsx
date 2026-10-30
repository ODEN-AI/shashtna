import type { Metadata } from "next";
import { redirect } from "next/navigation";

import a from "@/app/components/account/account.module.css";
import { AccountMobileTabs } from "@/app/components/account/AccountMobileTabs";
import { AccountNav } from "@/app/components/account/AccountNav";
import s from "@/app/components/home/home.module.css";
import { ToneShell } from "@/app/components/site/ToneShell";
import { getSessionUser } from "@/src/server/auth";
import { getLoyaltyRules } from "@/src/server/loyalty";
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

  const [unread, loyalty] = await Promise.all([countUnreadNotifications(user.id).catch(() => 0), getLoyaltyRules()]);

  return (
    <ToneShell>
      <div className={`${s.wrap} ${a.area}`}>
        <aside className={a.side}>
          <AccountNav unread={unread} name={user.name} points={loyalty.enabled} />
        </aside>
        <div className="min-w-0">
          <AccountMobileTabs unread={unread} />
          {children}
        </div>
      </div>
    </ToneShell>
  );
}
