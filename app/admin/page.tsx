import type { Metadata } from "next";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Briefcase,
  CheckCircle2,
  Crown,
  FileCheck2,
  KeyRound,
  LayoutGrid,
  Megaphone,
  MessagesSquare,
  Package,
  PackageCheck,
  Plus,
  Receipt,
  RefreshCw,
  Search,
  Send,
  ShoppingBag,
  Sparkles,
  UsersRound,
  WalletCards,
  Cpu,
} from "lucide-react";
import type { ReactNode } from "react";

import { EmptyLine, KpiTile, SectionCard, SectionError } from "@/app/components/admin/dashboard/DashboardUI";
import { DeltaChip, bucketLabel, money } from "@/app/components/admin/finance/FinanceUI";
import { TrendChart } from "@/app/components/admin/finance/TrendChart";
import { StatusBadge } from "@/app/ui/Badge";
import { LinkButton } from "@/app/ui/Button";
import { cn } from "@/app/ui/cn";
import { daysRemaining } from "@/src/lib/subscription-state";
import { formatDateTime, localeOf, translator, type Lang } from "@/src/lib/i18n";
import { ORDER_STATUS_LABELS, type OrderStatus } from "@/src/lib/order-status";
import { requireStaffPage } from "@/src/server/auth";
import { getDashboard, type Dashboard } from "@/src/server/dashboard";
import { getI18n } from "@/src/server/i18n";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "الرئيسية" };

/**
 * Shashtna Console — Home. The operational command centre: KPIs, the task
 * inbox, a business snapshot, order/subscription/customer activity, recent
 * audit activity, quick actions and alerts. Every number comes from the
 * database; sections the role can't access are neither loaded nor shown.
 */
