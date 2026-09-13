"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Activity,
  AppWindow,
  Bell,
  ChevronLeft,
  CreditCard,
  Headphones,
  LayoutDashboard,
  LogOut,
  Package,
  Search,
  Settings,
  ShieldCheck,
  Smartphone,
  Tv,
  Users,
  RefreshCw,
  Languages,
  Sun,
  Moon,
  MessageCircle,
} from "lucide-react";

type UserData = {
  id: number;
  name: string;
  phone: string;
  email: string;
  role: string;
};

type Stats = {
  customers: number;
  totalUsers: number;
  subscriptions: number;
  activeSubscriptions: number;
  expiredSubscriptions: number;
  expiringSoon: number;
  currentConnections: number;
};

type Language = "ar" | "en";

const emptyStats: Stats = {
  customers: 0,
  totalUsers: 0,
  subscriptions: 0,
  activeSubscriptions: 0,
  expiredSubscriptions: 0,
  expiringSoon: 0,
  currentConnections: 0,
};

const menuItems = [
  {
    titleAr: "الرئيسية",
    titleEn: "Dashboard",
    href: "/admin",
    icon: LayoutDashboard,
  },
  {
    titleAr: "طلبات الاشتراك",
    titleEn: "Subscription requests",
    href: "/admin/subscription-requests",
    icon: MessageCircle,
  },
  {
    titleAr: "العملاء",
    titleEn: "Customers",
    href: "/admin/customers",
    icon: Users,
  },
  {
    titleAr: "البحث عن اشتراك",
    titleEn: "Subscription lookup",
    href: "/admin/lookup",
    icon: Search,
  },
  {
    titleAr: "الاشتراكات",
    titleEn: "Subscriptions",
    href: "/admin/subscriptions",
    icon: Tv,
  },
  {
    titleAr: "الاتصالات المباشرة",
    titleEn: "Live connections",
    href: "/admin/live-connections",
    icon: Smartphone,
  },
  {
    titleAr: "الطلبات",
    titleEn: "Orders",
    href: "/admin/orders",
    icon: CreditCard,
  },
  {
    titleAr: "الباقات",
    titleEn: "Plans",
    href: "/admin/packages",
    icon: Package,
  },
  {
    titleAr: "التطبيقات",
    titleEn: "Apps",
    href: "/admin/apps",
    icon: AppWindow,
  },
  {
    titleAr: "الدعم",
    titleEn: "Support",
    href: "/admin/support",
    icon: Headphones,
  },
  {
    titleAr: "الإشعارات",
    titleEn: "Notifications",
    href: "/admin/notifications",
    icon: Bell,
  },
  {
    titleAr: "سجل النشاطات",
    titleEn: "Activity logs",
    href: "/admin/activity-logs",
    icon: Activity,
  },
  {
    titleAr: "المستخدمون الإداريون",
    titleEn: "Administrators",
    href: "/admin/admins",
    icon: ShieldCheck,
  },
  {
    titleAr: "الإعدادات",
    titleEn: "Settings",
    href: "/admin/settings",
    icon: Settings,
  },
];

