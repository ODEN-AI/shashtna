"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { businessDay, parseBusinessDay } from "@/src/lib/business-time";
import { parseInstant } from "@/src/lib/finance";
import { db } from "@/src/prisma/db";
import { logActivity } from "@/src/server/activity";
import { generateReport } from "@/src/server/analyst";
import { assertStaff, getSessionUser } from "@/src/server/auth";
import { EXPENSE_CATEGORIES, parseSelection } from "@/src/server/finance";
import { getLang } from "@/src/server/i18n";

/**
 * Admin → Finance actions. Every action requires the "finance" permission
 * (owner / admin), validates on the server and is written to the audit log.
 */

export type FinanceState = { ok: boolean; message: string; code?: string } | null;

const MAX_AMOUNT = 10_000_000_000;

async function guard() {
  try {
    return await assertStaff("finance");
  } catch {
    // 401 vs 403: a missing/expired session is not a missing permission.
    throw new Error((await getSessionUser()) ? "FORBIDDEN" : "UNAUTHENTICATED");
  }
}

function fail(error: unknown, fallback: string): FinanceState {
  if (error instanceof Error && error.message === "UNAUTHENTICATED") {
    return { ok: false, code: "UNAUTHENTICATED", message: "انتهت جلسة تسجيل الدخول. يرجى تسجيل الدخول مرة أخرى." };
  }

  if (error instanceof Error && error.message === "FORBIDDEN") {
    return { ok: false, code: "FORBIDDEN", message: "ليس لديك صلاحية لتنفيذ هذا الإجراء." };
  }
  if (error instanceof Error && error.message.startsWith("INVALID:")) {
    return { ok: false, message: error.message.slice("INVALID:".length) };
  }

  console.error("FINANCE_ACTION_ERROR:", error);
  return { ok: false, message: fallback };
}

function readExpense(formData: FormData) {
  const amount = Number(String(formData.get("amount") ?? "").replace(/[,\s]/g, ""));
  const category = String(formData.get("category") ?? "");
  const day = String(formData.get("spentOn") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim().slice(0, 300);
  const reference = String(formData.get("reference") ?? "").trim().slice(0, 120) || null;
  const spentOn = parseBusinessDay(day);

  if (!Number.isInteger(amount) || amount <= 0 || amount > MAX_AMOUNT) throw new Error("INVALID:اكتب المبلغ كرقم صحيح بالدينار أكبر من صفر.");
  if (!(EXPENSE_CATEGORIES as readonly string[]).includes(category)) throw new Error("INVALID:اختر تصنيف المصروف.");
  if (!spentOn) throw new Error("INVALID:اختر تاريخ المصروف.");
  if (spentOn.getTime() > Date.now() + 24 * 60 * 60 * 1000) throw new Error("INVALID:تاريخ المصروف لا يمكن أن يكون بالمستقبل.");
  if (!description) throw new Error("INVALID:اكتب وصفًا مختصرًا للمصروف.");

  return { amount, category, spentOn: spentOn.toISOString(), description, reference };
}

function refresh() {
  revalidatePath("/admin/finance");
  revalidatePath("/admin/finance/expenses");
}

export async function createExpenseAction(_: FinanceState, formData: FormData): Promise<FinanceState> {
  try {
    const actor = await guard();
    const data = readExpense(formData);
    const created = await db.orm.public.Expense.create({ ...data, createdBy: actor.id });

    await logActivity({
      actor,
      entityType: "FINANCE",
      entityId: `expense:${created.id}`,
      action: "EXPENSE_CREATED",
      summary: `Expense recorded: ${data.amount} IQD (${data.category})`,
    });
    refresh();

    return { ok: true, message: "تم تسجيل المصروف." };
  } catch (error) {
    return fail(error, "تعذر تسجيل المصروف.");
  }
}

export async function updateExpenseAction(_: FinanceState, formData: FormData): Promise<FinanceState> {
  try {
    const actor = await guard();
    const id = Number(formData.get("id"));
    if (!Number.isInteger(id) || id <= 0) throw new Error("INVALID:المصروف غير موجود.");
    const existing = await db.orm.public.Expense.where({ id }).first();
    if (!existing) throw new Error("INVALID:المصروف غير موجود.");
    const data = readExpense(formData);

    await db.orm.public.Expense.where({ id }).update(data);
    await logActivity({
      actor,
      entityType: "FINANCE",
      entityId: `expense:${id}`,
      action: "EXPENSE_UPDATED",
      summary: `Expense updated: ${existing.amount} → ${data.amount} IQD (${data.category})`,
    });
    refresh();

    return { ok: true, message: "تم تعديل المصروف." };
  } catch (error) {
    return fail(error, "تعذر تعديل المصروف.");
  }
}

export async function deleteExpenseAction(_: FinanceState, formData: FormData): Promise<FinanceState> {
  try {
    const actor = await guard();
    const id = Number(formData.get("id"));
    if (!Number.isInteger(id) || id <= 0) throw new Error("INVALID:المصروف غير موجود.");
    const existing = await db.orm.public.Expense.where({ id }).first();
    if (!existing) throw new Error("INVALID:المصروف غير موجود.");

    await db.orm.public.Expense.where({ id }).delete();
    await logActivity({
      actor,
      entityType: "FINANCE",
      entityId: `expense:${id}`,
      action: "EXPENSE_DELETED",
      summary: `Expense deleted: ${existing.amount} IQD (${existing.category}, ${businessDay(parseInstant(String(existing.spentOn)) ?? new Date())})`,
    });
    refresh();

    return { ok: true, message: "تم حذف المصروف." };
  } catch (error) {
    return fail(error, "تعذر حذف المصروف.");
  }
}

export async function generateReportAction(_: FinanceState, formData: FormData): Promise<FinanceState> {
  let id: number;

  try {
    const actor = await guard();
    const selection = parseSelection({
      period: String(formData.get("period") ?? ""),
      from: String(formData.get("from") ?? "") || undefined,
      to: String(formData.get("to") ?? "") || undefined,
    });
    if (selection.period === "custom" && (!parseBusinessDay(selection.from ?? "") || !parseBusinessDay(selection.to ?? ""))) {
      throw new Error("INVALID:اختر تاريخ البداية والنهاية للفترة المخصصة.");
    }

    ({ id } = await generateReport(selection, actor, await getLang()));
    revalidatePath("/admin/finance");
    revalidatePath("/admin/finance/reports");
  } catch (error) {
    return fail(error, "تعذر إنشاء التقرير.");
  }

  redirect(`/admin/finance/reports/${id}`);
}
