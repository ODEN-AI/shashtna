import type { Metadata } from "next";

import { saveSettingsAction } from "@/app/admin/actions";
import { Forbidden } from "@/app/components/admin/Forbidden";
import { ActionForm } from "@/app/ui/ActionForm";
import { Badge } from "@/app/ui/Badge";
import { Card, CardHeader } from "@/app/ui/Card";
import { Field, Input, Select, Textarea } from "@/app/ui/Field";
import { Notice } from "@/app/ui/States";
import { PageHeader } from "@/app/ui/Page";
import { SubmitButton } from "@/app/ui/SubmitButton";
import { requireStaffPage } from "@/src/server/auth";
import { getI18n } from "@/src/server/i18n";
import { formatPrice } from "@/src/lib/i18n";
import { db } from "@/src/prisma/db";
import { getLoyaltyRules, rewardOption } from "@/src/server/loyalty";
import { SETTING_DEFINITIONS, SETTING_KEYS, getSettings, type SettingKey } from "@/src/server/settings";

const LOYALTY_NUMBERS: SettingKey[] = [
  "loyalty.reward3mPoints",
  "loyalty.reward6mPoints",
  "loyalty.pendingDays",
  "loyalty.expiryMonths",
  "loyalty.cooldownDays",
  "loyalty.seedPoints",
];

