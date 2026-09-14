import { NextResponse } from "next/server";
import {
  db,
  ensureDatabaseConnection,
} from "@/src/prisma/db";

export const dynamic = "force-dynamic";

type RequestBody = {
  userId?: number;
  planSlug?: string;
  contactMethod?: string;

  requestType?:
    | "NEW"
    | "RENEW"
    | "DEVICE_PURCHASE";

  deviceId?: string | number | null;
  deviceName?: string | null;
  devicePrice?: number | null;
};

const VALID_CONTACT_METHODS = new Set([
  "PENDING",
  "TELEGRAM",
  "FACEBOOK",
]);

const VALID_REQUEST_TYPES = new Set([
  "NEW",
  "RENEW",
  "DEVICE_PURCHASE",
]);

function normalizeServiceType(
  value: unknown
) {
  return String(value ?? "")
    .trim()
    .toUpperCase();
}

function normalizeRequestType(
  value: unknown
) {
  const normalized = String(
    value ?? ""
  )
    .trim()
    .toUpperCase();

  if (
    normalized === "NEW" ||
    normalized === "RENEW" ||
    normalized === "DEVICE_PURCHASE"
  ) {
    return normalized;
  }

  return "";
}

function normalizeDeviceId(
  value: unknown
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  return String(value).trim() || null;
}

