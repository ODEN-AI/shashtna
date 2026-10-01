import type { Metadata } from "next";
import { Clock3, Headset, ListChecks, Workflow } from "lucide-react";

import { KpiTile, SectionCard, SectionError } from "@/app/components/admin/dashboard/DashboardUI";
import { Bars, ChangeLine, DurationBlock, IntelHeader, NotAvailable, fmt } from "@/app/components/admin/intelligence/IntelUI";
import { Forbidden } from "@/app/components/admin/Forbidden";
import { INTEL_PAGES } from "@/src/lib/intelligence";
import { ORDER_STATUS_LABELS, REQUEST_TYPE_LABELS, type OrderStatus } from "@/src/lib/order-status";
import { requireStaffPage } from "@/src/server/auth";
import { getI18n } from "@/src/server/i18n";
import { loadIntelligence, parseIntelSelection } from "@/src/server/intelligence";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "العمليات — الذكاء والتحليلات" };

/**
 * Operations intelligence: orders (orders permission) and support (support
 * permission), each loaded only with its permission. Processing times are
 * measured between real event timestamps — never updatedAt, which changes
 * on any edit. No efficiency scores and no SLA.
 */
export default async function IntelligenceOperations({ searchParams }: { searchParams: Promise<{ period?: string; from?: string; to?: string }> }) {
  const params = await searchParams;
  const { user } = await requireStaffPage("/admin/intelligence/operations");

  if (!INTEL_PAGES.operations(user.role)) return <Forbidden />;

  const { t, lang } = await getI18n();
  const selection = parseIntelSelection(params);
  const data = await loadIntelligence(user.role, selection, ["orders", "support"]);
  const orders = data.orders;
  const support = data.support;

  return (
    <div className="space-y-6" data-testid="intel-operations">
      <IntelHeader active="operations" role={user.role} t={t} lang={lang} selection={selection} range={data.ranges} title={t("العمليات", "Operations")} description={t("حجم الطلبات وحالاتها، أوقات المعالجة من سجل الأحداث، والدعم.", "Order volume and states, processing times from the event log, and support.")} />

      {orders === null ? null : !orders.ok ? (
        <SectionError label={t("تعذر تحميل بيانات الطلبات — غير متاحة الآن، وليست صفرًا.", "Order data couldn't be loaded — unavailable right now, not zero.")} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiTile href="/admin/orders" testId="intel-ops-created" label={t("طلبات جديدة", "New orders")} value={fmt(orders.data.pack.created.current)} chip={<ChangeLine value={orders.data.pack.created} lang={lang} />} />
            <KpiTile href="/admin/orders" testId="intel-ops-cancelled" label={t("ملغاة (من طلبات الفترة)", "Cancelled (of the period's orders)")} value={fmt(orders.data.pack.cancelled.current)} chip={<ChangeLine value={orders.data.pack.cancelled} lang={lang} invert />} />
            <KpiTile href="/admin/operations" testId="intel-ops-awaiting" label={t("بانتظار الدفع الآن", "Awaiting payment now")} value={fmt(orders.data.pack.awaitingPaymentNow)} hint={t(`${orders.data.pack.proofsAwaitingReviewNow} منها رفع إثبات دفع`, `${orders.data.pack.proofsAwaitingReviewNow} with a payment proof uploaded`)} />
            <KpiTile href="/admin/operations" testId="intel-ops-ready" label={t("مدفوعة بانتظار التفعيل", "Paid, awaiting activation")} value={fmt(orders.data.pack.readyToActivateNow)} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard title={t("من إنشاء الطلب إلى الدفع", "Order created → paid")} icon={<Clock3 size={14} aria-hidden />} testId="intel-ops-to-paid">
              <DurationBlock
                lang={lang}
                testId="intel-duration-paid"
                unit={{ ar: "طلب", en: "orders" }}
                value={orders.data.pack.createdToPaid}
                measures={t("وقت إنشاء الطلب ← أول حدث دفع (ORDER_PAID / FULFILLING / COMPLETED) للطلبات المنشأة بالفترة.", "Order creation time → the first paid event (ORDER_PAID / FULFILLING / COMPLETED), for orders created in the period.")}
              />
            </SectionCard>
            <SectionCard title={t("من الدفع إلى الإكمال", "Paid → completed")} icon={<Clock3 size={14} aria-hidden />} testId="intel-ops-to-completed">
              <DurationBlock
                lang={lang}
                testId="intel-duration-completed"
                unit={{ ar: "طلب", en: "orders" }}
                value={orders.data.pack.paidToCompleted}
                measures={t("أول حدث دفع ← أول حدث ORDER_COMPLETED، للطلبات المكتملة من طلبات الفترة.", "The first paid event → the first ORDER_COMPLETED event, for completed orders created in the period.")}
              />
            </SectionCard>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard title={t("حالات طلبات الفترة الآن", "Current state of the period's orders")} icon={<ListChecks size={14} aria-hidden />} testId="intel-ops-status">
              <Bars
                lang={lang}
                empty={t("لا توجد طلبات بهذه الفترة.", "No orders in this period.")}
                rows={orders.data.byStatus.map((row) => ({ label: ORDER_STATUS_LABELS[row.key as OrderStatus]?.[lang] ?? row.key, value: row.count }))}
              />
            </SectionCard>
            <SectionCard title={t("نوع الطلب", "Order type")} icon={<Workflow size={14} aria-hidden />} testId="intel-ops-types">
              <Bars
                lang={lang}
                empty={t("لا توجد طلبات بهذه الفترة.", "No orders in this period.")}
                rows={orders.data.byType.map((row) => ({ label: REQUEST_TYPE_LABELS[row.key]?.[lang] ?? row.key, value: row.count }))}
              />
            </SectionCard>
          </div>
        </>
      )}

      {support === null ? null : !support.ok ? (
        <SectionError label={t("تعذر تحميل بيانات الدعم — غير متاحة الآن، وليست صفرًا.", "Support data couldn't be loaded — unavailable right now, not zero.")} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <KpiTile href="/admin/support" testId="intel-support-created" label={t("تذاكر جديدة", "New tickets")} value={fmt(support.data.pack.created.current)} chip={<ChangeLine value={support.data.pack.created} lang={lang} invert />} />
            <KpiTile href="/admin/support" testId="intel-support-waiting" label={t("بانتظار رد الفريق", "Waiting on the team")} value={fmt(support.data.pack.waitingOnTeam)} hint={t(`${support.data.pack.open} تذكرة مفتوحة`, `${support.data.pack.open} open tickets`)} />
          </div>
          <SectionCard title={t("أول رد على تذاكر الفترة", "First response to the period's tickets")} icon={<Headset size={14} aria-hidden />} testId="intel-support-response">
            <DurationBlock
              lang={lang}
              testId="intel-duration-response"
              unit={{ ar: "تذكرة", en: "tickets" }}
              value={support.data.pack.firstResponse}
              measures={t("وقت أول رسالة من العميل ← أول رد من الفريق بعدها (من توقيت الرسائل المخزّن). التذاكر بدون رد بعد تُستثنى.", "The customer's first message → the team's first reply after it (stored message times). Tickets with no reply yet are excluded.")}
            />
          </SectionCard>
        </div>
      )}

      <NotAvailable
        lang={lang}
        items={[
          t("لا توجد «درجة كفاءة» ولا اتفاقية مستوى خدمة (SLA): لم يُحدَّد هدف رسمي، فتُعرض الأوقات المقاسة فقط.", "No “efficiency score” and no SLA: no official target is defined, so only measured times are shown."),
          t("الطلبات القديمة بدون سجل أحداث تُستثنى من الأوقات ويُعرض عددها.", "Older orders without an event history are excluded from the times, and their count is shown."),
        ]}
      />
    </div>
  );
}
