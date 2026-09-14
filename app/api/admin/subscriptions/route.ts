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
};

function calculateExpiryDate(
  startDateString: string,
  months: number
) {
  const startDate = new Date(
    `${startDateString}T00:00:00`
  );

  if (Number.isNaN(startDate.getTime())) {
    return null;
  }

  const expiryDate = new Date(startDate);

  expiryDate.setFullYear(
    expiryDate.getFullYear(),
    expiryDate.getMonth() + months,
    expiryDate.getDate()
  );

  const year = expiryDate.getFullYear();
  const month = String(
    expiryDate.getMonth() + 1
  ).padStart(2, "0");
  const day = String(
    expiryDate.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function generateReceiptNumber() {
  const now = new Date();

  const year = now.getFullYear();

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

  const random = Math.floor(
    1000 + Math.random() * 9000
  );

  return `SHASHTNA-${year}${month}${day}-${hours}${minutes}${seconds}-${random}`;
}

export async function GET() {
  try {
    await ensureDatabaseConnection();

    const subscriptions =
      await db.orm.public.Subscription.all();

    const customers =
      await Promise.all(
        subscriptions.map(
          async (subscription) => {
            const user =
              await db.orm.public.User.first({
                id: subscription.userId,
              });

            return {
              id: subscription.id,
              userId: subscription.userId,

              customerName:
                user?.name ?? "Unknown",

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
      subscriptions: customers,
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
      body.serviceType?.trim().toUpperCase() ||
      "IPTV";

    const serviceName =
      body.serviceName?.trim();

    const username =
      body.username?.trim() || null;

    const password =
      body.password?.trim() || null;

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

    if (
      !requestId ||
      !userId ||
      !serviceName ||
      !startDate ||
      typeof price !== "number"
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

    if (serviceType === "IPTV") {
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

    if (serviceType === "VIP") {
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

    const subscriptionRequest =
      await db.orm.public.SubscriptionRequest.first(
        {
          id: requestId,
        }
      );

    if (!subscriptionRequest) {
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

    if (
      serviceType === "VIP" &&
      subscriptionRequest.durationMonths !== 3
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

    const user =
      await db.orm.public.User.first({
        id: userId,
      });

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

    if (username) {
      const existingUsername =
        await db.orm.public.Subscription.first(
          {
            username,
          }
        );

      if (existingUsername) {
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

    if (deviceId) {
      const existingDevice =
        await db.orm.public.Subscription.first(
          {
            deviceId,
          }
        );

      if (existingDevice) {
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
        subscriptionRequest.durationMonths
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
            serviceType === "IPTV"
              ? username
              : null,

          password:
            serviceType === "IPTV"
              ? password
              : null,

          macAddress:
            serviceType === "IPTV"
              ? macAddress
              : null,

          deviceId:
            serviceType === "VIP"
              ? deviceId
              : null,

          status: "ACTIVE",

          packageName:
            serviceName,

          startDate,

          expiryDate,

          connections: 0,

          maxConnections:
            serviceType === "VIP"
              ? 1
              : 1,
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
            subscriptionRequest.durationMonths,

          durationLabel:
            subscriptionRequest.durationLabel,

          status: "PAID",
        }
      );

    const updatedRequest =
      await db.orm.public.SubscriptionRequest
        .where({
          id: requestId,
        })
        .update({
          status: "ACCEPTED",
        });

    if (!updatedRequest) {
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
          id: created.id,

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
          id: receipt.id,

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