import { NextResponse } from "next/server";

import { formatOrderNumber, normalizeOrderStatus } from "@/src/lib/order-status";
import { requireAdmin } from "@/src/lib/session";
import { db } from "@/src/prisma/db";
import { logActivity } from "@/src/server/activity";

export const dynamic = "force-dynamic";

function csv(rows: (string | number | null | undefined)[][]) {
  const escape = (value: string | number | null | undefined) => {
    const text = String(value ?? "");
    // Neutralise spreadsheet formula injection and quote every cell.
    const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
    return `"${safe.replace(/"/g, '""')}"`;
  };

  // BOM so Excel opens Arabic text correctly.
  return "﻿" + rows.map((row) => row.map(escape).join(",")).join("\r\n");
}

/** CSV exports for staff with the insights permission. Credentials are never exported. */
export async function GET(request: Request) {
  const admin = await requireAdmin(request, "insights");

  if (!admin.ok) {
    return admin.response;
  }

  const type = new URL(request.url).searchParams.get("type");
  let rows: (string | number | null)[][];

  if (type === "customers") {
    const users = await db.orm.public.User.orderBy((user) => user.id.asc()).all();
    rows = [["id", "name", "phone", "email", "role", "preferredContact", "marketingOptIn", "createdAt"]];
    users.forEach((user) => rows.push([user.id, user.name, user.phone, user.email, user.role, user.preferredContact, user.marketingOptIn ? "yes" : "no", String(user.createdAt)]));
  } else if (type === "orders") {
    const orders = await db.orm.public.SubscriptionRequest.orderBy((order) => order.id.asc()).all();
    rows = [["order", "userId", "type", "service", "serviceType", "price", "duration", "device", "status", "contactMethod", "paymentMethod", "paymentReference", "createdAt"]];
    orders.forEach((order) =>
      rows.push([formatOrderNumber(order.id), order.userId, order.requestType, order.serviceName, order.serviceType, order.price, order.durationLabel, order.deviceName, normalizeOrderStatus(order.status), order.contactMethod, order.paymentMethod, order.paymentReference, String(order.createdAt)]),
    );
  } else if (type === "subscriptions") {
    const subscriptions = await db.orm.public.Subscription.orderBy((subscription) => subscription.id.asc()).all();
    rows = [["id", "userId", "serviceType", "package", "status", "startDate", "expiryDate", "maxConnections"]];
    subscriptions.forEach((subscription) =>
      rows.push([subscription.id, subscription.userId, subscription.serviceType, subscription.packageName, subscription.status, String(subscription.startDate), String(subscription.expiryDate), subscription.maxConnections]),
    );
  } else if (type === "receipts") {
    const receipts = await db.orm.public.Receipt.orderBy((receipt) => receipt.id.asc()).all();
    rows = [["receiptNumber", "userId", "subscriptionId", "orderId", "service", "serviceType", "price", "duration", "status", "createdAt"]];
    receipts.forEach((receipt) =>
      rows.push([receipt.receiptNumber, receipt.userId, receipt.subscriptionId, receipt.orderId ? formatOrderNumber(receipt.orderId) : null, receipt.serviceName, receipt.serviceType, receipt.price, receipt.durationLabel, receipt.status, String(receipt.createdAt)]),
    );
  } else {
    return NextResponse.json({ success: false, message: "نوع التقرير غير صحيح." }, { status: 400 });
  }

  await logActivity({ actor: admin.user, entityType: "SETTING", action: "REPORT_EXPORTED", summary: `تصدير تقرير ${type}` });

  return new NextResponse(csv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="shashtna-${type}-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
