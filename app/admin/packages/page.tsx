"use client";

import {
  Check,
  CircleAlert,
  CircleX,
  Cpu,
  Edit3,
  ImagePlus,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";

type ServiceType = "IPTV" | "VIP";

type RelatedPackage = {
  id: number;
  name: string;
  slug: string;
  serviceType: ServiceType;
  price: number;
  durationMonths: number;
  durationLabel: string;
  isActive: boolean;
};

type DeviceData = {
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
  packages?: RelatedPackage[];
};

type PackageData = {
  id: number;
  name: string;
  slug: string;
  serviceType: ServiceType;
  price: number;
  durationMonths: number;
  durationLabel: string;
  description: string;
  specifications: string;
  notes: string | null;
  imageUrl: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  devices?: DeviceData[];
};

type PackageForm = {
  name: string;
  slug: string;
  serviceType: ServiceType;
  price: string;
  durationMonths: string;
  durationLabel: string;
  description: string;
  specifications: string;
  notes: string;
  imageUrl: string;
  isActive: boolean;
  deviceIds: number[];
};

const emptyForm: PackageForm = {
  name: "",
  slug: "",
  serviceType: "IPTV",
  price: "",
  durationMonths: "12",
  durationLabel: "1 Year",
  description: "",
  specifications: "",
  notes: "",
  imageUrl: "",
  isActive: true,
  deviceIds: [],
};

function formatPrice(price: number) {
  return new Intl.NumberFormat("en-US").format(price);
}

function getServiceLabel(serviceType: ServiceType) {
  return serviceType === "VIP" ? "VIP" : "IPTV";
}

export default function AdminPackagesPage() {
  const [packages, setPackages] = useState<PackageData[]>([]);
  const [devices, setDevices] = useState<DeviceData[]>([]);

  const [form, setForm] = useState<PackageForm>(emptyForm);

  const [editingId, setEditingId] =
    useState<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const fileInputRef =
    useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    void loadPackages();
  }, []);

  async function loadPackages() {
    try {
      setLoading(true);
      setError("");

      const [packagesResponse, devicesResponse] =
        await Promise.all([
          fetch("/api/admin/packages", {
            method: "GET",
            cache: "no-store",
          }),
          fetch("/api/admin/devices", {
            method: "GET",
            cache: "no-store",
          }),
        ]);

      const packagesData =
        await packagesResponse.json();

      const devicesData =
        await devicesResponse.json();

      if (
        !packagesResponse.ok ||
        !packagesData.success
      ) {
        throw new Error(
          packagesData.message ||
            "تعذر تحميل الباقات."
        );
      }

      if (
        !devicesResponse.ok ||
        !devicesData.success
      ) {
        throw new Error(
          devicesData.message ||
            "تعذر تحميل الأجهزة."
        );
      }

      const loadedPackages: PackageData[] =
        Array.isArray(packagesData.packages)
          ? packagesData.packages
          : [];

      const loadedDevices: DeviceData[] =
        Array.isArray(devicesData.devices)
          ? devicesData.devices
          : [];

      setPackages(loadedPackages);
      setDevices(loadedDevices);
    } catch (error) {
      console.error(error);

      setError(
        error instanceof Error
          ? error.message
          : "حدث خطأ أثناء تحميل البيانات."
      );
    } finally {
      setLoading(false);
    }
  }

  function updateField<K extends keyof PackageForm>(
    key: K,
    value: PackageForm[K]
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function changeServiceType(
    serviceType: ServiceType
  ) {
    setForm((current) => {
      if (serviceType === "VIP") {
        return {
          ...current,
          serviceType: "VIP",
          durationMonths: "3",
          durationLabel: "3 Months",
          deviceIds: [],
        };
      }

      return {
        ...current,
        serviceType: "IPTV",
        durationMonths:
          current.durationMonths === "3"
            ? "12"
            : current.durationMonths,
        durationLabel:
          current.durationMonths === "3" ||
          current.durationLabel === "3 Months"
            ? "1 Year"
            : current.durationLabel,
        deviceIds: [],
      };
    });
  }

  function startCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setError("");
    setMessage("");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function startEdit(pkg: PackageData) {
    const serviceType: ServiceType =
      pkg.serviceType === "VIP"
        ? "VIP"
        : "IPTV";

    const relatedDeviceIds = devices
      .filter((device) =>
        device.packages?.some(
          (relatedPackage) =>
            relatedPackage.id === pkg.id
        )
      )
      .map((device) => device.id);

    setEditingId(pkg.id);

    setForm({
      name: pkg.name,
      slug: pkg.slug,
      serviceType,
      price: String(pkg.price),
      durationMonths:
        serviceType === "VIP"
          ? "3"
          : String(pkg.durationMonths),
      durationLabel:
        serviceType === "VIP"
          ? "3 Months"
          : pkg.durationLabel,
      description: pkg.description ?? "",
      specifications:
        pkg.specifications ?? "",
      notes: pkg.notes ?? "",
      imageUrl: pkg.imageUrl ?? "",
      isActive: pkg.isActive,
      deviceIds: relatedDeviceIds,
    });

    setError("");
    setMessage("");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
    setError("");
    setMessage("");
  }

  async function uploadImage(file: File) {
    try {
      setUploading(true);
      setError("");
      setMessage("");

      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(
        "/api/admin/packages/upload",
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message ||
            "تعذر رفع الصورة."
        );
      }

      updateField("imageUrl", data.imageUrl);

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

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  async function handleFileChange(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    await uploadImage(file);
  }

  function toggleDevice(deviceId: number) {
    setForm((current) => ({
      ...current,
      deviceIds:
        current.deviceIds.includes(deviceId)
          ? current.deviceIds.filter(
              (id) => id !== deviceId
            )
          : [
              ...current.deviceIds,
              deviceId,
            ],
    }));
  }

  async function savePackage(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    try {
      setSaving(true);
      setError("");
      setMessage("");

      const name = form.name.trim();
      const slug = form.slug
        .trim()
        .toLowerCase();

      const serviceType =
        form.serviceType;

      if (!name || !slug) {
        throw new Error(
          "اسم الباقة وSlug مطلوبان."
        );
      }

      const price = Number(form.price);

      if (
        !Number.isFinite(price) ||
        price < 0
      ) {
        throw new Error(
          "السعر غير صحيح."
        );
      }

      let durationMonths = Number(
        form.durationMonths
      );

      let durationLabel =
        form.durationLabel.trim();

      if (serviceType === "VIP") {
        durationMonths = 3;
        durationLabel = "3 Months";
      } else {
        if (
          !Number.isInteger(
            durationMonths
          ) ||
          durationMonths <= 0
        ) {
          throw new Error(
            "مدة الاشتراك غير صحيحة."
          );
        }

        if (!durationLabel) {
          durationLabel = `${durationMonths} Months`;
        }
      }

      const description =
        form.description.trim() ||
        `اشتراك ${name}`;

      const specifications =
        form.specifications.trim() ||
        `اشتراك لمدة ${durationMonths} أشهر`;

      const payload = {
        name,
        slug,
        serviceType,
        price,
        durationMonths,
        durationLabel,
        description,
        specifications,
        notes:
          form.notes.trim() || null,
        imageUrl:
          form.imageUrl.trim() || null,
        isActive: form.isActive,
        deviceIds:
          serviceType === "VIP"
            ? form.deviceIds
            : [],
      };

      const url = editingId
        ? `/api/admin/packages/${editingId}`
        : "/api/admin/packages";

      const response = await fetch(url, {
        method: editingId ? "PATCH" : "POST",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data =
        await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message ||
            "تعذر حفظ الباقة."
        );
      }

      setMessage(
        editingId
          ? "تم تحديث الباقة بنجاح."
          : "تم إنشاء الباقة بنجاح."
      );

      setEditingId(null);
      setForm(emptyForm);

      await loadPackages();
    } catch (error) {
      console.error(error);

      setError(
        error instanceof Error
          ? error.message
          : "حدث خطأ أثناء حفظ الباقة."
      );
    } finally {
      setSaving(false);
    }
  }

  async function togglePackage(
    pkg: PackageData
  ) {
    try {
      setError("");
      setMessage("");

      const response = await fetch(
        `/api/admin/packages/${pkg.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            isActive: !pkg.isActive,
          }),
        }
      );

      const data =
        await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message ||
            "تعذر تغيير حالة الباقة."
        );
      }

      await loadPackages();

      setMessage(
        pkg.isActive
          ? "تم إيقاف الباقة."
          : "تم تفعيل الباقة."
      );
    } catch (error) {
      console.error(error);

      setError(
        error instanceof Error
          ? error.message
          : "حدث خطأ أثناء تغيير حالة الباقة."
      );
    }
  }

  async function deletePackage(
    pkg: PackageData
  ) {
    const confirmed =
      window.confirm(
        `هل تريد حذف باقة ${pkg.name} نهائيًا؟`
      );

    if (!confirmed) {
      return;
    }

    try {
      setError("");
      setMessage("");

      const response = await fetch(
        `/api/admin/packages/${pkg.id}`,
        {
          method: "DELETE",
        }
      );

      const data =
        await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message ||
            "تعذر حذف الباقة."
        );
      }

      if (editingId === pkg.id) {
        cancelEdit();
      }

      await loadPackages();

      setMessage(
        "تم حذف الباقة."
      );
    } catch (error) {
      console.error(error);

      setError(
        error instanceof Error
          ? error.message
          : "حدث خطأ أثناء حذف الباقة."
      );
    }
  }

  const availableDevices =
    devices.filter(
      (device) =>
        device.isActive &&
        device.serviceType ===
          form.serviceType
    );

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-slate-50 p-5 text-slate-900 dark:bg-slate-950 dark:text-white lg:p-8"
    >
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 text-sm font-black text-blue-600 dark:text-blue-400">
              إدارة النظام
            </p>

            <h1 className="text-3xl font-black tracking-tight md:text-4xl">
              إدارة الباقات
            </h1>

            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              أضف وعدّل باقات IPTV وVIP والأسعار والصور والأجهزة المتوافقة معها.
            </p>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() =>
                void loadPackages()
              }
              disabled={loading}
              className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3.5 text-sm font-black shadow-sm transition hover:border-blue-200 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
            >
              <RefreshCw
                size={17}
                className={
                  loading
                    ? "animate-spin"
                    : ""
                }
              />
              تحديث
            </button>

            <button
              type="button"
              onClick={startCreate}
              className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-700 to-cyan-500 px-5 py-3.5 text-sm font-black text-white shadow-lg shadow-blue-600/20 transition hover:scale-[1.01]"
            >
              <Plus size={18} />
              إضافة باقة
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-sm font-bold text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
            <CircleAlert size={18} />
            {error}
          </div>
        )}

        {message && (
          <div className="mb-6 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm font-bold text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-400">
            <Check size={18} />
            {message}
          </div>
        )}

        <div className="mb-10 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:p-8">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-black">
                {editingId
                  ? "تعديل الباقة"
                  : "إضافة باقة جديدة"}
              </h2>

              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                الصورة والوصف والمواصفات اختيارية، ويمكن تحديد الأجهزة المتوافقة مع باقة VIP.
              </p>
            </div>

            {editingId && (
              <button
                type="button"
                onClick={cancelEdit}
                className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold dark:border-slate-700"
              >
                <X size={16} />
                إلغاء
              </button>
            )}
          </div>

          <form
            onSubmit={savePackage}
            className="grid gap-5 md:grid-cols-2"
          >
            <div className="md:col-span-2">
              <label className="mb-3 block text-sm font-black">
                نوع الخدمة
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() =>
                    changeServiceType(
                      "IPTV"
                    )
                  }
                  className={`rounded-2xl border-2 p-5 text-right transition ${
                    form.serviceType ===
                    "IPTV"
                      ? "border-blue-500 bg-blue-50 text-blue-700 shadow-sm dark:border-blue-400 dark:bg-blue-500/10 dark:text-blue-300"
                      : "border-slate-200 bg-slate-50 text-slate-600 hover:border-blue-200 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-300"
                  }`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="text-lg font-black">
                        IPTV
                      </div>

                      <p className="mt-1 text-xs leading-6 opacity-70">
                        خدمة تعتمد على Username وPassword وMAC Address.
                      </p>
                    </div>

                    <div
                      className={`flex h-6 w-6 items-center justify-center rounded-full border ${
                        form.serviceType ===
                        "IPTV"
                          ? "border-blue-600 bg-blue-600 text-white"
                          : "border-slate-300 dark:border-slate-600"
                      }`}
                    >
                      {form.serviceType ===
                        "IPTV" && (
                        <Check size={14} />
                      )}
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    changeServiceType(
                      "VIP"
                    )
                  }
                  className={`rounded-2xl border-2 p-5 text-right transition ${
                    form.serviceType ===
                    "VIP"
                      ? "border-cyan-500 bg-cyan-50 text-cyan-700 shadow-sm dark:border-cyan-400 dark:bg-cyan-500/10 dark:text-cyan-300"
                      : "border-slate-200 bg-slate-50 text-slate-600 hover:border-cyan-200 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-300"
                  }`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="text-lg font-black">
                        VIP
                      </div>

                      <p className="mt-1 text-xs leading-6 opacity-70">
                        خدمة مرتبطة بجهاز VIP ومعرف جهاز خاص، ومدتها 3 أشهر.
                      </p>
                    </div>

                    <div
                      className={`flex h-6 w-6 items-center justify-center rounded-full border ${
                        form.serviceType ===
                        "VIP"
                          ? "border-cyan-600 bg-cyan-600 text-white"
                          : "border-slate-300 dark:border-slate-600"
                      }`}
                    >
                      {form.serviceType ===
                        "VIP" && (
                        <Check size={14} />
                      )}
                    </div>
                  </div>
                </button>
              </div>
            </div>

            <Field
              label="اسم الباقة"
              value={form.name}
              onChange={(value) =>
                updateField(
                  "name",
                  value
                )
              }
              placeholder={
                form.serviceType ===
                "VIP"
                  ? "VIP 3 Months"
                  : "Family"
              }
            />

            <Field
              label="Slug"
              value={form.slug}
              onChange={(value) =>
                updateField(
                  "slug",
                  value
                )
              }
              placeholder={
                form.serviceType ===
                "VIP"
                  ? "vip-3m"
                  : "family"
              }
              dir="ltr"
            />

            <Field
              label="السعر"
              value={form.price}
              onChange={(value) =>
                updateField(
                  "price",
                  value
                )
              }
              placeholder="25000"
              type="number"
              dir="ltr"
            />

            <div>
              <label className="mb-2 block text-sm font-black">
                مدة الاشتراك
              </label>

              {form.serviceType ===
              "VIP" ? (
                <div className="rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3.5 text-sm font-black text-cyan-700 dark:border-cyan-500/20 dark:bg-cyan-500/10 dark:text-cyan-300">
                  3 أشهر
                </div>
              ) : (
                <Field
                  label=""
                  value={
                    form.durationMonths
                  }
                  onChange={(value) =>
                    updateField(
                      "durationMonths",
                      value
                    )
                  }
                  placeholder="12"
                  type="number"
                  dir="ltr"
                />
              )}
            </div>

            <Field
              label="اسم المدة"
              value={form.durationLabel}
              onChange={(value) =>
                updateField(
                  "durationLabel",
                  value
                )
              }
              placeholder={
                form.serviceType ===
                "VIP"
                  ? "3 Months"
                  : "1 Year"
              }
              disabled={
                form.serviceType ===
                "VIP"
              }
            />

            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-black">
                صورة الباقة
              </label>

              <div className="grid gap-5 lg:grid-cols-[1fr_220px]">
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
                    disabled={uploading}
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
                        ? "جارٍ رفع الصورة..."
                        : "اختيار صورة من الكمبيوتر"}
                    </span>

                    <span className="mt-1 text-xs text-slate-400">
                      JPG • PNG • WEBP • GIF
                      • بحد أقصى 8MB
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
                        "Package"
                      }
                      className="h-full min-h-[180px] w-full object-cover"
                    />
                  ) : (
                    <div className="flex min-h-[180px] flex-col items-center justify-center text-slate-400">
                      <Upload size={28} />

                      <span className="mt-2 text-xs font-bold">
                        لا توجد صورة
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-black">
                رابط الصورة الخارجي
                <span className="mr-2 text-xs font-normal text-slate-400">
                  اختياري
                </span>
              </label>

              <input
                dir="ltr"
                value={form.imageUrl}
                onChange={(event) =>
                  updateField(
                    "imageUrl",
                    event.target.value
                  )
                }
                placeholder="/uploads/packages/image.jpg أو https://..."
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm outline-none transition focus:border-blue-500 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:focus:bg-slate-800"
              />
            </div>

            <div className="md:col-span-2">
              <TextAreaField
                label="الوصف"
                value={
                  form.description
                }
                onChange={(value) =>
                  updateField(
                    "description",
                    value
                  )
                }
                placeholder="اكتب وصف الباقة... (اختياري)"
              />
            </div>

            <div className="md:col-span-2">
              <TextAreaField
                label="المواصفات"
                value={
                  form.specifications
                }
                onChange={(value) =>
                  updateField(
                    "specifications",
                    value
                  )
                }
                placeholder="اكتب مواصفات الباقة... (اختياري)"
              />
            </div>

            {form.serviceType ===
              "VIP" && (
              <div className="md:col-span-2">
                <label className="mb-3 flex items-center gap-2 text-sm font-black">
                  <Cpu size={17} />
                  الأجهزة المتوافقة
                  <span className="text-xs font-normal text-slate-400">
                    اختياري
                  </span>
                </label>

                {availableDevices.length ===
                0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm font-semibold text-slate-500 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-400">
                    لا توجد أجهزة مفعلة من نوع{" "}
                    <span className="font-black text-slate-700 dark:text-slate-200">
                      VIP
                    </span>{" "}
                    حاليًا.
                    <div className="mt-2 text-xs">
                      أضف جهازًا من صفحة إدارة الأجهزة أولًا.
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {availableDevices.map(
                        (device) => {
                          const selected =
                            form.deviceIds.includes(
                              device.id
                            );

                          return (
                            <button
                              key={
                                device.id
                              }
                              type="button"
                              onClick={() =>
                                toggleDevice(
                                  device.id
                                )
                              }
                              className={`overflow-hidden rounded-2xl border-2 text-right transition ${
                                selected
                                  ? "border-cyan-500 bg-cyan-50 shadow-sm dark:border-cyan-400 dark:bg-cyan-500/10"
                                  : "border-slate-200 bg-slate-50 hover:border-cyan-200 hover:bg-cyan-50/50 dark:border-slate-700 dark:bg-slate-800/50 dark:hover:border-cyan-500/40"
                              }`}
                            >
                              <div className="relative h-32 overflow-hidden bg-gradient-to-br from-blue-700 via-blue-600 to-cyan-500">
                                {device.imageUrl ? (
                                  <img
                                    src={
                                      device.imageUrl
                                    }
                                    alt={
                                      device.name
                                    }
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <div className="flex h-full items-center justify-center text-white/70">
                                    <Cpu
                                      size={
                                        38
                                      }
                                    />
                                  </div>
                                )}

                                <div className="absolute left-3 top-3">
                                  {selected ? (
                                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-cyan-600 text-white shadow-lg">
                                      <Check
                                        size={
                                          15
                                        }
                                      />
                                    </span>
                                  ) : (
                                    <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white/80 bg-black/20" />
                                  )}
                                </div>
                              </div>

                              <div className="p-4">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-black">
                                      {
                                        device.name
                                      }
                                    </p>

                                    <p className="mt-1 text-xs font-semibold text-cyan-600 dark:text-cyan-400">
                                      {formatPrice(
                                        device.price
                                      )}{" "}
                                      الف
                                    </p>
                                  </div>

                                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black text-slate-500 dark:bg-slate-700 dark:text-slate-300">
                                    {
                                      device.serviceType
                                    }
                                  </span>
                                </div>

                                <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                                  {
                                    device.description
                                  }
                                </p>
                              </div>
                            </button>
                          );
                        }
                      )}
                    </div>

                    {form.deviceIds.length >
                      0 && (
                      <p className="mt-3 text-xs font-bold text-cyan-600 dark:text-cyan-400">
                        تم اختيار{" "}
                        {
                          form.deviceIds.length
                        }{" "}
                        {form.deviceIds.length ===
                        1
                          ? "جهاز"
                          : "أجهزة"}
                      </p>
                    )}
                  </>
                )}
              </div>
            )}

            <div className="md:col-span-2">
              <TextAreaField
                label="ملاحظات"
                value={form.notes}
                onChange={(value) =>
                  updateField(
                    "notes",
                    value
                  )
                }
                placeholder="ملاحظات إضافية... (اختياري)"
              />
            </div>

            <label className="md:col-span-2 flex cursor-pointer items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
              <input
                type="checkbox"
                checked={
                  form.isActive
                }
                onChange={(event) =>
                  updateField(
                    "isActive",
                    event.target.checked
                  )
                }
                className="h-5 w-5 accent-blue-600"
              />

              <span>
                <span className="block text-sm font-black">
                  الباقة مفعلة
                </span>

                <span className="block text-xs text-slate-400">
                  إذا كانت مفعلة، تظهر للعملاء في صفحة الباقات.
                </span>
              </span>
            </label>

            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={
                  saving || uploading
                }
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-700 to-cyan-500 px-5 py-4 text-sm font-black text-white shadow-lg shadow-blue-600/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? (
                  <Loader2
                    size={18}
                    className="animate-spin"
                  />
                ) : (
                  <Save size={18} />
                )}

                {editingId
                  ? "حفظ تعديلات الباقة"
                  : "إضافة الباقة"}
              </button>
            </div>
          </form>
        </div>

        <section>
          <div className="mb-5 flex items-end justify-between">
            <div>
              <h2 className="text-2xl font-black">
                الباقات الحالية
              </h2>

              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {packages.length} باقة
              </p>
            </div>
          </div>

          {loading ? (
            <div className="flex min-h-60 items-center justify-center rounded-3xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
              <Loader2
                size={28}
                className="animate-spin text-blue-600"
              />
            </div>
          ) : packages.length ===
            0 ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900">
              <p className="font-bold text-slate-500">
                لا توجد باقات.
              </p>
            </div>
          ) : (
            <div className="grid gap-5 lg:grid-cols-3">
              {packages.map((pkg) => {
                const serviceType: ServiceType =
                  pkg.serviceType === "VIP"
                    ? "VIP"
                    : "IPTV";

                const relatedDevices =
                  devices.filter(
                    (device) =>
                      device.packages?.some(
                        (item) =>
                          item.id ===
                          pkg.id
                      )
                  );

                return (
                  <article
                    key={pkg.id}
                    className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
                  >
                    <div className="relative h-48 overflow-hidden bg-slate-100 dark:bg-slate-800">
                      {pkg.imageUrl ? (
                        <img
                          src={
                            pkg.imageUrl
                          }
                          alt={
                            pkg.name
                          }
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full flex-col items-center justify-center text-slate-400">
                          <ImagePlus
                            size={32}
                          />

                          <span className="mt-2 text-xs font-bold">
                            لا توجد صورة
                          </span>
                        </div>
                      )}

                      <div className="absolute right-4 top-4 flex gap-2">
                        <span
                          className={`rounded-full px-3 py-1.5 text-[11px] font-black ${
                            serviceType ===
                            "VIP"
                              ? "bg-cyan-600 text-white"
                              : "bg-blue-600 text-white"
                          }`}
                        >
                          {getServiceLabel(
                            serviceType
                          )}
                        </span>

                        <span
                          className={`rounded-full px-3 py-1.5 text-[11px] font-black ${
                            pkg.isActive
                              ? "bg-emerald-500 text-white"
                              : "bg-slate-900/80 text-white"
                          }`}
                        >
                          {pkg.isActive
                            ? "مفعلة"
                            : "متوقفة"}
                        </span>
                      </div>
                    </div>

                    <div className="p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="text-xl font-black">
                            {
                              pkg.name
                            }
                          </h3>

                          <p
                            dir="ltr"
                            className="mt-1 text-xs text-slate-400"
                          >
                            {
                              pkg.slug
                            }
                          </p>
                        </div>

                        <div className="text-left">
                          <div className="text-lg font-black text-blue-600 dark:text-blue-400">
                            {formatPrice(
                              pkg.price
                            )}{" "}
                            الف
                          </div>
                        </div>
                      </div>

                      <p className="mt-4 line-clamp-2 text-sm leading-7 text-slate-500 dark:text-slate-400">
                        {
                          pkg.description
                        }
                      </p>

                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <div className="rounded-2xl bg-slate-50 px-4 py-3 text-xs font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                          الخدمة:{" "}
                          {getServiceLabel(
                            serviceType
                          )}
                        </div>

                        <div className="rounded-2xl bg-slate-50 px-4 py-3 text-xs font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                          المدة:{" "}
                          {
                            pkg.durationLabel
                          }
                        </div>
                      </div>

                      {serviceType ===
                        "VIP" && (
                        <div className="mt-4 rounded-2xl border border-cyan-200 bg-cyan-50/70 p-4 dark:border-cyan-500/20 dark:bg-cyan-500/10">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <Cpu
                                size={15}
                                className="text-cyan-600 dark:text-cyan-400"
                              />

                              <span className="text-xs font-black">
                                الأجهزة المتوافقة
                              </span>
                            </div>

                            <span className="text-xs font-black text-cyan-600 dark:text-cyan-400">
                              {
                                relatedDevices.length
                              }
                            </span>
                          </div>

                          {relatedDevices.length >
                          0 ? (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {relatedDevices
                                .slice(
                                  0,
                                  4
                                )
                                .map(
                                  (
                                    device
                                  ) => (
                                    <span
                                      key={
                                        device.id
                                      }
                                      className="rounded-full bg-white px-3 py-1.5 text-[10px] font-black text-slate-600 shadow-sm dark:bg-slate-900 dark:text-slate-300"
                                    >
                                      {
                                        device.name
                                      }
                                    </span>
                                  )
                                )}

                              {relatedDevices.length >
                                4 && (
                                <span className="rounded-full bg-white px-3 py-1.5 text-[10px] font-black text-slate-500 shadow-sm dark:bg-slate-900 dark:text-slate-400">
                                  +
                                  {relatedDevices.length -
                                    4}
                                </span>
                              )}
                            </div>
                          ) : (
                            <p className="mt-2 text-[11px] font-semibold text-slate-400">
                              لا توجد أجهزة مرتبطة بهذه الباقة.
                            </p>
                          )}
                        </div>
                      )}

                      <div className="mt-5 grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            startEdit(
                              pkg
                            )
                          }
                          className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-3 py-3 text-xs font-black transition hover:border-blue-200 hover:bg-blue-50 dark:border-slate-700 dark:hover:bg-slate-800"
                        >
                          <Edit3
                            size={14}
                          />
                          تعديل
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            void togglePackage(
                              pkg
                            )
                          }
                          className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-3 py-3 text-xs font-black transition hover:border-blue-200 hover:bg-blue-50 dark:border-slate-700 dark:hover:bg-slate-800"
                        >
                          {pkg.isActive ? (
                            <CircleX
                              size={
                                14
                              }
                            />
                          ) : (
                            <Check
                              size={
                                14
                              }
                            />
                          )}

                          {pkg.isActive
                            ? "إيقاف"
                            : "تفعيل"}
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            void deletePackage(
                              pkg
                            )
                          }
                          className="flex items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-3 text-xs font-black text-red-600 transition hover:bg-red-100 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400"
                        >
                          <Trash2
                            size={14}
                          />
                          حذف
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  dir = "rtl",
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  dir?: "rtl" | "ltr";
  disabled?: boolean;
}) {
  return (
    <label>
      {label && (
        <span className="mb-2 block text-sm font-black">
          {label}
        </span>
      )}

      <input
        dir={dir}
        type={type}
        value={value}
        disabled={disabled}
        onChange={(event) =>
          onChange(event.target.value)
        }
        placeholder={
          placeholder
        }
        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm outline-none transition focus:border-blue-500 focus:bg-white disabled:cursor-not-allowed disabled:opacity-70 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:bg-slate-800"
      />
    </label>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label>
      <span className="mb-2 block text-sm font-black">
        {label}
      </span>

      <textarea
        value={value}
        onChange={(event) =>
          onChange(
            event.target.value
          )
        }
        placeholder={
          placeholder
        }
        rows={4}
        className="w-full resize-y rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm leading-7 outline-none transition focus:border-blue-500 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:bg-slate-800"
      />
    </label>
  );
}