export default async function ConsoleHomePage() {
  const { user } = await requireStaffPage("/admin");
  const [{ t, lang }, data] = await Promise.all([getI18n(), getDashboard(user.role)]);
  const firstName = user.name.trim().split(/\s+/)[0] || t("فريق شاشتنا", "team");
  const today = new Intl.DateTimeFormat(localeOf(lang), { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: data.timeZone }).format(new Date());
  const inbox = inboxItems(data, lang);
  const pending = data.queues?.ok ? inbox.reduce((sum, item) => sum + (item.value ?? 0), 0) : null;
  const alerts = alertItems(data, lang);
  const actions = quickActions(data, lang);
  // Half-width activity cards present for this role; an odd last one spans the row.
  const halves = [data.latestOrders && "orders", data.ready && "ready", (data.customers || data.subscriptions) && "customers", data.expiring && "expiring", data.tickets && "tickets"].filter(Boolean) as string[];
  const half = (key: string) => (halves.length % 2 === 1 && halves[halves.length - 1] === key ? "lg:col-span-12" : "lg:col-span-6");

  return (
    <div className="relative isolate space-y-6" data-testid="console-home">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-24 -z-10 h-[520px] bg-[radial-gradient(55%_60%_at_75%_0%,rgb(25_81_252/0.2),transparent_70%),radial-gradient(40%_45%_at_10%_20%,rgb(55_129_252/0.08),transparent_70%)]" />

      {/* 1. Hero */}
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between" data-testid="home-hero">
        <div>
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-brand-ink">
            <Sparkles size={14} aria-hidden /> Shashtna Console
          </p>
          <h1 className="mt-2 text-h2 font-bold text-ink">{t(`مرحباً ${firstName}`, `Welcome, ${firstName}`)}</h1>
          <p className="mt-1 text-sm text-ink-3">
            {t("هذا ملخص نشاط شاشتنا", "Here's what's happening at Shashtna")} · <span className="nums">{today}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {pending !== null ? (
            <a href="#inbox" className="glass-soft inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-ink-2 hover:text-ink" data-testid="home-pending">
              <span className={cn("h-2 w-2 rounded-full", pending ? "bg-warning" : "bg-success")} aria-hidden />
              {pending ? t(`${pending} عنصر بانتظار المتابعة`, `${pending} item(s) need attention`) : t("ماكو مهام معلّقة", "Nothing pending")}
            </a>
          ) : null}
          {alerts.length ? (
            <a href="#alerts" className="inline-flex h-10 items-center gap-2 rounded-xl border border-warning/30 bg-warning/10 px-4 text-sm font-semibold text-warning">
              <AlertTriangle size={15} aria-hidden /> {t(`${alerts.length} تنبيه`, `${alerts.length} alert(s)`)}
            </a>
          ) : null}
        </div>
      </header>

      {/* 2. KPIs */}
      <KpiRow data={data} lang={lang} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* 3. Task inbox */}
        <SectionCard id="inbox" title={t("شنو يحتاج انتباه اليوم", "What needs attention today")} icon={<LayoutGrid size={14} aria-hidden />} className={data.finance ? "lg:col-span-5" : "lg:col-span-12"} testId="home-inbox">
          {!data.queues?.ok ? (
            <SectionError label={t("تعذر تحميل المهام. حدّث الصفحة.", "Couldn't load the task inbox. Refresh the page.")} />
          ) : inbox.length ? (
            <ul className={cn("grid gap-2", !data.finance && "sm:grid-cols-2 xl:grid-cols-3")}>
              {inbox.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="group flex items-center gap-3 rounded-2xl border border-line/70 bg-white/[0.02] p-3 transition hover:border-brand/40 hover:bg-white/[0.04]" data-testid="inbox-item">
                    <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl", item.value ? "bg-brand/18 text-brand-ink" : "bg-white/5 text-ink-3")}>{item.icon}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-ink">{item.label}</span>
                      <span className="block truncate text-xs text-ink-3">{item.hint}</span>
                    </span>
                    <span className={cn("nums min-w-9 rounded-full px-2.5 py-1 text-center text-sm font-bold", item.value === null ? "bg-white/5 text-ink-3" : item.value ? (item.urgent ? "bg-warning/15 text-warning" : "bg-glow/15 text-glow") : "bg-white/5 text-ink-3")}>
                      {item.value ?? "—"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyLine>{t("ماكو مهام ضمن صلاحياتك.", "No queues within your permissions.")}</EmptyLine>
          )}
        </SectionCard>

        {/* 4. Business snapshot (finance permission only) */}
        {data.finance ? <BusinessSnapshot data={data} lang={lang} /> : null}

        {/* 5. Orders / subscriptions activity */}
        {data.latestOrders ? (
          <SectionCard title={t("أحدث الطلبات", "Latest orders")} icon={<ShoppingBag size={14} aria-hidden />} action={{ href: "/admin/orders", label: t("كل الطلبات", "All orders") }} className={half("orders")} testId="home-latest-orders">
            {!data.latestOrders.ok ? (
              <SectionError label={t("تعذر تحميل الطلبات.", "Couldn't load orders.")} />
            ) : data.latestOrders.data.length ? (
              <ul className="divide-y divide-line/70">
                {data.latestOrders.data.map((order) => (
                  <li key={order.id}>
                    <Link href={`/admin/orders/${order.id}`} className="flex items-center justify-between gap-3 py-2.5" data-testid="home-order">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-bold text-ink">
                          <span className="nums">{order.number}</span> · {order.customerName ?? "—"}
                        </span>
                        <span className="block truncate text-xs text-ink-3">
                          {order.serviceName} · <span className="nums">{money(order.price, lang)}</span> · <span className="nums">{formatDateTime(order.createdAt, lang)}</span>
                        </span>
                      </span>
                      <StatusBadge status={order.status} label={ORDER_STATUS_LABELS[order.status as OrderStatus]?.[lang] ?? order.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyLine>{t("ماكو طلبات بعد.", "No orders yet.")}</EmptyLine>
            )}
          </SectionCard>
        ) : null}

        {data.ready ? (
          <SectionCard title={t("جاهزة للتفعيل", "Ready to activate")} icon={<PackageCheck size={14} aria-hidden />} action={{ href: "/admin/activations", label: t("الكل", "All") }} className={half("ready")} testId="home-ready">
            {!data.ready.ok ? (
              <SectionError label={t("تعذر تحميل الطلبات الجاهزة.", "Couldn't load ready orders.")} />
            ) : data.ready.data.length ? (
              <ul className="divide-y divide-line/70">
                {data.ready.data.slice(0, 6).map((order) => (
                  <li key={order.id} className="flex items-center justify-between gap-3 py-2.5">
                    <Link href={`/admin/orders/${order.id}`} className="min-w-0">
                      <span className="block truncate text-sm font-bold text-ink">
                        <span className="nums">{order.number}</span> · {order.customerName ?? "—"}
                      </span>
                      <span className="block truncate text-xs text-ink-3">{order.serviceName}</span>
                    </Link>
                    {order.requestType === "DEVICE_PURCHASE" ? (
                      <LinkButton href={`/admin/orders/${order.id}`} size="sm" variant="secondary">{t("إكمال", "Complete")}</LinkButton>
                    ) : (
                      <LinkButton href={`/admin/subscription-requests/${order.id}/add`} size="sm">{t("تفعيل", "Activate")}</LinkButton>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyLine>{t("ماكو طلبات مدفوعة بانتظار التفعيل.", "No paid orders waiting for activation.")}</EmptyLine>
            )}
          </SectionCard>
        ) : null}

        {/* 6. Customer snapshot */}
        {data.customers || data.subscriptions ? <CustomerSnapshot data={data} lang={lang} className={half("customers")} /> : null}

        {data.expiring ? (
          <SectionCard title={t("اشتراكات تنتهي خلال 7 أيام", "Ending within 7 days")} icon={<RefreshCw size={14} aria-hidden />} action={{ href: "/admin/renewals", label: t("التجديدات", "Renewals") }} className={half("expiring")} testId="home-expiring">
            {!data.expiring.ok ? (
              <SectionError label={t("تعذر تحميل الاشتراكات.", "Couldn't load subscriptions.")} />
            ) : data.expiring.data.length ? (
              <ul className="divide-y divide-line/70">
                {data.expiring.data.slice(0, 6).map((item) => (
                  <li key={item.id}>
                    <Link href={`/admin/customers/${item.userId}`} className="flex items-center justify-between gap-3 py-2.5">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-bold text-ink">{item.customerName ?? "—"}</span>
                        <span className="block truncate text-xs text-ink-3">{item.packageName}</span>
                      </span>
                      <span className="nums shrink-0 text-sm font-bold text-warning">{daysRemaining(item.expiryDate)} {t("يوم", "d")}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyLine>{t("ماكو اشتراكات تنتهي هذا الأسبوع.", "Nothing ends this week.")}</EmptyLine>
            )}
          </SectionCard>
        ) : null}

        {data.tickets ? (
          <SectionCard title={t("تذاكر بانتظار رد الفريق", "Tickets waiting on the team")} icon={<MessagesSquare size={14} aria-hidden />} action={{ href: "/admin/support?filter=waiting", label: t("الكل", "All") }} className={half("tickets")} testId="home-tickets">
            {!data.tickets.ok ? (
              <SectionError label={t("تعذر تحميل التذاكر.", "Couldn't load tickets.")} />
            ) : data.tickets.data.length ? (
              <ul className="divide-y divide-line/70">
                {data.tickets.data.slice(0, 6).map((ticket) => (
                  <li key={ticket.id}>
                    <Link href={`/admin/support/${encodeURIComponent(ticket.id)}`} className="flex items-center justify-between gap-3 py-2.5">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-bold text-ink">{ticket.subject}</span>
                        <span className="block truncate text-xs text-ink-3">{ticket.userName} · <span className="nums">{formatDateTime(ticket.updatedAt, lang)}</span></span>
                      </span>
                      <StatusBadge status={ticket.status} label={ticket.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyLine>{t("كل التذاكر تم الرد عليها.", "Every ticket has a reply.")}</EmptyLine>
            )}
          </SectionCard>
        ) : null}

        {/* 7. Recent activity (audit permission) */}
        {data.activity ? (
          <SectionCard title={t("آخر النشاطات", "Recent activity")} icon={<Activity size={14} aria-hidden />} action={{ href: "/admin/audit", label: t("سجل التدقيق", "Audit log") }} className="lg:col-span-7" testId="home-activity">
            {!data.activity.ok ? (
              <SectionError label={t("تعذر تحميل النشاطات.", "Couldn't load activity.")} />
            ) : data.activity.data.length ? (
              <ol className="relative space-y-3 ps-5 before:absolute before:inset-y-1 before:start-[5px] before:w-px before:bg-line">
                {data.activity.data.map((event) => (
                  <li key={event.id} className="relative" data-testid="home-activity-item">
                    <span className="absolute -start-5 top-1.5 h-2.5 w-2.5 rounded-full border-2 border-canvas bg-brand-ink" aria-hidden />
                    <p className="text-sm leading-6 text-ink">{event.summary}</p>
                    <p className="nums text-xs text-ink-3">
                      {event.actorName ?? (event.actorRole === "CUSTOMER" ? t("عميل", "Customer") : t("النظام", "System"))} · {formatDateTime(event.createdAt, lang)}
                    </p>
                  </li>
                ))}
              </ol>
            ) : (
              <EmptyLine>{t("ماكو نشاط مسجّل بعد.", "No activity recorded yet.")}</EmptyLine>
            )}
          </SectionCard>
        ) : null}

        {/* 8 + 9. Quick actions and alerts */}
        <div className={cn("grid content-start gap-5", data.activity ? "lg:col-span-5" : "lg:col-span-12 lg:grid-cols-2")}>
          {actions.length ? (
            <SectionCard title={t("إجراءات سريعة", "Quick actions")} icon={<Plus size={14} aria-hidden />} testId="home-quick-actions">
              <ul className="grid grid-cols-2 gap-2">
                {actions.map((action) => (
                  <li key={action.href}>
                    <Link href={action.href} className="flex h-full items-center gap-2.5 rounded-2xl border border-line/70 bg-white/[0.02] p-3 text-sm font-semibold text-ink-2 transition hover:border-brand/40 hover:text-ink" data-testid="quick-action">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand/15 text-brand-ink">{action.icon}</span>
                      <span className="min-w-0 leading-5">{action.label}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </SectionCard>
          ) : null}

          <SectionCard id="alerts" title={t("تنبيهات", "Alerts")} icon={<AlertTriangle size={14} aria-hidden />} testId="home-alerts">
            {alerts.length ? (
              <ul className="space-y-2">
                {alerts.map((alert) => (
                  <li key={alert.key}>
                    <Link href={alert.href} className={cn("flex items-start gap-2.5 rounded-2xl border p-3 text-sm leading-6 transition", alert.tone === "danger" ? "border-danger/30 bg-danger/8 text-ink hover:border-danger/50" : "border-warning/25 bg-warning/8 text-ink hover:border-warning/45")} data-testid="home-alert">
                      <AlertTriangle size={15} className={cn("mt-1 shrink-0", alert.tone === "danger" ? "text-danger" : "text-warning")} aria-hidden />
                      <span>{alert.text}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="flex items-center gap-2 rounded-xl bg-success/8 px-3 py-3 text-sm text-success">
                <CheckCircle2 size={15} aria-hidden /> {t("ماكو تنبيهات حالياً.", "No alerts right now.")}
              </p>
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ KPIs

function KpiRow({ data, lang }: { data: Dashboard; lang: Lang }) {
  const t = translator(lang);
  const tiles: ReactNode[] = [];
  const failed = <span className="text-base font-semibold text-danger">{t("تعذر التحميل", "Unavailable")}</span>;

  if (data.finance) {
    const finance = data.finance.ok ? data.finance.data : null;
    tiles.push(
      <KpiTile
        key="revenue"
        hero
        className="sm:col-span-2 xl:col-span-2"
        testId="kpi-revenue"
        href="/admin/finance"
        label={t("إيرادات هذا الشهر", "Revenue this month")}
        value={finance ? money(finance.revenue.amount, lang) : failed}
        chip={finance && finance.revenue.change !== null ? <DeltaChip change={finance.revenue.change} lang={lang} onBrand /> : null}
        hint={finance ? t(`${finance.revenue.sales} مبيعة`, `${finance.revenue.sales} sales`) : undefined}
      />,
      <KpiTile
        key="profit"
        testId="kpi-profit"
        href={finance && finance.profit.status === "ok" ? "/admin/finance" : "/admin/finance/expenses"}
        label={t("صافي الربح", "Net profit")}
        value={!finance ? failed : finance.profit.status === "ok" ? <span className={finance.profit.amount < 0 ? "text-danger" : undefined}>{money(finance.profit.amount, lang)}</span> : <span className="text-lg text-ink-2">{t("بيانات غير مكتملة", "Data incomplete")}</span>}
        hint={finance ? (finance.profit.status === "ok" ? t("هذا الشهر · الإيرادات − المصاريف", "This month · revenue − expenses") : t("سجّل المصاريف لحسابه", "Record expenses to calculate it")) : undefined}
      />,
    );
  }

  if (data.orders) {
    const orders = data.orders.ok ? data.orders.data : null;
    tiles.push(
      <KpiTile
        key="orders"
        testId="kpi-orders"
        href="/admin/orders"
        label={t("طلبات هذا الشهر", "Orders this month")}
        value={orders ? orders.current : failed}
        chip={orders && orders.change !== null ? <DeltaChip change={orders.change} lang={lang} /> : null}
        hint={orders ? (orders.change !== null ? t("مقارنة بنفس النقطة من الشهر الماضي", "vs the same point last month") : t("منذ بداية الشهر", "Since the start of the month")) : undefined}
      />,
    );
  }

  if (data.subscriptions) {
    const subs = data.subscriptions.ok ? data.subscriptions.data : null;
    tiles.push(
      <KpiTile
        key="subscriptions"
        testId="kpi-subscriptions"
        href="/admin/subscriptions"
        label={t("اشتراكات فعّالة", "Active subscriptions")}
        value={subs ? subs.active : failed}
        hint={subs ? (subs.expiring ? t(`منها ${subs.expiring} تنتهي قريبًا`, `${subs.expiring} ending soon`) : t("الآن", "Right now")) : undefined}
      />,
    );
  }

  if (data.customers) {
    const customers = data.customers.ok ? data.customers.data : null;
    tiles.push(
      <KpiTile
        key="customers"
        testId="kpi-customers"
        href="/admin/customers"
        label={t("العملاء", "Customers")}
        value={customers ? customers.total : failed}
        chip={customers && customers.newChange !== null ? <DeltaChip change={customers.newChange} lang={lang} /> : null}
        hint={customers ? t(`${customers.newThisMonth} جديد هذا الشهر`, `${customers.newThisMonth} new this month`) : undefined}
      />,
    );
  }

  if (!tiles.length) return null;

  return (
    <section aria-label={t("المؤشرات الرئيسية", "Key metrics")} className={cn("grid grid-cols-1 gap-4 sm:grid-cols-2", data.finance ? (tiles.length >= 5 ? "xl:grid-cols-6" : "xl:grid-cols-4") : tiles.length >= 3 ? "xl:grid-cols-3" : "xl:grid-cols-2")} data-testid="home-kpis">
      {tiles}
    </section>
  );
}

// ------------------------------------------------------------------ business snapshot

function BusinessSnapshot({ data, lang }: { data: Dashboard; lang: Lang }) {
  const t = translator(lang);
  const currency = t("د.ع", "IQD");

  return (
    <SectionCard title={t("لمحة الأعمال — آخر 30 يوم", "Business snapshot — last 30 days")} icon={<BarChart3 size={14} aria-hidden />} action={{ href: "/admin/finance", label: t("المالية والأداء", "Finance & BI") }} className="lg:col-span-7" testId="home-business">
      {!data.finance?.ok ? (
        <SectionError label={t("تعذر تحميل البيانات المالية.", "Couldn't load financial data.")} />
      ) : (
        (() => {
          const finance = data.finance.data;

          return (
            <div className="space-y-4">
              <dl className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <div className="rounded-2xl bg-white/[0.03] p-3">
                  <dt className="flex items-center gap-1.5 text-[11px] font-semibold text-ink-3"><span className="h-2 w-2 rounded-[2px] bg-viz-revenue" aria-hidden />{t("الإيرادات", "Revenue")}</dt>
                  <dd className="nums mt-1 text-base font-bold text-ink">{money(finance.revenue.amount, lang)}</dd>
                </div>
                <div className="rounded-2xl bg-white/[0.03] p-3">
                  <dt className="flex items-center gap-1.5 text-[11px] font-semibold text-ink-3"><span className="h-2 w-2 rounded-[2px] bg-viz-expenses" aria-hidden />{t("المصاريف", "Expenses")}</dt>
                  <dd className="nums mt-1 text-base font-bold text-ink">{finance.expenses.recorded ? money(finance.expenses.amount, lang) : t("غير مسجلة", "Not recorded")}</dd>
                </div>
                <div className="rounded-2xl bg-white/[0.03] p-3">
                  <dt className="flex items-center gap-1.5 text-[11px] font-semibold text-ink-3"><span className="h-0.5 w-3 rounded-full bg-viz-profit" aria-hidden />{t("صافي الربح", "Net profit")}</dt>
                  <dd className="nums mt-1 text-base font-bold text-ink">{finance.profit.status === "ok" ? money(finance.profit.amount, lang) : t("غير مكتمل", "Incomplete")}</dd>
                </div>
              </dl>
              <p className="text-[11px] text-ink-3">{t("الأرقام أعلاه لهذا الشهر؛ الرسم لآخر 30 يوم.", "Figures above are this month; the chart covers the last 30 days.")}</p>
              <TrendChart
                data={finance.trend.points.map((point) => ({ ...point, label: bucketLabel(point.key, "day", lang) }))}
                showProfit={finance.expenses.recorded}
                format={{ currency, locale: lang }}
                labels={{
                  revenue: t("الإيرادات", "Revenue"),
                  expenses: t("المصاريف", "Expenses"),
                  profit: t("صافي الربح", "Net profit"),
                  sales: t("المبيعات", "Sales"),
                  table: t("عرض كجدول", "Table view"),
                  period: t("اليوم", "Day"),
                  empty: t("ماكو إيرادات أو مصاريف بآخر 30 يوم.", "No revenue or expenses in the last 30 days."),
                  title: t("الإيرادات اليومية لآخر 30 يوم", "Daily revenue, last 30 days"),
                }}
              />
              <p className="flex items-center gap-2 text-sm text-ink-2" data-testid="home-most-sold">
                <Crown size={15} className="shrink-0 text-glow" aria-hidden />
                {finance.mostSold
                  ? t(`الأكثر مبيعًا هذا الشهر: ${finance.mostSold.name} (${finance.mostSold.units} عملية شراء)`, `Most sold this month: ${finance.mostSold.name} (${finance.mostSold.units} purchases)`)
                  : t("ماكو منتج متصدر بوضوح هذا الشهر بعد.", "No clear best-seller this month yet.")}
              </p>
            </div>
          );
        })()
      )}
    </SectionCard>
  );
}

// ------------------------------------------------------------------ customers

function CustomerSnapshot({ data, lang, className }: { data: Dashboard; lang: Lang; className: string }) {
  const t = translator(lang);
  const customers = data.customers;
  const subs = data.subscriptions;

  return (
    <SectionCard title={t("العملاء", "Customers")} icon={<UsersRound size={14} aria-hidden />} action={customers ? { href: "/admin/customers", label: t("كل العملاء", "All customers") } : undefined} className={className} testId="home-customers">
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {customers ? (
          <>
            <Figure label={t("إجمالي العملاء", "Total")} value={customers.ok ? customers.data.total : null} />
            <Figure label={t("جدد هذا الشهر", "New this month")} value={customers.ok ? customers.data.newThisMonth : null} />
          </>
        ) : null}
        {subs ? (
          <>
            <Figure label={t("اشتراكات فعّالة", "Active subs")} value={subs.ok ? subs.data.active : null} />
            <Figure label={t("تنتهي قريبًا", "Ending soon")} value={subs.ok ? subs.data.expiring : null} tone="warning" />
          </>
        ) : null}
      </dl>
      {customers ? (
        customers.ok ? (
          customers.data.recent.length ? (
            <div className="mt-4">
              <p className="text-xs font-semibold text-ink-3">{t("آخر المسجلين", "Latest sign-ups")}</p>
              <ul className="mt-2 divide-y divide-line/70">
                {customers.data.recent.map((customer) => (
                  <li key={customer.id}>
                    <Link href={`/admin/customers/${customer.id}`} className="flex items-center justify-between gap-3 py-2" data-testid="home-customer">
                      <span className="truncate text-sm font-semibold text-ink">{customer.name}</span>
                      <span className="nums shrink-0 text-xs text-ink-3">{formatDateTime(customer.createdAt, lang)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="mt-4"><EmptyLine>{t("ماكو عملاء مسجلين بعد.", "No customers yet.")}</EmptyLine></div>
          )
        ) : (
          <div className="mt-4"><SectionError label={t("تعذر تحميل بيانات العملاء.", "Couldn't load customers.")} /></div>
        )
      ) : null}
      {subs && !subs.ok ? <div className="mt-3"><SectionError label={t("تعذر تحميل الاشتراكات.", "Couldn't load subscriptions.")} /></div> : null}
    </SectionCard>
  );
}

function Figure({ label, value, tone }: { label: string; value: number | null; tone?: "warning" }) {
  return (
    <div className="rounded-2xl bg-white/[0.03] p-3">
      <dt className="text-[11px] font-semibold text-ink-3">{label}</dt>
      <dd className={cn("nums mt-1 text-xl font-bold", value === null ? "text-ink-3" : tone === "warning" && value ? "text-warning" : "text-ink")}>{value ?? "—"}</dd>
    </div>
  );
}

// ------------------------------------------------------------------ inbox / actions / alerts

type InboxItem = { href: string; label: string; hint: string; value: number | null; icon: ReactNode; urgent?: boolean };

function inboxItems(data: Dashboard, lang: Lang): InboxItem[] {
  const t = translator(lang);
  const q = data.queues?.ok ? data.queues.data : null;
  const items: (InboxItem | false)[] = [
    data.can("orders") && { href: "/admin/orders?status=unpaid", label: t("طلبات جديدة", "New orders"), hint: t("بانتظار التواصل أو الدفع", "Awaiting contact or payment"), value: q?.orders ?? null, icon: <ShoppingBag size={18} aria-hidden /> },
    data.can("orders") && { href: "/admin/orders?status=unpaid", label: t("إثباتات دفع للمراجعة", "Payment proofs to verify"), hint: t("رفعها العميل وتنتظر التحقق", "Uploaded, waiting for verification"), value: data.proofs?.ok ? data.proofs.data : null, icon: <FileCheck2 size={18} aria-hidden />, urgent: true },
    data.can("orders") && { href: "/admin/activations", label: t("جاهزة للتفعيل", "Ready to activate"), hint: t("مدفوعة أو قيد التفعيل", "Paid or activating"), value: q?.activations ?? null, icon: <PackageCheck size={18} aria-hidden />, urgent: true },
    data.can("subscriptions") && { href: "/admin/renewals", label: t("تجديدات مستحقة", "Renewals due"), hint: t("14 يوم القادمة / 30 يوم الماضية", "Next 14 / last 30 days"), value: q?.renewals ?? null, icon: <RefreshCw size={18} aria-hidden /> },
    data.can("support") && { href: "/admin/support?filter=waiting", label: t("تذاكر بانتظار رد", "Tickets awaiting reply"), hint: t("آخر رسالة من العميل", "Last message from customer"), value: q?.tickets ?? null, icon: <MessagesSquare size={18} aria-hidden />, urgent: true },
    data.can("customers") && { href: "/admin/password-resets", label: t("طلبات إعادة تعيين", "Password resets"), hint: t("تحتاج تحقق وإصدار رمز", "Need verification and a code"), value: q?.resets ?? null, icon: <KeyRound size={18} aria-hidden /> },
    data.can("orders") && { href: "/admin/leads", label: t("طلبات مشاريع جديدة", "New project leads"), hint: t("شاشتنا للحلول الرقمية", "Shashtna Digital"), value: q?.leads ?? null, icon: <Briefcase size={18} aria-hidden /> },
  ];

  return items.filter((item): item is InboxItem => Boolean(item));
}

function quickActions(data: Dashboard, lang: Lang) {
  const t = translator(lang);
  const actions: ({ href: string; label: string; icon: ReactNode } | false)[] = [
    data.can("orders") && { href: "/admin/orders", label: t("معالجة الطلبات", "Process orders"), icon: <ShoppingBag size={16} aria-hidden /> },
    data.can("subscriptions") && { href: "/admin/lookup", label: t("بحث عن اشتراك", "Find a subscription"), icon: <Search size={16} aria-hidden /> },
    data.can("catalogue") && { href: "/admin/packages", label: t("إضافة باقة", "Add a package"), icon: <Package size={16} aria-hidden /> },
    data.can("catalogue") && { href: "/admin/devices", label: t("إضافة جهاز", "Add a device"), icon: <Cpu size={16} aria-hidden /> },
    data.can("content") && { href: "/admin/announcements", label: t("إنشاء إعلان", "Create an ad"), icon: <Megaphone size={16} aria-hidden /> },
    data.can("finance") && { href: "/admin/finance/expenses", label: t("تسجيل مصروف", "Record an expense"), icon: <Receipt size={16} aria-hidden /> },
    data.can("finance") && { href: "/admin/finance", label: t("المالية والأداء", "Finance & BI"), icon: <WalletCards size={16} aria-hidden /> },
    data.can("customers") && { href: "/admin/customers", label: t("العملاء", "Customers"), icon: <UsersRound size={16} aria-hidden /> },
    data.can("support") && { href: "/admin/notifications", label: t("إرسال إشعار", "Send a notification"), icon: <Send size={16} aria-hidden /> },
  ];

  return actions.filter((action): action is { href: string; label: string; icon: ReactNode } => Boolean(action)).slice(0, 8);
}

function alertItems(data: Dashboard, lang: Lang) {
  const t = translator(lang);
  const alerts: { key: string; text: string; href: string; tone: "warning" | "danger" }[] = [];

  if (data.incidents?.ok && data.incidents.data.length) {
    alerts.push({ key: "incidents", tone: "danger", href: data.can("content") ? "/admin/status" : "/status", text: t(`${data.incidents.data.length} مشكلة معلنة على صفحة حالة الخدمة.`, `${data.incidents.data.length} incident(s) published on the status page.`) });
  }

  if (data.proofs?.ok && data.proofs.data > 0) {
    alerts.push({ key: "proofs", tone: "warning", href: "/admin/orders?status=unpaid", text: t(`${data.proofs.data} إثبات دفع بانتظار التحقق — العميل ينتظر تأكيد طلبه.`, `${data.proofs.data} payment proof(s) waiting for verification.`) });
  }

  if (data.finance?.ok && data.finance.data.profit.status === "incomplete") {
    alerts.push({ key: "expenses", tone: "warning", href: "/admin/finance/expenses", text: t("ما مسجّل أي مصروف — صافي الربح ما يمكن حسابه.", "No expenses recorded — net profit can't be calculated.") });
  }

  if (data.setup?.ok) {
    const setup = data.setup.data;
    if (setup.missingTransferNumber) alerts.push({ key: "transfer", tone: "danger", href: "/admin/settings", text: t("رقم التحويل فارغ — العملاء ما يگدرون يدفعون من صفحة الطلب.", "The transfer number is empty — customers can't pay.") });
    if (setup.missingWhatsapp) alerts.push({ key: "whatsapp", tone: "warning", href: "/admin/settings", text: t("رقم واتساب غير مضاف — زر واتساب مخفي بالموقع.", "No WhatsApp number — WhatsApp buttons are hidden.") });
    if (setup.termsDraft) alerts.push({ key: "terms", tone: "warning", href: "/admin/settings", text: t("الشروط والأحكام بعدها مسودة.", "Terms of service are still a draft.") });
    if (setup.privacyDraft) alerts.push({ key: "privacy", tone: "warning", href: "/admin/settings", text: t("سياسة الخصوصية بعدها مسودة.", "The privacy policy is still a draft.") });
  }

  return alerts;
}

