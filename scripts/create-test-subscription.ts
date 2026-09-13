import "dotenv/config";
import { db } from "../src/prisma/db";

async function main() {
  const user = await db.orm.public.User.first({
    email: "test@example.com",
  });

  if (!user) {
    throw new Error(
      "لم يتم العثور على test@example.com. أنشئ الحساب التجريبي أولاً."
    );
  }

  const existingSubscription =
    await db.orm.public.Subscription.first({
      username: "PRIME001",
    });

  if (existingSubscription) {
    console.log("الاشتراك التجريبي موجود مسبقاً:");
    console.log(existingSubscription);
    return;
  }

  const now = new Date();

  const startDate = now.toISOString();

  const expiry = new Date(now);
  expiry.setMonth(expiry.getMonth() + 1);

  const expiryDate = expiry.toISOString();

  const subscription =
    await db.orm.public.Subscription.create({
      userId: user.id,
      username: "PRIME001",
      password: "Prime123",
      macAddress: "00:11:22:33:44:55",
      status: "ACTIVE",
      packageName: "Premium 1 Month",
      startDate,
      expiryDate,
      connections: 1,
      maxConnections: 2,
    });

  console.log("تم إنشاء الاشتراك التجريبي بنجاح:");

  console.log({
    id: subscription.id,
    username: subscription.username,
    password: subscription.password,
    macAddress: subscription.macAddress,
    packageName: subscription.packageName,
    status: subscription.status,
    startDate: subscription.startDate,
    expiryDate: subscription.expiryDate,
  });
}

main().catch((error) => {
  console.error("CREATE_TEST_SUBSCRIPTION_ERROR:", error);
  process.exit(1);
});