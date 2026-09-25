"use client";

import { Send } from "lucide-react";
import { startTransition, useActionState, useState } from "react";

import { uploadPaymentProofAction, type ActionState } from "@/app/(site)/(account)/actions";
import { useLanguage } from "@/app/components/LanguageProvider";
import { Field, Input } from "@/app/ui/Field";
import { Notice } from "@/app/ui/States";
import { SubmitButton } from "@/app/ui/SubmitButton";

import { ProofPicker } from "./ProofPicker";

/** Upload or replace the transfer proof for an unpaid order. */
export function OrderProofForm({
  orderId,
  paymentReference,
  replacing,
}: {
  orderId: number;
  paymentReference: string | null;
  replacing: boolean;
}) {
  const { t } = useLanguage();
  const [state, action, pending] = useActionState<ActionState, FormData>(uploadPaymentProofAction, null);
  const [hasProof, setHasProof] = useState(false);
  const [missing, setMissing] = useState(false);
  const [pickerKey, setPickerKey] = useState(0);
  const [seenState, setSeenState] = useState<ActionState>(null);

  // After a successful upload, clear the picker (the page now shows the saved proof).
  if (state !== seenState) {
    setSeenState(state);

    if (state?.ok) {
      setPickerKey((key) => key + 1);
      setHasProof(false);
    }
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!hasProof) {
      setMissing(true);
      return;
    }

    const formData = new FormData(event.currentTarget);
    startTransition(() => action(formData));
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <input type="hidden" name="orderId" value={orderId} />
      {state ? <Notice tone={state.ok ? "success" : "danger"}>{state.message}</Notice> : null}
      <ProofPicker
        key={pickerKey}
        error={missing && !hasProof ? t("يرجى رفع صورة إثبات الدفع.", "Please upload the payment proof.") : null}
        onChange={(value) => {
          setHasProof(value);
          if (value) {
            setMissing(false);
          }
        }}
      />
      <Field
        label={t("رقم العملية / رقم التحويل (اختياري)", "Transaction / transfer number (optional)")}
        htmlFor={`paymentReference-${orderId}`}
      >
        <Input
          id={`paymentReference-${orderId}`}
          name="paymentReference"
          defaultValue={paymentReference ?? ""}
          maxLength={120}
          dir="ltr"
          autoComplete="off"
          className="text-start"
        />
      </Field>
      <SubmitButton className="w-full" pending={pending} pendingLabel={t("جاري الرفع...", "Uploading...")}>
        <Send size={16} className="rtl:-scale-x-100" aria-hidden />
        {replacing ? t("إرسال الصورة الجديدة", "Send new image") : t("إرسال إثبات الدفع", "Send payment proof")}
      </SubmitButton>
    </form>
  );
}
