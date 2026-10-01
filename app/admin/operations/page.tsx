import type { Metadata } from "next";
import Link from "next/link";
import { Activity, Briefcase, FileCheck2, Filter, MessagesSquare, PackageCheck, RefreshCw, Search, ShoppingBag, Workflow } from "lucide-react";
import type { ReactNode } from "react";

import { EmptyLine, SectionCard, SectionError } from "@/app/components/admin/dashboard/DashboardUI";
import { ActivationRow, LeadRow, OrderRow, PaymentCard, RenewalRow, TicketRow, waitingLabel } from "@/app/components/admin/operations/OperationsUI";
import { cn } from "@/app/ui/cn";
import { formatDateTime, translator, type Lang } from "@/src/lib/i18n";
import { QUEUE_PERMISSION, parseOperationsQuery, type OperationsQueue } from "@/src/lib/operations";
import { hasPermission } from "@/src/lib/roles";
import { requireStaffPage } from "@/src/server/auth";
import { getI18n } from "@/src/server/i18n";
import { getOperations, type Operations } from "@/src/server/operations";
import { TICKET_STATUS_LABELS } from "@/src/server/tickets";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "مركز العمليات" };

const LANE_LIMIT = 5;

/**
 * Operations Center — the daily operational workspace. It brings the
 * existing queues together (payments to verify, orders, activations,
 * renewals, tickets, leads) with search and URL filters, and acts only
 * through the existing server actions and detail pages. Queues the role
 * can't access are neither loaded nor shown.
 */
