import { NextResponse } from "next/server";
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
  price?: number;
  durationMonths?: number;
  durationLabel?: string;
};

function calculateExpiryDate(
  startDateString: string,
  months: number
) {
  const startDate = new Date(
    `${startDateString}T00:00:00`
  );

  if (
    Number.isNaN(
      startDate.getTime()
    )
  ) {
    return null;
  }

  const expiryDate =
    new Date(startDate);

  expiryDate.setFullYear(
    expiryDate.getFullYear(),
    expiryDate.getMonth() + months,
    expiryDate.getDate()
  );

  const year =
    expiryDate.getFullYear();

  const month = String(
    expiryDate.getMonth() + 1
  ).padStart(2, "0");

  const day = String(
    expiryDate.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function addMonthsToDate(
  dateString: string,
  months: number
) {
  const date = new Date(
    `${dateString}T00:00:00`
  );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return null;
  }

  date.setFullYear(
    date.getFullYear(),
    date.getMonth() + months,
    date.getDate()
  );

  const year =
    date.getFullYear();

  const month = String(
    date.getMonth() + 1
  ).padStart(2, "0");

  const day = String(
    date.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getTodayDate() {
  const today = new Date();

  const year =
    today.getFullYear();

  const month = String(
    today.getMonth() + 1
  ).padStart(2, "0");

  const day = String(
    today.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function isDateBeforeToday(
  dateString: string
) {
  const today = new Date(
    `${getTodayDate()}T00:00:00`
  );

  const date = new Date(
    `${dateString}T00:00:00`
  );

  if (
    Number.isNaN(
      today.getTime()
    ) ||
    Number.isNaN(
      date.getTime()
    )
  ) {
    return false;
  }

  return (
    date.getTime() <
    today.getTime()
  );
}

function generateReceiptNumber() {
  const now = new Date();

  const year =
    now.getFullYear();

  const month = String(
    now.getMonth() + 1
  ).padStart(2, "0");

  const day = String(
    now.getDate()
  ).padStart(2, "0");

  const hours = String(
    now.getHours()
  ).padStart(2, "0");

  const minutes = String(
    now.getMinutes()
  ).padStart(2, "0");

  const seconds = String(
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

function getRenewalDurationLabel(
  months: number
) {
  const years =
    months / 12;

  if (years === 1) {
    return "سنة واحدة";
  }

  if (years === 2) {
    return "سنتين";
  }

  return `${years} سنوات`;
}

export async function GET() {
  try {
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
                user?.email ?? "",

              customerPhone:
                user?.phone ?? "",

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

export async function POST(
  request: Request
) {
  try {
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
      serviceType !== "IPTV" &&
      serviceType !== "VIP"
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
          id: requestId,
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
      subscriptionRequest.status !==
      "PENDING"
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
      if (
        !Number.isInteger(
          requestedDurationMonths
        ) ||
        requestedDurationMonths! <=
          0
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
        requestedDurationMonths! %
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
        requestedDurationMonths! /
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

      /*
       * Prefer the active subscription with the
       * latest expiry date.
       */

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
            (a, b) =>
              new Date(
                b.expiryDate
              ).getTime() -
              new Date(
                a.expiryDate
              ).getTime()
          )[0];

      /*
       * Otherwise use the expired subscription
       * with the latest expiry date.
       */

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
            (a, b) =>
              new Date(
                b.expiryDate
              ).getTime() -
              new Date(
                a.expiryDate
              ).getTime()
          )[0];

      /*
       * Final fallback for older data where the
       * status might not have been updated correctly.
       */

      const existingSubscription =
        activeSubscription ??
        expiredSubscription ??
        customerSubscriptions.sort(
          (a, b) =>
            new Date(
              b.expiryDate
            ).getTime() -
            new Date(
              a.expiryDate
            ).getTime()
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

      /*
       * If the current subscription is still valid,
       * extend from its current expiry date.
       *
       * If it is expired, start from the date
       * selected by the admin.
       */

      const baseDate =
        isDateBeforeToday(
          existingSubscription.expiryDate
        )
          ? startDate
          : existingSubscription.expiryDate;

      const renewalExpiryDate =
        addMonthsToDate(
          baseDate,
          requestedDurationMonths!
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
        getRenewalDurationLabel(
          requestedDurationMonths!
        );

      const receipt =
        await db.orm.public.Receipt.create(
          {
            receiptNumber,

            userId,

            subscriptionId:
              existingSubscription.id,

            serviceType:
              existingSubscription.serviceType,

            serviceName,

            price,

            durationMonths:
              requestedDurationMonths!,

            durationLabel,

            status:
              "PAID",
          }
        );

      const updatedRequest =
        await db.orm.public.SubscriptionRequest
          .where({
            id: requestId,
          })
          .update({
            status:
              "ACCEPTED",

            price,

            durationMonths:
              requestedDurationMonths!,

            durationLabel,
          });

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

    if (
      serviceType === "VIP" &&
      originalDurationMonths !==
        3
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "اشتراك VIP متوفر لمدة 3 أشهر فقط.",
        },
        { status: 400 }
      );
    }

    /*
     * NEW IPTV validation
     */

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

    /*
     * NEW VIP validation
     */

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

    /*
     * Username uniqueness is only relevant
     * for a new IPTV subscription.
     */

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

    /*
     * Device uniqueness is only relevant
     * for a new VIP subscription.
     */

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

    const startDateValue =
      new Date(
        `${startDate}T00:00:00`
      );

    if (
      Number.isNaN(
        startDateValue.getTime()
      )
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
        startDate,
        originalDurationMonths
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

          startDate,

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

          subscriptionId:
            created.id,

          serviceType,

          serviceName,

          price,

          durationMonths:
            originalDurationMonths,

          durationLabel:
            subscriptionRequest.durationLabel,

          status:
            "PAID",
        }
      );

    const updatedRequest =
      await db.orm.public.SubscriptionRequest
        .where({
          id:
            requestId,
        })
        .update({
          status:
            "ACCEPTED",
        });

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
          "تم إنشاء الاشتراك والإيصال بنجاح.",

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