import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/src/lib/session";
import { ensureDatabaseConnection, db } from "@/src/prisma/db";

type ServiceType = "IPTV" | "VIP";

type DevicePayload = {
  id?: number;
  name?: string;
  slug?: string;
  serviceType?: string;
  price?: number;
  description?: string;
  specifications?: string;
  notes?: string | null;
  imageUrl?: string | null;
  isActive?: boolean;
  packageIds?: number[];
};

function normalizeServiceType(value: unknown): ServiceType {
  return String(value ?? "IPTV").toUpperCase() === "VIP"
    ? "VIP"
    : "IPTV";
}

function normalizePackageIds(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return [
    ...new Set(
      value
        .map((item) => Number(item))
        .filter(
          (item) =>
            Number.isInteger(item) && item > 0
        )
    ),
  ];
}

function getDatabase(): any {
  return db as any;
}

export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);

    if (!admin.ok) {
      return admin.response;
    }

    await ensureDatabaseConnection();

    const database = getDatabase();

    const devices =
      await database.orm.public.Device.all();

    const packageDevices =
      await database.orm.public.PackageDevice.all();

    const packages =
      await database.orm.public.Package.all();

    const packagesMap = new Map<number, any>();

    for (const pkg of packages ?? []) {
      packagesMap.set(Number(pkg.id), pkg);
    }

    const relationsByDevice =
      new Map<number, any[]>();

    for (const relation of packageDevices ?? []) {
      const deviceId = Number(
        relation.deviceId
      );

      const packageId = Number(
        relation.packageId
      );

      const pkg = packagesMap.get(packageId);

      if (!pkg) {
        continue;
      }

      const current =
        relationsByDevice.get(deviceId) ?? [];

      current.push({
        id: pkg.id,
        name: pkg.name,
        slug: pkg.slug,
        serviceType: normalizeServiceType(
          pkg.serviceType
        ),
        price: pkg.price,
        durationMonths: pkg.durationMonths,
        durationLabel: pkg.durationLabel,
        isActive: pkg.isActive,
      });

      relationsByDevice.set(
        deviceId,
        current
      );
    }

    const normalizedDevices =
      (devices ?? []).map(
        (device: any) => ({
          id: device.id,
          name: device.name,
          slug: device.slug,
          serviceType:
            normalizeServiceType(
              device.serviceType
            ),
          price: device.price,
          description:
            device.description,
          specifications:
            device.specifications,
          notes:
            device.notes ?? null,
          imageUrl:
            device.imageUrl ?? null,
          isActive:
            device.isActive,
          createdAt:
            device.createdAt,
          updatedAt:
            device.updatedAt,
          packages:
            relationsByDevice.get(
              Number(device.id)
            ) ?? [],
        })
      );

    return NextResponse.json({
      success: true,
      devices: normalizedDevices,
    });
  } catch (error) {
    console.error(
      "GET /api/admin/devices error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message: "تعذر جلب الأجهزة",
        devices: [],
      },
      {
        status: 500,
      }
    );
  }
}

