"use client";

import { Loader2, Plus, Power, Save, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";

import { adminFetch } from "@/app/components/admin/adminFetch";
import { ImageUploadField } from "@/app/components/admin/ImageUploadField";
import { useLanguage } from "@/app/components/LanguageProvider";
import { Button } from "@/app/ui/Button";
import { cn } from "@/app/ui/cn";
import { Dialog } from "@/app/ui/Dialog";
import { Checkbox, Field, Input, Select, Textarea } from "@/app/ui/Field";
import { useToast } from "@/app/ui/Toast";
import { centsToDollars, dollarsToCents } from "@/src/lib/costs";
import { formatPrice } from "@/src/lib/i18n";
import { durationValue, formatDuration, monthlyPrice, parseDuration, type DurationUnit } from "@/src/lib/subscription-duration";

/**
 * Catalogue editors. Every write goes through the existing catalogue APIs
 * (/api/admin/packages, /api/admin/devices), which validate on the server,
 * enforce the permission and write the audit log; these forms only collect
 * values and show the server's answer.
 */

type Option = { id: number; name: string; isActive: boolean };

async function send(url: string, method: string, body: unknown) {
  const response = await adminFetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json().catch(() => ({}));

  return { ok: response.ok && data.success !== false, status: response.status, data };
}

/** Digits are sent as a number; anything else is sent as typed so the server rejects it (no silent coercion). */
function priceValue(raw: FormDataEntryValue | null) {
  const text = String(raw ?? "").trim();

  return /^\d+$/.test(text) ? Number(text) : text;
}

function text(form: FormData, key: string) {
  return String(form.get(key) ?? "").trim();
}

function Group({ title, children, testId }: { title: string; children: ReactNode; testId?: string }) {
  return (
    <fieldset className="space-y-4 rounded-2xl border border-line/70 bg-white/[0.02] p-4 sm:p-5" data-testid={testId}>
      <legend className="px-1 text-xs font-bold uppercase tracking-[0.14em] text-brand-ink">{title}</legend>
      {children}
    </fieldset>
  );
}

function CompatibilityChecklist({ name, options, selected, empty }: { name: string; options: Option[]; selected: number[]; empty: string }) {
  const { t } = useLanguage();

  if (!options.length) return <p className="rounded-xl bg-white/[0.03] px-3 py-4 text-center text-sm text-ink-3">{empty}</p>;

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {options.map((option) => (
        <Checkbox
          key={option.id}
          name={name}
          value={option.id}
          defaultChecked={selected.includes(option.id)}
          className="rounded-xl border border-line bg-surface-2 px-3 py-2.5"
          label={
            <span className="flex flex-wrap items-center gap-2">
              {option.name}
              {option.isActive ? null : <span className="text-xs text-ink-3">({t("موقوف", "inactive")})</span>}
            </span>
          }
        />
      ))}
    </div>
  );
}

function FormFooter({ busy, error, label }: { busy: boolean; error: string; label: string }) {
  return (
    <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface/95 p-3 backdrop-blur md:bottom-4">
      <p className={cn("min-w-0 flex-1 text-sm", error ? "font-semibold text-danger" : "text-ink-3")} role={error ? "alert" : undefined} data-testid="catalogue-form-error">
        {error}
      </p>
      <Button type="submit" disabled={busy} data-testid="catalogue-save">
        {busy ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Save size={16} aria-hidden />}
        {label}
      </Button>
    </div>
  );
}

// ------------------------------------------------------------------ packages

/** One length the package is sold in, as the form edits it (text fields hold what the admin typed). */
export type PackageOptionValues = {
  id?: number;
  durationMonths: number;
  durationUnit: DurationUnit;
  durationLabel: string;
  price: number | "";
  renewalPrice: number | null;
  /** Loyalty points an order of this length earns; null = price ÷ 1,000. */
  pointsEarned?: number | null;
  /** Panel credit in US cents to activate this length; null = unknown. */
  creditCostCents?: number | null;
  isActive: boolean;
};

