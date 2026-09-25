import { redirect } from "next/navigation";

export default function ReceiptsPage() {
  redirect("/orders?tab=receipts");
}
