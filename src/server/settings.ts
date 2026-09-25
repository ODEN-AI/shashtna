import { cache } from "react";

import { db } from "@/src/prisma/db";

/**
 * Admin-editable site configuration and content.
 *
 * Defaults only contain facts already present in the codebase before the
 * redesign (the Telegram channel, the Facebook page, the support hours shown
 * on the old dashboard). Anything not known — WhatsApp number, phone number,
 * payment methods, final legal text — defaults to empty and is hidden or
 * clearly marked until an admin fills it in from Admin → Settings.
 */
export const SETTING_DEFINITIONS = {
  "contact.telegram": {
    group: "contact",
    labelAr: "رابط تيليجرام",
    labelEn: "Telegram link",
    default: "https://t.me/shashtna",
    multiline: false,
  },
  "contact.facebook": {
    group: "contact",
    labelAr: "رابط فيسبوك / ماسنجر",
    labelEn: "Facebook / Messenger link",
    default: "https://www.facebook.com/profile.php?id=61594341596034",
    multiline: false,
  },
  "contact.whatsapp": {
    group: "contact",
    labelAr: "رقم واتساب (بالصيغة الدولية، مثال 9647700000000)",
    labelEn: "WhatsApp number (international format, e.g. 9647700000000)",
    default: "",
    multiline: false,
  },
  "contact.phone": {
    group: "contact",
    labelAr: "رقم الهاتف للاتصال",
    labelEn: "Phone number",
    default: "",
    multiline: false,
  },
  "support.hours": {
    group: "support",
    labelAr: "ساعات الدعم",
    labelEn: "Support hours",
    default: "يوميًا من 10 صباحًا إلى 11 مساءً",
    multiline: false,
  },
  "support.hoursEn": {
    group: "support",
    labelAr: "ساعات الدعم (إنجليزي)",
    labelEn: "Support hours (English)",
    default: "Daily, 10 AM – 11 PM",
    multiline: false,
  },
  "payment.methods": {
    group: "payment",
    labelAr: "طرق الدفع المتاحة (سطر لكل طريقة)",
    labelEn: "Available payment methods (one per line)",
    default: "",
    multiline: true,
  },
  "payment.instructions": {
    group: "payment",
    labelAr: "تعليمات الدفع",
    labelEn: "Payment instructions",
    default: "",
    multiline: true,
  },
  "legal.terms": {
    group: "legal",
    labelAr: "نص الشروط والأحكام",
    labelEn: "Terms of service text",
    default: "",
    multiline: true,
  },
  "legal.privacy": {
    group: "legal",
    labelAr: "نص سياسة الخصوصية",
    labelEn: "Privacy policy text",
    default: "",
    multiline: true,
  },
  "legal.refund": {
    group: "legal",
    labelAr: "نص سياسة الاسترجاع",
    labelEn: "Refund policy text",
    default: "",
    multiline: true,
  },
  "player.downloadUrl": {
    group: "player",
    labelAr: "رابط تحميل Shashtna Player (اختياري — وإلا يُستخدم التطبيق من قائمة التطبيقات)",
    labelEn: "Shashtna Player download link (optional — otherwise taken from the apps list)",
    default: "",
    multiline: false,
  },
} as const;

export type SettingKey = keyof typeof SETTING_DEFINITIONS;

export const SETTING_KEYS = Object.keys(SETTING_DEFINITIONS) as SettingKey[];

export type SiteSettings = Record<SettingKey, string> & {
  /** Keys an admin has saved explicitly (legal pages use this to decide
   * whether to show the "draft" notice). */
  savedKeys: SettingKey[];
};

export const getSettings = cache(async (): Promise<SiteSettings> => {
  const values = Object.fromEntries(
    SETTING_KEYS.map((key) => [key, SETTING_DEFINITIONS[key].default]),
  ) as Record<SettingKey, string>;
  const savedKeys: SettingKey[] = [];

  try {
    const rows = await db.orm.public.SiteSetting.all();

    for (const row of rows) {
      if (row.key in SETTING_DEFINITIONS) {
        values[row.key as SettingKey] = row.value;
        savedKeys.push(row.key as SettingKey);
      }
    }
  } catch (error) {
    console.error("SETTINGS_READ_ERROR:", error);
  }

  return { ...values, savedKeys };
});

export async function saveSetting(key: SettingKey, value: string, updatedBy: number) {
  const trimmed = value.trim();
  const existing = await db.orm.public.SiteSetting.first({ key });

  if (existing) {
    await db.orm.public.SiteSetting.where({ key }).update({
      value: trimmed,
      updatedBy,
    });
  } else {
    await db.orm.public.SiteSetting.create({ key, value: trimmed, updatedBy });
  }
}

export function whatsappLink(number: string, text?: string) {
  const digits = number.replace(/\D/g, "");

  if (digits.length < 8) {
    return null;
  }

  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

export function telegramLink(base: string, text?: string) {
  if (!/^https:\/\/t\.me\//.test(base)) {
    return null;
  }

  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

export function safeExternalUrl(value: string) {
  return /^https:\/\//.test(value.trim()) ? value.trim() : null;
}

export function paymentMethodList(settings: SiteSettings) {
  return settings["payment.methods"]
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}
