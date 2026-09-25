import { db } from "@/src/prisma/db";
import { parseOrderNumber } from "@/src/lib/order-status";
import { serializeOrder } from "@/src/server/orders";

export type CustomerRef = { id: number; name: string; phone: string; role: string };

export async function customersById(ids: number[]) {
  const unique = [...new Set(ids.filter((id) => Number.isInteger(id)))];

  if (!unique.length) {
    return new Map<number, CustomerRef>();
  }

  const users = await db.orm.public.User.where((user) => user.id.in(unique)).all();

  return new Map(users.map((user) => [user.id, { id: user.id, name: user.name, phone: user.phone, role: user.role }]));
}

export async function listOrdersAdmin(options: { statuses?: string[]; type?: string; q?: string } = {}) {
  let query = db.orm.public.SubscriptionRequest.orderBy((order) => order.id.desc());

  if (options.statuses?.length) {
    query = query.where((order) => order.status.in(options.statuses!));
  }

  if (options.type) {
    query = query.where({ requestType: options.type });
  }

  const rows = await query.all();
  const customers = await customersById(rows.map((row) => row.userId));
  let orders = rows.map((row) => ({ ...serializeOrder(row, { staff: true }), customer: customers.get(row.userId) ?? null }));

  const q = options.q?.trim().toLowerCase();

  if (q) {
    const byNumber = parseOrderNumber(q);
    orders = orders.filter(
      (order) =>
        order.id === byNumber ||
        order.customer?.name.toLowerCase().includes(q) ||
        order.customer?.phone.includes(q) ||
        order.serviceName.toLowerCase().includes(q),
    );
  }

  return orders;
}

export type AdminOrder = Awaited<ReturnType<typeof listOrdersAdmin>>[number];