/** Active IPTV lengths the owner can pick as a reward ("IPTV 4K — 3 أشهر (6,000 د.ع)"). */
async function iptvOptions() {
  const packages = await db.orm.public.Package.where({ isActive: true }).all();
  const iptv = packages.filter((pkg) => String(pkg.serviceType).toUpperCase() === "IPTV");
  const options = iptv.length ? await db.orm.public.PackageOption.where((option) => option.packageId.in(iptv.map((pkg) => pkg.id))).where({ isActive: true }).all() : [];
  const nameOf = new Map(iptv.map((pkg) => [pkg.id, pkg.name]));

  return options
    .filter((option) => option.durationMonths > 0)
    .sort((a, b) => a.packageId - b.packageId || a.durationMonths - b.durationMonths)
    .map((option) => ({ id: option.id, months: option.durationMonths, label: `${nameOf.get(option.packageId)} — ${option.durationLabel}`, price: option.price }));
}

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

  const [{ t, lang }, settings, loyaltyRules, rewardChoices] = await Promise.all([getI18n(), getSettings(), getLoyaltyRules(), iptvOptions()]);
  const [reward3m, reward6m] = await Promise.all([rewardOption(loyaltyRules, "3m"), rewardOption(loyaltyRules, "6m")]);

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
                      <Textarea key={`${key}:${settings[key]}`} id={key} name={key} rows={group.key === "legal" ? 10 : 4} defaultValue={settings[key]} />
                    ) : (
                      <Input key={`${key}:${settings[key]}`} id={key} name={key} defaultValue={settings[key]} dir={key.startsWith("contact.") || key.startsWith("player.") ? "ltr" : undefined} className={key.startsWith("contact.") || key.startsWith("player.") ? "text-start" : undefined} />
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

      <Card className="scroll-mt-24 p-6" as="section">
        <div id="loyalty" className="scroll-mt-24" />
        <CardHeader
          title={t("نقاط شاشتنا", "Shashtna Points")}
          description={t(
            "برنامج ولاء لتجديدات IPTV. أي تغيير يطبّق على النقاط الجاية فقط، وما يغيّر السجل القديم.",
            "IPTV renewal loyalty. Changes apply to future points only; past entries never change.",
          )}
        />
        {!reward3m || !reward6m ? (
          <Notice tone="warning" className="mt-4">
            {t("لازم تختار مدة IPTV فعّالة لكل مكافأة، وإلا الاستبدال يترفض.", "Pick an active IPTV length for each reward, or redemptions are refused.")}
          </Notice>
        ) : null}
        <ActionForm action={saveSettingsAction} className="mt-5 space-y-5">
          <Field label={lang === "ar" ? SETTING_DEFINITIONS["loyalty.enabled"].labelAr : SETTING_DEFINITIONS["loyalty.enabled"].labelEn} htmlFor="loyalty.enabled">
            <Select key={`loyalty.enabled:${settings["loyalty.enabled"]}`} id="loyalty.enabled" name="loyalty.enabled" defaultValue={settings["loyalty.enabled"] === "on" ? "on" : "off"}>
              <option value="off">{t("متوقف (مخفي عن العملاء)", "Off (hidden from customers)")}</option>
              <option value="on">{t("مفعّل", "On")}</option>
            </Select>
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            {LOYALTY_NUMBERS.map((key) => (
              <Field key={key} label={lang === "ar" ? SETTING_DEFINITIONS[key].labelAr : SETTING_DEFINITIONS[key].labelEn} htmlFor={key}>
                <Input key={`${key}:${settings[key]}`} id={key} name={key} inputMode="numeric" dir="ltr" defaultValue={settings[key]} className="text-start" />
              </Field>
            ))}
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            {(["loyalty.reward3mOptionId", "loyalty.reward6mOptionId"] as const).map((key) => (
              <Field key={key} label={lang === "ar" ? SETTING_DEFINITIONS[key].labelAr : SETTING_DEFINITIONS[key].labelEn} htmlFor={key}>
                <Select key={`${key}:${settings[key]}`} id={key} name={key} defaultValue={settings[key]}>
                  <option value="">{t("— اختر مدة —", "— choose a length —")}</option>
                  {rewardChoices.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label} ({formatPrice(option.price, lang)})
                    </option>
                  ))}
                </Select>
              </Field>
            ))}
          </div>
          <SubmitButton pendingLabel={t("جاري الحفظ...", "Saving...")}>{t("حفظ", "Save")}</SubmitButton>
        </ActionForm>
      </Card>

      <Card className="scroll-mt-24 p-6" as="section">
        <div id="automation" className="scroll-mt-24" />
        <CardHeader
          title={t("الأتمتة", "Automation")}
          description={t(
            "قائمة اليوم الصباحية (6:00 بتوقيت بغداد) تنحسب وتوصلك كإشعار. ما ينرسل أي شي للعملاء تلقائياً: رسائل الواتساب أنت ترسلها من صفحة «اليوم». التغيير للمالك فقط.",
            "The morning daily list (06:00 Baghdad) is counted and sent to you as a notification. Nothing reaches customers automatically: you send WhatsApp messages yourself from the Today page. Owner only.",
          )}
        />
        <ActionForm action={saveSettingsAction} className="mt-5 space-y-5">
          <div className="grid gap-5 sm:grid-cols-3">
            {(["automation.enabled", "automation.job.dailyDigest", "automation.dryRun"] as const).map((key) => (
              <Field key={key} label={lang === "ar" ? SETTING_DEFINITIONS[key].labelAr : SETTING_DEFINITIONS[key].labelEn} htmlFor={key}>
                <Select key={`${key}:${settings[key]}`} id={key} name={key} defaultValue={settings[key] === "on" ? "on" : "off"}>
                  <option value="off">{t("متوقف", "Off")}</option>
                  <option value="on">{t("مفعّل", "On")}</option>
                </Select>
              </Field>
            ))}
          </div>
          <Field label={lang === "ar" ? SETTING_DEFINITIONS["automation.quietHours"].labelAr : SETTING_DEFINITIONS["automation.quietHours"].labelEn} htmlFor="automation.quietHours">
            <Input key={`automation.quietHours:${settings["automation.quietHours"]}`} id="automation.quietHours" name="automation.quietHours" dir="ltr" defaultValue={settings["automation.quietHours"]} className="text-start" placeholder="22:00-09:00" />
          </Field>
          <SubmitButton pendingLabel={t("جاري الحفظ...", "Saving...")}>{t("حفظ", "Save")}</SubmitButton>
        </ActionForm>
      </Card>
    </div>
  );
}
