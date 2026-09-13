import { NextResponse } from "next/server";
import { db } from "@/src/prisma/db";

function isSameDay(value: string) {
  const date = new Date(value);
  const now = new Date();

  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

export async function GET() {
  try {
    const [
      users,
      subscriptions,
      packages,
      apps,
      requests,
      receipts,
    ] = await Promise.all([
      db.orm.public.User.all(),
      db.orm.public.Subscription.all(),
      db.orm.public.Package.all(),
      db.orm.public.App.all(),
      db.orm.public.SubscriptionRequest.all(),
      db.orm.public.Receipt.all(),
    ]);

    const now = new Date();

    const activeSubscriptions = subscriptions.filter(
      (item) =>
        item.status.toUpperCase() === "ACTIVE" &&
        !Number.isNaN(new Date(item.expiryDate).getTime()) &&
        new Date(item.expiryDate) >= now
    );

    const expiredSubscriptions = subscriptions.filter((item) => {
      const expiry = new Date(item.expiryDate);

      return (
        item.status.toUpperCase() === "EXPIRED" ||
        (!Number.isNaN(expiry.getTime()) && expiry < now)
      );
    });

    const pendingRequests = requests.filter(
      (item) => item.status.toUpperCase() === "PENDING"
    );

    const acceptedRequests = requests.filter(
      (item) => item.status.toUpperCase() === "ACCEPTED"
    );

    const rejectedRequests = requests.filter(
      (item) => item.status.toUpperCase() === "REJECTED"
    );

    const totalRevenue = receipts.reduce(
      (sum, receipt) => sum + Number(receipt.price || 0),
      0
    );

    const todaySales = receipts
      .filter((receipt) => isSameDay(receipt.createdAt))
      .reduce((sum, receipt) => sum + Number(receipt.price || 0), 0);

    const monthlyRevenue = receipts
      .filter((receipt) => {
        const date = new Date(receipt.createdAt);

        return (
          date.getFullYear() === now.getFullYear() &&
          date.getMonth() === now.getMonth()
        );
      })
      .reduce((sum, receipt) => sum + Number(receipt.price || 0), 0);

    const totalCustomers = users.filter(
      (user) => user.role.toUpperCase() !== "ADMIN"
    ).length;

    const activePackages = packages.filter(
      (item) => item.isActive
    ).length;

    const activeApps = apps.filter(
      (item) => item.isActive
    ).length;

    const totalConnections = subscriptions.reduce(
      (sum, subscription) => sum + Number(subscription.connections || 0),
      0
    );

    const totalMaxConnections = subscriptions.reduce(
      (sum, subscription) =>
        sum + Number(subscription.maxConnections || 0),
      0
    );

    const stats = {
      totalUsers: users.length,
      totalCustomers,

      totalSubscriptions: subscriptions.length,
      activeSubscriptions: activeSubscriptions.length,
      expiredSubscriptions: expiredSubscriptions.length,

      totalPackages: packages.length,
      activePackages,

      totalApps: apps.length,
      activeApps,

      totalRequests: requests.length,
      pendingRequests: pendingRequests.length,
      acceptedRequests: acceptedRequests.length,
      rejectedRequests: rejectedRequests.length,

      totalReceipts: receipts.length,

      totalRevenue,
      monthlyRevenue,
      todaySales,

      totalExpenses: 0,
      netProfit: totalRevenue,

      totalDebts: 0,

      totalConnections,
      totalMaxConnections,
    };

    return NextResponse.json({
      success: true,

      stats,

      // Keep these at the top level too so older admin UI code
      // can continue working without breaking.
      totalUsers: stats.totalUsers,
      totalCustomers: stats.totalCustomers,

      totalSubscriptions: stats.totalSubscriptions,
      activeSubscriptions: stats.activeSubscriptions,
      expiredSubscriptions: stats.expiredSubscriptions,

      totalPackages: stats.totalPackages,
      activePackages: stats.activePackages,

      totalApps: stats.totalApps,
      activeApps: stats.activeApps,

      totalRequests: stats.totalRequests,
      pendingRequests: stats.pendingRequests,
      acceptedRequests: stats.acceptedRequests,
      rejectedRequests: stats.rejectedRequests,

      totalReceipts: stats.totalReceipts,

      totalRevenue: stats.totalRevenue,
      monthlyRevenue: stats.monthlyRevenue,
      todaySales: stats.todaySales,

      totalExpenses: stats.totalExpenses,
      netProfit: stats.netProfit,
      totalDebts: stats.totalDebts,

      totalConnections: stats.totalConnections,
      totalMaxConnections: stats.totalMaxConnections,
    });
  } catch (error) {
    console.error("Admin stats GET error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "تعذر تحميل إحصائيات لوحة الإدارة.",
        stats: {
          totalUsers: 0,
          totalCustomers: 0,
          totalSubscriptions: 0,
          activeSubscriptions: 0,
          expiredSubscriptions: 0,
          totalPackages: 0,
          activePackages: 0,
          totalApps: 0,
          activeApps: 0,
          totalRequests: 0,
          pendingRequests: 0,
          acceptedRequests: 0,
          rejectedRequests: 0,
          totalReceipts: 0,
          totalRevenue: 0,
          monthlyRevenue: 0,
          todaySales: 0,
          totalExpenses: 0,
          netProfit: 0,
          totalDebts: 0,
          totalConnections: 0,
          totalMaxConnections: 0,
        },
      },
      {
        status: 500,
      }
    );
  }
}