export async function POST(
  request: NextRequest
) {
  try {
    const admin = await requireAdmin(request);

    if (!admin.ok) {
      return admin.response;
    }

    await ensureDatabaseConnection();

    const database = getDatabase();

    const body =
      (await request.json()) as DevicePayload;

    const name = String(
      body.name ?? ""
    ).trim();

    const slug = String(
      body.slug ?? ""
    )
      .trim()
      .toLowerCase();

    const serviceType =
      normalizeServiceType(
        body.serviceType
      );

    const price = Number(
      body.price ?? 0
    );

    const description = String(
      body.description ?? ""
    ).trim();

    const specifications =
      String(
        body.specifications ?? ""
      ).trim();

    const notes =
      body.notes == null
        ? null
        : String(
            body.notes
          ).trim() || null;

    const imageUrl =
      body.imageUrl == null
        ? null
        : String(
            body.imageUrl
          ).trim() || null;

    const isActive =
      typeof body.isActive ===
      "boolean"
        ? body.isActive
        : true;

    const packageIds =
      normalizePackageIds(
        body.packageIds
      );

    if (!name) {
      return NextResponse.json(
        {
          success: false,
          message: "اسم الجهاز مطلوب",
        },
        {
          status: 400,
        }
      );
    }

    if (!slug) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Slug الجهاز مطلوب",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !Number.isInteger(price) ||
      price < 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "سعر الجهاز غير صحيح",
        },
        {
          status: 400,
        }
      );
    }

    if (!description) {
      return NextResponse.json(
        {
          success: false,
          message:
            "وصف الجهاز مطلوب",
        },
        {
          status: 400,
        }
      );
    }

    if (!specifications) {
      return NextResponse.json(
        {
          success: false,
          message:
            "مواصفات الجهاز مطلوبة",
        },
        {
          status: 400,
        }
      );
    }

    const existingDevices =
      await database.orm.public.Device.all();

    const duplicate =
      (existingDevices ?? []).find(
        (device: any) =>
          String(
            device.slug
          ).toLowerCase() ===
          slug
      );

    if (duplicate) {
      return NextResponse.json(
        {
          success: false,
          message:
            "يوجد جهاز آخر بنفس الـSlug",
        },
        {
          status: 409,
        }
      );
    }

    const allPackages =
      packageIds.length > 0
        ? await database.orm.public.Package.all()
        : [];

    const selectedPackages =
      (allPackages ?? []).filter(
        (pkg: any) =>
          packageIds.includes(
            Number(pkg.id)
          )
      );

    if (
      selectedPackages.length !==
      packageIds.length
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "واحدة أو أكثر من الباقات المحددة غير موجودة",
        },
        {
          status: 400,
        }
      );
    }

    const invalidPackage =
      selectedPackages.find(
        (pkg: any) =>
          normalizeServiceType(
            pkg.serviceType
          ) !== serviceType
      );

    if (invalidPackage) {
      return NextResponse.json(
        {
          success: false,
          message:
            "يجب أن تكون الباقات من نفس نوع خدمة الجهاز",
        },
        {
          status: 400,
        }
      );
    }

    const device =
      await database.orm.public.Device.create({
        name,
        slug,
        serviceType,
        price,
        description,
        specifications,
        notes,
        imageUrl,
        isActive,
      });

    for (const packageId of packageIds) {
      await database.orm.public.PackageDevice.create(
        {
          deviceId: device.id,
          packageId,
        }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message:
          "تمت إضافة الجهاز بنجاح",
        deviceId: device.id,
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error(
      "POST /api/admin/devices error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "تعذر إضافة الجهاز",
      },
      {
        status: 500,
      }
    );
  }
}