export type PackageFormValues = {
  id?: number;
  name: string;
  slug: string;
  serviceType: "IPTV" | "VIP";
  /** Every length with its own price; VIP packages have exactly one (3 months). */
  options: PackageOptionValues[];
  description: string;
  specifications: string;
  notes: string | null;
  imageUrl: string | null;
  isActive: boolean;
  deviceIds: number[];
};

/** A stored label that is just the generated text is shown as empty, so changing the duration regenerates it. */
function customLabel(label: string, months: number) {
  const generated = [formatDuration(months, "ar"), formatDuration(months, "en"), `${months} Months`, months === 12 ? "1 Year" : ""];
  return generated.includes(label.trim()) ? "" : label;
}

/** An option row as typed in the form (strings until the server validates them). */
type OptionRow = { key: string; id?: number; amount: string; unit: DurationUnit; label: string; price: string; renewal: string; points: string; credit: string; isActive: boolean };

let rowSeed = 0;

function optionRow(option: PackageOptionValues): OptionRow {
  const length = durationValue(option.durationMonths, option.durationUnit);

  return {
    key: option.id !== undefined ? `id-${option.id}` : `new-${(rowSeed += 1)}`,
    id: option.id,
    amount: String(length.value),
    unit: length.unit,
    label: customLabel(option.durationLabel, option.durationMonths),
    price: String(option.price),
    renewal: option.renewalPrice === null ? "" : String(option.renewalPrice),
    points: typeof option.pointsEarned === "number" ? String(option.pointsEarned) : "",
    credit: typeof option.creditCostCents === "number" ? centsToDollars(option.creditCostCents) : "",
    isActive: option.isActive,
  };
}

function blankOption(serviceType: "IPTV" | "VIP"): PackageOptionValues {
  return serviceType === "VIP"
    ? { durationMonths: 3, durationUnit: "MONTH", durationLabel: "", price: "", renewalPrice: null, isActive: true }
    : { durationMonths: 1, durationUnit: "YEAR", durationLabel: "", price: "", renewalPrice: null, isActive: true };
}

const MAX_ROWS = 12;

/**
 * The lengths a package is sold in, each with its own price, renewal price
 * and on/off switch. Add, edit or remove rows; nothing is saved until the
 * package form is. A removed length that past orders used is kept inactive
 * by the server so their history stays linked.
 */
