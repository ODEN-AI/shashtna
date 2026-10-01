import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Pencil, Plus, Receipt, Trash2 } from "lucide-react";

import { createExpenseAction, deleteExpenseAction, updateExpenseAction } from "@/app/admin/finance/actions";
import { GlassTile, PeriodControl, TileLabel, expenseCategoryLabel, money, periodLabel } from "@/app/components/admin/finance/FinanceUI";
import { Forbidden } from "@/app/components/admin/Forbidden";
import { ActionForm } from "@/app/ui/ActionForm";
import { cn } from "@/app/ui/cn";
import { Field, Input, Select } from "@/app/ui/Field";
import { EmptyState } from "@/app/ui/States";
import { SubmitButton } from "@/app/ui/SubmitButton";
import { businessDay, resolveRange } from "@/src/lib/business-time";
import { parseInstant } from "@/src/lib/finance";
import type { Lang } from "@/src/lib/i18n";
import { requireStaffPage } from "@/src/server/auth";
import { EXPENSE_CATEGORIES, listExpenses, parseSelection } from "@/src/server/finance";
import { getI18n } from "@/src/server/i18n";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "المصاريف" };

type ExpenseRow = Awaited<ReturnType<typeof listExpenses>>[number];

function ExpenseFields({ lang, expense, idPrefix }: { lang: Lang; expense?: ExpenseRow; idPrefix: string }) {
  const t = (ar: string, en: string) => (lang === "ar" ? ar : en);
  const day = expense ? businessDay(parseInstant(expense.spentOn) ?? new Date()) : businessDay(new Date());

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label={t("المبلغ (د.ع)", "Amount (IQD)")} htmlFor={`${idPrefix}-amount`} required>
        <Input id={`${idPrefix}-amount`} name="amount" inputMode="numeric" pattern="[0-9,]*" required defaultValue={expense?.amount} placeholder="25000" className="nums" />
      </Field>
      <Field label={t("التصنيف", "Category")} htmlFor={`${idPrefix}-category`} required>
        <Select id={`${idPrefix}-category`} name="category" required defaultValue={expense?.category ?? ""}>
          <option value="" disabled>{t("اختر…", "Choose…")}</option>
          {EXPENSE_CATEGORIES.map((category) => (
            <option key={category} value={category}>{expenseCategoryLabel(category, lang)}</option>
          ))}
        </Select>
      </Field>
      <Field label={t("التاريخ", "Date")} htmlFor={`${idPrefix}-date`} required>
        <Input id={`${idPrefix}-date`} name="spentOn" type="date" required defaultValue={day} className="nums" />
      </Field>
      <Field label={t("مرجع (اختياري)", "Reference (optional)")} htmlFor={`${idPrefix}-reference`} hint={t("رقم فاتورة أو اسم المزوّد", "Invoice number or vendor")}>
        <Input id={`${idPrefix}-reference`} name="reference" maxLength={120} defaultValue={expense?.reference ?? ""} />
      </Field>
      <Field label={t("الوصف", "Description")} htmlFor={`${idPrefix}-description`} required className="sm:col-span-2">
        <Input id={`${idPrefix}-description`} name="description" required maxLength={300} defaultValue={expense?.description} placeholder={t("مثال: تجديد استضافة الموقع لشهر", "e.g. Website hosting, one month")} />
      </Field>
    </div>
  );
}

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<{ period?: string; from?: string; to?: string; category?: string }> }) {
  const { allowed } = await requireStaffPage("/admin/finance/expenses", "finance");

  if (!allowed) {
    return <Forbidden />;
  }

  const [{ t, lang }, params] = await Promise.all([getI18n(), searchParams]);
  const selection = parseSelection(params);
  const category = (EXPENSE_CATEGORIES as readonly string[]).includes(params.category ?? "") ? params.category! : "";
  const { current } = resolveRange(selection.period, new Date(), { from: selection.from, to: selection.to });
  const from = businessDay(current.start);
  const to = businessDay(new Date(current.end.getTime() - 1));
  const [inPeriod, allTime] = await Promise.all([listExpenses({ range: current }), listExpenses({})]);
  const rows = category ? inPeriod.filter((row) => row.category === category) : inPeriod;
  const total = rows.reduce((sum, row) => sum + row.amount, 0);
  const periodTotal = inPeriod.reduce((sum, row) => sum + row.amount, 0);
  const byCategory = EXPENSE_CATEGORIES.map((key) => ({ key, amount: inPeriod.filter((row) => row.category === key).reduce((sum, row) => sum + row.amount, 0) }))
    .filter((item) => item.amount > 0)
    .sort((a, b) => b.amount - a.amount);
  const base = { period: selection.period, ...(selection.period === "custom" ? { from, to } : {}) };
  const href = (extra: Record<string, string>) => `/admin/finance/expenses?${new URLSearchParams({ ...base, ...extra }).toString()}`;

  return (
    <div className="space-y-6" data-testid="expenses-page">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Link href="/admin/finance" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-ink hover:text-ink">
            <ArrowRight size={14} className="ltr:rotate-180" aria-hidden /> {t("المالية والأداء", "Finance & performance")}
          </Link>
          <h1 className="mt-2 text-h1 font-bold text-ink">{t("المصاريف", "Expenses")}</h1>
          <p className="mt-1 text-sm text-ink-3">{t("المصاريف المسجلة هنا تُطرح من الإيرادات لحساب صافي الربح.", "Expenses recorded here are subtracted from revenue to calculate net profit.")}</p>
        </div>
      </header>

      <PeriodControl basePath="/admin/finance/expenses" period={selection.period} from={from} to={to} lang={lang} keep={category ? { category } : {}} />

      <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
        <GlassTile testId="expenses-total">
          <TileLabel icon={<Receipt size={14} aria-hidden />}>{t("إجمالي المصاريف", "Total expenses")} · {periodLabel(selection.period, lang)}</TileLabel>
          <p className="nums mt-3 text-[2.4rem] font-extrabold leading-none text-ink" data-testid="expenses-period-total">{money(periodTotal, lang)}</p>
          <p className="nums mt-2 text-xs text-ink-3">{from} → {to} · {inPeriod.length} {t("مصروف", "entries")}</p>
          {byCategory.length ? (
            <ul className="mt-5 space-y-2.5">
              {byCategory.map((item) => (
                <li key={item.key}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-ink-2">{expenseCategoryLabel(item.key, lang)}</span>
                    <span className="nums font-semibold text-ink">{money(item.amount, lang)}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/6">
                    <div className="h-full rounded-full bg-viz-expenses" style={{ width: `${(item.amount / periodTotal) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </GlassTile>

        <GlassTile testId="expense-create">
          <TileLabel icon={<Plus size={14} aria-hidden />}>{t("تسجيل مصروف", "Record an expense")}</TileLabel>
          <ActionForm action={createExpenseAction} resetOnSuccess className="mt-4 space-y-4">
            <ExpenseFields lang={lang} idPrefix="new" />
            <SubmitButton>{t("حفظ المصروف", "Save expense")}</SubmitButton>
          </ActionForm>
        </GlassTile>
      </div>

      <section aria-labelledby="expense-list" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="expense-list" className="text-lg font-bold text-ink">
            {t("السجل", "Ledger")} <span className="nums text-sm font-semibold text-ink-3">· {money(total, lang)}</span>
          </h2>
          <nav aria-label={t("تصفية حسب التصنيف", "Filter by category")} className="flex flex-wrap gap-1.5" data-testid="expense-category-filter">
            <Link href={href({})} aria-current={!category ? "page" : undefined} className={cn("rounded-full px-3 py-1.5 text-xs font-semibold", !category ? "bg-white text-navy" : "bg-surface-2 text-ink-2 hover:text-ink")}>
              {t("الكل", "All")}
            </Link>
            {EXPENSE_CATEGORIES.map((key) => (
              <Link key={key} href={href({ category: key })} aria-current={category === key ? "page" : undefined} className={cn("rounded-full px-3 py-1.5 text-xs font-semibold", category === key ? "bg-white text-navy" : "bg-surface-2 text-ink-2 hover:text-ink")}>
                {expenseCategoryLabel(key, lang)}
              </Link>
            ))}
          </nav>
        </div>

        {rows.length ? (
          <ul className="space-y-2">
            {rows.map((row) => (
              <li key={row.id} className="rounded-2xl border border-line bg-surface/70 p-4" data-testid="expense-row">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <span className="nums w-24 shrink-0 text-sm text-ink-3">{businessDay(parseInstant(row.spentOn) ?? new Date())}</span>
                  <span className="rounded-md bg-viz-expenses/15 px-2 py-0.5 text-xs font-semibold text-[#f0b98a]">{expenseCategoryLabel(row.category, lang)}</span>
                  <span className="min-w-0 flex-1 truncate text-sm text-ink">
                    {row.description}
                    {row.reference ? <span className="ms-2 text-xs text-ink-3">#{row.reference}</span> : null}
                  </span>
                  <span className="nums text-base font-bold text-ink">{money(row.amount, lang)}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <details className="group w-full sm:w-auto sm:flex-1">
                    <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-brand-ink hover:text-ink">
                      <Pencil size={12} aria-hidden /> {t("تعديل", "Edit")}
                    </summary>
                    <ActionForm action={updateExpenseAction} className="mt-3 space-y-4 rounded-xl border border-line p-4">
                      <input type="hidden" name="id" value={row.id} />
                      <ExpenseFields lang={lang} expense={row} idPrefix={`edit-${row.id}`} />
                      <SubmitButton size="sm">{t("حفظ التعديل", "Save changes")}</SubmitButton>
                    </ActionForm>
                  </details>
                  <details>
                    <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-danger hover:opacity-80">
                      <Trash2 size={12} aria-hidden /> {t("حذف", "Delete")}
                    </summary>
                    <ActionForm action={deleteExpenseAction} className="mt-2 flex items-center gap-2">
                      <input type="hidden" name="id" value={row.id} />
                      <span className="text-xs text-ink-2">{t("متأكد؟", "Are you sure?")}</span>
                      <SubmitButton size="sm" variant="danger">{t("تأكيد الحذف", "Confirm delete")}</SubmitButton>
                    </ActionForm>
                  </details>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title={allTime.length ? t("ماكو مصاريف بهذه الفترة", "No expenses in this period") : t("ما مسجل أي مصروف بعد", "No expenses recorded yet")}
            description={allTime.length ? undefined : t("بدون مصاريف مسجلة، صافي الربح يظهر «بيانات غير مكتملة».", "Until expenses are recorded, net profit shows as “data incomplete”.")}
          />
        )}
      </section>
    </div>
  );
}
