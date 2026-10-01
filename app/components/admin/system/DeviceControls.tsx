"use client";

import { Ban, Loader2, Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { renameConsoleDeviceAction, revokeConsoleDeviceAction, type SecurityState } from "@/app/admin/security/actions";
import { useLanguage } from "@/app/components/LanguageProvider";
import { Button } from "@/app/ui/Button";
import { Dialog } from "@/app/ui/Dialog";
import { Input } from "@/app/ui/Field";
import { announceSessionExpired } from "@/app/ui/session-events";
import { useToast } from "@/app/ui/Toast";

/**
 * Rename / revoke one Console device. Both run server actions that check
 * ownership or the "staff" permission and write the audit log; revoking
 * asks for confirmation first.
 */
export function DeviceControls({ id, label, revoked }: { id: number; label: string; revoked: boolean }) {
  const { t } = useLanguage();
  const toast = useToast();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [renaming, setRenaming] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [name, setName] = useState(label);
  const [error, setError] = useState("");

  function run(action: (state: SecurityState, form: FormData) => Promise<SecurityState>, fields: Record<string, string>, done: () => void) {
    const form = new FormData();
    form.set("deviceId", String(id));
    for (const [key, value] of Object.entries(fields)) form.set(key, value);

    startTransition(async () => {
      const result = await action(null, form);
      if (result?.code === "UNAUTHENTICATED") announceSessionExpired();
      if (!result?.ok) {
        setError(result?.message ?? "");
        return;
      }
      setError("");
      toast(result.message);
      done();
      router.refresh();
    });
  }

  if (revoked) return null;

  return (
    <div className="space-y-2" data-testid="device-controls" data-device={id}>
      {renaming ? (
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            run(renameConsoleDeviceAction, { label: name }, () => setRenaming(false));
          }}
        >
          <Input value={name} onChange={(event) => setName(event.target.value)} maxLength={60} required aria-label={t("اسم الجهاز", "Device name")} className="h-9 w-48 py-1 text-sm" data-testid="device-rename-input" />
          <Button size="sm" type="submit" disabled={pending} data-testid="device-rename-save">
            {pending ? <Loader2 size={14} className="animate-spin" aria-hidden /> : null}
            {t("حفظ", "Save")}
          </Button>
          <Button size="sm" variant="ghost" type="button" onClick={() => { setRenaming(false); setName(label); setError(""); }}>{t("إلغاء", "Cancel")}</Button>
        </form>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="ghost" onClick={() => setRenaming(true)} data-testid="device-rename">
            <Pencil size={14} aria-hidden /> {t("تغيير الاسم", "Rename")}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setConfirming(true)} data-testid="device-revoke">
            <Ban size={14} aria-hidden /> {t("إلغاء الجهاز", "Revoke")}
          </Button>
        </div>
      )}
      {error ? <p className="text-xs font-semibold text-danger" role="alert" data-testid="device-error">{error}</p> : null}
      <Dialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title={t(`إلغاء «${label}»؟`, `Revoke “${label}”?`)}
        description={t(
          "يتوقف هذا الجهاز فورًا ولا يستطيع الدخول مرة أخرى بنفس التسجيل. أجهزتك الثانية وجلسات المتصفح لا تتأثر.",
          "This device stops immediately and can't sign in again with this registration. Your other devices and browser sessions aren't affected.",
        )}
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirming(false)}>{t("رجوع", "Back")}</Button>
            <Button
              variant="danger"
              disabled={pending}
              data-testid="device-revoke-confirm"
              onClick={() => {
                setConfirming(false);
                run(revokeConsoleDeviceAction, {}, () => undefined);
              }}
            >
              {t("إلغاء الجهاز", "Revoke device")}
            </Button>
          </div>
        }
      />
    </div>
  );
}
