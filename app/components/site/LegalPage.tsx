import { HelpHero } from "@/app/components/site/HelpHero";
import { Container } from "@/app/ui/Page";
import { Notice } from "@/app/ui/States";
import type { LegalDraft } from "@/src/content/legal";
import { getI18n } from "@/src/server/i18n";
import { getSettings, type SettingKey } from "@/src/server/settings";

export async function LegalPage({
  settingKey,
  titleAr,
  titleEn,
  draft,
}: {
  settingKey: SettingKey;
  titleAr: string;
  titleEn: string;
  draft: LegalDraft;
}) {
  const [{ t, lang }, settings] = await Promise.all([getI18n(), getSettings()]);
  const text = settings[settingKey].trim();
  const published = settings.savedKeys.includes(settingKey) && text.length > 0;

  return (
    <>
      <HelpHero eyebrow={t("شاشتنا", "Shashtna")} title={t(titleAr, titleEn)} />
      <Container className="max-w-3xl py-14">
        {published ? (
          <article className="surface rounded-panel p-6 sm:p-10">
            <div className="whitespace-pre-line text-[15px] leading-8 text-ink-2">{text}</div>
          </article>
        ) : (
          <>
            <Notice tone="warning" title={t("مسودة — لم تتم مراجعتها قانونيًا", "Draft — not legally reviewed")}>
              {t(
                "هذا ملخص لطريقة عمل الخدمة حاليًا، وليس النص القانوني النهائي. النص المعتمد راح يُنشر هنا من لوحة الإدارة.",
                "This is a summary of how the service works today, not the final legal text. The approved text will be published here from the admin console.",
              )}
            </Notice>
            <article className="surface mt-6 space-y-8 rounded-panel p-6 sm:p-10">
              {draft.map((section) => (
                <section key={section.heading.en}>
                  <h2 className="text-lg font-bold text-ink">{section.heading[lang]}</h2>
                  <p className="mt-2 text-[15px] leading-8 text-ink-2">{section.body[lang]}</p>
                </section>
              ))}
            </article>
          </>
        )}
      </Container>
    </>
  );
}