export default async function OperationsPage({ searchParams }: { searchParams: Promise<{ queue?: string; q?: string; since?: string }> }) {
  const { user } = await requireStaffPage("/admin/operations");
  const [{ t, lang }, params] = await Promise.all([getI18n(), searchParams]);
  const requested = parseOperationsQuery(params);
  const permitted = (queue: OperationsQueue) => queue === "overview" || hasPermission(user.role, QUEUE_PERMISSION[queue]);
  // A queue the role can't access falls back to the overview (never loaded).
  const query = permitted(requested.queue) ? requested : { ...requested, queue: "overview" as const };
  const ops = await getOperations(user.role, query);
  const queues = queueMeta(lang).filter((queue) => permitted(queue.key));
  const href = (next: Partial<{ queue: string; q: string; since: string }>) => {
    const search = new URLSearchParams();
    const merged = { queue: query.queue, q: query.q, since: query.since, ...next };
    if (merged.queue && merged.queue !== "overview") search.set("queue", merged.queue);
    if (merged.q) search.set("q", merged.q);
    if (merged.since && merged.since !== "all") search.set("since", merged.since);
    const text = search.toString();

    return `/admin/operations${text ? `?${text}` : ""}`;
  };
  const anyQueue = queues.length > 1;

  return (
    <div className="relative isolate space-y-5" data-testid="operations">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-24 -z-10 h-[420px] bg-[radial-gradient(55%_60%_at_75%_0%,rgb(25_81_252/0.16),transparent_70%)]" />

      <header>
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-brand-ink">
          <Workflow size={14} aria-hidden /> Shashtna Operations
        </p>
        <h1 className="mt-2 text-h2 font-bold text-ink">{t("مركز العمليات", "Operations Center")}</h1>
        <p className="mt-1 text-sm text-ink-3">{t("شنو يحتاج انتباه، وين تروح، وشنو الإجراء — من مكان واحد.", "What needs attention, where to go and what to do — in one place.")}</p>
      </header>

      {anyQueue ? (
        <>
          {/* Queue navigation */}
          <nav aria-label={t("طوابير العمليات", "Operational queues")} className="scrollbar-none -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0" data-testid="ops-tabs">
            <ul className="flex w-max gap-1 rounded-2xl border border-line bg-surface/70 p-1 backdrop-blur">
              {queues.map((queue) => (
                <li key={queue.key}>
                  <Link
                    href={href({ queue: queue.key })}
                    aria-current={query.queue === queue.key ? "page" : undefined}
                    className={cn("inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold transition", query.queue === queue.key ? "bg-brand text-white" : "text-ink-2 hover:bg-white/5 hover:text-ink")}
                  >
                    {queue.icon}
                    {queue.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Search + filters (URL-addressable) */}
          <form action="/admin/operations" className="glass-soft sticky top-[4.5rem] z-10 flex flex-wrap items-center gap-2 rounded-2xl p-2" role="search" data-testid="ops-filters">
            {query.queue !== "overview" ? <input type="hidden" name="queue" value={query.queue} /> : null}
            <label className="relative min-w-0 flex-1">
              <span className="sr-only">{t("بحث", "Search")}</span>
              <Search size={15} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink-3" aria-hidden />
              <input
                name="q"
                defaultValue={query.q}
                placeholder={t("رقم الطلب، اسم العميل، الهاتف، الموضوع…", "Order number, customer, phone, subject…")}
                className="h-10 w-full rounded-xl border border-line bg-surface ps-9 pe-3 text-sm text-ink placeholder:text-ink-3 focus:border-brand focus:outline-none"
                data-testid="ops-search"
              />
            </label>
            <label className="flex items-center gap-1.5 text-xs text-ink-3">
              <Filter size={14} aria-hidden />
              <span className="sr-only">{t("منذ", "Since")}</span>
              <select name="since" defaultValue={query.since} className="h-10 rounded-xl border border-line bg-surface px-2 text-sm text-ink" data-testid="ops-since">
                <option value="all">{t("كل الأوقات", "Any time")}</option>
                <option value="today">{t("اليوم", "Today")}</option>
                <option value="7d">{t("آخر 7 أيام", "Last 7 days")}</option>
                <option value="30d">{t("آخر 30 يوم", "Last 30 days")}</option>
              </select>
            </label>
            <button type="submit" className="h-10 rounded-xl bg-brand px-4 text-sm font-bold text-white hover:bg-brand-strong">{t("تطبيق", "Apply")}</button>
            {query.q || query.since !== "all" ? (
              <Link href={href({ q: "", since: "all" })} className="h-10 content-center rounded-xl px-3 text-sm font-semibold text-ink-3 hover:text-ink" data-testid="ops-clear">
                {t("مسح", "Clear")}
              </Link>
            ) : null}
          </form>
          {query.q || query.since !== "all" ? (
            <p className="text-xs text-ink-3" data-testid="ops-filter-note">{t("الأرقام والقوائم تعرض النتائج المطابقة للفلتر فقط.", "Counts and lists show only items matching the filter.")}</p>
          ) : null}

          {query.queue === "overview" ? <Overview ops={ops} lang={lang} href={href} /> : <QueueView ops={ops} lang={lang} queue={query.queue} />}
        </>
      ) : (
        <SectionCard title={t("لا توجد طوابير", "No queues")} testId="ops-none">
          <EmptyLine>{t("ماكو طوابير عمليات ضمن صلاحياتك.", "No operational queues within your permissions.")}</EmptyLine>
        </SectionCard>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ metadata

function queueMeta(lang: Lang) {
  const t = translator(lang);

  return [
    { key: "overview" as const, label: t("نظرة عامة", "Overview"), icon: <Activity size={15} aria-hidden /> },
    { key: "payments" as const, label: t("التحقق من الدفع", "Payment verification"), icon: <FileCheck2 size={15} aria-hidden /> },
    { key: "orders" as const, label: t("الطلبات", "Orders"), icon: <ShoppingBag size={15} aria-hidden /> },
    { key: "activations" as const, label: t("التفعيل", "Activations"), icon: <PackageCheck size={15} aria-hidden /> },
    { key: "renewals" as const, label: t("التجديدات", "Renewals"), icon: <RefreshCw size={15} aria-hidden /> },
    { key: "support" as const, label: t("الدعم", "Support"), icon: <MessagesSquare size={15} aria-hidden /> },
    { key: "leads" as const, label: t("الطلبات الرقمية", "Leads"), icon: <Briefcase size={15} aria-hidden /> },
  ];
}

// ------------------------------------------------------------------ overview

type Lane = {
  key: OperationsQueue;
  title: string;
  hint: string;
  icon: ReactNode;
  count: number | null;
  failed: boolean;
  urgent?: boolean;
  items: { key: string; label: string; meta: string; since: string; href: string }[];
};

function lanesFor(ops: Operations, lang: Lang): Lane[] {
  const t = translator(lang);
  const lanes: Lane[] = [];

  if (ops.unpaid) {
    const data = ops.unpaid.ok ? ops.unpaid.data : null;
    lanes.push({
      key: "payments",
      title: t("إثباتات دفع للتحقق", "Payment proofs to verify"),
      hint: t("الأقدم أولًا", "Oldest first"),
      icon: <FileCheck2 size={16} aria-hidden />,
      count: data ? data.payments.length : null,
      failed: !data,
      urgent: true,
      items: (data?.payments ?? []).map((item) => ({ key: `p${item.id}`, label: `${item.number} · ${item.customerName ?? "—"}`, meta: item.serviceName, since: item.since, href: `/admin/orders/${item.id}` })),
    });
    lanes.push({
      key: "orders",
      title: t("طلبات بانتظار التواصل أو الدفع", "Orders awaiting contact or payment"),
      hint: t("بدون إثبات دفع بعد", "No proof yet"),
      icon: <ShoppingBag size={16} aria-hidden />,
      count: data ? data.orders.length : null,
      failed: !data,
      items: (data?.orders ?? []).map((item) => ({ key: `o${item.id}`, label: `${item.number} · ${item.customerName ?? "—"}`, meta: item.serviceName, since: item.since, href: `/admin/orders/${item.id}` })),
    });
  }

  if (ops.activations) {
    const data = ops.activations.ok ? ops.activations.data : null;
    lanes.push({
      key: "activations",
      title: t("جاهزة للتفعيل", "Ready to activate"),
      hint: t("مدفوعة، الأقدم أولًا", "Paid, oldest first"),
      icon: <PackageCheck size={16} aria-hidden />,
      count: data ? data.length : null,
      failed: !data,
      urgent: true,
      items: (data ?? []).map((item) => ({ key: `a${item.id}`, label: `${item.number} · ${item.customerName ?? "—"}`, meta: item.serviceName, since: item.since, href: item.requestType === "DEVICE_PURCHASE" ? `/admin/orders/${item.id}` : `/admin/subscription-requests/${item.id}/add` })),
    });
  }

  if (ops.renewals) {
    const data = ops.renewals.ok ? ops.renewals.data : null;
    lanes.push({
      key: "renewals",
      title: t("تجديدات تنتهي قريبًا", "Renewals ending soon"),
      hint: t("الأقرب انتهاءً أولًا", "Soonest first"),
      icon: <RefreshCw size={16} aria-hidden />,
      count: data ? data.ending.length : null,
      failed: !data,
      items: (data?.ending ?? []).map((item) => ({ key: `r${item.id}`, label: item.customerName ?? "—", meta: `${item.packageName} · ${item.daysLeft} ${t("يوم", "d")}`, since: item.expiryDate, href: `/admin/customers/${item.userId}` })),
    });
  }

  if (ops.support) {
    const data = ops.support.ok ? ops.support.data.filter((item) => item.waitingOnTeam) : null;
    lanes.push({
      key: "support",
      title: t("تذاكر بانتظار ردنا", "Tickets waiting on us"),
      hint: t("الأقدم أولًا", "Oldest first"),
      icon: <MessagesSquare size={16} aria-hidden />,
      count: data ? data.length : null,
      failed: !data,
      urgent: true,
      items: (data ?? []).map((item) => ({ key: `t${item.id}`, label: item.subject, meta: item.customerName, since: item.since, href: `/admin/support/${encodeURIComponent(item.id)}` })),
    });
  }

  if (ops.leads) {
    const data = ops.leads.ok ? ops.leads.data.filter((item) => item.status === "NEW") : null;
    lanes.push({
      key: "leads",
      title: t("طلبات مشاريع جديدة", "New project leads"),
      hint: t("لم يتم التواصل بعد", "Not contacted yet"),
      icon: <Briefcase size={16} aria-hidden />,
      count: data ? data.length : null,
      failed: !data,
      items: (data ?? []).map((item) => ({ key: `l${item.id}`, label: item.name, meta: item.projectType, since: item.since, href: `/admin/operations?queue=leads` })),
    });
  }

  return lanes;
}

function Overview({ ops, lang, href }: { ops: Operations; lang: Lang; href: (next: Partial<{ queue: string }>) => string }) {
  const t = translator(lang);
  const lanes = lanesFor(ops, lang);

  return (
    <div className="space-y-5">
      {/* Queue KPIs: each says whether action is required and links to its workflow */}
      <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6" data-testid="ops-kpis">
        {lanes.map((lane) => (
          <li key={lane.key}>
            <Link href={href({ queue: lane.key })} className="flex h-full flex-col justify-between gap-3 rounded-2xl border border-line/80 bg-surface/70 p-4 transition hover:border-brand/40" data-testid={`ops-kpi-${lane.key}`}>
              <span className="flex items-center justify-between gap-2 text-xs font-semibold text-ink-3">
                {lane.title}
                <span className="text-brand-ink">{lane.icon}</span>
              </span>
              <span>
                <span className={cn("nums block text-3xl font-extrabold", lane.failed ? "text-base text-danger" : lane.count ? (lane.urgent ? "text-warning" : "text-ink") : "text-ink-3")} data-testid="ops-kpi-value">
                  {lane.failed ? t("تعذر التحميل", "Unavailable") : lane.count}
                </span>
                <span className={cn("mt-1 block text-[11px] font-semibold", lane.failed ? "text-danger" : lane.count ? "text-warning" : "text-success")}>
                  {lane.failed ? t("تعذر تحميل البيانات", "Couldn't load") : lane.count ? t("يحتاج إجراء", "Action needed") : t("لا شيء معلّق", "Nothing pending")}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        {/* Needs attention: one lane per workflow stage, each ordered by waiting time */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:col-span-8" data-testid="ops-attention">
          {lanes.map((lane) => (
            <SectionCard key={lane.key} title={lane.title} icon={lane.icon} action={{ href: href({ queue: lane.key }), label: t("فتح الطابور", "Open queue") }} testId={`ops-lane-${lane.key}`}>
              {lane.failed ? (
                <SectionError label={t("تعذر تحميل هذا الطابور.", "Couldn't load this queue.")} />
              ) : lane.items.length ? (
                <ol className="divide-y divide-line/70">
                  {lane.items.slice(0, LANE_LIMIT).map((item) => (
                    <li key={item.key}>
                      <Link href={item.href} className="flex items-center justify-between gap-3 py-2.5" data-testid="ops-lane-item">
                        <span className="min-w-0">
                          <span className="nums block truncate text-sm font-semibold text-ink">{item.label}</span>
                          <span className="block truncate text-xs text-ink-3">{item.meta}</span>
                        </span>
                        <span className="nums shrink-0 text-xs text-ink-3">{lane.key === "renewals" ? "" : waitingLabel(item.since, lang)}</span>
                      </Link>
                    </li>
                  ))}
                  {lane.items.length > LANE_LIMIT ? (
                    <li className="pt-2 text-xs text-ink-3">{t(`و ${lane.items.length - LANE_LIMIT} غيرها`, `and ${lane.items.length - LANE_LIMIT} more`)}</li>
                  ) : null}
                </ol>
              ) : (
                <EmptyLine>{t("ماكو شي هنا حاليًا.", "Nothing here right now.")}</EmptyLine>
              )}
              <p className="mt-3 text-[11px] text-ink-3">{lane.hint}</p>
            </SectionCard>
          ))}
        </div>

        {/* What happened after: latest operational audit events */}
        {ops.recent ? (
          <SectionCard title={t("آخر الإجراءات التشغيلية", "Latest operational actions")} icon={<Activity size={14} aria-hidden />} className="xl:col-span-4" testId="ops-recent">
            {!ops.recent.ok ? (
              <SectionError label={t("تعذر تحميل آخر الإجراءات.", "Couldn't load recent actions.")} />
            ) : ops.recent.data.length ? (
              <ol className="relative space-y-3 ps-5 before:absolute before:inset-y-1 before:start-[5px] before:w-px before:bg-line">
                {ops.recent.data.map((event) => (
                  <li key={event.id} className="relative" data-testid="ops-recent-item">
                    <span className="absolute -start-5 top-1.5 h-2.5 w-2.5 rounded-full border-2 border-canvas bg-brand-ink" aria-hidden />
                    {event.entityType === "ORDER" && event.entityId ? (
                      <Link href={`/admin/orders/${event.entityId}`} className="text-sm leading-6 text-ink hover:text-brand-ink">{event.summary}</Link>
                    ) : (
                      <p className="text-sm leading-6 text-ink">{event.summary}</p>
                    )}
                    <p className="nums text-xs text-ink-3">
                      {event.actorName ?? (event.actorRole === "CUSTOMER" ? t("عميل", "Customer") : t("النظام", "System"))} · {formatDateTime(event.createdAt, lang)}
                    </p>
                  </li>
                ))}
              </ol>
            ) : (
              <EmptyLine>{t("ماكو إجراءات مسجّلة بعد.", "No actions recorded yet.")}</EmptyLine>
            )}
          </SectionCard>
        ) : null}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ single queue

function QueueView({ ops, lang, queue }: { ops: Operations; lang: Lang; queue: Exclude<OperationsQueue, "overview"> }) {
  const t = translator(lang);
  const failed = (label: string) => <SectionError label={label} />;
  const empty = (label: string) => <EmptyLine>{label}</EmptyLine>;
  const list = (children: ReactNode, testId: string) => <ul className="space-y-3" data-testid={testId}>{children}</ul>;

  if (queue === "payments" || queue === "orders") {
    const data = ops.unpaid?.ok ? ops.unpaid.data : null;

    if (queue === "payments") {
      return (
        <SectionCard title={t("التحقق من الدفع", "Payment verification")} icon={<FileCheck2 size={14} aria-hidden />} action={{ href: "/admin/orders?status=unpaid", label: t("كل الطلبات غير المدفوعة", "All unpaid orders") }} testId="ops-queue-payments">
          <p className="mb-3 text-xs text-ink-3">{t("طلبات رفع العميل إثبات تحويلها وتنتظر التحقق — الأقدم أولًا. التأكيد ينقل الطلب إلى «تم الدفع» عبر مسار حالات الطلب نفسه.", "Orders whose customer uploaded a transfer proof — oldest first. Confirming moves the order to Paid through the same order workflow.")}</p>
          {!data ? failed(t("تعذر تحميل بيانات إثباتات الدفع.", "Couldn't load payment proofs.")) : data.payments.length ? list(data.payments.map((item) => <PaymentCard key={item.id} item={item} lang={lang} />), "ops-payments") : empty(t("ماكو إثباتات دفع بانتظار التحقق.", "No payment proofs waiting."))}
        </SectionCard>
      );
    }

    return (
      <SectionCard title={t("طلبات بانتظار التواصل أو الدفع", "Orders awaiting contact or payment")} icon={<ShoppingBag size={14} aria-hidden />} action={{ href: "/admin/orders", label: t("صفحة الطلبات الكاملة", "Full orders page") }} testId="ops-queue-orders">
        <p className="mb-3 text-xs text-ink-3">{t("الطلبات اللي ما رفعت إثبات دفع بعد — الأقدم أولًا. كل تحديث يمر بقواعد حالات الطلب ويُسجَّل.", "Orders without a payment proof yet — oldest first. Every update follows the order rules and is logged.")}</p>
        {!data ? failed(t("تعذر تحميل الطلبات.", "Couldn't load orders.")) : data.orders.length ? list(data.orders.map((item) => <OrderRow key={item.id} item={item} lang={lang} />), "ops-orders") : empty(t("ماكو طلبات بانتظار التواصل أو الدفع.", "No orders awaiting contact or payment."))}
      </SectionCard>
    );
  }

  if (queue === "activations") {
    const data = ops.activations?.ok ? ops.activations.data : null;

    return (
      <SectionCard title={t("جاهزة للتفعيل", "Ready to activate")} icon={<PackageCheck size={14} aria-hidden />} action={{ href: "/admin/activations", label: t("صفحة التفعيل", "Activations page") }} testId="ops-queue-activations">
        {!data ? failed(t("تعذر تحميل طلبات التفعيل.", "Couldn't load activations.")) : data.length ? list(data.map((item) => <ActivationRow key={item.id} item={item} lang={lang} />), "ops-activations") : empty(t("ماكو طلبات مدفوعة بانتظار التفعيل.", "No paid orders waiting for activation."))}
      </SectionCard>
    );
  }

  if (queue === "renewals") {
    const data = ops.renewals?.ok ? ops.renewals.data : null;

    return (
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <SectionCard title={t("تنتهي قريبًا", "Ending soon")} icon={<RefreshCw size={14} aria-hidden />} action={{ href: "/admin/renewals", label: t("صفحة التجديدات", "Renewals page") }} testId="ops-queue-renewals">
          {!data ? failed(t("تعذر تحميل التجديدات.", "Couldn't load renewals.")) : data.ending.length ? list(data.ending.map((item) => <RenewalRow key={item.id} item={item} lang={lang} />), "ops-renewals-ending") : empty(t("ماكو اشتراكات تنتهي خلال 14 يوم.", "Nothing ends in the next 14 days."))}
        </SectionCard>
        <SectionCard title={t("انتهت مؤخرًا (آخر 30 يوم)", "Ended recently (last 30 days)")} icon={<RefreshCw size={14} aria-hidden />} action={{ href: "/admin/renewals?view=expired", label: t("الكل", "All") }} testId="ops-queue-renewals-ended">
          {!data ? failed(t("تعذر تحميل التجديدات.", "Couldn't load renewals.")) : data.ended.length ? list(data.ended.map((item) => <RenewalRow key={item.id} item={item} lang={lang} />), "ops-renewals-ended") : empty(t("ماكو اشتراكات انتهت مؤخرًا.", "Nothing ended recently."))}
        </SectionCard>
      </div>
    );
  }

  if (queue === "support") {
    const data = ops.support?.ok ? ops.support.data : null;

    return (
      <SectionCard title={t("التذاكر المفتوحة", "Open tickets")} icon={<MessagesSquare size={14} aria-hidden />} action={{ href: "/admin/support", label: t("صفحة الدعم", "Support page") }} testId="ops-queue-support">
        <p className="mb-3 text-xs text-ink-3">{t("اللي بانتظار ردنا أولًا، بعدين الأقدم.", "Waiting on us first, then oldest.")}</p>
        {!data ? failed(t("تعذر تحميل التذاكر.", "Couldn't load tickets.")) : data.length ? list(data.map((item) => <TicketRow key={item.id} item={item} lang={lang} statusLabel={TICKET_STATUS_LABELS[item.status]?.[lang] ?? item.status} />), "ops-tickets") : empty(t("ماكو تذاكر مفتوحة.", "No open tickets."))}
      </SectionCard>
    );
  }

  const data = ops.leads?.ok ? ops.leads.data : null;

  return (
    <SectionCard title={t("طلبات الحلول الرقمية المفتوحة", "Open digital leads")} icon={<Briefcase size={14} aria-hidden />} action={{ href: "/admin/leads", label: t("صفحة الطلبات الرقمية", "Leads page") }} testId="ops-queue-leads">
      {!data ? failed(t("تعذر تحميل الطلبات الرقمية.", "Couldn't load leads.")) : data.length ? list(data.map((item) => <LeadRow key={item.id} item={item} lang={lang} />), "ops-leads") : empty(t("ماكو طلبات جديدة أو قيد التواصل.", "No new or in-progress leads."))}
    </SectionCard>
  );
}
