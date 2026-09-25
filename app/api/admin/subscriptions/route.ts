import { NextResponse } from "next/server";
import { requireAdmin } from "@/src/lib/session";
import { isOpen } from "@/src/lib/order-status";
import { logActivity } from "@/src/server/activity";
import { completeOrderWithSubscription } from "@/src/server/orders";
import {
  db,
  ensureDatabaseConnection,
} from "@/src/prisma/db";

type RequestBody = {
  requestId?: number;
  userId?: number;
  serviceName?: string;
  serviceType?: string;
  username?: string;
  password?: string;
  macAddress?: string;
  deviceId?: string;
  startDate?: string;
  expiryDate?: string;
  price?: number;
  durationMonths?: number;
  durationLabel?: string;
  bonusYears?: number;

  subscriptionId?: number;
  packageName?: string;
  status?: string;
  maxConnections?: number;
};

function normalizeDateOnly(
  value: unknown
) {
  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  const stringValue =
    String(value).trim();

  if (!stringValue) {
    return "";
  }

  const match =
    stringValue.match(
      /^(\d{4}-\d{2}-\d{2})/
    );

  if (match?.[1]) {
    return match[1];
  }

  const parsed =
    new Date(stringValue);

  if (
    Number.isNaN(
      parsed.getTime()
    )
  ) {
    return "";
  }

  const year =
    parsed.getFullYear();

  const month =
    String(
      parsed.getMonth() + 1
    ).padStart(2, "0");

  const day =
    String(
      parsed.getDate()
    ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function calculateExpiryDate(
  startDateString: string,
  months: number
) {
  const normalizedStart =
    normalizeDateOnly(
      startDateString
    );

  if (
    !normalizedStart ||
    !Number.isInteger(
      months
    ) ||
    months <= 0
  ) {
    return null;
  }

  const startDate =
    new Date(
      `${normalizedStart}T00:00:00`
    );

  if (
    Number.isNaN(
      startDate.getTime()
    )
  ) {
    return null;
  }

  startDate.setMonth(
    startDate.getMonth() +
      months
  );

  const year =
    startDate.getFullYear();

  const month =
    String(
      startDate.getMonth() + 1
    ).padStart(2, "0");

  const day =
    String(
      startDate.getDate()
    ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function addMonthsToDate(
  dateString: string,
  months: number
) {
  return calculateExpiryDate(
    dateString,
    months
  );
}

function getTodayDate() {
  const today =
    new Date();

  const year =
    today.getFullYear();

  const month =
    String(
      today.getMonth() + 1
    ).padStart(2, "0");

  const day =
    String(
      today.getDate()
    ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function isDateBeforeToday(
  dateString: string
) {
  const normalized =
    normalizeDateOnly(
      dateString
    );

  if (!normalized) {
    return false;
  }

  return (
    normalized <
    getTodayDate()
  );
}

function generateReceiptNumber() {
  const now =
    new Date();

  const year =
    now.getFullYear();

  const month =
    String(
      now.getMonth() + 1
    ).padStart(2, "0");

  const day =
    String(
      now.getDate()
    ).padStart(2, "0");

  const hours =
    String(
      now.getHours()
    ).padStart(2, "0");

  const minutes =
    String(
      now.getMinutes()
    ).padStart(2, "0");

  const seconds =
    String(
      now.getSeconds()
    ).padStart(2, "0");

  const random =
    Math.floor(
      1000 +
        Math.random() *
          9000
    );

  return `SHASHTNA-${year}${month}${day}-${hours}${minutes}${seconds}-${random}`;
}

function getYearLabel(
  years: number
) {
  if (years === 1) {
    return "سنة واحدة";
  }

  if (years === 2) {
    return "سنتين";
  }

  return `${years} سنوات`;
}

function getBonusLabel(
  years: number
) {
  if (years === 0) {
    return "بدون بونص";
  }

  if (years === 1) {
    return "سنة واحدة بونص";
  }

  if (years === 2) {
    return "سنتين بونص";
  }

  return `${years} سنوات بونص`;
}

function getNewDurationLabel(
  baseLabel: string,
  bonusYears: number
) {
  if (!bonusYears) {
    return baseLabel;
  }

  return `${baseLabel} + ${getBonusLabel(
    bonusYears
  )}`;
}

export async function GET(request: Request) {
  try {
    const admin = await requireAdmin(request, "subscriptions");

    if (!admin.ok) {
      return admin.response;
    }

    await ensureDatabaseConnection();

    const subscriptions =
      await db.orm.public.Subscription.all();

    const customers =
      await Promise.all(
        subscriptions.map(
          async (
            subscription
          ) => {
            const user =
              await db.orm.public.User.first(
                {
                  id:
                    subscription.userId,
                }
              );

            return {
              id:
                subscription.id,

              userId:
                subscription.userId,

              customerName:
                user?.name ??
                "Unknown",

              customerEmail:
                user?.email ??
                "",

              customerPhone:
                user?.phone ??
                "",

              serviceType:
                subscription.serviceType,

              username:
                subscription.username,

              password:
                subscription.password,

              macAddress:
                subscription.macAddress,

              deviceId:
                subscription.deviceId,

              status:
                subscription.status,

              packageName:
                subscription.packageName,

              startDate:
                subscription.startDate,

              expiryDate:
                subscription.expiryDate,

              connections:
                subscription.connections,

              maxConnections:
                subscription.maxConnections,

              createdAt:
                subscription.createdAt,

              updatedAt:
                subscription.updatedAt,
            };
          }
        )
      );

    customers.sort(
      (a, b) =>
        new Date(
          b.createdAt
        ).getTime() -
        new Date(
          a.createdAt
        ).getTime()
    );

    return NextResponse.json({
      success: true,
      subscriptions:
        customers,
    });
  } catch (error) {
    console.error(
      "Admin subscriptions GET error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "تعذر تحميل الاشتراكات.",
        subscriptions: [],
      },
      { status: 500 }
    );
  }
}

/*
 * ==========================================================
 * EDIT EXISTING SUBSCRIPTION
 * ==========================================================
 */

export async function PATCH(
  request: Request
) {
  try {
    const admin = await requireAdmin(request, "subscriptions");

    if (!admin.ok) {
      return admin.response;
    }

    await ensureDatabaseConnection();

    const body =
      (await request.json()) as RequestBody;

    const subscriptionId =
      body.subscriptionId;

    if (
      !subscriptionId ||
      !Number.isInteger(
        subscriptionId
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "معرف الاشتراك غير صحيح.",
        },
        { status: 400 }
      );
    }

    const existingSubscription =
      await db.orm.public.Subscription.first(
        {
          id:
            subscriptionId,
        }
      );

    if (
      !existingSubscription
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "الاشتراك غير موجود.",
        },
        { status: 404 }
      );
    }

    const serviceType =
      String(
        existingSubscription.serviceType ??
          "IPTV"
      )
        .trim()
        .toUpperCase();

    const packageName =
      body.packageName?.trim();

    const username =
      body.username?.trim() ||
      null;

    const password =
      body.password?.trim() ||
      null;

    const macAddress =
      body.macAddress?.trim() ||
      null;

    const deviceId =
      body.deviceId?.trim() ||
      null;

    const startDate =
      normalizeDateOnly(
        body.startDate
      );

    const expiryDate =
      normalizeDateOnly(
        body.expiryDate
      );

    const status =
      body.status
        ?.trim()
        .toUpperCase() ||
      existingSubscription.status;

    const maxConnections =
      body.maxConnections;

    if (
      !packageName
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "اسم الباقة غير صحيح.",
        },
        { status: 400 }
      );
    }

    if (
      !startDate ||
      !expiryDate
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "تاريخ البداية أو الانتهاء غير صحيح.",
        },
        { status: 400 }
      );
    }

    if (
      expiryDate <
      startDate
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "تاريخ الانتهاء لا يمكن أن يكون قبل تاريخ البداية.",
        },
        { status: 400 }
      );
    }

    if (
      !Number.isInteger(
        maxConnections
      ) ||
      maxConnections! < 1 ||
      maxConnections! > 100
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "الحد الأقصى للاتصالات يجب أن يكون بين 1 و100.",
        },
        { status: 400 }
      );
    }

    const validStatuses =
      new Set([
        "ACTIVE",
        "EXPIRED",
        "SUSPENDED",
        "CANCELLED",
      ]);

    if (
      !validStatuses.has(
        status
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "حالة الاشتراك غير صحيحة.",
        },
        { status: 400 }
      );
    }

    if (
      serviceType ===
      "IPTV"
    ) {
      if (
        !username ||
        !password
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "اشتراك IPTV يحتاج Username و Password.",
          },
          { status: 400 }
        );
      }

      /*
       * Username is unique in the database.
       * Make sure another subscription does not
       * already use the new username.
       */
      if (
        username !==
        existingSubscription.username
      ) {
        const existingUsername =
          await db.orm.public.Subscription.first(
            {
              username,
            }
          );

        if (
          existingUsername &&
          existingUsername.id !==
            subscriptionId
        ) {
          return NextResponse.json(
            {
              success: false,
              message:
                "اسم المستخدم هذا مستخدم مسبقاً.",
            },
            { status: 409 }
          );
        }
      }
    }

    if (
      serviceType ===
      "VIP"
    ) {
      if (!deviceId) {
        return NextResponse.json(
          {
            success: false,
            message:
              "اشتراك VIP يحتاج Device ID أو Serial Number.",
          },
          { status: 400 }
        );
      }

      /*
       * Device ID is unique in the database.
       */
      if (
        deviceId !==
        existingSubscription.deviceId
      ) {
        const existingDevice =
          await db.orm.public.Subscription.first(
            {
              deviceId,
            }
          );

        if (
          existingDevice &&
          existingDevice.id !==
            subscriptionId
        ) {
          return NextResponse.json(
            {
              success: false,
              message:
                "Device ID أو Serial Number هذا مرتبط باشتراك آخر.",
            },
            { status: 409 }
          );
        }
      }
    }

    const updated =
      await db.orm.public.Subscription
        .where({
          id:
            subscriptionId,
        })
        .update({
          packageName,

          username:
            serviceType ===
            "IPTV"
              ? username
              : null,

          password:
            serviceType ===
            "IPTV"
              ? password
              : null,

          macAddress:
            serviceType ===
            "IPTV"
              ? macAddress
              : null,

          deviceId:
            serviceType ===
            "VIP"
              ? deviceId
              : null,

          status,

          startDate,

          expiryDate,

          maxConnections:
            maxConnections!,
        });

    if (!updated) {
      return NextResponse.json(
        {
          success: false,
          message:
            "تعذر تعديل الاشتراك.",
        },
        { status: 500 }
      );
    }

    await logActivity({
      actor: admin.user,
      userId: updated.userId,
      entityType: "SUBSCRIPTION",
      entityId: updated.id,
      action: "SUBSCRIPTION_UPDATED",
      summary: `تم تحديث بيانات الاشتراك (الحالة: ${updated.status}، الانتهاء: ${String(updated.expiryDate).slice(0, 10)})`,
      customerVisible: true,
    });

    return NextResponse.json(
      {
        success: true,
        message:
          "تم تعديل الاشتراك بنجاح.",
        subscription: {
          id:
            updated.id,

          userId:
            updated.userId,

          serviceType:
            updated.serviceType,

          username:
            updated.username,

          password:
            updated.password,

          macAddress:
            updated.macAddress,

          deviceId:
            updated.deviceId,

          status:
            updated.status,

          packageName:
            updated.packageName,

          startDate:
            updated.startDate,

          expiryDate:
            updated.expiryDate,

          connections:
            updated.connections,

          maxConnections:
            updated.maxConnections,

          updatedAt:
            updated.updatedAt,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(
      "Admin subscription PATCH error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "حدث خطأ أثناء تعديل الاشتراك.",
      },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request
) {
  try {
    const admin = await requireAdmin(request, "subscriptions");

    if (!admin.ok) {
      return admin.response;
    }

    await ensureDatabaseConnection();

    const body =
      (await request.json()) as RequestBody;

    const requestId =
      body.requestId;

    const userId =
      body.userId;

    const serviceType =
      body.serviceType
        ?.trim()
        .toUpperCase() ||
      "IPTV";

    const serviceName =
      body.serviceName?.trim();

    const username =
      body.username?.trim() ||
      null;

    const password =
      body.password?.trim() ||
      null;

    const macAddress =
      body.macAddress?.trim() ||
      null;

    const deviceId =
      body.deviceId?.trim() ||
      null;

    const startDate =
      body.startDate;

    const price =
      body.price;

    const requestedDurationMonths =
      body.durationMonths;

    const requestedDurationLabel =
      body.durationLabel?.trim();

    const requestedBonusYears =
      body.bonusYears;

    if (
      !requestId ||
      !userId ||
      !serviceName ||
      !startDate ||
      typeof price !==
        "number"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "يرجى تعبئة جميع البيانات المطلوبة.",
        },
        { status: 400 }
      );
    }

    if (
      serviceType !==
        "IPTV" &&
      serviceType !==
        "VIP"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "نوع الخدمة غير صحيح.",
        },
        { status: 400 }
      );
    }

    if (price < 0) {
      return NextResponse.json(
        {
          success: false,
          message:
            "السعر غير صحيح.",
        },
        { status: 400 }
      );
    }

    const subscriptionRequest =
      await db.orm.public.SubscriptionRequest.first(
        {
          id:
            requestId,
        }
      );

    if (
      !subscriptionRequest
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "طلب الاشتراك غير موجود.",
        },
        { status: 404 }
      );
    }

    if (
      !isOpen(
        subscriptionRequest.status
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "هذا الطلب تمت معالجته مسبقاً.",
        },
        { status: 400 }
      );
    }

    if (
      subscriptionRequest.userId !==
      userId
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "بيانات العميل لا تطابق الطلب.",
        },
        { status: 400 }
      );
    }

    if (
      subscriptionRequest.serviceType.toUpperCase() !==
      serviceType
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "نوع الخدمة لا يطابق نوع الطلب.",
        },
        { status: 400 }
      );
    }

    const requestType =
      String(
        subscriptionRequest.requestType ??
          "NEW"
      )
        .trim()
        .toUpperCase();

    /*
     * ==========================================================
     * RENEWAL
     * ==========================================================
     */

    if (
      requestType ===
      "RENEW"
    ) {
      const renewalMonths =
        requestedDurationMonths;

      if (
        !Number.isInteger(
          renewalMonths
        ) ||
        renewalMonths! <= 0
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "مدة التجديد غير صحيحة.",
          },
          { status: 400 }
        );
      }

      if (
        renewalMonths! %
          12 !==
        0
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "مدة التجديد يجب أن تكون بعدد سنوات كامل.",
          },
          { status: 400 }
        );
      }

      const requestedYears =
        renewalMonths! /
        12;

      if (
        requestedYears < 1 ||
        requestedYears > 5
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "مدة التجديد يجب أن تكون بين سنة وخمس سنوات.",
          },
          { status: 400 }
        );
      }

      const existingSubscriptions =
        await db.orm.public.Subscription.all();

      const customerSubscriptions =
        existingSubscriptions.filter(
          (subscription) =>
            subscription.userId ===
            userId
        );

      if (
        customerSubscriptions.length ===
        0
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "لا يوجد اشتراك سابق لهذا العميل حتى يتم تجديده.",
          },
          { status: 400 }
        );
      }

      const activeSubscription =
        customerSubscriptions
          .filter(
            (subscription) =>
              String(
                subscription.status
              )
                .trim()
                .toUpperCase() ===
              "ACTIVE"
          )
          .sort(
            (a, b) => {
              const expiryA =
                normalizeDateOnly(
                  a.expiryDate
                );

              const expiryB =
                normalizeDateOnly(
                  b.expiryDate
                );

              return expiryB.localeCompare(
                expiryA
              );
            }
          )[0];

      const expiredSubscription =
        customerSubscriptions
          .filter(
            (subscription) =>
              String(
                subscription.status
              )
                .trim()
                .toUpperCase() ===
              "EXPIRED"
          )
          .sort(
            (a, b) => {
              const expiryA =
                normalizeDateOnly(
                  a.expiryDate
                );

              const expiryB =
                normalizeDateOnly(
                  b.expiryDate
                );

              return expiryB.localeCompare(
                expiryA
              );
            }
          )[0];

      // A renewal ordered for a specific subscription renews that one.
      const targetedSubscription =
        subscriptionRequest.subscriptionId
          ? customerSubscriptions.find(
              (subscription) =>
                subscription.id ===
                subscriptionRequest.subscriptionId
            )
          : undefined;

      const existingSubscription =
        targetedSubscription ??
        activeSubscription ??
        expiredSubscription ??
        [
          ...customerSubscriptions,
        ].sort(
          (a, b) => {
            const expiryA =
              normalizeDateOnly(
                a.expiryDate
              );

            const expiryB =
              normalizeDateOnly(
                b.expiryDate
              );

            return expiryB.localeCompare(
              expiryA
            );
          }
        )[0];

      if (
        !existingSubscription
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "تعذر العثور على الاشتراك الحالي للعميل.",
          },
          { status: 400 }
        );
      }

      const baseDate =
        isDateBeforeToday(
          existingSubscription.expiryDate
        )
          ? startDate
          : normalizeDateOnly(
              existingSubscription.expiryDate
            );

      const renewalExpiryDate =
        addMonthsToDate(
          baseDate,
          renewalMonths!
        );

      if (
        !renewalExpiryDate
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "تعذر حساب تاريخ انتهاء التجديد.",
          },
          { status: 400 }
        );
      }

      const updatedSubscription =
        await db.orm.public.Subscription
          .where({
            id:
              existingSubscription.id,
          })
          .update({
            serviceType:
              existingSubscription.serviceType,

            username:
              existingSubscription.username,

            password:
              existingSubscription.password,

            macAddress:
              existingSubscription.macAddress,

            deviceId:
              existingSubscription.deviceId,

            status:
              "ACTIVE",

            packageName:
              serviceName,

            startDate:
              existingSubscription.startDate,

            expiryDate:
              renewalExpiryDate,

            connections:
              existingSubscription.connections,

            maxConnections:
              existingSubscription.maxConnections,
          });

      if (
        !updatedSubscription
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "تعذر تحديث الاشتراك للتجديد.",
          },
          { status: 500 }
        );
      }

      const receiptNumber =
        generateReceiptNumber();

      const durationLabel =
        requestedDurationLabel ||
        getYearLabel(
          requestedDurationMonths! /
            12
        );

      const receipt =
        await db.orm.public.Receipt.create(
          {
            receiptNumber,

            userId,

            orderId:
              requestId,

            subscriptionId:
              existingSubscription.id,

            serviceType:
              existingSubscription.serviceType,

            serviceName,

            price,

            durationMonths:
              renewalMonths!,

            durationLabel,

            bonusYears:
              0,

            status:
              "PAID",
          }
        );

      const updatedRequest =
        await completeOrderWithSubscription(
          admin.user,
          requestId,
          existingSubscription.id,
          {
            price,
            durationMonths:
              renewalMonths!,
            durationLabel,
            bonusYears: 0,
          }
        );

      if (
        !updatedRequest
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "تم تجديد الاشتراك وإنشاء الإيصال لكن تعذر تحديث حالة الطلب.",

            subscriptionId:
              existingSubscription.id,

            receiptNumber:
              receipt.receiptNumber,
          },
          { status: 500 }
        );
      }

      return NextResponse.json(
        {
          success: true,

          message:
            "تم تجديد الاشتراك وإنشاء الإيصال بنجاح.",

          subscription: {
            id:
              existingSubscription.id,

            serviceType:
              updatedSubscription.serviceType,

            username:
              updatedSubscription.username,

            password:
              updatedSubscription.password,

            macAddress:
              updatedSubscription.macAddress,

            deviceId:
              updatedSubscription.deviceId,

            packageName:
              updatedSubscription.packageName,

            startDate:
              updatedSubscription.startDate,

            expiryDate:
              updatedSubscription.expiryDate,
          },

          receipt: {
            id:
              receipt.id,

            receiptNumber:
              receipt.receiptNumber,

            serviceType:
              receipt.serviceType,

            serviceName:
              receipt.serviceName,

            price:
              receipt.price,

            durationMonths:
              receipt.durationMonths,

            durationLabel:
              receipt.durationLabel,

            bonusYears:
              receipt.bonusYears,

            status:
              receipt.status,

            createdAt:
              receipt.createdAt,
          },

          request: {
            id:
              updatedRequest.id,

            status:
              updatedRequest.status,

            bonusYears:
              updatedRequest.bonusYears,
          },
        },
        { status: 201 }
      );
    }

    /*
     * ==========================================================
     * NEW SUBSCRIPTION
     * ==========================================================
     */

    const originalDurationMonths =
      subscriptionRequest.durationMonths;

    if (
      !Number.isInteger(
        originalDurationMonths
      ) ||
      originalDurationMonths <=
        0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "مدة الاشتراك في الطلب غير صحيحة.",
        },
        { status: 400 }
      );
    }

    const bonusYears =
      typeof requestedBonusYears ===
        "number"
        ? requestedBonusYears
        : 0;

    if (
      !Number.isInteger(
        bonusYears
      ) ||
      bonusYears < 0 ||
      bonusYears > 5
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "البونص يجب أن يكون بين 0 و5 سنوات.",
        },
        { status: 400 }
      );
    }

    const bonusMonths =
      bonusYears * 12;

    const finalDurationMonths =
      originalDurationMonths +
      bonusMonths;

    const finalDurationLabel =
      getNewDurationLabel(
        subscriptionRequest.durationLabel,
        bonusYears
      );

    if (
      serviceType ===
        "VIP" &&
      originalDurationMonths !==
        3
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "اشتراك VIP الأساسي متوفر لمدة 3 أشهر.",
        },
        { status: 400 }
      );
    }

    if (
      serviceType ===
      "IPTV"
    ) {
      if (
        !username ||
        !password
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "اشتراك IPTV يحتاج Username و Password.",
          },
          { status: 400 }
        );
      }
    }

    if (
      serviceType ===
      "VIP"
    ) {
      if (!deviceId) {
        return NextResponse.json(
          {
            success: false,
            message:
              "اشتراك VIP يحتاج Device ID أو Serial Number.",
          },
          { status: 400 }
        );
      }
    }

    const user =
      await db.orm.public.User.first(
        {
          id:
            userId,
        }
      );

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message:
            "العميل غير موجود.",
        },
        { status: 404 }
      );
    }

    if (
      serviceType ===
        "IPTV" &&
      username
    ) {
      const existingUsername =
        await db.orm.public.Subscription.first(
          {
            username,
          }
        );

      if (
        existingUsername
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "اسم المستخدم هذا مستخدم مسبقاً.",
          },
          { status: 409 }
        );
      }
    }

    if (
      serviceType ===
        "VIP" &&
      deviceId
    ) {
      const existingDevice =
        await db.orm.public.Subscription.first(
          {
            deviceId,
          }
        );

      if (
        existingDevice
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Device ID أو Serial Number هذا مرتبط باشتراك آخر.",
          },
          { status: 409 }
        );
      }
    }

    const normalizedStartDate =
      normalizeDateOnly(
        startDate
      );

    if (
      !normalizedStartDate
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "تاريخ البداية غير صحيح.",
        },
        { status: 400 }
      );
    }

    const expiryDate =
      calculateExpiryDate(
        normalizedStartDate,
        finalDurationMonths
      );

    if (!expiryDate) {
      return NextResponse.json(
        {
          success: false,
          message:
            "تعذر حساب تاريخ الانتهاء.",
        },
        { status: 400 }
      );
    }

    const created =
      await db.orm.public.Subscription.create(
        {
          userId,

          serviceType,

          username:
            serviceType ===
            "IPTV"
              ? username
              : null,

          password:
            serviceType ===
            "IPTV"
              ? password
              : null,

          macAddress:
            serviceType ===
            "IPTV"
              ? macAddress
              : null,

          deviceId:
            serviceType ===
            "VIP"
              ? deviceId
              : null,

          status:
            "ACTIVE",

          packageName:
            serviceName,

          packageId:
            (
              await db.orm.public.Package.first({
                slug: subscriptionRequest.planSlug,
              })
            )?.id ?? null,

          startDate:
            normalizedStartDate,

          expiryDate,

          connections:
            0,

          maxConnections:
            1,
        }
      );

    const receiptNumber =
      generateReceiptNumber();

    const receipt =
      await db.orm.public.Receipt.create(
        {
          receiptNumber,

          userId,

          orderId:
            requestId,

          subscriptionId:
            created.id,

          serviceType,

          serviceName,

          price,

          durationMonths:
            finalDurationMonths,

          durationLabel:
            finalDurationLabel,

          bonusYears,

          status:
            "PAID",
        }
      );

    const updatedRequest =
      await completeOrderWithSubscription(
        admin.user,
        requestId,
        created.id,
        {
          price,
          durationMonths:
            finalDurationMonths,
          durationLabel:
            finalDurationLabel,
          bonusYears,
        }
      );

    if (
      !updatedRequest
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "تم إنشاء الاشتراك والإيصال لكن تعذر تحديث حالة الطلب.",

          subscriptionId:
            created.id,

          receiptNumber:
            receipt.receiptNumber,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,

        message:
          bonusYears > 0
            ? `تم إنشاء الاشتراك مع ${getBonusLabel(
                bonusYears
              )} بنجاح.`
            : "تم إنشاء الاشتراك والإيصال بنجاح.",

        subscription: {
          id:
            created.id,

          serviceType:
            created.serviceType,

          username:
            created.username,

          password:
            created.password,

          macAddress:
            created.macAddress,

          deviceId:
            created.deviceId,

          packageName:
            created.packageName,

          startDate:
            created.startDate,

          expiryDate:
            created.expiryDate,
        },

        receipt: {
          id:
            receipt.id,

          receiptNumber:
            receipt.receiptNumber,

          serviceType:
            receipt.serviceType,

          serviceName:
            receipt.serviceName,

          price:
            receipt.price,

          durationMonths:
            receipt.durationMonths,

          durationLabel:
            receipt.durationLabel,

          bonusYears:
            receipt.bonusYears,

          status:
            receipt.status,

          createdAt:
            receipt.createdAt,
        },

        request: {
          id:
            updatedRequest.id,

          status:
            updatedRequest.status,

          durationMonths:
            updatedRequest.durationMonths,

          durationLabel:
            updatedRequest.durationLabel,

          bonusYears:
            updatedRequest.bonusYears,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(
      "Create subscription and receipt error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "حدث خطأ أثناء إنشاء الاشتراك والإيصال.",
      },
      { status: 500 }
    );
  }
}