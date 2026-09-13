"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import {
  AppWindow,
  ArrowRight,
  CheckCircle2,
  Download,
  Eye,
  Image as ImageIcon,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
  XCircle,
} from "lucide-react";

type AppItem = {
  id: number;
  name: string;
  slug: string;
  description: string;
  platform: string;
  version: string | null;
  downloadUrl: string;
  imageUrl: string | null;
  instructions: string | null;
  notes: string | null;
  isActive: boolean;
};

type FormData = {
  name: string;
  description: string;
  platform: string;
  version: string;
  downloadUrl: string;
  imageUrl: string;
  instructions: string;
  notes: string;
  isActive: boolean;
};

const emptyForm: FormData = {
  name: "",
  description: "",
  platform: "",
  version: "",
  downloadUrl: "",
  imageUrl: "",
  instructions: "",
  notes: "",
  isActive: true,
};

export default function AdminAppsPage() {
  const [apps, setApps] = useState<AppItem[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [editingApp, setEditingApp] =
    useState<AppItem | null>(null);

  const [form, setForm] = useState<FormData>(emptyForm);

  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] =
    useState<number | null>(null);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    loadApps();
  }, []);

  async function loadApps() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        "/api/admin/apps",
        {
          method: "GET",
          cache: "no-store",
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "تعذر جلب التطبيقات"
        );
      }

      setApps(data.apps ?? []);
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "حدث خطأ أثناء جلب التطبيقات"
      );
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setEditingApp(null);
    setForm(emptyForm);
    setMessage("");
    setError("");
    setFormOpen(true);
  }

  function openEdit(app: AppItem) {
    setEditingApp(app);

    setForm({
      name: app.name,
      description: app.description,
      platform: app.platform,
      version: app.version ?? "",
      downloadUrl: app.downloadUrl,
      imageUrl: app.imageUrl ?? "",
      instructions: app.instructions ?? "",
      notes: app.notes ?? "",
      isActive: app.isActive,
    });

    setMessage("");
    setError("");
    setFormOpen(true);
  }

  function closeForm() {
    if (saving) return;

    setFormOpen(false);
    setEditingApp(null);
    setForm(emptyForm);
    setMessage("");
    setError("");
  }

  function updateForm<K extends keyof FormData>(
    field: K,
    value: FormData[K]
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setSaving(true);
    setMessage("");
    setError("");

    const payload = {
      ...(editingApp ? { id: editingApp.id } : {}),
      name: form.name,
      description: form.description,
      platform: form.platform,
      version: form.version || null,
      downloadUrl: form.downloadUrl,
      imageUrl: form.imageUrl || null,
      instructions: form.instructions || null,
      notes: form.notes || null,
      isActive: form.isActive,
    };

    try {
      const response = await fetch(
        "/api/admin/apps",
        {
          method: editingApp ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message ||
            (editingApp
              ? "تعذر تعديل التطبيق"
              : "تعذر إضافة التطبيق")
        );
      }

      setMessage(
        editingApp
          ? "تم تعديل التطبيق بنجاح"
          : "تمت إضافة التطبيق بنجاح"
      );

      await loadApps();

      setTimeout(() => {
        setFormOpen(false);
        setEditingApp(null);
        setForm(emptyForm);
        setMessage("");
      }, 700);
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "حدث خطأ أثناء حفظ التطبيق"
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(app: AppItem) {
    if (
      !window.confirm(
        `هل أنت متأكد من حذف التطبيق "${app.name}"؟`
      )
    ) {
      return;
    }

    try {
      setDeletingId(app.id);
      setError("");
      setMessage("");

      const response = await fetch(
        "/api/admin/apps",
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            id: app.id,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "تعذر حذف التطبيق"
        );
      }

      setApps((current) =>
        current.filter((item) => item.id !== app.id)
      );

      setMessage("تم حذف التطبيق بنجاح");

      setTimeout(() => {
        setMessage("");
      }, 1800);
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "حدث خطأ أثناء حذف التطبيق"
      );
    } finally {
      setDeletingId(null);
    }
  }

  const filteredApps = apps.filter((app) => {
    const query = search.trim().toLowerCase();

    if (!query) return true;

    return (
      app.name.toLowerCase().includes(query) ||
      app.platform.toLowerCase().includes(query) ||
      app.description.toLowerCase().includes(query)
    );
  });

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-slate-50 p-5 text-slate-900 transition-colors dark:bg-slate-950 dark:text-white lg:p-8"
    >
      <div className="mx-auto max-w-7xl">

        <div className="mb-8">
          <Link
            href="/admin"
            className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-blue-600 dark:text-blue-400"
          >
            <ArrowRight size={17} />
            العودة إلى لوحة الإدارة
          </Link>

          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">

            <div className="flex items-center gap-3">
              <div className="flex h-13 w-13 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-700 via-blue-600 to-cyan-500 text-white shadow-lg shadow-blue-600/20">
                <AppWindow size={24} />
              </div>

              <div>
                <h1 className="text-2xl font-black md:text-3xl">
                  إدارة التطبيقات
                </h1>

                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  التطبيقات والبرامج التي يحتاجها المشتركون.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={openCreate}
              className="flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3.5 text-sm font-black text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700"
            >
              <Plus size={19} />
              إضافة تطبيق
            </button>

          </div>
        </div>

        {message && (
          <div className="mb-5 flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-400">
            <CheckCircle2 size={18} />
            {message}
          </div>
        )}

        {error && (
          <div className="mb-5 flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
            <XCircle size={18} />
            {error}
          </div>
        )}

        <div className="mb-6 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="relative">
            <Search
              size={19}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <input
              suppressHydrationWarning
              dir="rtl"
              type="text"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="ابحث عن تطبيق..."
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3.5 pl-4 pr-12 text-right text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>
        </div>

        {loading ? (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3].map((item) => (
              <div
                key={item}
                className="overflow-hidden rounded-3xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="aspect-video animate-pulse bg-slate-200 dark:bg-slate-800" />
                <div className="space-y-3 p-5">
                  <div className="h-5 w-2/3 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
                  <div className="h-4 w-full animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
                  <div className="h-10 w-full animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredApps.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-20 text-center dark:border-slate-700 dark:bg-slate-900">

            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
              <AppWindow size={28} />
            </div>

            <h2 className="mt-5 text-lg font-black">
              لا توجد تطبيقات حالياً
            </h2>

            <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-slate-500 dark:text-slate-400">
              أضف أول تطبيق حتى يظهر للمستخدمين في صفحة التطبيقات.
            </p>

            <button
              type="button"
              onClick={openCreate}
              className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white"
            >
              <Plus size={18} />
              إضافة أول تطبيق
            </button>

          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filteredApps.map((app) => (
              <AppCard
                key={app.id}
                app={app}
                deleting={deletingId === app.id}
                onEdit={() => openEdit(app)}
                onDelete={() => handleDelete(app)}
              />
            ))}
          </div>
        )}

      </div>

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-sm">

          <div className="my-6 w-full max-w-3xl overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">

            <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5 dark:border-slate-800">

              <div>
                <h2 className="text-xl font-black">
                  {editingApp
                    ? "تعديل التطبيق"
                    : "إضافة تطبيق جديد"}
                </h2>

                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  أضف بيانات التطبيق ورابط التحميل.
                </p>
              </div>

              <button
                type="button"
                onClick={closeForm}
                disabled={saving}
                className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X size={19} />
              </button>

            </div>

            <form
              onSubmit={handleSubmit}
              className="max-h-[75vh] overflow-y-auto px-6 py-6"
            >

              <div className="grid gap-5 md:grid-cols-2">

                <Field label="اسم التطبيق" required>
                  <input
                    dir="rtl"
                    type="text"
                    value={form.name}
                    onChange={(event) =>
                      updateForm(
                        "name",
                        event.target.value
                      )
                    }
                    placeholder="مثال: شاشتنا TV"
                    className={inputClass}
                    required
                  />
                </Field>

                <Field label="المنصة" required>
                  <select
                    value={form.platform}
                    onChange={(event) =>
                      updateForm(
                        "platform",
                        event.target.value
                      )
                    }
                    className={inputClass}
                    required
                  >
                    <option value="">
                      اختر المنصة
                    </option>
                    <option value="Android">
                      Android
                    </option>
                    <option value="Android TV">
                      Android TV
                    </option>
                    <option value="Smart TV">
                      Smart TV
                    </option>
                    <option value="Windows">
                      Windows
                    </option>
                    <option value="iOS">
                      iPhone / iPad
                    </option>
                    <option value="macOS">
                      macOS
                    </option>
                    <option value="Other">
                      أخرى
                    </option>
                  </select>
                </Field>

                <Field
                  label="الإصدار"
                  hint="اختياري"
                >
                  <input
                    dir="ltr"
                    type="text"
                    value={form.version}
                    onChange={(event) =>
                      updateForm(
                        "version",
                        event.target.value
                      )
                    }
                    placeholder="v1.0.0"
                    className={`${inputClass} text-left`}
                  />
                </Field>

                <Field label="رابط التحميل" required>
                  <div className="relative">
                    <Download
                      size={17}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"
                    />

                    <input
                      dir="ltr"
                      type="url"
                      value={form.downloadUrl}
                      onChange={(event) =>
                        updateForm(
                          "downloadUrl",
                          event.target.value
                        )
                      }
                      placeholder="https://..."
                      className={`${inputClass} pr-11 text-left`}
                      required
                    />
                  </div>
                </Field>

                <Field
                  label="رابط صورة التطبيق"
                  hint="اختياري"
                >
                  <div className="relative">
                    <ImageIcon
                      size={17}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"
                    />

                    <input
                      dir="ltr"
                      type="url"
                      value={form.imageUrl}
                      onChange={(event) =>
                        updateForm(
                          "imageUrl",
                          event.target.value
                        )
                      }
                      placeholder="https://..."
                      className={`${inputClass} pr-11 text-left`}
                    />
                  </div>
                </Field>

                <Field label="الحالة">
                  <button
                    type="button"
                    onClick={() =>
                      updateForm(
                        "isActive",
                        !form.isActive
                      )
                    }
                    className={`flex h-[50px] w-full items-center justify-between rounded-xl border px-4 text-sm font-bold ${
                      form.isActive
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-400"
                        : "border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-800"
                    }`}
                  >
                    <span>
                      {form.isActive
                        ? "التطبيق منشور"
                        : "التطبيق مخفي"}
                    </span>

                    {form.isActive ? (
                      <CheckCircle2 size={19} />
                    ) : (
                      <XCircle size={19} />
                    )}
                  </button>
                </Field>

                <Field
                  label="الوصف"
                  required
                  full
                >
                  <textarea
                    dir="rtl"
                    value={form.description}
                    onChange={(event) =>
                      updateForm(
                        "description",
                        event.target.value
                      )
                    }
                    placeholder="اكتب وصفًا واضحًا للتطبيق..."
                    rows={4}
                    className={`${inputClass} resize-none`}
                    required
                  />
                </Field>

                <Field
                  label="تعليمات الاستخدام أو التثبيت"
                  full
                >
                  <textarea
                    dir="rtl"
                    value={form.instructions}
                    onChange={(event) =>
                      updateForm(
                        "instructions",
                        event.target.value
                      )
                    }
                    placeholder="اكتب خطوات التثبيت أو الاستخدام..."
                    rows={5}
                    className={`${inputClass} resize-none`}
                  />
                </Field>

                <Field
                  label="ملاحظات"
                  hint="اختياري"
                  full
                >
                  <textarea
                    dir="rtl"
                    value={form.notes}
                    onChange={(event) =>
                      updateForm(
                        "notes",
                        event.target.value
                      )
                    }
                    placeholder="ملاحظات إضافية..."
                    rows={4}
                    className={`${inputClass} resize-none`}
                  />
                </Field>

              </div>

              {message && (
                <div className="mt-5 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">
                  {message}
                </div>
              )}

              {error && (
                <div className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700 dark:bg-red-950/30 dark:text-red-400">
                  {error}
                </div>
              )}

              <div className="mt-7 flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row dark:border-slate-800">

                <button
                  type="button"
                  onClick={closeForm}
                  disabled={saving}
                  className="flex flex-1 items-center justify-center rounded-xl border border-slate-200 px-5 py-3.5 text-sm font-bold text-slate-700 dark:border-slate-700 dark:text-slate-300"
                >
                  إلغاء
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3.5 text-sm font-black text-white"
                >
                  {saving ? (
                    "جاري الحفظ..."
                  ) : (
                    <>
                      {editingApp ? (
                        <Pencil size={17} />
                      ) : (
                        <Plus size={18} />
                      )}

                      {editingApp
                        ? "حفظ التعديلات"
                        : "إضافة التطبيق"}
                    </>
                  )}
                </button>

              </div>

            </form>

          </div>
        </div>
      )}
    </main>
  );
}

