"use client";

import { Loader2, LogOut, UserCog } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { AdminState } from "@/app/admin/actions";
import { useLanguage } from "@/app/components/LanguageProvider";
import { Button } from "@/app/ui/Button";
import { Dialog } from "@/app/ui/Dialog";
import { Select } from "@/app/ui/Field";
import { announceSessionExpired } from "@/app/ui/session-events";
import { useToast } from "@/app/ui/Toast";

/**
 * Staff controls. Both run the existing server actions (setUserRoleAction,
 * revokeStaffSessionsAction), which check the "staff" permission and the
 * privilege rules on the server and write the audit log. Every change asks
 * for confirmation first.
 */

type Action = (state: AdminState, formData: FormData) => Promise<AdminState>;

function useRun() {
  const toast = useToast();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function run(action: Action, form: FormData, done: () => void) {
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

  return { run, pending, error, setError };
}

export function RoleControl({ userId, name, role, roles, labels, action }: { userId: number; name: string; role: string; roles: readonly string[]; labels: Record<string, string>; action: Action }) {
  const { t } = useLanguage();
  const [next, setNext] = useState(role === "ADMIN" ? "OWNER" : role);
  const [open, setOpen] = useState(false);
  const { run, pending, error, setError } = useRun();
  const removing = next === "CUSTOMER";
  const granting = next === "OWNER";

  return (
    <div className="space-y-1" data-testid="role-control" data-user={userId}>
      <div className="flex flex-wrap items-center gap-2">
        <Select value={next} onChange={(event) => setNext(event.target.value)} className="w-auto py-2 text-sm" aria-label={t(`دور ${name}`, `Role of ${name}`)} data-testid="role-select">
          {roles.map((value) => <option key={value} value={value}>{labels[value] ?? value}</option>)}
        </Select>
        <Button size="sm" variant="secondary" disabled={next === role || (role === "ADMIN" && next === "OWNER")} onClick={() => { setError(""); setOpen(true); }} data-testid="role-apply">
          <UserCog size={15} aria-hidden /> {t("تغيير", "Change")}
        </Button>
      </div>
      {error ? <p className="text-xs font-semibold text-danger" role="alert" data-testid="role-error">{error}</p> : null}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={t(`تغيير دور ${name}؟`, `Change ${name}'s role?`)}
        description={
          removing
            ? t("سيفقد الوصول للوحة الإدارة فورًا ويبقى حسابه كعميل.", "They lose console access immediately; their account stays as a customer.")
            : granting
              ? t("سيحصل على كل الصلاحيات، بما فيها إدارة الفريق والإعدادات وسجل التدقيق والمالية.", "They get every permission, including staff, settings, the audit log and finance.")
              : t(`الدور الجديد: ${labels[next] ?? next}. يسري فورًا على كل طلب.`, `New role: ${labels[next] ?? next}. It applies immediately on every request.`)
        }
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>{t("إلغاء", "Cancel")}</Button>
            <Button
              variant={removing ? "danger" : "primary"}
              disabled={pending}
              data-testid="role-confirm"
              onClick={() => {
                const form = new FormData();
                form.set("userId", String(userId));
                form.set("role", next);
                run(action, form, () => setOpen(false));
                setOpen(false);
              }}
            >
              {pending ? <Loader2 size={15} className="animate-spin" aria-hidden /> : null}
              {t("تأكيد", "Confirm")}
            </Button>
          </div>
        }
      />
    </div>
  );
}

export function RevokeSessions({ userId, name, action }: { userId: number; name: string; action: Action }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const { run, pending, error } = useRun();

  return (
    <div className="space-y-1">
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)} data-testid="revoke-sessions">
        <LogOut size={15} aria-hidden /> {t("إنهاء كل جلساته", "End all sessions")}
      </Button>
      {error ? <p className="text-xs font-semibold text-danger" role="alert">{error}</p> : null}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={t(`إنهاء كل جلسات ${name}؟`, `End all of ${name}'s sessions?`)}
        description={t("يُسجَّل خروجه من كل الأجهزة فورًا ويحتاج تسجيل الدخول من جديد. دوره لا يتغير.", "They're signed out on every device right away and must sign in again. Their role doesn't change.")}
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>{t("إلغاء", "Cancel")}</Button>
            <Button
              variant="danger"
              disabled={pending}
              data-testid="revoke-confirm"
              onClick={() => {
                const form = new FormData();
                form.set("userId", String(userId));
                run(action, form, () => setOpen(false));
                setOpen(false);
              }}
            >
              {pending ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <LogOut size={15} aria-hidden />}
              {t("إنهاء الجلسات", "End sessions")}
            </Button>
          </div>
        }
      />
    </div>
  );
}
