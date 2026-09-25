import { UnauthorizedState } from "@/app/ui/States";
import { getI18n } from "@/src/server/i18n";

export async function Forbidden() {
  const { t } = await getI18n();

  return (
    <UnauthorizedState
      title={t("ما عندك صلاحية لهذا القسم", "You don't have access to this section")}
      description={t("تواصل ويا مالك الحساب إذا تحتاج هاي الصلاحية.", "Ask an owner if you need this permission.")}
    />
  );
}
