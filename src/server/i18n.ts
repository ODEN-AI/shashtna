import { cookies } from "next/headers";

import {
  LANG_COOKIE,
  directionOf,
  normalizeLang,
  translator,
} from "@/src/lib/i18n";

export async function getLang() {
  return normalizeLang((await cookies()).get(LANG_COOKIE)?.value);
}

export async function getI18n() {
  const lang = await getLang();

  return {
    lang,
    t: translator(lang),
    dir: directionOf(lang),
    isAr: lang === "ar",
  };
}