export default function AdminDashboardPage() {
  const [user, setUser] =
    useState<UserData | null>(null);

  const [stats, setStats] =
    useState<Stats>(emptyStats);

  const [loadingStats, setLoadingStats] =
    useState(true);

  const [statsError, setStatsError] =
    useState("");

  const [language, setLanguage] =
    useState<Language>("ar");

  const [darkMode, setDarkMode] =
    useState(false);

  const [mounted, setMounted] =
    useState(false);

  const isArabic =
    language === "ar";

  useEffect(() => {
    setMounted(true);

    try {
      const storedUser =
        localStorage.getItem("user");

      if (storedUser) {
        setUser(
          JSON.parse(storedUser)
        );
      }
    } catch {
      localStorage.removeItem("user");
      setUser(null);
    }

    const savedLanguage =
      localStorage.getItem("language");

    if (
      savedLanguage === "ar" ||
      savedLanguage === "en"
    ) {
      setLanguage(savedLanguage);
    }

    const savedTheme =
      localStorage.getItem("theme");

    if (savedTheme === "dark") {
      document.documentElement.classList.add(
        "dark"
      );
      setDarkMode(true);
    } else if (
      savedTheme === "light"
    ) {
      document.documentElement.classList.remove(
        "dark"
      );
      setDarkMode(false);
    } else {
      const prefersDark =
        window.matchMedia(
          "(prefers-color-scheme: dark)"
        ).matches;

      if (prefersDark) {
        document.documentElement.classList.add(
          "dark"
        );
        setDarkMode(true);
      }
    }

    loadStats();
  }, []);

  useEffect(() => {
    if (!mounted) {
      return;
    }

    document.documentElement.lang =
      language;

    document.documentElement.dir =
      language === "ar"
        ? "rtl"
        : "ltr";

    localStorage.setItem(
      "language",
      language
    );
  }, [
    language,
    mounted,
  ]);

  async function loadStats() {
    try {
      setLoadingStats(true);
      setStatsError("");

      const response =
        await fetch(
          "/api/admin/stats",
          {
            method: "GET",
            cache: "no-store",
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
            "Unable to load admin statistics"
        );
      }

      setStats({
        customers: Number(
          data.stats?.customers ??
            0
        ),
        totalUsers: Number(
          data.stats?.totalUsers ??
            0
        ),
        subscriptions: Number(
          data.stats?.subscriptions ??
            0
        ),
        activeSubscriptions:
          Number(
            data.stats
              ?.activeSubscriptions ??
              0
          ),
        expiredSubscriptions:
          Number(
            data.stats
              ?.expiredSubscriptions ??
              0
          ),
        expiringSoon: Number(
          data.stats
            ?.expiringSoon ?? 0
        ),
        currentConnections:
          Number(
            data.stats
              ?.currentConnections ??
              0
          ),
      });
    } catch (error) {
      console.error(error);

      setStatsError(
        error instanceof Error
          ? error.message
          : isArabic
            ? "حدث خطأ أثناء جلب الإحصائيات"
            : "An error occurred while loading statistics"
      );
    } finally {
      setLoadingStats(false);
    }
  }

  function logout() {
    localStorage.removeItem(
      "user"
    );

    localStorage.removeItem(
      "remember"
    );

    window.location.href =
      "/";
  }

  function toggleLanguage() {
    setLanguage((current) =>
      current === "ar"
        ? "en"
        : "ar"
    );
  }

  function toggleDarkMode() {
    const nextMode =
      !darkMode;

    setDarkMode(nextMode);

    if (nextMode) {
      document.documentElement.classList.add(
        "dark"
      );

      localStorage.setItem(
        "theme",
        "dark"
      );
    } else {
      document.documentElement.classList.remove(
        "dark"
      );

      localStorage.setItem(
        "theme",
        "light"
      );
    }
  }

  return (
    <main
      dir={
        isArabic
          ? "rtl"
          : "ltr"
      }
      className="min-h-screen bg-slate-50 text-slate-900 transition-colors dark:bg-slate-950 dark:text-white"
    >
      {/* Sidebar */}
      <aside
        className={`fixed top-0 hidden h-screen w-72 border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 lg:block ${
          isArabic
            ? "right-0 border-l"
            : "left-0 border-r"
        }`}
      >
        <div className="flex h-full flex-col">
          <div className="border-b border-slate-100 px-6 py-6 dark:border-slate-800">
            <Link
              href="/admin"
              className="block"
            >
              <div className="text-2xl font-black tracking-tight">
                شاشتنا
              </div>

              <div className="mt-1 text-xs font-medium text-slate-400">
                {isArabic
                  ? "لوحة الإدارة"
                  : "Admin panel"}
              </div>
            </Link>
          </div>

          <nav className="flex-1 overflow-y-auto p-4">
            <div className="mb-3 px-3 text-xs font-bold text-slate-400">
              {isArabic
                ? "الإدارة"
                : "Administration"}
            </div>

            <div className="space-y-1">
              {menuItems.map(
                (item) => {
                  const Icon =
                    item.icon;

                  return (
                    <Link
                      key={
                        item.href
                      }
                      href={
                        item.href
                      }
                      className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition ${
                        item.href ===
                        "/admin"
                          ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                          : "text-slate-600 hover:bg-slate-50 hover:text-blue-600 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-blue-400"
                      }`}
                    >
                      <Icon
                        size={19}
                      />

                      <span>
                        {isArabic
                          ? item.titleAr
                          : item.titleEn}
                      </span>
                    </Link>
                  );
                }
              )}
            </div>
          </nav>

          <div className="border-t border-slate-100 p-4 dark:border-slate-800">
            <Link
              href="/"
              className="flex items-center justify-between rounded-xl px-4 py-3 text-sm font-semibold text-slate-500 transition hover:bg-slate-50 hover:text-blue-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-blue-400"
            >
              <span>
                {isArabic
                  ? "العودة للموقع"
                  : "Back to website"}
              </span>

              <ChevronLeft
                size={18}
                className={
                  isArabic
                    ? ""
                    : "rotate-180"
                }
              />
            </Link>

            <button
              type="button"
              onClick={logout}
              className="mt-1 flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-red-500 transition hover:bg-red-50 dark:hover:bg-red-950/30"
            >
              <LogOut
                size={18}
              />

              {isArabic
                ? "تسجيل الخروج"
                : "Sign out"}
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div
        className={
          isArabic
            ? "lg:mr-72"
            : "lg:ml-72"
        }
      >
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
          <div className="flex items-center justify-between gap-4 px-5 py-5 lg:px-8">
            <div>
              <p className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                {isArabic
                  ? "لوحة الإدارة"
                  : "Admin dashboard"}
              </p>

              <h1 className="mt-1 text-2xl font-black">
                {isArabic
                  ? `أهلاً ${user?.name || "بك"} 👋`
                  : `Welcome ${user?.name || "there"} 👋`}
              </h1>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              {mounted && (
                <button
                  type="button"
                  onClick={
                    toggleLanguage
                  }
                  className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-blue-500/30 dark:hover:bg-slate-800 dark:hover:text-blue-400"
                >
                  <Languages
                    size={16}
                  />

                  {isArabic
                    ? "EN"
                    : "العربية"}
                </button>
              )}

              {mounted && (
                <button
                  type="button"
                  onClick={
                    toggleDarkMode
                  }
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-blue-500/30"
                >
                  {darkMode ? (
                    <Sun
                      size={17}
                    />
                  ) : (
                    <Moon
                      size={17}
                    />
                  )}
                </button>
              )}

              <button
                type="button"
                onClick={loadStats}
                disabled={
                  loadingStats
                }
                className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 transition hover:border-blue-200 hover:text-blue-600 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
              >
                <RefreshCw
                  size={15}
                  className={
                    loadingStats
                      ? "animate-spin"
                      : ""
                  }
                />

                <span className="hidden sm:block">
                  {isArabic
                    ? "تحديث"
                    : "Refresh"}
                </span>
              </button>

              <div className="hidden rounded-xl border border-slate-200 bg-white px-4 py-2 dark:border-slate-700 dark:bg-slate-800 sm:block">
                <p className="text-xs text-slate-400">
                  {isArabic
                    ? "الحساب الحالي"
                    : "Current account"}
                </p>

                <p className="text-sm font-bold">
                  {user?.name ||
                    (isArabic
                      ? "جاري التحميل..."
                      : "Loading...")}
                </p>
              </div>
            </div>
          </div>
        </header>

        <section className="p-5 lg:p-8">
          {statsError && (
            <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
              {statsError}
            </div>
          )}

          {/* Stats */}
          <div className="mb-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              title={
                isArabic
                  ? "إجمالي العملاء"
                  : "Total customers"
              }
              value={
                stats.customers
              }
              description={
                isArabic
                  ? `${stats.totalUsers} حساب إجمالي`
                  : `${stats.totalUsers} total accounts`
              }
              icon={Users}
              loading={
                loadingStats
              }
            />

            <StatCard
              title={
                isArabic
                  ? "الاشتراكات النشطة"
                  : "Active subscriptions"
              }
              value={
                stats.activeSubscriptions
              }
              description={
                isArabic
                  ? `${stats.subscriptions} اشتراك إجمالي`
                  : `${stats.subscriptions} total subscriptions`
              }
              icon={Tv}
              loading={
                loadingStats
              }
            />

            <StatCard
              title={
                isArabic
                  ? "تنتهي قريبًا"
                  : "Expiring soon"
              }
              value={
                stats.expiringSoon
              }
              description={
                isArabic
                  ? "خلال 7 أيام"
                  : "Within 7 days"
              }
              icon={Bell}
              loading={
                loadingStats
              }
            />

            <StatCard
              title={
                isArabic
                  ? "الاتصالات الحالية"
                  : "Current connections"
              }
              value={
                stats.currentConnections
              }
              description={
                isArabic
                  ? `${stats.expiredSubscriptions} اشتراك منتهي`
                  : `${stats.expiredSubscriptions} expired subscriptions`
              }
              icon={Activity}
              loading={
                loadingStats
              }
            />
          </div>

          {/* Quick actions */}
          <div className="mb-8 grid gap-5 md:grid-cols-2 xl:grid-cols-5">
            <QuickAction
              href="/admin/subscription-requests"
              icon={
                MessageCircle
              }
              title={
                isArabic
                  ? "طلبات الاشتراك"
                  : "Subscription requests"
              }
              description={
                isArabic
                  ? "طلبات الزبائن الجديدة"
                  : "New customer requests"
              }
            />

            <QuickAction
              href="/admin/customers"
              icon={Users}
              title={
                isArabic
                  ? "إدارة العملاء"
                  : "Manage customers"
              }
              description={
                isArabic
                  ? "عرض حسابات العملاء"
                  : "View customer accounts"
              }
            />

            <QuickAction
              href="/admin/subscriptions"
              icon={Tv}
              title={
                isArabic
                  ? "إدارة الاشتراكات"
                  : "Manage subscriptions"
              }
              description={
                isArabic
                  ? "متابعة الاشتراكات"
                  : "Monitor subscriptions"
              }
            />

            <QuickAction
              href="/admin/packages"
              icon={Package}
              title={
                isArabic
                  ? "إدارة الباقات"
                  : "Manage plans"
              }
              description={
                isArabic
                  ? "إضافة وتعديل الباقات"
                  : "Add and edit plans"
              }
            />

            <QuickAction
              href="/admin/apps"
              icon={AppWindow}
              title={
                isArabic
                  ? "إدارة التطبيقات"
                  : "Manage apps"
              }
              description={
                isArabic
                  ? "نشر تطبيقات للمستخدمين"
                  : "Publish apps for users"
              }
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            {/* Activity */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 xl:col-span-2">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-black">
                    {isArabic
                      ? "آخر النشاطات"
                      : "Recent activity"}
                  </h2>

                  <p className="mt-1 text-sm text-slate-400">
                    {isArabic
                      ? "آخر العمليات التي تمت داخل النظام"
                      : "Latest operations performed in the system"}
                  </p>
                </div>

                <Link
                  href="/admin/activity-logs"
                  className="text-sm font-bold text-blue-600 dark:text-blue-400"
                >
                  {isArabic
                    ? "عرض الكل"
                    : "View all"}
                </Link>
              </div>

              <div className="flex min-h-52 items-center justify-center rounded-xl bg-slate-50 dark:bg-slate-800">
                <div className="text-center">
                  <Activity
                    size={32}
                    className="mx-auto mb-3 text-slate-300 dark:text-slate-600"
                  />

                  <p className="text-sm font-semibold text-slate-400">
                    {isArabic
                      ? "لا توجد نشاطات حتى الآن"
                      : "No activity yet"}
                  </p>
                </div>
              </div>
            </div>

            {/* Fast actions */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-6">
                <h2 className="text-lg font-black">
                  {isArabic
                    ? "إجراءات سريعة"
                    : "Quick actions"}
                </h2>

                <p className="mt-1 text-sm text-slate-400">
                  {isArabic
                    ? "أدوات الإدارة الأساسية"
                    : "Essential admin tools"}
                </p>
              </div>

              <div className="space-y-3">
                <QuickAction
                  href="/admin/subscription-requests"
                  icon={
                    MessageCircle
                  }
                  title={
                    isArabic
                      ? "طلبات الاشتراك"
                      : "Subscription requests"
                  }
                  description={
                    isArabic
                      ? "طلبات العملاء"
                      : "Customer requests"
                  }
                />

                <QuickAction
                  href="/admin/lookup"
                  icon={Search}
                  title={
                    isArabic
                      ? "البحث عن اشتراك"
                      : "Subscription lookup"
                  }
                  description={
                    isArabic
                      ? "MAC أو Username"
                      : "MAC or username"
                  }
                />

                <QuickAction
                  href="/admin/live-connections"
                  icon={Smartphone}
                  title={
                    isArabic
                      ? "الاتصالات المباشرة"
                      : "Live connections"
                  }
                  description={
                    isArabic
                      ? `${stats.currentConnections} اتصال حالي`
                      : `${stats.currentConnections} current connections`
                  }
                />

                <QuickAction
                  href="/admin/orders"
                  icon={CreditCard}
                  title={
                    isArabic
                      ? "الطلبات"
                      : "Orders"
                  }
                  description={
                    isArabic
                      ? "إدارة طلبات العملاء"
                      : "Manage customer orders"
                  }
                />

                <QuickAction
                  href="/admin/support"
                  icon={Headphones}
                  title={
                    isArabic
                      ? "الدعم"
                      : "Support"
                  }
                  description={
                    isArabic
                      ? "متابعة طلبات الدعم"
                      : "Monitor support requests"
                  }
                />
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function StatCard({
  title,
  value,
  description,
  icon: Icon,
  loading,
}: {
  title: string;
  value: number;
  description: string;
  icon: React.ComponentType<{
    size?: number;
  }>;
  loading: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-5 flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
            {title}
          </p>

          {loading ? (
            <div className="mt-3 h-9 w-20 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
          ) : (
            <p className="mt-2 text-3xl font-black">
              {value.toLocaleString(
                "en-US"
              )}
            </p>
          )}
        </div>

        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
          <Icon size={21} />
        </div>
      </div>

      <p className="text-xs font-medium text-slate-400">
        {description}
      </p>
    </div>
  );
}

function QuickAction({
  href,
  icon: Icon,
  title,
  description,
}: {
  href: string;
  icon: React.ComponentType<{
    size?: number;
  }>;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50/40 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-500/20 dark:hover:bg-blue-950/20"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-500 transition group-hover:bg-blue-100 group-hover:text-blue-600 dark:bg-slate-800 dark:text-slate-400 dark:group-hover:bg-blue-500/10 dark:group-hover:text-blue-400">
        <Icon size={19} />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold">
          {title}
        </p>

        <p className="mt-1 text-xs text-slate-400">
          {description}
        </p>
      </div>

      <ChevronLeft
        size={18}
        className="shrink-0 text-slate-300 transition group-hover:text-blue-600 dark:text-slate-600 dark:group-hover:text-blue-400"
      />
    </Link>
  );
}