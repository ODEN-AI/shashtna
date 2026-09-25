"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  Activity,
  AppWindow,
  BarChart3,
  Bell,
  Briefcase,
  CircleDollarSign,
  Cpu,
  ExternalLink,
  FileSpreadsheet,
  Inbox,
  KeyRound,
  LogOut,
  Megaphone,
  Menu,
  MessagesSquare,
  Package,
  PackageCheck,
  RefreshCw,
  ScrollText,
  Search,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Tv,
  UsersRound,
} from "lucide-react";

import { useLanguage } from "@/app/components/LanguageProvider";
import { signOut } from "@/app/components/site/SiteHeader";
import { cn } from "@/app/ui/cn";
import { LogoMark } from "@/app/ui/Logo";

import type { AdminNavGroup } from "./nav";

const ICONS: Record<string, typeof Inbox> = {
  inbox: Inbox,
  orders: ShoppingBag,
  activations: PackageCheck,
  renewals: RefreshCw,
  customers: UsersRound,
  subscriptions: Tv,
  lookup: Search,
  resets: KeyRound,
  packages: Package,
  devices: Cpu,
  apps: AppWindow,
  tickets: MessagesSquare,
  announcements: Megaphone,
  notifications: Bell,
  status: Activity,
  leads: Briefcase,
  insights: BarChart3,
  revenue: CircleDollarSign,
  reports: FileSpreadsheet,
  admins: ShieldCheck,
  audit: ScrollText,
  settings: Settings,
};

type Counts = Partial<Record<string, number>>;

function isActive(pathname: string, href: string) {
  return href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`);
}

function Nav({ groups, counts, onNavigate }: { groups: AdminNavGroup[]; counts: Counts; onNavigate?: () => void }) {
  const pathname = usePathname();
  const { language } = useLanguage();

  return (
    <nav aria-label={language === "ar" ? "قائمة الإدارة" : "Admin navigation"} className="space-y-6">
      {groups.map((group) => (
        <div key={group.en}>
          <p className="px-3 text-[11px] font-bold uppercase tracking-[0.16em] text-ink-3">{group[language]}</p>
          <ul className="mt-2 space-y-0.5">
            {group.items.map((item) => {
              const Icon = ICONS[item.icon] ?? Inbox;
              const active = isActive(pathname, item.href);
              const badge = item.badgeKey ? counts[item.badgeKey] : undefined;

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition",
                      active ? "bg-brand/15 text-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink",
                    )}
                  >
                    <Icon size={17} className={active ? "text-brand-ink" : "text-ink-3"} aria-hidden />
                    <span className="flex-1 truncate">{item[language]}</span>
                    {badge ? (
                      <span className="nums rounded-full bg-glow/15 px-2 py-0.5 text-[11px] font-bold text-glow">{badge}</span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function AdminShell({
  groups,
  counts,
  user,
  roleLabel,
  children,
}: {
  groups: AdminNavGroup[];
  counts: Counts;
  user: { name: string };
  roleLabel: string;
  children: ReactNode;
}) {
  const { t, language, toggleLanguage } = useLanguage();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-3 pb-6">
        <LogoMark />
        <div className="leading-tight">
          <p className="font-bold text-ink">{t("شاشتنا", "Shashtna")}</p>
          <p className="text-xs text-ink-3">{t("لوحة الإدارة", "Admin console")}</p>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto pb-6">
        <Nav groups={groups} counts={counts} onNavigate={() => setOpen(false)} />
      </div>
      <div className="space-y-1 border-t border-line pt-4">
        <div className="px-3 pb-2">
          <p className="truncate text-sm font-bold text-ink">{user.name}</p>
          <p className="text-xs text-ink-3">{roleLabel}</p>
        </div>
        <Link href="/" className="flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-ink-2 hover:bg-surface-2 hover:text-ink">
          <ExternalLink size={17} aria-hidden />
          {t("العودة للموقع", "Back to site")}
        </Link>
        <button type="button" onClick={signOut} className="flex h-10 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold text-ink-2 hover:bg-surface-2 hover:text-danger">
          <LogOut size={17} aria-hidden />
          {t("تسجيل الخروج", "Sign out")}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh bg-canvas">
      <aside className="fixed inset-y-0 start-0 z-30 hidden w-68 border-e border-line bg-[#060c18] p-4 lg:block">{sidebar}</aside>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label={t("القائمة", "Menu")}>
          <button type="button" className="absolute inset-0 bg-black/70" onClick={() => setOpen(false)} aria-label={t("إغلاق", "Close")} />
          <div className="absolute inset-y-0 start-0 w-[85%] max-w-xs border-e border-line bg-[#060c18] p-4">{sidebar}</div>
        </div>
      ) : null}

      <div className="lg:ps-68">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-canvas/90 px-4 backdrop-blur-xl sm:px-6">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-line text-ink-2 lg:hidden"
            aria-label={t("فتح القائمة", "Open menu")}
          >
            <Menu size={19} aria-hidden />
          </button>
          <form
            role="search"
            className="relative max-w-md flex-1"
            onSubmit={(event) => {
              event.preventDefault();

              if (query.trim()) {
                router.push(`/admin/customers?q=${encodeURIComponent(query.trim())}`);
              }
            }}
          >
            <Search size={16} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink-3" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("ابحث عن عميل بالاسم أو الهاتف…", "Search customers by name or phone…")}
              aria-label={t("بحث", "Search")}
              className="h-10 w-full rounded-xl border border-line bg-surface ps-9 pe-3 text-sm text-ink placeholder:text-ink-3 focus:border-brand focus:outline-none"
            />
          </form>
          <button
            type="button"
            onClick={toggleLanguage}
            className="ms-auto flex h-10 min-w-10 items-center justify-center rounded-xl border border-line px-3 text-xs font-bold text-ink-2 hover:text-ink"
            aria-label={language === "ar" ? "Switch to English" : "التبديل إلى العربية"}
          >
            {language === "ar" ? "EN" : "ع"}
          </button>
        </header>
        <main id="main" className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
