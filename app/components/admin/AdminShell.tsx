"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  Activity,
  AppWindow,
  BarChart3,
  Bell,
  Boxes,
  Briefcase,
  CircleDollarSign,
  Cpu,
  Download,
  ExternalLink,
  FileSpreadsheet,
  Inbox,
  KeyRound,
  LayoutDashboard,
  LayoutGrid,
  Link2,
  LockKeyhole,
  LogOut,
  ImageIcon,
  Megaphone,
  Newspaper,
  MessagesSquare,
  Package,
  PackageCheck,
  RefreshCw,
  ScrollText,
  Search,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Tv,
  UsersRound,
  WalletCards,
  Workflow,
  X,
} from "lucide-react";

import { useLanguage } from "@/app/components/LanguageProvider";
import { cn } from "@/app/ui/cn";
import { LogoImage } from "@/app/ui/Logo";

import { ConsoleRuntime, consoleSignOut, useInstallPrompt, useStandalone } from "./ConsoleRuntime";
import { activeHref, primaryItems, type AdminNavGroup } from "./nav";

const ICONS: Record<string, typeof Inbox> = {
  inbox: Inbox,
  home: LayoutDashboard,
  operations: Workflow,
  orders: ShoppingBag,
  activations: PackageCheck,
  renewals: RefreshCw,
  customers: UsersRound,
  subscriptions: Tv,
  lookup: Search,
  resets: KeyRound,
  catalogue: Boxes,
  packages: Package,
  devices: Cpu,
  compatibility: Link2,
  apps: AppWindow,
  tickets: MessagesSquare,
  announcements: Megaphone,
  promotions: Sparkles,
  news: Newspaper,
  media: ImageIcon,
  notifications: Bell,
  status: Activity,
  leads: Briefcase,
  insights: BarChart3,
  revenue: CircleDollarSign,
  finance: WalletCards,
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
  const current = activeHref(pathname, groups.flatMap((group) => group.items.map((item) => item.href)));

  return (
    <nav aria-label={language === "ar" ? "قائمة الإدارة" : "Admin navigation"} className="space-y-6">
      {groups.map((group) => (
        <div key={group.en}>
          <p className="px-3 text-[11px] font-bold uppercase tracking-[0.16em] text-ink-3">{group[language]}</p>
          <ul className="mt-2 space-y-0.5">
            {group.items.map((item) => {
              const Icon = ICONS[item.icon] ?? Inbox;
              const active = item.href === current;
              const badge = item.badgeKey ? counts[item.badgeKey] : undefined;

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition xl:h-10",
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

/**
 * The Shashtna Console app shell — one admin, three layouts:
 *  - desktop (≥1280px): full sidebar
 *  - tablet (768–1279px): icon rail with the primary destinations + "More"
 *  - mobile (<768px): bottom tab bar with the primary destinations + "More"
 * "More" opens the full navigation. Installed (standalone) it runs in its
 * own window with safe-area insets respected.
 */
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
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const install = useInstallPrompt();
  const standalone = useStandalone();
  const primary = primaryItems(groups, 4);
  const railItems = primaryItems(groups, 6);
  const inMore = !primary.some((item) => isActive(pathname, item.href));

  // Close the drawer on navigation and with Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);

    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const footer = (
    <div className="space-y-1 border-t border-line pt-4">
      <div className="px-3 pb-2">
        <p className="truncate text-sm font-bold text-ink">{user.name}</p>
        <p className="text-xs text-ink-3">{roleLabel}</p>
      </div>
      {install.available && !standalone ? (
        <button type="button" onClick={install.install} className="flex h-10 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold text-brand-ink hover:bg-surface-2 hover:text-ink" data-testid="console-install">
          <Download size={17} aria-hidden />
          {t("تثبيت التطبيق", "Install app")}
        </button>
      ) : null}
      <Link href="/admin/security" onClick={() => setOpen(false)} className="flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-ink-2 hover:bg-surface-2 hover:text-ink" data-testid="console-security-link">
        <LockKeyhole size={17} aria-hidden />
        {t("الأمان والجلسات", "Security & sessions")}
      </Link>
      <a href="/" target="_blank" rel="noopener" className="flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-ink-2 hover:bg-surface-2 hover:text-ink">
        <ExternalLink size={17} aria-hidden />
        {t("فتح الموقع", "Open website")}
      </a>
      <button type="button" onClick={consoleSignOut} className="flex h-10 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold text-ink-2 hover:bg-surface-2 hover:text-danger">
        <LogOut size={17} aria-hidden />
        {t("تسجيل الخروج", "Sign out")}
      </button>
    </div>
  );

  const sidebar = (onNavigate?: () => void) => (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-3 pb-6">
        <LogoImage className="h-11" />
        <p className="text-xs font-semibold text-ink-3">{t("لوحة الإدارة", "Admin console")}</p>
      </div>
      <div className="flex-1 overflow-y-auto overscroll-contain pb-6">
        <Nav groups={groups} counts={counts} onNavigate={onNavigate} />
      </div>
      {footer}
    </div>
  );

  return (
    <div className="min-h-dvh bg-canvas" data-console-shell>
      {/* Desktop: full sidebar */}
      <aside className="fixed inset-y-0 start-0 z-30 hidden w-68 border-e border-line bg-canvas-deep p-4 pt-[max(1rem,env(safe-area-inset-top))] xl:block" data-testid="console-sidebar">
        {sidebar()}
      </aside>

      {/* Tablet: icon rail */}
      <aside className="fixed inset-y-0 start-0 z-30 hidden w-24 flex-col items-center gap-1 border-e border-line bg-canvas-deep px-2 pb-4 pt-[max(1rem,env(safe-area-inset-top))] md:flex xl:hidden" data-testid="console-rail">
        <Link href="/admin" className="mb-3 grid h-12 w-12 place-items-center" aria-label={t("الرئيسية", "Home")}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/shashtna-mark-256.webp" alt="" width={44} height={44} className="h-11 w-11 object-contain" />
        </Link>
        <nav aria-label={t("التنقل الرئيسي", "Primary navigation")} className="flex w-full flex-1 flex-col items-center gap-1 overflow-y-auto">
          {railItems.map((item) => {
            const Icon = ICONS[item.icon] ?? Inbox;
            const active = isActive(pathname, item.href);
            const badge = item.badgeKey ? counts[item.badgeKey] : undefined;

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn("relative flex w-full flex-col items-center gap-1 rounded-2xl px-1 py-2.5 text-[11px] font-semibold transition", active ? "bg-brand/18 text-ink" : "text-ink-3 hover:bg-surface-2 hover:text-ink")}
              >
                <Icon size={20} className={active ? "text-brand-ink" : undefined} aria-hidden />
                <span className="max-w-full truncate">{item.short[language]}</span>
                {badge ? <span className="nums absolute end-2 top-1.5 min-w-4 rounded-full bg-glow px-1 text-center text-[10px] font-bold leading-4 text-navy">{badge}</span> : null}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setOpen(true)}
            className={cn("flex w-full flex-col items-center gap-1 rounded-2xl px-1 py-2.5 text-[11px] font-semibold transition", inMore ? "bg-brand/18 text-ink" : "text-ink-3 hover:bg-surface-2 hover:text-ink")}
            aria-haspopup="dialog"
            aria-expanded={open}
          >
            <LayoutGrid size={20} aria-hidden />
            {t("المزيد", "More")}
          </button>
        </nav>
      </aside>

      {/* "More": full navigation drawer (tablet + mobile) */}
      {open ? (
        <div className="fixed inset-0 z-50 xl:hidden" role="dialog" aria-modal="true" aria-label={t("كل الأقسام", "All sections")} data-testid="console-drawer">
          <button type="button" className="absolute inset-0 bg-black/70" onClick={() => setOpen(false)} aria-label={t("إغلاق", "Close")} />
          <div className="absolute inset-y-0 start-0 w-[86%] max-w-sm border-e border-line bg-canvas-deep p-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
            <button type="button" onClick={() => setOpen(false)} className="absolute end-3 top-[max(0.75rem,env(safe-area-inset-top))] grid h-10 w-10 place-items-center rounded-xl text-ink-3 hover:text-ink" aria-label={t("إغلاق", "Close")}>
              <X size={19} aria-hidden />
            </button>
            {sidebar(() => setOpen(false))}
          </div>
        </div>
      ) : null}

      <div className="md:ps-24 xl:ps-68">
        <header className="sticky top-0 z-20 border-b border-line bg-canvas/90 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/shashtna-mark-256.webp" alt="" width={36} height={36} className="h-9 w-9 shrink-0 object-contain md:hidden" />
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
          </div>
        </header>
        <ConsoleRuntime />
        <main id="main" className="mx-auto w-full max-w-7xl px-4 py-6 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:px-6 sm:py-8 md:pb-8">
          {children}
        </main>
      </div>

      {/* Mobile: bottom tab bar */}
      <nav
        aria-label={t("التنقل الرئيسي", "Primary navigation")}
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-canvas-deep/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
        data-testid="console-bottom-nav"
      >
        <ul className="mx-auto flex max-w-lg">
          {primary.map((item) => {
            const Icon = ICONS[item.icon] ?? Inbox;
            const active = isActive(pathname, item.href);
            const badge = item.badgeKey ? counts[item.badgeKey] : undefined;

            return (
              <li key={item.href} className="flex-1">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn("relative flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold", active ? "text-ink" : "text-ink-3")}
                >
                  <span className={cn("grid h-8 w-12 place-items-center rounded-full transition", active && "bg-brand/22")}>
                    <Icon size={20} className={active ? "text-brand-ink" : undefined} aria-hidden />
                  </span>
                  <span className="max-w-full truncate px-1">{item.short[language]}</span>
                  {badge ? <span className="nums absolute top-1.5 ms-7 min-w-4 rounded-full bg-glow px-1 text-center text-[10px] font-bold leading-4 text-navy">{badge}</span> : null}
                </Link>
              </li>
            );
          })}
          <li className="flex-1">
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={open}
              className={cn("flex h-16 w-full flex-col items-center justify-center gap-1 text-[11px] font-semibold", inMore ? "text-ink" : "text-ink-3")}
              data-testid="console-more"
            >
              <span className={cn("grid h-8 w-12 place-items-center rounded-full transition", inMore && "bg-brand/22")}>
                <LayoutGrid size={20} className={inMore ? "text-brand-ink" : undefined} aria-hidden />
              </span>
              {t("المزيد", "More")}
            </button>
          </li>
        </ul>
      </nav>
    </div>
  );
}
