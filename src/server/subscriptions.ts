import { db } from "@/src/prisma/db";
import {
  daysRemaining,
  deriveSubscriptionState,
  remainingFraction,
} from "@/src/lib/subscription-state";

export type CustomerSubscription = {
  id: number;
  serviceType: string;
  packageName: string;
  packageId: number | null;
  packageSlug: string | null;
  status: string;
  state: ReturnType<typeof deriveSubscriptionState>;
  daysRemaining: number;
  remainingFraction: number;
  startDate: string;
  expiryDate: string;
  username: string | null;
  password: string | null;
  macAddress: string | null;
  deviceId: string | null;
  maxConnections: number;
  createdAt: string;
};

export async function listSubscriptionsForUser(
  userId: number,
): Promise<CustomerSubscription[]> {
  const [rows, packages] = await Promise.all([
    db.orm.public.Subscription.where({ userId })
      .orderBy((subscription) => subscription.expiryDate.desc())
      .all(),
    db.orm.public.Package.all(),
  ]);

  return rows.map((row) => {
    // Older subscriptions only store the package name.
    const pkg =
      packages.find((item) => item.id === row.packageId) ??
      packages.find((item) => item.name.trim() === row.packageName.trim());

    return {
      id: row.id,
      serviceType: String(row.serviceType).toUpperCase(),
      packageName: row.packageName,
      packageId: pkg?.id ?? null,
      packageSlug: pkg?.isActive ? pkg.slug : null,
      status: row.status,
      state: deriveSubscriptionState(row),
      daysRemaining: daysRemaining(row.expiryDate),
      remainingFraction: remainingFraction(row),
      startDate: String(row.startDate),
      expiryDate: String(row.expiryDate),
      username: row.username,
      password: row.password,
      macAddress: row.macAddress,
      deviceId: row.deviceId,
      maxConnections: row.maxConnections,
      createdAt: String(row.createdAt),
    };
  });
}

export async function getSubscriptionForUser(userId: number, subscriptionId: number) {
  const subscriptions = await listSubscriptionsForUser(userId);

  return subscriptions.find((item) => item.id === subscriptionId) ?? null;
}

export async function listReceiptsForUser(userId: number) {
  return db.orm.public.Receipt.where({ userId })
    .orderBy((receipt) => receipt.id.desc())
    .all();
}
