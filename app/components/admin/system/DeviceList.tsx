import { Laptop, MonitorSmartphone, Smartphone, Tablet } from "lucide-react";

import { DeviceControls } from "@/app/components/admin/system/DeviceControls";
import { Badge } from "@/app/ui/Badge";
import type { DeviceView } from "@/src/lib/console-api";
import { formatDateTime, type Lang, type Translate } from "@/src/lib/i18n";

/**
 * Console app devices (Phase 10A). Safe metadata only — the list never
 * receives credential verifiers, tokens or push tokens. With `owners`, the
 * owner's name is shown (team view).
 */
export function DeviceList({ devices, t, lang, owners, empty }: { devices: DeviceView[]; t: Translate; lang: Lang; owners?: Map<number, string>; empty: string }) {
  if (!devices.length) return <p className="rounded-xl bg-white/[0.03] px-3 py-4 text-center text-sm text-ink-3" data-testid="devices-empty">{empty}</p>;

  const platform: Record<string, { label: string; icon: typeof Laptop }> = {
    WINDOWS: { label: "Windows", icon: Laptop },
    ANDROID: { label: "Android", icon: Smartphone },
    IOS: { label: "iOS", icon: Tablet },
    WEB: { label: t("متصفح", "Web"), icon: MonitorSmartphone },
  };
  const status: Record<DeviceView["status"], { label: string; tone: "success" | "warning" | "danger" }> = {
    ACTIVE: { label: t("نشط", "Active"), tone: "success" },
    SIGNED_OUT: { label: t("خرج", "Signed out"), tone: "warning" },
    REVOKED: { label: t("ملغى", "Revoked"), tone: "danger" },
  };

  return (
    <ul className="divide-y divide-line/60" data-testid="device-list">
      {devices.map((device) => {
        const kind = platform[device.platform] ?? platform.WEB;
        const Icon = kind.icon;

        return (
          <li key={device.id} className="flex flex-wrap items-start justify-between gap-3 py-3" data-testid="device-row" data-device={device.id} data-status={device.status}>
            <div className="flex min-w-0 items-start gap-3">
              <Icon size={18} className="mt-0.5 shrink-0 text-brand-ink" aria-hidden />
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 font-semibold text-ink">
                  <span className="break-words" data-testid="device-label">{device.label}</span>
                  <Badge tone={status[device.status].tone}>{status[device.status].label}</Badge>
                </p>
                <p className="nums text-xs text-ink-3">
                  {owners ? `${owners.get(device.userId) ?? `#${device.userId}`} · ` : ""}
                  {kind.label}
                  {device.appVersion ? ` · v${device.appVersion}` : ""}
                  {" · "}
                  {t("أُضيف", "added")} {formatDateTime(device.createdAt, lang)}
                  {device.lastSeenAt ? ` · ${t("آخر نشاط", "last seen")} ${formatDateTime(device.lastSeenAt, lang)}` : ""}
                </p>
              </div>
            </div>
            <DeviceControls id={device.id} label={device.label} revoked={device.status === "REVOKED"} />
          </li>
        );
      })}
    </ul>
  );
}
