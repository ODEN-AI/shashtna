import type { Metadata } from "next";
import Link from "next/link";
import { Bell, CheckCheck } from "lucide-react";

import { markNotificationsReadAction } from "@/app/(site)/(account)/actions";
import { cn } from "@/app/ui/cn";
import { PageHeader } from "@/app/ui/Page";
import { EmptyState } from "@/app/ui/States";
import { SubmitButton } from "@/app/ui/SubmitButton";
import { formatDateTime } from "@/src/lib/i18n";
import { safeRedirect } from "@/src/lib/redirect";
import { requireCustomer } from "@/src/server/auth";
import { getI18n } from "@/src/server/i18n";
import { listNotifications } from "@/src/server/notifications";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "الإشعارات" };

export default async function NotificationsPage() {
  const user = await requireCustomer("/notifications");
  const [{ t, lang }, notifications] = await Promise.all([getI18n(), listNotifications(user.id, 50)]);
  const unread = notifications.filter((item) => !item.readAt).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("الإشعارات", "Notifications")}
        description={t("تحديثات طلباتك واشتراكاتك وردود الدعم.", "Updates on your orders, subscriptions and support replies.")}
        actions={
          unread ? (
            <form action={markNotificationsReadAction}>
              <SubmitButton variant="secondary" size="sm">
                <CheckCheck size={15} aria-hidden />
                {t("تعليم الكل كمقروء", "Mark all as read")}
              </SubmitButton>
            </form>
          ) : null
        }
      />

      {notifications.length === 0 ? (
        <EmptyState icon={<Bell size={22} aria-hidden />} title={t("ماكو إشعارات", "No notifications")} description={t("أي تحديث على طلباتك أو اشتراكك راح يوصلك هنا.", "Any update on your orders or subscription will appear here.")} />
      ) : (
        <ul className="surface divide-y divide-line overflow-hidden rounded-card">
          {notifications.map((item) => {
            const body = (
              <div className="flex items-start gap-3 p-4 sm:p-5">
                <span className={cn("mt-2 h-2 w-2 shrink-0 rounded-full", item.readAt ? "bg-transparent" : "bg-glow")} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className={cn("text-sm", item.readAt ? "font-semibold text-ink-2" : "font-bold text-ink")}>{item.title}</p>
                  <p className="mt-1 text-sm leading-6 text-ink-2">{item.body}</p>
                  <p className="nums mt-2 text-xs text-ink-3">{formatDateTime(item.createdAt, lang)}</p>
                </div>
              </div>
            );

            return (
              <li key={item.id} className={cn(!item.readAt && "bg-brand/5")}>
                {item.link ? (
                  <Link href={safeRedirect(item.link, "/dashboard")} className="block transition hover:bg-surface-2">
                    {body}
                  </Link>
                ) : (
                  body
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
