import type { Metadata } from "next";
import { BookOpenCheck } from "lucide-react";

import { savePlaybookAction } from "@/app/admin/playbook/actions";
import { Forbidden } from "@/app/components/admin/Forbidden";
import { ActionForm } from "@/app/ui/ActionForm";
import { Badge } from "@/app/ui/Badge";
import { Card, CardHeader } from "@/app/ui/Card";
import { Field, Input, Select, Textarea } from "@/app/ui/Field";
import { PageHeader } from "@/app/ui/Page";
import { EmptyState, Notice } from "@/app/ui/States";
import { SubmitButton } from "@/app/ui/SubmitButton";
import { PLAYBOOK_KIND_LABELS, PLAYBOOK_KINDS, PLAYBOOK_LIMITS, PLAYBOOK_SERVICE_LABELS, PLAYBOOK_SERVICES, type PlaybookKind, type PlaybookService } from "@/src/lib/playbook";
import { isFullAccess } from "@/src/lib/system";
import { requireStaffPage } from "@/src/server/auth";
import { getI18n } from "@/src/server/i18n";
import { listPlaybook, type PlaybookEntryView } from "@/src/server/playbook";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "دليل الحلول" };

/** One add/edit form; `entry` absent = a new entry. */
function EntryForm({ entry, lang, t }: { entry?: PlaybookEntryView; lang: "ar" | "en"; t: (ar: string, en: string) => string }) {
  const key = entry ? `e${entry.id}` : "new";

  return (
    <ActionForm action={savePlaybookAction} resetOnSuccess={!entry} className="space-y-4">
      {entry ? <input type="hidden" name="id" value={entry.id} /> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("النوع", "Kind")} htmlFor={`${key}-kind`}>
          <Select id={`${key}-kind`} name="kind" defaultValue={entry?.kind ?? "PROBLEM"}>
            {PLAYBOOK_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {PLAYBOOK_KIND_LABELS[kind][lang]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("الخدمة", "Service")} htmlFor={`${key}-service`}>
          <Select id={`${key}-service`} name="service" defaultValue={entry?.service ?? "ALL"}>
            {PLAYBOOK_SERVICES.map((service) => (
              <option key={service} value={service}>
                {PLAYBOOK_SERVICE_LABELS[service][lang]}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label={t("المشكلة أو السؤال", "Problem or question")} htmlFor={`${key}-title`} hint={t("اكتبها بكلماتك، مثلاً: القنوات تقطّع بالليل. المساعد يفهمها حتى لو الزبون شرحها بطريقة ثانية.", "In your own words, e.g. Channels freeze at night. The assistant recognises it however a customer describes it.")}>
        <Input id={`${key}-title`} name="title" maxLength={PLAYBOOK_LIMITS.title} defaultValue={entry?.title ?? ""} dir="auto" required />
      </Field>
      <Field label={t("طرق ثانية يوصفها الزبائن (اختياري)", "Other ways customers say it (optional)")} htmlFor={`${key}-keywords`} hint={t("مو ضروري. إذا عندك أمثلة من رسائل الزبائن، تساعد المساعد: يعلك، يدور ويوكف", "Not needed. Real examples from customer messages help the assistant: stuck, keeps loading")}>
        <Input id={`${key}-keywords`} name="keywords" maxLength={PLAYBOOK_LIMITS.keywords} defaultValue={entry?.keywords ?? ""} dir="auto" />
      </Field>
      <Field label={t("الحل أو الجواب", "Fix or answer")} htmlFor={`${key}-content`} hint={t("اشرح الحل بالخطوات، وإذا تعرف السبب اكتبه. المساعد يشرحها للزبون بأسلوب بسيط.", "Explain the fix step by step, and the cause if you know it. The assistant explains it to the customer simply.")}>
        <Textarea id={`${key}-content`} name="content" rows={entry ? 5 : 6} maxLength={PLAYBOOK_LIMITS.content} defaultValue={entry?.content ?? ""} dir="auto" required />
      </Field>
      <div className="flex flex-wrap items-end gap-4">
        <Field label={t("الترتيب", "Order")} htmlFor={`${key}-sort`} className="w-28">
          <Input id={`${key}-sort`} name="sortOrder" inputMode="numeric" defaultValue={String(entry?.sortOrder ?? 0)} className="nums" dir="ltr" />
        </Field>
        <Field label={t("الحالة", "Status")} htmlFor={`${key}-active`} className="min-w-36">
          <Select id={`${key}-active`} name="isActive" defaultValue={entry && !entry.isActive ? "off" : "on"}>
            <option value="on">{t("مفعّل", "On")}</option>
            <option value="off">{t("متوقف", "Off")}</option>
          </Select>
        </Field>
        <SubmitButton pendingLabel={t("جاري الحفظ...", "Saving...")}>{entry ? t("حفظ", "Save") : t("أضف للدليل", "Add to playbook")}</SubmitButton>
      </div>
    </ActionForm>
  );
}

/**
 * Admin → Playbook («دليل الحلول»): everything the AI customer agent may tell
 * customers — problems and fixes, answers, payment steps, policies, devices.
 * Support can read it; only the owner/admin can edit (audited). See docs/playbook.md.
 */
export default async function PlaybookPage() {
  const { user, allowed } = await requireStaffPage("/admin/playbook", "support");

  if (!allowed) {
    return <Forbidden />;
  }

  const [{ t, lang }, entries] = await Promise.all([getI18n(), listPlaybook()]);
  const canEdit = isFullAccess(user.role);
  const active = entries.filter((entry) => entry.isActive).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("دليل الحلول", "Playbook")}
        description={t(
          "علّم المساعد مشاكل شغلك وحلولها، وأجوبة الأسئلة، وطريقة الدفع، والقواعد، والأجهزة. اكتب كل مشكلة مرة وحدة بكلماتك: المساعد يقرا الدليل كله ويفهم رسالة الزبون، فيربطها بالمشكلة الصحيحة حتى لو شرحها بأسلوب مختلف. المساعد يجاوب من هذا الدليل بس.",
          "Teach the assistant your problems and fixes, answers, how to pay, rules and devices. Write each problem once, in your own words: the assistant reads the whole playbook and understands the customer's message, so it links it to the right problem however it's described. It answers from this playbook only.",
        )}
      />

      <p className="nums text-sm text-ink-3">{t(`${active} مفعّل من ${entries.length}`, `${active} active of ${entries.length}`)}</p>

      {canEdit ? (
        <Card className="p-5 sm:p-6" as="section">
          <CardHeader title={t("إضافة جديدة", "New entry")} />
          <div className="mt-5">
            <EntryForm lang={lang} t={t} />
          </div>
        </Card>
      ) : (
        <Notice tone="info">{t("الدليل يعدّله المالك. تكدر تقراه حتى تعرف شنو يجاوب المساعد.", "The owner edits the playbook. You can read it to see what the assistant answers.")}</Notice>
      )}

      {!entries.length ? (
        <EmptyState icon={<BookOpenCheck />} title={t("الدليل فارغ", "The playbook is empty")} description={t("أضف أول مشكلة وحلها حتى يبدأ المساعد يستخدمها.", "Add the first problem and fix so the assistant can start using it.")} />
      ) : (
        PLAYBOOK_KINDS.map((kind: PlaybookKind) => {
          const group = entries.filter((entry) => entry.kind === kind);

          if (!group.length) return null;

          return (
            <section key={kind} className="space-y-3">
              <h2 className="text-lg font-bold text-ink">{PLAYBOOK_KIND_LABELS[kind][lang]}</h2>
              {group.map((entry) => (
                <Card key={entry.id} className="p-0" as="article">
                  <details className="group">
                    <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 p-4 sm:p-5">
                      <span className="min-w-0 flex-1 font-semibold text-ink" dir="auto">
                        {entry.title}
                      </span>
                      <Badge>{PLAYBOOK_SERVICE_LABELS[entry.service as PlaybookService]?.[lang] ?? entry.service}</Badge>
                      {!entry.isActive ? <Badge tone="warning">{t("متوقف", "Off")}</Badge> : null}
                    </summary>
                    <div className="border-t border-line p-4 sm:p-5">
                      {canEdit ? (
                        <EntryForm entry={entry} lang={lang} t={t} />
                      ) : (
                        <div className="space-y-2 text-sm">
                          {entry.keywords ? <p className="text-ink-3" dir="auto">{entry.keywords}</p> : null}
                          <p className="whitespace-pre-wrap leading-7 text-ink-2" dir="auto">
                            {entry.content}
                          </p>
                        </div>
                      )}
                    </div>
                  </details>
                </Card>
              ))}
            </section>
          );
        })
      )}
    </div>
  );
}
