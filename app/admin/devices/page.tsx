"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Cpu,
  ImagePlus,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
  XCircle,
} from "lucide-react";

type ServiceType = "IPTV" | "VIP";

type PackageItem = {
  id: number;
  name: string;
  slug: string;
  serviceType: ServiceType;
  price: number;
  durationMonths: number;
  durationLabel: string;
  isActive: boolean;
};

type DeviceItem = {
  id: number;
  name: string;
  slug: string;
  serviceType: ServiceType;
  price: number;
  description: string;
  specifications: string;
  notes: string | null;
  imageUrl: string | null;
  isActive: boolean;
  packages: PackageItem[];
};

type FormData = {
  name: string;
  slug: string;
  serviceType: ServiceType;
  price: string;
  description: string;
  specifications: string;
  notes: string;
  imageUrl: string;
  isActive: boolean;
  packageIds: number[];
};

const emptyForm: FormData = {
  name: "",
  slug: "",
  serviceType: "VIP",
  price: "",
  description: "",
  specifications: "",
  notes: "",
  imageUrl: "",
  isActive: true,
  packageIds: [],
};

function formatPrice(price: number) {
  return new Intl.NumberFormat("en-US").format(price);
}

function makeAbsoluteImageUrl(url: string) {
  const value = url.trim();

  if (!value) {
    return "";
  }

  if (
    value.startsWith("http://") ||
    value.startsWith("https://")
  ) {
    return value;
  }

  if (typeof window !== "undefined") {
    return new URL(
      value.startsWith("/") ? value : `/${value}`,
      window.location.origin
    ).toString();
  }

  return value;
}