export async function POST(request: Request) {
  try {
    await ensureDatabaseConnection();

    const body =
      (await request.json()) as RequestBody;

    const userId = body.userId;

    const planSlug =
      body.planSlug?.trim();

    const contactMethod =
      String(
        body.contactMethod ??
          "PENDING"
      )
        .trim()
        .toUpperCase();

    const requestType =
      normalizeRequestType(
        body.requestType
      );

    const deviceId =
      normalizeDeviceId(
        body.deviceId
      );

    if (
      !Number.isInteger(userId) ||
      !userId
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "بيانات المستخدم غير صحيحة.",
        },
        { status: 400 }
      );
    }

    if (!planSlug) {
      return NextResponse.json(
        {
          success: false,
          error:
            "معرف الطلب غير موجود.",
        },
        { status: 400 }
      );
    }

    if (
      !VALID_CONTACT_METHODS.has(
        contactMethod
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "طريقة التواصل غير صحيحة.",
        },
        { status: 400 }
      );
    }

    if (
      requestType &&
      !VALID_REQUEST_TYPES.has(
        requestType
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "نوع الطلب غير صحيح.",
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
          error:
            "المستخدم غير موجود.",
        },
        { status: 404 }
      );
    }

    /*
     * ==========================================================
     * DEVICE PURCHASE
     * ==========================================================
     *
     * For a standalone device purchase, planSlug is stored as:
     * device:<device-slug>
     *
     * No Package lookup is required.
     */
    if (
      requestType ===
      "DEVICE_PURCHASE"
    ) {
      if (!deviceId) {
        return NextResponse.json(
          {
            success: false,
            error:
              "معرف الجهاز غير موجود.",
          },
          { status: 400 }
        );
      }

      const device =
        await db.orm.public.Device.first({
          id: Number(deviceId),
          isActive: true,
        });

      if (!device) {
        return NextResponse.json(
          {
            success: false,
            error:
              "الجهاز غير موجود أو غير متاح حاليًا.",
          },
          { status: 404 }
        );
      }

      const devicePlanSlug =
        `device:${device.slug}`;

      const existingRequest =
        await db.orm.public.SubscriptionRequest.first(
          {
            userId,
            planSlug: devicePlanSlug,
            status: "PENDING",
          }
        );

      if (existingRequest) {
        const updated =
          await db.orm.public.SubscriptionRequest
            .where({
              id: existingRequest.id,
            })
            .update({
              serviceType: "DEVICE",
              serviceName:
                device.name,
              price: device.price,
              durationMonths: 0,
              durationLabel: "Device",
              deviceId:
                String(device.id),
              deviceName:
                device.name,
              devicePrice:
                device.price,
              contactMethod,
            });

        if (!updated) {
          return NextResponse.json(
            {
              success: false,
              error:
                "تعذر تحديث طلب شراء الجهاز.",
            },
            { status: 500 }
          );
        }

        return NextResponse.json(
          {
            success: true,
            requestId: updated.id,
            alreadyExists: true,
            updated: true,
            requestType:
              "DEVICE_PURCHASE",
          },
          { status: 200 }
        );
      }

      const created =
        await db.orm.public.SubscriptionRequest.create(
          {
            userId,
            planSlug:
              devicePlanSlug,
            serviceType: "DEVICE",
            serviceName:
              device.name,
            price: device.price,
            durationMonths: 0,
            durationLabel: "Device",
            deviceId:
              String(device.id),
            deviceName:
              device.name,
            devicePrice:
              device.price,
            contactMethod,
            status: "PENDING",
          }
        );

      return NextResponse.json(
        {
          success: true,
          requestId: created.id,
          requestType:
            "DEVICE_PURCHASE",
        },
        { status: 201 }
      );
    }

    /*
     * ==========================================================
     * NORMAL PACKAGE / VIP REQUEST
     * ==========================================================
     */

    const plan =
      await db.orm.public.Package.first({
        slug: planSlug,
        isActive: true,
      });

    if (!plan) {
      return NextResponse.json(
        {
          success: false,
          error:
            "الباقة المحددة غير موجودة أو غير متاحة حاليًا.",
        },
        { status: 400 }
      );
    }

    const serviceType =
      normalizeServiceType(
        plan.serviceType
      ) === "VIP"
        ? "VIP"
        : "IPTV";

    const finalDeviceId =
      serviceType === "VIP" &&
      requestType === "NEW"
        ? deviceId
        : null;

    let finalDeviceName:
      | string
      | null = null;

    let finalDevicePrice:
      | number
      | null = null;

    if (
      serviceType === "VIP" &&
      requestType === "NEW"
    ) {
      if (!finalDeviceId) {
        return NextResponse.json(
          {
            success: false,
            error:
              "يجب اختيار جهاز VIP للاشتراك الجديد.",
          },
          { status: 400 }
        );
      }

      const vipDevice =
        await db.orm.public.Device.first(
          {
            id: Number(
              finalDeviceId
            ),
            isActive: true,
          }
        );

      if (!vipDevice) {
        return NextResponse.json(
          {
            success: false,
            error:
              "الجهاز المحدد غير موجود أو غير متاح.",
          },
          { status: 400 }
        );
      }

      if (
        normalizeServiceType(
          vipDevice.serviceType
        ) !== "VIP"
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "الجهاز المحدد ليس جهاز VIP.",
          },
          { status: 400 }
        );
      }

      const relations =
        await db.orm.public.PackageDevice.all();

      const compatible =
        relations.some(
          (relation) =>
            relation.packageId ===
              plan.id &&
            relation.deviceId ===
              vipDevice.id
        );

      if (!compatible) {
        return NextResponse.json(
          {
            success: false,
            error:
              "هذا الجهاز غير متوافق مع الباقة المحددة.",
          },
          { status: 400 }
        );
      }

      finalDeviceName =
        vipDevice.name;

      finalDevicePrice =
        vipDevice.price;
    }

    const finalPrice =
      serviceType === "VIP" &&
      requestType === "NEW" &&
      finalDevicePrice !== null
        ? plan.price +
          finalDevicePrice
        : plan.price;

    const existingRequest =
      await db.orm.public.SubscriptionRequest.first(
        {
          userId,
          planSlug,
          status: "PENDING",
        }
      );

    if (existingRequest) {
      const updated =
        await db.orm.public.SubscriptionRequest
          .where({
            id: existingRequest.id,
          })
          .update({
            serviceType,
            serviceName:
              plan.name,
            price: finalPrice,
            durationMonths:
              plan.durationMonths,
            durationLabel:
              plan.durationLabel,
            deviceId:
              finalDeviceId,
            deviceName:
              finalDeviceName,
            devicePrice:
              finalDevicePrice,
            contactMethod,
          });

      if (!updated) {
        return NextResponse.json(
          {
            success: false,
            error:
              "تعذر تحديث طلب الاشتراك.",
          },
          { status: 500 }
        );
      }

      return NextResponse.json(
        {
          success: true,
          requestId: updated.id,
          alreadyExists: true,
          updated: true,
        },
        { status: 200 }
      );
    }

    const created =
      await db.orm.public.SubscriptionRequest.create(
        {
          userId,
          planSlug,
          serviceType,
          serviceName:
            plan.name,
          price: finalPrice,
          durationMonths:
            plan.durationMonths,
          durationLabel:
            plan.durationLabel,
          deviceId:
            finalDeviceId,
          deviceName:
            finalDeviceName,
          devicePrice:
            finalDevicePrice,
          contactMethod,
          status: "PENDING",
        }
      );

    return NextResponse.json(
      {
        success: true,
        requestId: created.id,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(
      "Subscription request error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "حدث خطأ أثناء حفظ طلب الاشتراك.",
      },
      { status: 500 }
    );
  }
}