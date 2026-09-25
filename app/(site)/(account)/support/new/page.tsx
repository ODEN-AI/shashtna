import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Lightbulb } from "lucide-react";

import { createTicketAction } from "@/app/(site)/(account)/actions";
import { ActionForm } from "@/app/ui/ActionForm";
import { LinkButton } from "@/app/ui/Button";
import { Card } from "@/app/ui/Card";
import { Field, Input, Select, Textarea } from "@/app/ui/Field";
import { PageHeader } from "@/app/ui/Page";
import { SubmitButton } from "@/app/ui/SubmitButton";
import { TROUBLESHOOTING } from "@/src/content/help";
import { formatOrderNumber } from "@/src/lib/order-status";
import { requireCustomer } from "@/src/server/auth";
import { getActiveApps } from "@/src/server/catalog";
import { getI18n } from "@/src/server/i18n";
import { listSubscriptionsForUser } from "@/src/server/subscriptions";
import { TICKET_CATEGORIES } from "@/src/server/tickets";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "تذكرة دعم جديدة" };

type Params = { category?: string; subscriptionId?: string; orderId?: string; topic?: string };

export default async function NewTicketPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const user = await requireCustomer("/support/new");
  const [{ t, lang }, subscriptions, apps] = await Promise.all([
    getI18n(),
    listSubscriptionsForUser(user.id),
    getActiveApps().catch(() => []),
  ]);

  const category = TICKET_CATEGORIES.some((item) => item.value === params.category) ? params.category! : "general";
  const subscriptionId = Number(params.subscriptionId);
  const orderId = Number(params.orderId);
  const linkedSubscription = subscriptions.find((item) => item.id === subscriptionId);
  const guide = TROUBLESHOOTING.find((item) => item.id === params.topic);
  const suggestedGuides = TROUBLESHOOTING.filter((item) => item.category === category).slice(0, 3);

  const defaultSubject = guide
    ? guide.title[lang]
    : linkedSubscription
      ? t(`مشكلة باشتراك «${linkedSubscription.packageName}»`, `Issue with “${linkedSubscription.packageName}”`)
      : Number.isInteger(orderId) && orderId > 0
        ? t(`استفسار عن الطلب ${formatOrderNumber(orderId)}`, `Question about order ${formatOrderNumber(orderId)}`)
        : "";

  return (
    <div className="space-y-6">
      <LinkButton href="/support" variant="ghost" size="sm" className="-ms-3">
        <ArrowRight size={16} className="ltr:rotate-180" aria-hidden />
        {t("الدعم الفني", "Support")}
      </LinkButton>
      <PageHeader
        title={t("تذكرة دعم جديدة", "New support ticket")}
        description={t("كلما وضحت المشكلة أكثر، نكدر نساعدك أسرع.", "The clearer the details, the faster we can help.")}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <Card className="p-6 sm:p-8">
          <ActionForm action={createTicketAction} className="space-y-5">
            {Number.isInteger(orderId) && orderId > 0 ? <input type="hidden" name="orderId" value={orderId} /> : null}
            {params.topic ? <input type="hidden" name="topic" value={params.topic.slice(0, 60)} /> : null}

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label={t("نوع المشكلة", "Topic")} htmlFor="category" required>
                <Select id="category" name="category" defaultValue={category}>
                  {TICKET_CATEGORIES.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item[lang]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t("الاشتراك المعني", "Related subscription")} htmlFor="subscriptionId">
                <Select id="subscriptionId" name="subscriptionId" defaultValue={linkedSubscription ? String(linkedSubscription.id) : ""}>
                  <option value="">{t("بدون", "None")}</option>
                  {subscriptions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.packageName}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label={t("التطبيق (اختياري)", "App (optional)")} htmlFor="app">
                <Select id="app" name="app" defaultValue="">
                  <option value="">{t("—", "—")}</option>
                  {apps.map((app) => (
                    <option key={app.id} value={app.name}>
                      {app.name} · {app.platform}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t("الجهاز (اختياري)", "Device (optional)")} htmlFor="device">
                <Input id="device" name="device" maxLength={80} placeholder={t("مثلًا: شاشة سامسونج، TV Box", "e.g. Samsung TV, TV box")} />
              </Field>
            </div>

            <Field label={t("العنوان", "Subject")} htmlFor="subject" required>
              <Input id="subject" name="subject" required maxLength={120} defaultValue={defaultSubject} />
            </Field>

            <Field label={t("التفاصيل", "Details")} htmlFor="message" required hint={t("شنو صار؟ من يمته؟ شنو جربت؟", "What happened? Since when? What have you tried?")}>
              <Textarea id="message" name="message" required minLength={5} maxLength={4000} rows={6} />
            </Field>

            <SubmitButton size="lg" pendingLabel={t("جاري الإرسال...", "Sending...")}>
              {t("إرسال التذكرة", "Send ticket")}
            </SubmitButton>
          </ActionForm>
        </Card>

        <aside className="space-y-4">
          {suggestedGuides.length ? (
            <Card className="p-5">
              <p className="flex items-center gap-2 text-sm font-bold text-ink">
                <Lightbulb size={17} className="text-warning" aria-hidden />
                {t("جرّب قبل ما ترسل", "Try this first")}
              </p>
              <ul className="mt-3 space-y-2">
                {suggestedGuides.map((item) => (
                  <li key={item.id}>
                    <Link href={`/help/troubleshooting#${item.id}`} className="text-sm text-brand-ink underline-offset-4 hover:underline">
                      {item.title[lang]}
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
          <Card className="p-5">
            <p className="text-sm font-bold text-ink">{t("شلون يمشي الموضوع؟", "What happens next?")}</p>
            <p className="mt-2 text-sm leading-7 text-ink-2">
              {t("فريق الدعم يرد على التذكرة، ويوصلك إشعار بحسابك. تكدر ترد وتتابع من صفحة التذكرة.", "The support team replies on the ticket and you get a notification in your account. You can reply and follow up on the ticket page.")}
            </p>
          </Card>
        </aside>
      </div>
    </div>
  );
}
