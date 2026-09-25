import type { Metadata } from "next";

import { saveSettingsAction } from "@/app/admin/actions";
import { Forbidden } from "@/app/components/admin/Forbidden";
import { ActionForm } from "@/app/ui/ActionForm";
import { Badge } from "@/app/ui/Badge";
import { Card, CardHeader } from "@/app/ui/Card";
import { Field, Input, Textarea } from "@/app/ui/Field";
import { PageHeader } from "@/app/ui/Page";
import { SubmitButton } from "@/app/ui/SubmitButton";
import { requireStaffPage } from "@/src/server/auth";
import { getI18n } from "@/src/server/i18n";
import { SETTING_DEFINITIONS, SETTING_KEYS, getSettings } from "@/src/server/settings";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "الإعدادات" };

const GROUPS = [
  { key: "contact", ar: "قنوات التواصل", en: "Contact channels" },
  { key: "support", ar: "الدعم", en: "Support" },
  { key: "payment", ar: "الدفع", en: "Payment" },
  { key: "player", ar: "Shashtna Player", en: "Shashtna Player" },
  { key: "legal", ar: "الصفحات القانونية", en: "Legal pages" },
] as const;

export default async function SettingsPage() {
  const { allowed } = await requireStaffPage("/admin/settings", "settings");

  if (!allowed) {
    return <Forbidden />;
  }

  const [{ t, lang }, settings] = await Promise.all([getI18n(), getSettings()]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("الإعدادات", "Settings")}
        description={t(
          "القيم هنا تظهر مباشرة بالموقع (الأزرار، ساعات الدعم، صفحة الدفع، الصفحات القانونية). الحقل الفارغ يخفي العنصر المرتبط.",
          "These values appear directly on the site (buttons, support hours, payment page, legal pages). An empty field hides the related element.",
        )}
      />
      {GROUPS.map((group) => {
        const keys = SETTING_KEYS.filter((key) => SETTING_DEFINITIONS[key].group === group.key);

        return (
          <Card key={group.key} className="p-6">
            <CardHeader title={group[lang]} />
            <ActionForm action={saveSettingsAction} className="mt-5 space-y-5">
              {keys.map((key) => {
                const definition = SETTING_DEFINITIONS[key];
                const label = (
                  <span className="flex flex-wrap items-center gap-2">
                    {lang === "ar" ? definition.labelAr : definition.labelEn}
                    {group.key === "legal" ? (
                      settings.savedKeys.includes(key) && settings[key] ? (
                        <Badge tone="success">{t("منشور", "Published")}</Badge>
                      ) : (
                        <Badge tone="warning">{t("مسودة", "Draft")}</Badge>
                      )
                    ) : null}
                  </span>
                );

                return (
                  <Field key={key} label={label} htmlFor={key}>
                    {definition.multiline ? (
                      <Textarea id={key} name={key} rows={group.key === "legal" ? 10 : 4} defaultValue={settings[key]} />
                    ) : (
                      <Input id={key} name={key} defaultValue={settings[key]} dir={key.startsWith("contact.") || key.startsWith("player.") ? "ltr" : undefined} className={key.startsWith("contact.") || key.startsWith("player.") ? "text-start" : undefined} />
                    )}
                  </Field>
                );
              })}
              {group.key === "legal" ? (
                <p className="text-xs leading-6 text-ink-3">
                  {t(
                    "حفظ نص قانوني ينشره كنص نهائي ويخفي تنبيه «مسودة». تأكد من مراجعته قبل الحفظ.",
                    "Saving legal text publishes it as final and removes the “draft” notice. Make sure it has been reviewed first.",
                  )}
                </p>
              ) : null}
              <SubmitButton pendingLabel={t("جاري الحفظ...", "Saving...")}>{t("حفظ", "Save")}</SubmitButton>
            </ActionForm>
          </Card>
        );
      })}
    </div>
  );
}
