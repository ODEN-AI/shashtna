import { NextResponse } from "next/server";
import { requireAdmin } from "@/src/lib/session";
import {
  db,
  ensureDatabaseConnection,
} from "@/src/prisma/db";

export const dynamic = "force-dynamic";

type ServiceType = "IPTV" | "VIP";

type PackageBody = {
  name?: string;
  slug?: string;
  serviceType?: string;
  price?: number;
  durationMonths?: number;
  durationLabel?: string;
  description?: string;
  specifications?: string;
  notes?: string | null;
  imageUrl?: string | null;
  isActive?: boolean;
  deviceIds?: number[];
};

function normalizeServiceType(
  value?: string
): ServiceType {
  return value?.trim().toUpperCase() ===
    "VIP"
    ? "VIP"
    : "IPTV";
}

function normalizeDeviceIds(
  value?: unknown
): number[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return [
    ...new Set(
      value
        .map((item) => Number(item))
        .filter(
          (item) =>
            Number.isInteger(item) &&
            item > 0
        )
    ),
  ];
}

export async function GET(request: Request) {
  try {
    const admin = await requireAdmin(request);

    if (!admin.ok) {
      return admin.response;
    }

    await ensureDatabaseConnection();

    const packages =
      await db.orm.public.Package.all();

    packages.sort((a, b) => {
      if (
        a.serviceType !==
        b.serviceType
      ) {
        return a.serviceType ===
          "IPTV"
          ? -1
          : 1;
      }

      if (a.price !== b.price) {
        return a.price - b.price;
      }

      return a.id - b.id;
    });

    return NextResponse.json({
      success: true,

      packages: packages.map(
        (pkg) => ({
          id: pkg.id,
          name: pkg.name,
          slug: pkg.slug,

          serviceType:
            normalizeServiceType(
              pkg.serviceType
            ),

          price: pkg.price,
          durationMonths:
            pkg.durationMonths,
          durationLabel:
            pkg.durationLabel,
          description:
            pkg.description,
          specifications:
            pkg.specifications,
          notes: pkg.notes,
          imageUrl:
            pkg.imageUrl,
          isActive:
            pkg.isActive,
          createdAt:
            pkg.createdAt,
          updatedAt:
            pkg.updatedAt,
        })
      ),
    });
  } catch (error) {
    console.error(
      "Admin packages GET error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "تعذر تحميل الباقات.",
        packages: [],
      },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request
) {
  try {
    const admin = await requireAdmin(request);

    if (!admin.ok) {
      return admin.response;
    }

    await ensureDatabaseConnection();

    const body =
      (await request.json()) as PackageBody;

    const name =
      body.name?.trim();

    const slug =
      body.slug?.trim().toLowerCase();

    const serviceType =
      normalizeServiceType(
        body.serviceType
      );

    const price =
      body.price;

    const deviceIds =
      normalizeDeviceIds(
        body.deviceIds
      );

    if (
      !name ||
      !slug
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "اسم الباقة والـ Slug مطلوبان.",
        },
        { status: 400 }
      );
    }

    if (
      typeof price !==
        "number" ||
      !Number.isFinite(
        price
      ) ||
      price < 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "السعر غير صحيح.",
        },
        { status: 400 }
      );
    }

    let durationMonths =
      body.durationMonths;

    let durationLabel =
      body.durationLabel?.trim();

    if (serviceType === "VIP") {
      durationMonths = 3;
      durationLabel = "3 Months";
    } else {
      if (
        typeof durationMonths !==
          "number" ||
        !Number.isInteger(
          durationMonths
        ) ||
        durationMonths <= 0
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "مدة الاشتراك غير صحيحة.",
          },
          { status: 400 }
        );
      }

      durationLabel =
        durationLabel ||
        `${durationMonths} Months`;
    }

    const description =
      body.description?.trim() ||
      `اشتراك ${name}`;

    const specifications =
      body.specifications?.trim() ||
      `اشتراك لمدة ${durationMonths} شهر`;

    const notes =
      body.notes?.trim() ||
      null;

    const imageUrl =
      body.imageUrl?.trim() ||
      null;

    const isActive =
      typeof body.isActive ===
      "boolean"
        ? body.isActive
        : true;

    const existing =
      await db.orm.public.Package.first(
        {
          slug,
        }
      );

    if (existing) {
      return NextResponse.json(
        {
          success: false,
          message:
            "هذا الـ Slug مستخدم مسبقًا.",
        },
        { status: 409 }
      );
    }

    /*
     * Validate selected devices before creating
     * the package.
     */
    if (deviceIds.length > 0) {
      for (const deviceId of deviceIds) {
        const device =
          await db.orm.public.Device.first(
            {
              id: deviceId,
            }
          );

        if (!device) {
          return NextResponse.json(
            {
              success: false,
              message:
                "واحد أو أكثر من الأجهزة المحددة غير موجود.",
            },
            { status: 400 }
          );
        }

        const deviceServiceType =
          normalizeServiceType(
            device.serviceType
          );

        if (
          deviceServiceType !==
          serviceType
        ) {
          return NextResponse.json(
            {
              success: false,
              message:
                "لا يمكن ربط جهاز بنوع خدمة مختلف عن نوع الباقة.",
            },
            { status: 400 }
          );
        }
      }
    }

    const created =
      await db.orm.public.Package.create(
        {
          name,
          slug,
          serviceType,
          price,
          durationMonths,
          durationLabel,
          description,
          specifications,
          notes,
          imageUrl,
          isActive,
        }
      );

    /*
     * Save package/device relations.
     */
    if (deviceIds.length > 0) {
      for (const deviceId of deviceIds) {
        await db.orm.public.PackageDevice.create(
          {
            packageId: created.id,
            deviceId,
          }
        );
      }
    }

    return NextResponse.json(
      {
        success: true,
        message:
          "تم إنشاء الباقة بنجاح.",
        package: created,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(
      "Admin packages POST error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "حدث خطأ أثناء إنشاء الباقة.",
      },
      { status: 500 }
    );
  }
}