import { NextResponse } from "next/server";
import { catalogueImageUrl, isValidPrice, parseRenewalPrice } from "@/src/lib/catalogue";
import { requireAdmin } from "@/src/lib/session";
import { defaultOption, packageMirror, parsePackageOptions } from "@/src/lib/package-options";
import { formatDurationAr, resolvePackageDuration } from "@/src/lib/subscription-duration";
import { auditCatalogue } from "@/src/server/catalogue";
import { describeOption, optionsByPackage } from "@/src/server/package-options";
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
  renewalPrice?: number | null;
  durationMonths?: number;
  durationValue?: number;
  durationUnit?: string;
  durationLabel?: string;
  description?: string;
  specifications?: string;
  notes?: string | null;
  imageUrl?: string | null;
  isActive?: boolean;
  deviceIds?: number[];
  /** Lengths with their own prices. Without it, the package's price and duration make its one option. */
  options?: unknown;
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
    const admin = await requireAdmin(request, "catalogue");

    if (!admin.ok) {
      return admin.response;
    }

    await ensureDatabaseConnection();

    const packages =
      await db.orm.public.Package.all();
    const optionMap = await optionsByPackage(packages.map((pkg) => pkg.id));

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
          durationUnit:
            pkg.durationUnit,
          renewalPrice:
            pkg.renewalPrice,
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
          // Every length with its own price (parked ones, kept for past orders, are left out).
          options: (optionMap.get(pkg.id) ?? []).filter((option) => option.durationMonths > 0),
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
    const admin = await requireAdmin(request, "catalogue");

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

    const hasOptions =
      body.options !== undefined;

    const parsedOptions =
      hasOptions ? parsePackageOptions(body.options, serviceType) : null;

    if (parsedOptions && !parsedOptions.ok) {
      return NextResponse.json(
        {
          success: false,
          message: parsedOptions.error,
        },
        { status: 400 }
      );
    }

    // With options, the package columns mirror its default (shortest active) option.
    const mainOption =
      parsedOptions?.ok ? defaultOption(parsedOptions.options) : null;

    const price =
      mainOption ? mainOption.price : body.price;

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

    // Whole dinars only (Int column): a fraction or string is rejected, not coerced.
    if (!isValidPrice(price)) {
      return NextResponse.json(
        {
          success: false,
          message:
            "السعر غير صحيح.",
        },
        { status: 400 }
      );
    }

    // Optional: empty = renewals cost the normal price.
    const renewalPrice =
      mainOption ? ({ ok: true, value: mainOption.renewalPrice } as const) : parseRenewalPrice(body.renewalPrice);

    if (!renewalPrice.ok) {
      return NextResponse.json(
        {
          success: false,
          message:
            "سعر التجديد غير صحيح.",
        },
        { status: 400 }
      );
    }

    // Value + unit (months / years), whole numbers, 1 month to 5 years.
    const duration =
      mainOption
        ? ({ ok: true, ...packageMirror(mainOption), durationUnit: mainOption.durationUnit } as const)
        : resolvePackageDuration(body, serviceType);

    if (!duration.ok) {
      return NextResponse.json(
        {
          success: false,
          message: duration.error,
        },
        { status: 400 }
      );
    }

    const { durationMonths, durationUnit, durationLabel } =
      duration;

    const description =
      body.description?.trim() ||
      `اشتراك ${name}`;

    const specifications =
      body.specifications?.trim() ||
      `اشتراك لمدة ${formatDurationAr(durationMonths)}`;

    const notes =
      body.notes?.trim() ||
      null;

    const imageUrl =
      catalogueImageUrl(body.imageUrl);

    if (imageUrl === false) {
      return NextResponse.json(
        {
          success: false,
          message:
            "رابط الصورة غير صالح. ارفع صورة أو استخدم رابط https.",
        },
        { status: 400 }
      );
    }

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
          renewalPrice: renewalPrice.value,
          durationMonths,
          durationUnit,
          durationLabel,
          description,
          specifications,
          notes,
          imageUrl,
          isActive,
        }
      );

    /*
     * Save its lengths: the ones sent, or one made from the package's own
     * price and duration (older clients send no options).
     */
    const lengths =
      parsedOptions?.ok
        ? parsedOptions.options
        : [{ durationMonths, durationUnit, durationLabel, price, renewalPrice: renewalPrice.value, isActive: true }];

    for (const option of lengths) {
      await db.orm.public.PackageOption.create({
        packageId: created.id,
        durationMonths: option.durationMonths,
        durationUnit: option.durationUnit,
        durationLabel: option.durationLabel,
        price: option.price,
        renewalPrice: option.renewalPrice,
        pointsEarned: "pointsEarned" in option ? (option.pointsEarned ?? null) : null,
        creditCostCents: "creditCostCents" in option ? (option.creditCostCents ?? null) : null,
        isActive: option.isActive,
      });
    }

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

    await auditCatalogue({
      actor: { id: admin.user.id, role: admin.user.role },
      entityType: "PACKAGE",
      entityId: created.id,
      action: "PACKAGE_CREATED",
      summary: `Package created: ${name} (${serviceType}, ${price} IQD)`,
      changes: [
        `lengths: ${lengths.map(describeOption).join("; ")}`,
        ...(deviceIds.length ? [`devices: ${deviceIds.join(", ")}`] : []),
      ],
    });

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