function OptionsEditor({ vip, rows, setRows }: { vip: boolean; rows: OptionRow[]; setRows: (update: (rows: OptionRow[]) => OptionRow[]) => void }) {
  const { t, language } = useLanguage();
  const update = (key: string, patch: Partial<OptionRow>) => setRows((list) => list.map((row) => (row.key === key ? { ...row, ...patch } : row)));

  return (
    <div className="space-y-3" data-testid="package-options">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-ink">{t("المدد والأسعار", "Lengths and prices")}</p>
          <p className="text-xs leading-5 text-ink-3">
            {vip
              ? t("باقات VIP مدتها 3 أشهر دائمًا، والتجديد كذلك 3 أشهر.", "VIP packages always run 3 months, and so do VIP renewals.")
              : t("كل مدة بسعرها. العميل يختار المدة قبل الدفع، والطلبات السابقة تحتفظ بمدتها وسعرها.", "Each length has its own price. Customers pick one before paying; past orders keep theirs.")}
          </p>
        </div>
        {vip ? null : (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={rows.length >= MAX_ROWS}
            onClick={() => setRows((list) => [...list, optionRow({ ...blankOption("IPTV"), durationMonths: 1, durationUnit: "MONTH" })])}
            data-testid="package-option-add"
          >
            <Plus size={15} aria-hidden />
            {t("إضافة مدة", "Add a length")}
          </Button>
        )}
      </div>

      <ol className="space-y-3">
        {rows.map((row, index) => {
          const amount = /^\d+$/.test(row.amount.trim()) ? Number(row.amount.trim()) : row.amount;
          const preview = vip ? ({ ok: true, months: 3 } as const) : parseDuration(amount, row.unit);
          const price = /^\d+$/.test(row.price.trim()) ? Number(row.price.trim()) : null;
          const id = `opt-${row.key}`;
          const creditField = (
            <Field label={t("كلفة الرصيد ($)", "Panel credit ($)")} htmlFor={`${id}-credit`} hint={t("فارغ = غير معروفة.", "Empty = unknown.")}>
              <Input id={`${id}-credit`} inputMode="decimal" dir="ltr" value={row.credit} onChange={(event) => update(row.key, { credit: event.target.value })} placeholder="1" data-testid="package-option-credit" />
            </Field>
          );

          return (
            <li key={row.key} className={cn("rounded-2xl border bg-surface-2 p-3 sm:p-4", row.isActive ? "border-line" : "border-dashed border-line opacity-80")} data-testid="package-option" data-option-id={row.id ?? ""}>
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)]">
                {vip ? (
                  <Field label={t("المدة", "Length")} htmlFor={`${id}-length`}>
                    <Input id={`${id}-length`} value={t("3 أشهر", "3 months")} readOnly aria-readonly />
                  </Field>
                ) : (
                  <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2">
                    <Field label={t(`المدة ${index + 1}`, `Length ${index + 1}`)} htmlFor={`${id}-amount`} required>
                      <Input id={`${id}-amount`} inputMode="numeric" dir="ltr" value={row.amount} onChange={(event) => update(row.key, { amount: event.target.value })} data-testid="package-option-duration" />
                    </Field>
                    <Field label={t("الوحدة", "Unit")} htmlFor={`${id}-unit`}>
                      <Select id={`${id}-unit`} value={row.unit} onChange={(event) => update(row.key, { unit: event.target.value === "YEAR" ? "YEAR" : "MONTH" })} data-testid="package-option-unit">
                        <option value="MONTH">{t("أشهر", "Months")}</option>
                        <option value="YEAR">{t("سنوات", "Years")}</option>
                      </Select>
                    </Field>
                  </div>
                )}
                <Field label={t("السعر (د.ع)", "Price (IQD)")} htmlFor={`${id}-price`} required>
                  <Input id={`${id}-price`} inputMode="numeric" dir="ltr" value={row.price} onChange={(event) => update(row.key, { price: event.target.value })} data-testid="package-option-price" />
                </Field>
                <Field label={t("سعر التجديد (د.ع)", "Renewal price (IQD)")} htmlFor={`${id}-renewal`} hint={t("فارغ = نفس السعر.", "Empty = same price.")}>
                  <Input id={`${id}-renewal`} inputMode="numeric" dir="ltr" value={row.renewal} onChange={(event) => update(row.key, { renewal: event.target.value })} data-testid="package-option-renewal" />
                </Field>
              </div>

              {vip ? null : (
                <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
                  <Field label={t("تسمية المدة (اختياري)", "Length label (optional)")} htmlFor={`${id}-label`}>
                    <Input id={`${id}-label`} value={row.label} onChange={(event) => update(row.key, { label: event.target.value })} placeholder={preview.ok ? formatDuration(preview.months, "ar") : ""} maxLength={40} />
                  </Field>
                  <Field
                    label={t("نقاط الطلب", "Order points")}
                    htmlFor={`${id}-points`}
                    hint={t(`فارغ = تلقائي (${price !== null ? Math.floor(price / 1000) : "السعر ÷ 1000"}).`, `Empty = automatic (${price !== null ? Math.floor(price / 1000) : "price ÷ 1000"}).`)}
                  >
                    <Input id={`${id}-points`} inputMode="numeric" dir="ltr" value={row.points} onChange={(event) => update(row.key, { points: event.target.value })} data-testid="package-option-points" />
                  </Field>
                  {creditField}
                </div>
              )}
              {vip ? <div className="mt-3 grid gap-3 sm:grid-cols-3">{creditField}</div> : null}

              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <p className={cn("text-sm", preview.ok ? "text-ink-2" : "font-semibold text-danger")} aria-live="polite" data-testid="package-option-preview">
                  {preview.ok
                    ? t(
                        `${formatDuration(preview.months, "ar")}${price !== null ? ` بسعر ${formatPrice(price, language)} — حوالي ${formatPrice(monthlyPrice(price, preview.months), language)} شهريًا` : ""}`,
                        `${formatDuration(preview.months, "en")}${price !== null ? ` for ${formatPrice(price, language)} — about ${formatPrice(monthlyPrice(price, preview.months), language)} a month` : ""}`,
                      )
                    : preview.error}
                </p>
                <div className="flex items-center gap-3">
                  <Checkbox name={`${id}-active`} checked={row.isActive} onChange={(event) => update(row.key, { isActive: event.target.checked })} label={t("متاحة للبيع", "On sale")} data-testid="package-option-active" />
                  {vip ? null : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={rows.length <= 1}
                      onClick={() => setRows((list) => list.filter((item) => item.key !== row.key))}
                      aria-label={t(`حذف المدة ${index + 1}`, `Remove length ${index + 1}`)}
                      data-testid="package-option-remove"
                    >
                      <Trash2 size={15} aria-hidden />
                      {t("حذف", "Remove")}
                    </Button>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function PackageForm({ initial, devices, slugLocked }: { initial: PackageFormValues; devices: (Option & { serviceType: string })[]; slugLocked?: boolean }) {
  const { t } = useLanguage();
  const toast = useToast();
  const router = useRouter();
  const [serviceType, setServiceType] = useState(initial.serviceType);
  const [rows, setRows] = useState<OptionRow[]>(() => (initial.options.length ? initial.options : [blankOption(initial.serviceType)]).map(optionRow));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const editing = initial.id !== undefined;
  const vip = serviceType === "VIP";
  // VIP is sold for three months only: one length, whatever was listed before.
  const shown = vip ? rows.slice(0, 1) : rows;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      name: text(form, "name"),
      slug: text(form, "slug"),
      serviceType,
      // Every length with its own price; the server validates each one.
      options: shown.map((row) => ({
        ...(row.id !== undefined ? { id: row.id } : {}),
        ...(vip ? {} : { durationValue: priceValue(row.amount), durationUnit: row.unit, durationLabel: row.label.trim() }),
        price: priceValue(row.price),
        // Empty = renewals of this length cost its normal price.
        renewalPrice: row.renewal.trim() === "" ? null : priceValue(row.renewal),
        // Empty = automatic loyalty points (price ÷ 1,000). IPTV only.
        ...(vip ? {} : { pointsEarned: row.points.trim() === "" ? null : priceValue(row.points) }),
        // Dollars as typed → cents; an invalid value is sent as typed so the server explains it.
        creditCostCents: row.credit.trim() === "" ? null : (dollarsToCents(row.credit) ?? row.credit),
        isActive: row.isActive,
      })),
      description: text(form, "description"),
      specifications: text(form, "specifications"),
      notes: text(form, "notes") || null,
      imageUrl: text(form, "imageUrl") || null,
      isActive: form.get("isActive") === "on",
      // Compatibility is a VIP rule (createOrder sells VIP packages with a linked VIP device).
      deviceIds: vip ? form.getAll("deviceIds").map(Number) : [],
    };

    setBusy(true);
    setError("");

    try {
      const result = editing ? await send(`/api/admin/packages/${initial.id}`, "PATCH", payload) : await send("/api/admin/packages", "POST", payload);

      if (!result.ok) {
        setError(result.data.message || t("تعذر حفظ الباقة.", "Couldn't save the package."));
        return;
      }

      toast(result.data.message || t("تم الحفظ.", "Saved."));
      if (editing) router.refresh();
      else router.push(`/admin/catalogue/packages/${result.data.package?.id ?? ""}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("تعذر حفظ الباقة.", "Couldn't save the package."));
    } finally {
      setBusy(false);
    }
  }

  const candidates = devices.filter((device) => device.serviceType === serviceType);

  return (
    <form onSubmit={submit} noValidate className="space-y-4" data-testid="package-form">
      <Group title={t("الهوية", "Identity")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("اسم الباقة", "Package name")} htmlFor="pkg-name" required>
            <Input id="pkg-name" name="name" defaultValue={initial.name} maxLength={120} />
          </Field>
          <Field label="Slug" htmlFor="pkg-slug" required hint={slugLocked ? t("مقفل: طلبات سابقة مرتبطة بهذا الـ Slug.", "Locked: past orders reference this slug.") : t("حروف إنجليزية صغيرة وأرقام وشرطات، يظهر في رابط الشراء.", "Lowercase letters, digits and dashes; used in the checkout link.")}>
            <Input id="pkg-slug" name="slug" dir="ltr" defaultValue={initial.slug} readOnly={slugLocked} aria-readonly={slugLocked} maxLength={80} />
          </Field>
        </div>
        <Field label={t("الوصف", "Description")} htmlFor="pkg-description" hint={t("فارغ = وصف تلقائي من الاسم.", "Empty = generated from the name.")}>
          <Textarea id="pkg-description" name="description" defaultValue={initial.description} className="min-h-20" maxLength={1000} />
        </Field>
      </Group>

      <Group title={t("التجاري", "Commercial")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("نوع الخدمة", "Service type")} htmlFor="pkg-type">
            <Select id="pkg-type" name="serviceType" value={serviceType} onChange={(event) => setServiceType(event.target.value === "VIP" ? "VIP" : "IPTV")}>
              <option value="IPTV">IPTV</option>
              <option value="VIP">VIP</option>
            </Select>
          </Field>
        </div>
        <OptionsEditor vip={vip} rows={shown} setRows={setRows} />
        <Checkbox name="isActive" defaultChecked={initial.isActive} label={t("فعّالة — تظهر للعملاء ويمكن شراؤها", "Active — visible to customers and purchasable")} />
      </Group>

      <Group title={t("الصورة", "Media")}>
        <ImageUploadField name="imageUrl" defaultValue={initial.imageUrl} label={t("صورة الباقة", "Package image")} endpoint="/api/admin/packages/upload" hint={t("JPG أو PNG أو WEBP أو GIF، حتى 5MB.", "JPG, PNG, WEBP or GIF, up to 5MB.")} />
      </Group>

      <Group title={t("التوافق", "Compatibility")} testId="package-compatibility">
        {vip ? (
          <CompatibilityChecklist name="deviceIds" options={candidates} selected={initial.deviceIds} empty={t("لا توجد أجهزة VIP في الكتالوج.", "No VIP devices in the catalogue.")} />
        ) : (
          <p className="text-sm text-ink-3">{t("باقات IPTV لا تحتاج جهازًا. التوافق خاص بباقات VIP.", "IPTV packages don't use devices. Compatibility applies to VIP packages.")}</p>
        )}
      </Group>

      <Group title={t("تفاصيل أخرى", "Other")}>
        <Field label={t("المميزات (سطر لكل ميزة)", "Features (one per line)")} htmlFor="pkg-specs">
          <Textarea id="pkg-specs" name="specifications" defaultValue={initial.specifications} maxLength={3000} />
        </Field>
        <Field label={t("ملاحظات", "Notes")} htmlFor="pkg-notes">
          <Textarea id="pkg-notes" name="notes" defaultValue={initial.notes ?? ""} className="min-h-20" maxLength={1000} />
        </Field>
      </Group>

      <FormFooter busy={busy} error={error} label={editing ? t("حفظ التعديلات", "Save changes") : t("إنشاء الباقة", "Create package")} />
    </form>
  );
}

// ------------------------------------------------------------------ devices

export type DeviceFormValues = {
  id?: number;
  name: string;
  slug: string;
  serviceType: "IPTV" | "VIP";
  price: number | "";
  description: string;
  specifications: string;
  notes: string | null;
  imageUrl: string | null;
  isActive: boolean;
  packageIds: number[];
};

export function DeviceForm({ initial, packages }: { initial: DeviceFormValues; packages: (Option & { serviceType: string })[] }) {
  const { t } = useLanguage();
  const toast = useToast();
  const router = useRouter();
  const [serviceType, setServiceType] = useState(initial.serviceType);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const editing = initial.id !== undefined;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      ...(editing ? { id: initial.id } : {}),
      name: text(form, "name"),
      slug: text(form, "slug"),
      serviceType,
      price: priceValue(form.get("price")),
      description: text(form, "description"),
      specifications: text(form, "specifications"),
      notes: text(form, "notes") || null,
      imageUrl: text(form, "imageUrl") || null,
      isActive: form.get("isActive") === "on",
      packageIds: form.getAll("packageIds").map(Number),
    };

    setBusy(true);
    setError("");

    try {
      const result = await send("/api/admin/devices", editing ? "PUT" : "POST", payload);

      if (!result.ok) {
        setError(result.data.message || t("تعذر حفظ الجهاز.", "Couldn't save the device."));
        return;
      }

      toast(result.data.message || t("تم الحفظ.", "Saved."));
      if (editing) router.refresh();
      else router.push(`/admin/catalogue/devices/${result.data.deviceId ?? ""}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("تعذر حفظ الجهاز.", "Couldn't save the device."));
    } finally {
      setBusy(false);
    }
  }

  const candidates = packages.filter((pkg) => pkg.serviceType === serviceType);

  return (
    <form onSubmit={submit} noValidate className="space-y-4" data-testid="device-form">
      <Group title={t("الهوية", "Identity")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("اسم الجهاز", "Device name")} htmlFor="dev-name" required>
            <Input id="dev-name" name="name" defaultValue={initial.name} maxLength={120} />
          </Field>
          <Field label="Slug" htmlFor="dev-slug" required hint={t("حروف إنجليزية صغيرة وأرقام وشرطات.", "Lowercase letters, digits and dashes.")}>
            <Input id="dev-slug" name="slug" dir="ltr" defaultValue={initial.slug} maxLength={80} />
          </Field>
        </div>
        <Field label={t("الوصف", "Description")} htmlFor="dev-description" required>
          <Textarea id="dev-description" name="description" defaultValue={initial.description} className="min-h-20" maxLength={1000} />
        </Field>
      </Group>

      <Group title={t("التجاري", "Commercial")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("نوع الخدمة", "Service type")} htmlFor="dev-type">
            <Select id="dev-type" name="serviceType" value={serviceType} onChange={(event) => setServiceType(event.target.value === "VIP" ? "VIP" : "IPTV")}>
              <option value="IPTV">IPTV</option>
              <option value="VIP">VIP</option>
            </Select>
          </Field>
          <Field label={t("السعر (د.ع)", "Price (IQD)")} htmlFor="dev-price" required hint={t("رقم صحيح بالدينار. الطلبات السابقة تحتفظ بسعرها.", "Whole dinars. Past orders keep their own price.")}>
            <Input id="dev-price" name="price" inputMode="numeric" dir="ltr" defaultValue={initial.price} data-testid="device-price" />
          </Field>
        </div>
        <Checkbox name="isActive" defaultChecked={initial.isActive} label={t("فعّال — يظهر للعملاء ويمكن شراؤه", "Active — visible to customers and purchasable")} />
      </Group>

      <Group title={t("الصورة", "Media")}>
        <ImageUploadField name="imageUrl" defaultValue={initial.imageUrl} label={t("صورة الجهاز", "Device image")} endpoint="/api/admin/packages/upload" hint={t("JPG أو PNG أو WEBP أو GIF، حتى 5MB.", "JPG, PNG, WEBP or GIF, up to 5MB.")} />
      </Group>

      <Group title={t("الباقات المتوافقة", "Compatible packages")} testId="device-compatibility">
        <CompatibilityChecklist name="packageIds" options={candidates} selected={initial.packageIds} empty={t(`لا توجد باقات ${serviceType} في الكتالوج.`, `No ${serviceType} packages in the catalogue.`)} />
      </Group>

      <Group title={t("تفاصيل أخرى", "Other")}>
        <Field label={t("المواصفات (سطر لكل ميزة)", "Specifications (one per line)")} htmlFor="dev-specs" required>
          <Textarea id="dev-specs" name="specifications" defaultValue={initial.specifications} maxLength={3000} />
        </Field>
        <Field label={t("ملاحظات", "Notes")} htmlFor="dev-notes">
          <Textarea id="dev-notes" name="notes" defaultValue={initial.notes ?? ""} className="min-h-20" maxLength={1000} />
        </Field>
      </Group>

      <FormFooter busy={busy} error={error} label={editing ? t("حفظ التعديلات", "Save changes") : t("إضافة الجهاز", "Add device")} />
    </form>
  );
}

// ------------------------------------------------------------------ status + delete

/**
 * Activate / deactivate (the safe way to retire a product) and delete,
 * which is only offered when nothing references the product — the API
 * refuses it otherwise.
 */
export function ProductActions({
  kind,
  id,
  name,
  isActive,
  devicePayload,
  deletable,
  deleteBlockedReason,
}: {
  kind: "package" | "device";
  id: number;
  name: string;
  isActive: boolean;
  /** Devices are saved as a whole (PUT): the current values, with isActive flipped. */
  devicePayload?: Omit<DeviceFormValues, "price"> & { price: number };
  deletable: boolean;
  deleteBlockedReason?: string;
}) {
  const { t } = useLanguage();
  const toast = useToast();
  const router = useRouter();
  const [busy, setBusy] = useState<"" | "status" | "delete">("");
  const [confirm, setConfirm] = useState<"" | "status" | "delete">("");
  const [error, setError] = useState("");

  async function toggle() {
    setBusy("status");
    setError("");

    try {
      const result =
        kind === "package"
          ? await send(`/api/admin/packages/${id}`, "PATCH", { isActive: !isActive })
          : await send("/api/admin/devices", "PUT", { ...devicePayload, id, isActive: !isActive });

      if (!result.ok) {
        setError(result.data.message || t("تعذر تغيير الحالة.", "Couldn't change the status."));
        return;
      }

      toast(isActive ? t("تم الإيقاف.", "Deactivated.") : t("تم التفعيل.", "Activated."));
      setConfirm("");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("تعذر تغيير الحالة.", "Couldn't change the status."));
    } finally {
      setBusy("");
    }
  }

  async function remove() {
    setBusy("delete");
    setError("");

    try {
      const result = kind === "package" ? await send(`/api/admin/packages/${id}`, "DELETE", {}) : await send("/api/admin/devices", "DELETE", { id });

      if (!result.ok) {
        setError(result.data.message || t("تعذر الحذف.", "Couldn't delete."));
        return;
      }

      toast(t("تم الحذف.", "Deleted."));
      setConfirm("");
      router.push(kind === "package" ? "/admin/catalogue/packages" : "/admin/catalogue/devices");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("تعذر الحذف.", "Couldn't delete."));
    } finally {
      setBusy("");
    }
  }

  const noun = kind === "package" ? t("الباقة", "package") : t("الجهاز", "device");

  return (
    <div className="space-y-3" data-testid="product-actions">
      <div className="flex flex-wrap gap-2">
        <Button variant={isActive ? "secondary" : "primary"} size="sm" onClick={() => setConfirm("status")} data-testid="product-toggle">
          <Power size={15} aria-hidden />
          {isActive ? t(`إيقاف ${noun}`, `Deactivate ${noun}`) : t(`تفعيل ${noun}`, `Activate ${noun}`)}
        </Button>
        <Button variant="danger" size="sm" disabled={!deletable} onClick={() => setConfirm("delete")} data-testid="product-delete">
          <Trash2 size={15} aria-hidden />
          {t("حذف", "Delete")}
        </Button>
      </div>
      {!deletable && deleteBlockedReason ? <p className="text-xs leading-5 text-ink-3" data-testid="product-delete-blocked">{deleteBlockedReason}</p> : null}
      {error ? <p className="text-sm font-semibold text-danger" role="alert">{error}</p> : null}

      <Dialog
        open={confirm === "status"}
        onClose={() => setConfirm("")}
        title={isActive ? t(`إيقاف «${name}»؟`, `Deactivate “${name}”?`) : t(`تفعيل «${name}»؟`, `Activate “${name}”?`)}
        description={
          isActive
            ? t("سيختفي من الموقع ولن يمكن شراؤه. الطلبات والاشتراكات الحالية لا تتأثر.", "It disappears from the website and can't be bought. Existing orders and subscriptions are unaffected.")
            : t("سيظهر في الموقع ويمكن شراؤه.", "It appears on the website and can be bought.")
        }
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirm("")}>{t("إلغاء", "Cancel")}</Button>
            <Button onClick={toggle} disabled={busy !== ""} data-testid="product-toggle-confirm">
              {busy === "status" ? <Loader2 size={15} className="animate-spin" aria-hidden /> : null}
              {isActive ? t("إيقاف", "Deactivate") : t("تفعيل", "Activate")}
            </Button>
          </div>
        }
      />
      <Dialog
        open={confirm === "delete"}
        onClose={() => setConfirm("")}
        title={t(`حذف «${name}» نهائيًا؟`, `Permanently delete “${name}”?`)}
        description={t("لا توجد طلبات أو اشتراكات مرتبطة به. لا يمكن التراجع عن الحذف.", "No orders or subscriptions reference it. This can't be undone.")}
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirm("")}>{t("إلغاء", "Cancel")}</Button>
            <Button variant="danger" onClick={remove} disabled={busy !== ""} data-testid="product-delete-confirm">
              {busy === "delete" ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <Trash2 size={15} aria-hidden />}
              {t("حذف نهائي", "Delete permanently")}
            </Button>
          </div>
        }
      />
    </div>
  );
}

