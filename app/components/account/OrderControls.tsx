"use client";

import { useActionState, useState } from "react";
import { XCircle } from "lucide-react";

import { useLanguage } from "@/app/components/LanguageProvider";
import { cancelOrderAction } from "@/app/(site)/(account)/actions";
import { Button } from "@/app/ui/Button";
import { Dialog } from "@/app/ui/Dialog";
import { Notice } from "@/app/ui/States";
import { SubmitButton } from "@/app/ui/SubmitButton";

export function CancelOrderButton({ orderId, orderNumber }: { orderId: number; orderNumber: string }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(cancelOrderAction, null);

  return (
    <>
      <Button variant="danger" onClick={() => setOpen(true)}>
        <XCircle size={16} aria-hidden />
        {t("إلغاء الطلب", "Cancel order")}
      </Button>
      <Dialog
        open={open && !state?.ok}
        onClose={() => setOpen(false)}
        variant="drawer"
        title={t("إلغاء الطلب؟", "Cancel this order?")}
        description={t(`راح يتم إلغاء الطلب ${orderNumber}. تكدر تسوي طلب جديد بأي وقت.`, `Order ${orderNumber} will be cancelled. You can place a new order any time.`)}
        closeLabel={t("إغلاق", "Close")}
      >
        <form action={action} className="space-y-4">
          <input type="hidden" name="orderId" value={orderId} />
          {state && !state.ok ? <Notice tone="danger">{state.message}</Notice> : null}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              {t("تراجع", "Keep order")}
            </Button>
            <SubmitButton variant="danger" pendingLabel={t("جاري الإلغاء...", "Cancelling...")}>
              {t("نعم، ألغِ الطلب", "Yes, cancel it")}
            </SubmitButton>
          </div>
        </form>
      </Dialog>
    </>
  );
}