function Field({
  label,
  required,
  hint,
  full,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={full ? "md:col-span-2" : ""}>
      <div className="mb-2 flex items-center justify-between">
        <label className="text-sm font-black text-slate-800 dark:text-slate-200">
          {label}
          {required && (
            <span className="mr-1 text-red-500">*</span>
          )}
        </label>

        {hint && (
          <span className="text-[11px] font-semibold text-slate-400">
            {hint}
          </span>
        )}
      </div>

      {children}
    </div>
  );
}

function AppCard({
  app,
  deleting,
  onEdit,
  onDelete,
}: {
  app: AppItem;
  deleting: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900">

      <div className="relative aspect-[16/9] overflow-hidden bg-gradient-to-br from-blue-700 via-blue-600 to-cyan-500">

        {app.imageUrl ? (
          <img
            src={app.imageUrl}
            alt={app.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-white/70">
            <AppWindow size={46} />
          </div>
        )}

        <div className="absolute left-4 top-4">

          {app.isActive ? (
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-500 px-3 py-1.5 text-[11px] font-black text-white">
              <CheckCircle2 size={13} />
              منشور
            </span>
          ) : (
            <span className="flex items-center gap-1.5 rounded-full bg-slate-800/90 px-3 py-1.5 text-[11px] font-black text-white">
              <XCircle size={13} />
              مخفي
            </span>
          )}

        </div>

      </div>

      <div className="p-5">

        <div className="flex items-start justify-between gap-4">

          <div className="min-w-0">
            <h3 className="truncate text-lg font-black">
              {app.name}
            </h3>

            <p className="mt-1 text-xs font-semibold text-blue-600 dark:text-blue-400">
              {app.platform}
              {app.version
                ? ` • ${app.version}`
                : ""}
            </p>
          </div>

        </div>

        <p className="mt-4 min-h-[72px] line-clamp-3 text-sm leading-6 text-slate-500 dark:text-slate-400">
          {app.description}
        </p>

        <div className="mt-5 flex gap-2">

          <a
            href={app.downloadUrl}
            target="_blank"
            rel="noreferrer"
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-blue-400"
            aria-label="فتح رابط التحميل"
          >
            <Eye size={17} />
          </a>

          <button
            type="button"
            onClick={onEdit}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 dark:border-slate-700 dark:text-slate-300"
          >
            <Pencil size={16} />
            تعديل
          </button>

          <button
            type="button"
            onClick={onDelete}
            disabled={deleting}
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-red-100 text-red-600 disabled:opacity-50 dark:border-red-900/40 dark:text-red-400"
          >
            {deleting ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-red-300 border-t-red-600" />
            ) : (
              <Trash2 size={16} />
            )}
          </button>

        </div>

      </div>
    </div>
  );
}

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:bg-slate-800";