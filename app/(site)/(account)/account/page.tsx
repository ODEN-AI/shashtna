import type { Metadata } from "next";
import { Bell, KeyRound, ShieldCheck, UserRound } from "lucide-react";

import { changePasswordAction, updatePreferencesAction, updateProfileAction } from "@/app/(site)/(account)/actions";
import { SignOutButton } from "@/app/components/account/SignOutButton";
import { ActionForm } from "@/app/ui/ActionForm";
import { Card, CardHeader } from "@/app/ui/Card";
import { Checkbox, Field, Input, Select } from "@/app/ui/Field";
import { PageHeader } from "@/app/ui/Page";
import { SubmitButton } from "@/app/ui/SubmitButton";
import { formatDate } from "@/src/lib/i18n";
import { requireCustomer } from "@/src/server/auth";
import { getI18n } from "@/src/server/i18n";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "الحساب" };

export default async function AccountPage() {
  const user = await requireCustomer("/account");
  const { t, lang } = await getI18n();

  return (
    <div className="space-y-6">
      <PageHeader title={t("الحساب", "Account")} description={t("بياناتك، كلمة المرور، والتفضيلات.", "Your details, password and preferences.")} />

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="p-6">
          <CardHeader icon={<UserRound size={19} aria-hidden />} title={t("الملف الشخصي", "Profile")} />
          <ActionForm action={updateProfileAction} className="mt-5 space-y-5">
            <Field label={t("الاسم", "Name")} htmlFor="name" required>
              <Input id="name" name="name" defaultValue={user.name} required maxLength={120} autoComplete="name" />
            </Field>
            <Field label={t("رقم الهاتف", "Phone number")} htmlFor="phone" hint={t("رقم الهاتف هو اسم الدخول. لتغييره تواصل ويا الدعم.", "Your phone number is your sign-in. Contact support to change it.")}>
              <Input id="phone" value={user.phone} readOnly disabled dir="ltr" className="text-start" />
            </Field>
            <SubmitButton pendingLabel={t("جاري الحفظ...", "Saving...")}>{t("حفظ", "Save")}</SubmitButton>
          </ActionForm>
        </Card>

        <Card className="p-6">
          <CardHeader icon={<KeyRound size={19} aria-hidden />} title={t("كلمة المرور", "Password")} />
          <ActionForm action={changePasswordAction} resetOnSuccess className="mt-5 space-y-5">
            <Field label={t("كلمة المرور الحالية", "Current password")} htmlFor="currentPassword" required>
              <Input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" required />
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label={t("الجديدة", "New")} htmlFor="newPassword" required hint={t("6 أحرف على الأقل", "At least 6 characters")}>
                <Input id="newPassword" name="newPassword" type="password" autoComplete="new-password" minLength={6} required />
              </Field>
              <Field label={t("تأكيدها", "Confirm")} htmlFor="confirmPassword" required>
                <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" minLength={6} required />
              </Field>
            </div>
            <SubmitButton pendingLabel={t("جاري التغيير...", "Changing...")}>{t("تغيير كلمة المرور", "Change password")}</SubmitButton>
          </ActionForm>
        </Card>

        <Card className="p-6">
          <CardHeader
            icon={<Bell size={19} aria-hidden />}
            title={t("الإشعارات والتواصل", "Notifications & contact")}
            description={t("الإشعارات حاليًا داخل حسابك بالموقع.", "Notifications currently appear inside your account on the website.")}
          />
          <ActionForm action={updatePreferencesAction} className="mt-5 space-y-5">
            <Field label={t("طريقة التواصل المفضلة", "Preferred contact method")} htmlFor="preferredContact">
              <Select id="preferredContact" name="preferredContact" defaultValue={user.preferredContact ?? ""}>
                <option value="">{t("بدون تفضيل", "No preference")}</option>
                <option value="TELEGRAM">Telegram</option>
                <option value="WHATSAPP">WhatsApp</option>
                <option value="FACEBOOK">Facebook</option>
                <option value="PHONE">{t("اتصال هاتفي", "Phone call")}</option>
              </Select>
            </Field>
            <Checkbox
              name="renewalReminders"
              defaultChecked={user.renewalReminders}
              label={t("تذكيري داخل الحساب قبل انتهاء الاشتراك بـ7 أيام وعند انتهائه", "Remind me in my account 7 days before my subscription ends and when it ends")}
            />
            <Checkbox
              name="marketingOptIn"
              defaultChecked={user.marketingOptIn}
              label={t("أوافق على استلام عروض وتحديثات من شاشتنا", "I'd like to receive offers and updates from Shashtna")}
            />
            <SubmitButton variant="secondary" pendingLabel={t("جاري الحفظ...", "Saving...")}>{t("حفظ التفضيلات", "Save preferences")}</SubmitButton>
          </ActionForm>
        </Card>

        <Card className="p-6">
          <CardHeader icon={<ShieldCheck size={19} aria-hidden />} title={t("الأمان", "Security")} />
          <dl className="mt-5 space-y-3 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-ink-3">{t("تاريخ إنشاء الحساب", "Member since")}</dt>
              <dd className="nums font-semibold text-ink">{formatDate(user.createdAt, lang)}</dd>
            </div>
          </dl>
          <ul className="mt-5 space-y-2 text-sm leading-7 text-ink-2">
            <li>{t("• جلسة الدخول تبقى 30 يوم كحد أقصى.", "• A sign-in session lasts at most 30 days.")}</li>
            <li>{t("• فريق شاشتنا ما يطلب منك كلمة المرور أبدًا.", "• The Shashtna team will never ask for your password.")}</li>
          </ul>
          <div className="mt-6 border-t border-line pt-5">
            <SignOutButton label={t("تسجيل الخروج", "Sign out")} />
          </div>
        </Card>
      </div>
    </div>
  );
}