export async function PUT(
  request: NextRequest
) {
  try {
    const admin = await requireAdmin(request);

    if (!admin.ok) {
      return admin.response;
    }

    await ensureDatabaseConnection();

    const database = getDatabase();

    const body =
      (await request.json()) as DevicePayload;

    const id = Number(body.id);

    if (
      !Number.isInteger(id) ||
      id <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "معرف الجهاز غير صحيح",
        },
        {
          status: 400,
        }
      );
    }

    const currentDevice =
      await database.orm.public.Device.first({
        id,
      });

    if (!currentDevice) {
      return NextResponse.json(
        {
          success: false,
          message:
            "الجهاز غير موجود",
        },
        {
          status: 404,
        }
      );
    }

    const name = String(
      body.name ?? ""
    ).trim();

    const slug = String(
      body.slug ?? ""
    )
      .trim()
      .toLowerCase();

    const serviceType =
      normalizeServiceType(
        body.serviceType
      );

    const price = Number(
      body.price ?? 0
    );

    const description = String(
      body.description ?? ""
    ).trim();

    const specifications =
      String(
        body.specifications ?? ""
      ).trim();

    const notes =
      body.notes == null
        ? null
        : String(
            body.notes
          ).trim() || null;

    const imageUrl =
      body.imageUrl == null
        ? null
        : String(
            body.imageUrl
          ).trim() || null;

    const isActive =
      typeof body.isActive ===
      "boolean"
        ? body.isActive
        : currentDevice.isActive;

    const packageIds =
      normalizePackageIds(
        body.packageIds
      );

    if (!name) {
      return NextResponse.json(
        {
          success: false,
          message:
            "اسم الجهاز مطلوب",
        },
        {
          status: 400,
        }
      );
    }

    if (!slug) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Slug الجهاز مطلوب",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !Number.isInteger(price) ||
      price < 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "سعر الجهاز غير صحيح",
        },
        {
          status: 400,
        }
      );
    }

    if (!description) {
      return NextResponse.json(
        {
          success: false,
          message:
            "وصف الجهاز مطلوب",
        },
        {
          status: 400,
        }
      );
    }

    if (!specifications) {
      return NextResponse.json(
        {
          success: false,
          message:
            "مواصفات الجهاز مطلوبة",
        },
        {
          status: 400,
        }
      );
    }

    const allDevices =
      await database.orm.public.Device.all();

    const duplicate =
      (allDevices ?? []).find(
        (device: any) =>
          String(
            device.slug
          ).toLowerCase() ===
            slug &&
          Number(
            device.id
          ) !== id
      );

    if (duplicate) {
      return NextResponse.json(
        {
          success: false,
          message:
            "يوجد جهاز آخر بنفس الـSlug",
        },
        {
          status: 409,
        }
      );
    }

    const allPackages =
      packageIds.length > 0
        ? await database.orm.public.Package.all()
        : [];

    const selectedPackages =
      (allPackages ?? []).filter(
        (pkg: any) =>
          packageIds.includes(
            Number(pkg.id)
          )
      );

    if (
      selectedPackages.length !==
      packageIds.length
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "واحدة أو أكثر من الباقات المحددة غير موجودة",
        },
        {
          status: 400,
        }
      );
    }

    const invalidPackage =
      selectedPackages.find(
        (pkg: any) =>
          normalizeServiceType(
            pkg.serviceType
          ) !== serviceType
      );

    if (invalidPackage) {
      return NextResponse.json(
        {
          success: false,
          message:
            "يجب أن تكون الباقات من نفس نوع خدمة الجهاز",
        },
        {
          status: 400,
        }
      );
    }

    await database.orm.public.Device
      .where({ id })
      .update({
        name,
        slug,
        serviceType,
        price,
        description,
        specifications,
        notes,
        imageUrl,
        isActive,
      });

    const allRelations =
      await database.orm.public.PackageDevice.all();

    const deviceRelations =
      (allRelations ?? []).filter(
        (relation: any) =>
          Number(
            relation.deviceId
          ) === id
      );

    for (const relation of deviceRelations) {
      await database.orm.public.PackageDevice
        .where({
          id: relation.id,
        })
        .delete();
    }

    for (const packageId of packageIds) {
      await database.orm.public.PackageDevice.create(
        {
          deviceId: id,
          packageId,
        }
      );
    }

    return NextResponse.json({
      success: true,
      message:
        "تم تعديل الجهاز بنجاح",
      deviceId: id,
    });
  } catch (error) {
    console.error(
      "PUT /api/admin/devices error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "تعذر تعديل الجهاز",
      },
      {
        status: 500,
      }
    );
  }
}

export async function DELETE(
  request: NextRequest
) {
  try {
    const admin = await requireAdmin(request);

    if (!admin.ok) {
      return admin.response;
    }

    await ensureDatabaseConnection();

    const database = getDatabase();

    const body =
      await request.json();

    const id = Number(
      body?.id
    );

    if (
      !Number.isInteger(id) ||
      id <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "معرف الجهاز غير صحيح",
        },
        {
          status: 400,
        }
      );
    }

    const device =
      await database.orm.public.Device.first({
        id,
      });

    if (!device) {
      return NextResponse.json(
        {
          success: false,
          message:
            "الجهاز غير موجود",
        },
        {
          status: 404,
        }
      );
    }

    const allRelations =
      await database.orm.public.PackageDevice.all();

    const deviceRelations =
      (allRelations ?? []).filter(
        (relation: any) =>
          Number(
            relation.deviceId
          ) === id
      );

    for (const relation of deviceRelations) {
      await database.orm.public.PackageDevice
        .where({
          id: relation.id,
        })
        .delete();
    }

    await database.orm.public.Device
      .where({ id })
      .delete();

    return NextResponse.json({
      success: true,
      message:
        "تم حذف الجهاز بنجاح",
    });
  } catch (error) {
    console.error(
      "DELETE /api/admin/devices error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "تعذر حذف الجهاز",
      },
      {
        status: 500,
      }
    );
  }
}