// ------------------------------------------------------------------ compatibility board

/**
 * VIP package ↔ device links. Each toggle saves that package's device set
 * through the existing package API (PATCH deviceIds), the same mechanism
 * the package editor uses.
 */
export function CompatibilityToggles({ packageId, packageName, deviceIds, devices }: { packageId: number; packageName: string; deviceIds: number[]; devices: Option[] }) {
  const { t } = useLanguage();
  const toast = useToast();
  const router = useRouter();
  const [pending, setPending] = useState<number | null>(null);
  // The set the server last confirmed. Kept locally so a second toggle never
  // starts from props that the refresh hasn't replaced yet.
  const [linked, setLinked] = useState(deviceIds);
  const propsKey = deviceIds.join(",");
  const [seenKey, setSeenKey] = useState(propsKey);

  // Fresh server data (after refresh) replaces the local copy.
  if (propsKey !== seenKey) {
    setSeenKey(propsKey);
    setLinked(deviceIds);
  }

  async function toggle(deviceId: number) {
    const next = linked.includes(deviceId) ? linked.filter((id) => id !== deviceId) : [...linked, deviceId];
    setPending(deviceId);

    try {
      const result = await send(`/api/admin/packages/${packageId}`, "PATCH", { deviceIds: next });

      if (!result.ok) {
        toast(result.data.message || t("تعذر تحديث التوافق.", "Couldn't update compatibility."), "error");
        return;
      }

      setLinked(next);
      toast(t(`تم تحديث أجهزة «${packageName}».`, `Updated devices for “${packageName}”.`));
      router.refresh();
    } catch (caught) {
      toast(caught instanceof Error ? caught.message : t("تعذر تحديث التوافق.", "Couldn't update compatibility."), "error");
    } finally {
      setPending(null);
    }
  }

  if (!devices.length) return <p className="text-sm text-ink-3">{t("لا توجد أجهزة VIP.", "No VIP devices.")}</p>;

  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={t(`أجهزة ${packageName}`, `Devices for ${packageName}`)}>
      {devices.map((device) => {
        const on = linked.includes(device.id);

        return (
          <button
            key={device.id}
            type="button"
            aria-pressed={on}
            disabled={pending !== null}
            onClick={() => void toggle(device.id)}
            data-testid="compat-toggle"
            data-device={device.id}
            className={cn(
              "inline-flex min-h-9 items-center gap-2 rounded-full border px-3 text-xs font-semibold transition disabled:opacity-60",
              on ? "border-brand/60 bg-brand/15 text-ink" : "border-line bg-surface-2 text-ink-3 hover:text-ink",
            )}
          >
            {pending === device.id ? <Loader2 size={13} className="animate-spin" aria-hidden /> : <span className={cn("h-2 w-2 rounded-full", on ? "bg-brand" : "border border-ink-3")} aria-hidden />}
            {device.name}
            {device.isActive ? null : <span className="text-ink-3">· {t("موقوف", "inactive")}</span>}
          </button>
        );
      })}
    </div>
  );
}
