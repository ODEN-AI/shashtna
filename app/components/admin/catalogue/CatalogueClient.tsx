"use client";

import { Loader2, Power, Save, Trash2 } from "lucide-react";
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

export type PackageFormValues = {
  id?: number;
  name: string;
  slug: string;
  serviceType: "IPTV" | "VIP";
  price: number | "";
  durationMonths: number;
  durationUnit: DurationUnit;
  durationLabel: string;
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

export function PackageForm({ initial, devices, slugLocked }: { initial: PackageFormValues; devices: (Option & { serviceType: string })[]; slugLocked?: boolean }) {
  const { t, language } = useLanguage();
  const toast = useToast();
  const router = useRouter();
  const [serviceType, setServiceType] = useState(initial.serviceType);
  const startDuration = durationValue(initial.durationMonths, initial.durationUnit);
  const [amount, setAmount] = useState(String(startDuration.value));
  const [unit, setUnit] = useState<DurationUnit>(startDuration.unit);
  const [price, setPrice] = useState(String(initial.price));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const editing = initial.id !== undefined;
  const vip = serviceType === "VIP";
  // Live preview with the same rules the server applies.
  const preview = parseDuration(/^\d+$/.test(amount.trim()) ? Number(amount.trim()) : amount, unit);
  const previewPrice = /^\d+$/.test(price.trim()) ? Number(price.trim()) : null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      name: text(form, "name"),
      slug: text(form, "slug"),
      serviceType,
      price: priceValue(form.get("price")),
      ...(vip ? {} : { durationValue: priceValue(form.get("durationValue")), durationUnit: unit, durationLabel: text(form, "durationLabel") }),
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
          <Field label={t("السعر (د.ع)", "Price (IQD)")} htmlFor="pkg-price" required hint={t("رقم صحيح بالدينار. الطلبات والاشتراكات السابقة تحتفظ بسعرها ومدتها.", "Whole dinars. Past orders and subscriptions keep their own price and duration.")}>
            <Input id="pkg-price" name="price" inputMode="numeric" dir="ltr" value={price} onChange={(event) => setPrice(event.target.value)} data-testid="package-price" />
          </Field>
          {vip ? (
            <p className="rounded-xl bg-white/[0.03] px-3 py-3 text-sm text-ink-3 sm:col-span-2">{t("باقات VIP مدتها 3 أشهر دائمًا (قاعدة النظام الحالية).", "VIP packages always run 3 months (existing rule).")}</p>
          ) : (
            <>
              <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2">
                <Field label={t("المدة", "Duration")} htmlFor="pkg-duration" required>
                  <Input id="pkg-duration" name="durationValue" inputMode="numeric" dir="ltr" value={amount} onChange={(event) => setAmount(event.target.value)} data-testid="package-duration" />
                </Field>
                <Field label={t("الوحدة", "Unit")} htmlFor="pkg-unit">
                  <Select id="pkg-unit" value={unit} onChange={(event) => setUnit(event.target.value === "YEAR" ? "YEAR" : "MONTH")} data-testid="package-duration-unit">
                    <option value="MONTH">{t("أشهر", "Months")}</option>
                    <option value="YEAR">{t("سنوات", "Years")}</option>
                  </Select>
                </Field>
              </div>
              <Field label={t("تسمية المدة (اختياري)", "Duration label (optional)")} htmlFor="pkg-label" hint={t("فارغ = تسمية تلقائية مثل «6 أشهر» أو «سنتان».", "Empty = automatic, e.g. “6 أشهر” or “سنتان”.")}>
                <Input id="pkg-label" name="durationLabel" defaultValue={customLabel(initial.durationLabel, initial.durationMonths)} placeholder={preview.ok ? formatDuration(preview.months, "ar") : ""} maxLength={40} />
              </Field>
              <p className={cn("rounded-xl px-3 py-2.5 text-sm sm:col-span-2", preview.ok ? "bg-white/[0.03] text-ink-2" : "bg-danger/10 font-semibold text-danger")} data-testid="package-duration-preview" aria-live="polite">
                {preview.ok
                  ? t(
                      `يشتري العميل ${formatDuration(preview.months, "ar")} (${preview.months} شهر)${previewPrice !== null ? ` بسعر ${formatPrice(previewPrice, language)} — حوالي ${formatPrice(monthlyPrice(previewPrice, preview.months), language)} شهريًا` : ""}.`,
                      `Customers buy ${formatDuration(preview.months, "en")} (${preview.months} months)${previewPrice !== null ? ` for ${formatPrice(previewPrice, language)} — about ${formatPrice(monthlyPrice(previewPrice, preview.months), language)} a month` : ""}.`,
                    )
                  : preview.error}
              </p>
            </>
          )}
        </div>
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