export default function AdminDevicesPage() {
  const [devices, setDevices] =
    useState<DeviceItem[]>([]);

  const [packages, setPackages] =
    useState<PackageItem[]>([]);

  const [search, setSearch] =
    useState("");

  const [serviceFilter, setServiceFilter] =
    useState<"ALL" | ServiceType>("ALL");

  const [loading, setLoading] =
    useState(true);

  const [formOpen, setFormOpen] =
    useState(false);

  const [editingDevice, setEditingDevice] =
    useState<DeviceItem | null>(null);

  const [form, setForm] =
    useState<FormData>(emptyForm);

  const [saving, setSaving] =
    useState(false);

  const [uploading, setUploading] =
    useState(false);

  const [deletingId, setDeletingId] =
    useState<number | null>(null);

  const [message, setMessage] =
    useState("");

  const [error, setError] =
    useState("");

  const fileInputRef =
    useRef<HTMLInputElement | null>(null);

  /*
   * نخزن آخر رابط صورة تم رفعها بشكل مستقل
   * حتى لا نعتمد فقط على تحديث React state.
   */
  const uploadedImageUrlRef =
    useRef("");

  useEffect(() => {
    void loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const [
        devicesResponse,
        packagesResponse,
      ] = await Promise.all([
        fetch("/api/admin/devices", {
          method: "GET",
          cache: "no-store",
        }),

        fetch("/api/admin/packages", {
          method: "GET",
          cache: "no-store",
        }),
      ]);

      const devicesData =
        await devicesResponse.json();

      const packagesData =
        await packagesResponse.json();

      if (
        !devicesResponse.ok ||
        !devicesData.success
      ) {
        throw new Error(
          devicesData.message ||
            "تعذر جلب الأجهزة"
        );
      }

      if (
        !packagesResponse.ok ||
        !packagesData.success
      ) {
        throw new Error(
          packagesData.message ||
            "تعذر جلب الباقات"
        );
      }

      setDevices(
        devicesData.devices ?? []
      );

      setPackages(
        (
          packagesData.packages ?? []
        ).filter(
          (item: PackageItem) =>
            item.isActive
        )
      );
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "حدث خطأ أثناء جلب البيانات"
      );
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setEditingDevice(null);

    uploadedImageUrlRef.current = "";

    setForm({
      ...emptyForm,
      serviceType: "VIP",
    });

    setMessage("");
    setError("");
    setFormOpen(true);
  }

  function openEdit(
    device: DeviceItem
  ) {
    setEditingDevice(device);

    uploadedImageUrlRef.current =
      device.imageUrl ?? "";

    setForm({
      name: device.name,
      slug: device.slug,
      serviceType:
        device.serviceType,
      price: String(device.price),
      description:
        device.description,
      specifications:
        device.specifications,
      notes:
        device.notes ?? "",
      imageUrl:
        device.imageUrl ?? "",
      isActive:
        device.isActive,
      packageIds:
        device.packages.map(
          (item) => item.id
        ),
    });

    setMessage("");
    setError("");
    setFormOpen(true);
  }

  function closeForm() {
    if (saving || uploading) {
      return;
    }

    setFormOpen(false);
    setEditingDevice(null);
    setForm(emptyForm);

    uploadedImageUrlRef.current = "";

    setMessage("");
    setError("");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function updateForm<
    K extends keyof FormData
  >(
    field: K,
    value: FormData[K]
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function togglePackage(
    packageId: number
  ) {
    setForm((current) => ({
      ...current,
      packageIds:
        current.packageIds.includes(
          packageId
        )
          ? current.packageIds.filter(
              (id) =>
                id !== packageId
            )
          : [
              ...current.packageIds,
              packageId,
            ],
    }));
  }

  function changeServiceType(
    serviceType: ServiceType
  ) {
    setForm((current) => ({
      ...current,
      serviceType,
      packageIds: [],
    }));
  }

  async function uploadImage(
    file: File
  ) {
    try {
      setUploading(true);
      setError("");
      setMessage("");

      if (
        ![
          "image/jpeg",
          "image/png",
          "image/webp",
          "image/gif",
        ].includes(file.type)
      ) {
        throw new Error(
          "نوع الصورة غير مدعوم. استخدم JPG أو PNG أو WEBP أو GIF."
        );
      }

      if (
        file.size >
        8 * 1024 * 1024
      ) {
        throw new Error(
          "حجم الصورة يجب ألا يتجاوز 8MB."
        );
      }

      const formData =
        new FormData();

      formData.append(
        "file",
        file
      );

      const response =
        await fetch(
          "/api/admin/media/upload",
          {
            method: "POST",
            body: formData,
          }
        );

      const data =
        await response.json();

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.message ||
            "تعذر رفع الصورة."
        );
      }

      const uploadedImageUrl =
        String(
          data.imageUrl ?? ""
        ).trim();

      if (!uploadedImageUrl) {
        throw new Error(
          "تم رفع الصورة لكن السيرفر لم يُرجع رابط الصورة."
        );
      }

      /*
       * نخزن الرابط مباشرة بالـ ref.
       */
      uploadedImageUrlRef.current =
        uploadedImageUrl;

      /*
       * ونخزنه بالـ state حتى تظهر الصورة
       * مباشرة داخل المعاينة.
       */
      updateForm(
        "imageUrl",
        uploadedImageUrl
      );

      setMessage(
        "تم رفع الصورة بنجاح."
      );
    } catch (error) {
      console.error(error);

      setError(
        error instanceof Error
          ? error.message
          : "حدث خطأ أثناء رفع الصورة."
      );
    } finally {
      setUploading(false);

      if (
        fileInputRef.current
      ) {
        fileInputRef.current.value =
          "";
      }
    }
  }

  async function handleFileChange(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file =
      event.target.files?.[0];

    if (!file) {
      return;
    }

    await uploadImage(file);
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setSaving(true);
    setMessage("");
    setError("");

    const price =
      Number(form.price);

    if (
      !Number.isInteger(price) ||
      price < 0
    ) {
      setSaving(false);

      setError(
        "سعر الجهاز غير صحيح"
      );

      return;
    }

    /*
     * نأخذ الرابط من الـ state أولاً،
     * وإذا لم يكن موجودًا نأخذه من ref.
     */
    const rawImageUrl =
      form.imageUrl.trim() ||
      uploadedImageUrlRef.current.trim();

    /*
     * إذا كان الرابط نسبيًا مثل:
     * /api/uploads/media/...
     *
     * نحوله إلى:
     * https://domain.com/api/uploads/media/...
     *
     * حتى يقبله الـ API الذي يتحقق من صحة URL.
     */
    const imageUrl =
      rawImageUrl
        ? makeAbsoluteImageUrl(
            rawImageUrl
          )
        : null;

    if (!imageUrl) {
      setSaving(false);

      setError(
        "رجاءً أضف صورة للجهاز أو رابط الصورة."
      );

      return;
    }

    const payload = {
      ...(editingDevice
        ? {
            id: editingDevice.id,
          }
        : {}),

      name:
        form.name.trim(),

      slug:
        form.slug
          .trim()
          .toLowerCase(),

      serviceType:
        form.serviceType,

      price,

      description:
        form.description.trim(),

      specifications:
        form.specifications.trim(),

      notes:
        form.notes.trim() ||
        null,

      imageUrl,

      isActive:
        form.isActive,

      packageIds:
        form.packageIds,
    };

    try {
      const response =
        await fetch(
          "/api/admin/devices",
          {
            method: editingDevice
              ? "PUT"
              : "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify(
              payload
            ),
          }
        );

      const data =
        await response.json();

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.message ||
            (editingDevice
              ? "تعذر تعديل الجهاز"
              : "تعذر إضافة الجهاز")
        );
      }

      setMessage(
        editingDevice
          ? "تم تعديل الجهاز بنجاح"
          : "تمت إضافة الجهاز بنجاح"
      );

      await loadData();

      setTimeout(() => {
        setFormOpen(false);
        setEditingDevice(null);
        setForm(emptyForm);

        uploadedImageUrlRef.current =
          "";

        setMessage("");

        if (
          fileInputRef.current
        ) {
          fileInputRef.current.value =
            "";
        }
      }, 700);
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "حدث خطأ أثناء حفظ الجهاز"
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(
    device: DeviceItem
  ) {
    if (
      !window.confirm(
        `هل أنت متأكد من حذف الجهاز "${device.name}"؟`
      )
    ) {
      return;
    }

    try {
      setDeletingId(device.id);
      setError("");
      setMessage("");

      const response =
        await fetch(
          "/api/admin/devices",
          {
            method: "DELETE",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              id: device.id,
            }),
          }
        );

      const data =
        await response.json();

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.message ||
            "تعذر حذف الجهاز"
        );
      }

      setDevices((current) =>
        current.filter(
          (item) =>
            item.id !== device.id
        )
      );

      setMessage(
        "تم حذف الجهاز بنجاح"
      );

      setTimeout(() => {
        setMessage("");
      }, 1800);
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "حدث خطأ أثناء حذف الجهاز"
      );
    } finally {
      setDeletingId(null);
    }
  }

  const filteredDevices =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      return devices.filter(
        (device) => {
          const matchesService =
            serviceFilter ===
              "ALL" ||
            device.serviceType ===
              serviceFilter;

          if (
            !matchesService
          ) {
            return false;
          }

          if (!query) {
            return true;
          }

          return (
            device.name
              .toLowerCase()
              .includes(query) ||
            device.slug
              .toLowerCase()
              .includes(query) ||
            device.description
              .toLowerCase()
              .includes(query) ||
            device.serviceType
              .toLowerCase()
              .includes(query)
          );
        }
      );
    }, [
      devices,
      search,
      serviceFilter,
    ]);

  const availablePackages =
    packages.filter(
      (item) =>
        item.serviceType ===
        form.serviceType
    );

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-slate-50 p-5 text-slate-900 transition-colors dark:bg-slate-950 dark:text-white lg:p-8"
    >
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">

          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-13 w-13 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-700 via-blue-600 to-cyan-500 text-white shadow-lg shadow-blue-600/20">
                <Cpu size={24} />
              </div>

              <div>
                <h1 className="text-2xl font-black md:text-3xl">
                  إدارة الأجهزة
                </h1>

                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  إدارة الأجهزة وتحديد الباقات المتوافقة معها.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={openCreate}
              className="flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3.5 text-sm font-black text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700"
            >
              <Plus size={19} />
              إضافة جهاز
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

        <div className="mb-6 grid gap-3 lg:grid-cols-[1fr_auto]">
          <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="relative">
              <Search
                size={19}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                dir="rtl"
                type="text"
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value
                  )
                }
                placeholder="ابحث عن جهاز..."
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3.5 pl-4 pr-12 text-right text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>

          <div className="flex rounded-3xl border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            {(
              [
                ["ALL", "الكل"],
                ["VIP", "VIP"],
                ["IPTV", "IPTV"],
              ] as const
            ).map(
              ([
                value,
                label,
              ]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() =>
                    setServiceFilter(
                      value
                    )
                  }
                  className={`rounded-2xl px-5 py-3 text-sm font-black transition ${
                    serviceFilter ===
                    value
                      ? "bg-blue-600 text-white"
                      : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                  }`}
                >
                  {label}
                </button>
              )
            )}
          </div>
        </div>

        {loading ? (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3].map(
              (item) => (
                <div
                  key={item}
                  className="overflow-hidden rounded-3xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="aspect-[16/9] animate-pulse bg-slate-200 dark:bg-slate-800" />

                  <div className="space-y-3 p-5">
                    <div className="h-5 w-2/3 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />

                    <div className="h-4 w-full animate-pulse rounded bg-slate-200 dark:bg-slate-800" />

                    <div className="h-10 w-full animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
                  </div>
                </div>
              )
            )}
          </div>
        ) : filteredDevices.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-20 text-center dark:border-slate-700 dark:bg-slate-900">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
              <Cpu size={28} />
            </div>

            <h2 className="mt-5 text-lg font-black">
              لا توجد أجهزة حاليًا
            </h2>

            <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-slate-500 dark:text-slate-400">
              أضف أول جهاز حتى تتمكن من ربطه بالباقات وعرضه للمستخدمين.
            </p>

            <button
              type="button"
              onClick={openCreate}
              className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white"
            >
              <Plus size={18} />
              إضافة أول جهاز
            </button>
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filteredDevices.map(
              (device) => (
                <DeviceCard
                  key={device.id}
                  device={device}
                  deleting={
                    deletingId ===
                    device.id
                  }
                  onEdit={() =>
                    openEdit(device)
                  }
                  onDelete={() =>
                    void handleDelete(
                      device
                    )
                  }
                />
              )
            )}
          </div>
        )}
      </div>

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="my-6 w-full max-w-4xl overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5 dark:border-slate-800">
              <div>
                <h2 className="text-xl font-black">
                  {editingDevice
                    ? "تعديل الجهاز"
                    : "إضافة جهاز جديد"}
                </h2>

                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  أضف بيانات الجهاز وحدد الباقات المتوافقة معه.
                </p>
              </div>

              <button
                type="button"
                onClick={closeForm}
                disabled={
                  saving ||
                  uploading
                }
                className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-slate-800"
              >
                <X size={19} />
              </button>
            </div>

            <form
              onSubmit={
                handleSubmit
              }
              className="max-h-[78vh] overflow-y-auto px-6 py-6"
            >
              <div className="grid gap-5 md:grid-cols-2">
                <Field
                  label="اسم الجهاز"
                  required
                >
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
                    placeholder="مثال: VIP Box X1"
                    className={inputClass}
                    required
                  />
                </Field>

                <Field
                  label="Slug"
                  hint="يستخدم داخليًا"
                  required
                >
                  <input
                    dir="ltr"
                    type="text"
                    value={form.slug}
                    onChange={(event) =>
                      updateForm(
                        "slug",
                        event.target.value
                          .toLowerCase()
                          .replace(
                            /\s+/g,
                            "-"
                          )
                      )
                    }
                    placeholder="vip-box-x1"
                    className={`${inputClass} text-left`}
                    required
                  />
                </Field>

                <Field
                  label="نوع الخدمة"
                  required
                >
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        changeServiceType(
                          "VIP"
                        )
                      }
                      className={`rounded-xl border px-4 py-3.5 text-sm font-black transition ${
                        form.serviceType ===
                        "VIP"
                          ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400"
                          : "border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-800"
                      }`}
                    >
                      VIP
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        changeServiceType(
                          "IPTV"
                        )
                      }
                      className={`rounded-xl border px-4 py-3.5 text-sm font-black transition ${
                        form.serviceType ===
                        "IPTV"
                          ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400"
                          : "border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-800"
                      }`}
                    >
                      IPTV
                    </button>
                  </div>
                </Field>

                <Field
                  label="السعر"
                  required
                >
                  <input
                    dir="ltr"
                    type="number"
                    min="0"
                    step="1"
                    value={form.price}
                    onChange={(event) =>
                      updateForm(
                        "price",
                        event.target.value
                      )
                    }
                    placeholder="150000"
                    className={`${inputClass} text-left`}
                    required
                  />
                </Field>

                <div className="md:col-span-2">
                  <Field
                    label="صورة الجهاز"
                    hint="اختياري"
                  >
                    <div className="grid gap-5 lg:grid-cols-[1fr_240px]">
                      <div className="rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50 p-6 dark:border-slate-700 dark:bg-slate-800/50">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/gif"
                          onChange={
                            handleFileChange
                          }
                          className="hidden"
                        />

                        <button
                          type="button"
                          disabled={
                            uploading ||
                            saving
                          }
                          onClick={() =>
                            fileInputRef.current?.click()
                          }
                          className="flex w-full flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-8 text-center transition hover:border-blue-300 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
                        >
                          {uploading ? (
                            <Loader2
                              size={30}
                              className="animate-spin text-blue-600"
                            />
                          ) : (
                            <ImagePlus
                              size={30}
                              className="text-blue-600"
                            />
                          )}

                          <span className="mt-3 text-sm font-black">
                            {uploading
                              ? "جاري رفع الصورة..."
                              : "اختيار صورة من الكمبيوتر"}
                          </span>

                          <span className="mt-1 text-xs text-slate-400">
                            JPG · PNG · WEBP · GIF · بحد أقصى 8MB
                          </span>
                        </button>
                      </div>

                      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50">
                        {form.imageUrl ? (
                          <img
                            src={
                              form.imageUrl
                            }
                            alt={
                              form.name ||
                              "Device"
                            }
                            className="h-full min-h-[190px] w-full object-cover"
                          />
                        ) : (
                          <div className="flex min-h-[190px] flex-col items-center justify-center text-slate-400">
                            <Upload
                              size={28}
                            />

                            <span className="mt-2 text-xs font-bold">
                              لا توجد صورة
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </Field>
                </div>

                <div className="md:col-span-2">
                  <Field
                    label="رابط الصورة الخارجي"
                    hint="اختياري"
                  >
                    <input
                      dir="ltr"
                      type="text"
                      value={
                        form.imageUrl
                      }
                      onChange={(event) => {
                        const value =
                          event.target.value;

                        uploadedImageUrlRef.current =
                          value;

                        updateForm(
                          "imageUrl",
                          value
                        );
                      }}
                      placeholder="https://... أو /uploads/..."
                      className={`${inputClass} text-left`}
                    />
                  </Field>
                </div>

                <Field
                  label="الوصف"
                  required
                  full
                >
                  <textarea
                    dir="rtl"
                    value={
                      form.description
                    }
                    onChange={(event) =>
                      updateForm(
                        "description",
                        event.target.value
                      )
                    }
                    rows={4}
                    placeholder="اكتب وصفًا واضحًا للجهاز..."
                    className={`${inputClass} resize-none`}
                    required
                  />
                </Field>

                <Field
                  label="المواصفات"
                  required
                  full
                >
                  <textarea
                    dir="rtl"
                    value={
                      form.specifications
                    }
                    onChange={(event) =>
                      updateForm(
                        "specifications",
                        event.target.value
                      )
                    }
                    rows={5}
                    placeholder="مثال: 4K - Wi-Fi - Ethernet - Android..."
                    className={`${inputClass} resize-none`}
                    required
                  />
                </Field>

                <Field
                  label="الباقات المتوافقة"
                  hint="اختياري"
                  full
                >
                  {availablePackages.length ===
                  0 ? (
                    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm font-semibold text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                      لا توجد باقات نشطة من نوع{" "}
                      {form.serviceType} حاليًا.
                    </div>
                  ) : (
                    <div className="grid gap-3 md:grid-cols-2">
                      {availablePackages.map(
                        (item) => {
                          const selected =
                            form.packageIds.includes(
                              item.id
                            );

                          return (
                            <button
                              key={
                                item.id
                              }
                              type="button"
                              onClick={() =>
                                togglePackage(
                                  item.id
                                )
                              }
                              className={`flex items-center justify-between rounded-2xl border p-4 text-right transition ${
                                selected
                                  ? "border-blue-500 bg-blue-50 dark:border-blue-500 dark:bg-blue-500/10"
                                  : "border-slate-200 bg-slate-50 hover:border-blue-200 dark:border-slate-700 dark:bg-slate-800"
                              }`}
                            >
                              <div>
                                <p className="text-sm font-black">
                                  {
                                    item.name
                                  }
                                </p>

                                <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                                  {formatPrice(
                                    item.price
                                  )}{" "}
                                  الف
                                  {" • "}
                                  {
                                    item.durationLabel
                                  }
                                </p>
                              </div>

                              {selected ? (
                                <CheckCircle2
                                  size={20}
                                  className="text-blue-600 dark:text-blue-400"
                                />
                              ) : (
                                <div className="h-5 w-5 rounded-full border-2 border-slate-300 dark:border-slate-600" />
                              )}
                            </button>
                          );
                        }
                      )}
                    </div>
                  )}
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
                    rows={4}
                    placeholder="ملاحظات إضافية..."
                    className={`${inputClass} resize-none`}
                  />
                </Field>

                <Field
                  label="الحالة"
                  full
                >
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
                        ? "الجهاز منشور"
                        : "الجهاز مخفي"}
                    </span>

                    {form.isActive ? (
                      <CheckCircle2
                        size={19}
                      />
                    ) : (
                      <XCircle
                        size={19}
                      />
                    )}
                  </button>
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
                  disabled={
                    saving ||
                    uploading
                  }
                  className="flex flex-1 items-center justify-center rounded-xl border border-slate-200 px-5 py-3.5 text-sm font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-300"
                >
                  إلغاء
                </button>

                <button
                  type="submit"
                  disabled={
                    saving ||
                    uploading
                  }
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3.5 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? (
                    <Loader2
                      size={17}
                      className="animate-spin"
                    />
                  ) : editingDevice ? (
                    <Pencil
                      size={17}
                    />
                  ) : (
                    <Plus size={18} />
                  )}

                  {saving
                    ? "جاري الحفظ..."
                    : editingDevice
                    ? "حفظ التعديلات"
                    : "إضافة الجهاز"}
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
    <div
      className={
        full
          ? "md:col-span-2"
          : ""
      }
    >
      <div className="mb-2 flex items-center justify-between">
        <label className="text-sm font-black text-slate-800 dark:text-slate-200">
          {label}

          {required && (
            <span className="mr-1 text-red-500">
              *
            </span>
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

function DeviceCard({
  device,
  deleting,
  onEdit,
  onDelete,
}: {
  device: DeviceItem;
  deleting: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900">
      <div className="relative aspect-[16/9] overflow-hidden bg-gradient-to-br from-blue-700 via-blue-600 to-cyan-500">
        {device.imageUrl ? (
          <img
            src={device.imageUrl}
            alt={device.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-white/70">
            <Cpu size={46} />
          </div>
        )}

        <div className="absolute left-4 top-4 flex gap-2">
          <span className="rounded-full bg-blue-950/80 px-3 py-1.5 text-[11px] font-black text-white">
            {device.serviceType}
          </span>

          {device.isActive ? (
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-500 px-3 py-1.5 text-[11px] font-black text-white">
              <CheckCircle2
                size={13}
              />
              منشور
            </span>
          ) : (
            <span className="flex items-center gap-1.5 rounded-full bg-slate-800/90 px-3 py-1.5 text-[11px] font-black text-white">
              <XCircle
                size={13}
              />
              مخفي
            </span>
          )}
        </div>
      </div>

      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="truncate text-lg font-black">
              {device.name}
            </h3>

            <p className="mt-1 text-sm font-black text-blue-600 dark:text-blue-400">
              {formatPrice(
                device.price
              )}{" "}
              الف
            </p>
          </div>
        </div>

        <p className="mt-4 min-h-[72px] line-clamp-3 text-sm leading-6 text-slate-500 dark:text-slate-400">
          {device.description}
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {device.packages.length ===
          0 ? (
            <span className="rounded-full bg-slate-100 px-3 py-1.5 text-[11px] font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              غير مرتبط بأي باقة
            </span>
          ) : (
            device.packages
              .slice(0, 3)
              .map((item) => (
                <span
                  key={item.id}
                  className="rounded-full bg-blue-50 px-3 py-1.5 text-[11px] font-black text-blue-700 dark:bg-blue-500/10 dark:text-blue-400"
                >
                  {item.name}
                </span>
              ))
          )}

          {device.packages.length >
            3 && (
            <span className="rounded-full bg-slate-100 px-3 py-1.5 text-[11px] font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              +
              {device.packages.length -
                3}
            </span>
          )}
        </div>

        <div className="mt-5 flex gap-2">
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