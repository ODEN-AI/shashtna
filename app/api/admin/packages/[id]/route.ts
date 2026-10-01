import { NextResponse } from "next/server";
import { catalogueImageUrl, describeChanges, describeLinks, isValidPrice } from "@/src/lib/catalogue";
import { requireAdmin } from "@/src/lib/session";
import { auditCatalogue, packageReferences } from "@/src/server/catalogue";
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

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
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

export async function PATCH(
  request: Request,
  context: RouteContext
) {
  try {
    const admin = await requireAdmin(request, "catalogue");

    if (!admin.ok) {
      return admin.response;
    }

    await ensureDatabaseConnection();

    const { id } =
      await context.params;

    const packageId =
      Number(id);

    if (
      !Number.isInteger(
        packageId
      ) ||
      packageId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "معرّف الباقة غير صحيح.",
        },
        { status: 400 }
      );
    }

    const existing =
      await db.orm.public.Package.first(
        {
          id: packageId,
        }
      );

    if (!existing) {
      return NextResponse.json(
        {
          success: false,
          message:
            "الباقة غير موجودة.",
        },
        { status: 404 }
      );
    }

    const body =
      (await request.json()) as PackageBody;

    const updateData: Record<
      string,
      unknown
    > = {};

    let serviceType: ServiceType =
      normalizeServiceType(
        existing.serviceType
      );

    if (
      typeof body.serviceType ===
      "string"
    ) {
      serviceType =
        normalizeServiceType(
          body.serviceType
        );

      updateData.serviceType =
        serviceType;
    }

    if (
      typeof body.name ===
      "string"
    ) {
      const value =
        body.name.trim();

      if (!value) {
        return NextResponse.json(
          {
            success: false,
            message:
              "اسم الباقة مطلوب.",
          },
          { status: 400 }
        );
      }

      updateData.name =
        value;
    }

    if (
      typeof body.slug ===
      "string"
    ) {
      const value =
        body.slug
          .trim()
          .toLowerCase();

      if (!value) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Slug الباقة مطلوب.",
          },
          { status: 400 }
        );
      }

      const sameSlug =
        await db.orm.public.Package.first(
          {
            slug: value,
          }
        );

      if (
        sameSlug &&
        sameSlug.id !== packageId
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "هذا الـ Slug مستخدم من باقة أخرى.",
          },
          { status: 409 }
        );
      }

      // Orders reference their package by slug (planSlug): renaming it would
      // orphan their history, so it is only allowed while nothing uses it.
      if (
        value !== existing.slug &&
        (await packageReferences(existing)).orders > 0
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "لا يمكن تغيير الـ Slug لأن طلبات سابقة مرتبطة بهذه الباقة.",
          },
          { status: 409 }
        );
      }

      updateData.slug =
        value;
    }

    if (body.price !== undefined) {
      // Whole dinars only: a fraction or a string is rejected, not ignored.
      if (!isValidPrice(body.price)) {
        return NextResponse.json(
          {
            success: false,
            message:
              "السعر غير صحيح.",
          },
          { status: 400 }
        );
      }

      updateData.price =
        body.price;
    }

    if (
      serviceType === "VIP"
    ) {
      updateData.durationMonths =
        3;

      updateData.durationLabel =
        "3 Months";
    } else {
      if (
        typeof body.durationMonths ===
        "number"
      ) {
        if (
          !Number.isInteger(
            body.durationMonths
          ) ||
          body.durationMonths <=
            0
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

        updateData.durationMonths =
          body.durationMonths;
      }

      if (
        typeof body.durationLabel ===
        "string"
      ) {
        updateData.durationLabel =
          body.durationLabel.trim();
      }
    }

    if (
      typeof body.description ===
      "string"
    ) {
      updateData.description =
        body.description.trim();
    }

    if (
      typeof body.specifications ===
      "string"
    ) {
      updateData.specifications =
        body.specifications.trim();
    }

    if (
      body.notes === null ||
      typeof body.notes ===
        "string"
    ) {
      updateData.notes =
        body.notes === null
          ? null
          : body.notes.trim() ||
            null;
    }

    if (body.imageUrl !== undefined) {
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

      updateData.imageUrl =
        imageUrl;
    }

    if (
      typeof body.isActive ===
      "boolean"
    ) {
      updateData.isActive =
        body.isActive;
    }

    /*
     * Handle package/device relations
     * only when the client sends deviceIds.
     */
    const hasDeviceIds =
      Object.prototype.hasOwnProperty.call(
        body,
        "deviceIds"
      );

    const deviceIds =
      normalizeDeviceIds(
        body.deviceIds
      );

    if (
      hasDeviceIds &&
      deviceIds.length > 0
    ) {
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

    const linksBefore = (
      await db.orm.public.PackageDevice.where({ packageId }).select("deviceId").all()
    ).map((link) => link.deviceId);

    updateData.updatedAt =
      new Date().toISOString();

    const updated =
      await db.orm.public.Package
        .where({
          id: packageId,
        })
        .update(updateData);

    if (!updated) {
      return NextResponse.json(
        {
          success: false,
          message:
            "تعذر تحديث الباقة.",
        },
        { status: 500 }
      );
    }

    /*
     * Replace package/device relations
     * whenever deviceIds was sent.
     */
    if (hasDeviceIds) {
      // deleteAndCount removes every link; delete() would remove only the first.
      await db.orm.public.PackageDevice
        .where({
          packageId,
        })
        .deleteAndCount();

      for (const deviceId of deviceIds) {
        await db.orm.public.PackageDevice.create(
          {
            packageId,
            deviceId,
          }
        );
      }
    }

    await auditPackageUpdate({
      actor: { id: admin.user.id, role: admin.user.role },
      packageId,
      name: String(updateData.name ?? existing.name),
      before: existing,
      after: updateData,
      links: hasDeviceIds ? describeLinks(linksBefore, deviceIds) : null,
    });

    return NextResponse.json({
      success: true,
      message:
        "تم تحديث الباقة بنجاح.",
      package: updated,
    });
  } catch (error) {
    console.error(
      "Admin package PATCH error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "حدث خطأ أثناء تحديث الباقة.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  context: RouteContext
) {
  try {
    const admin = await requireAdmin(request, "catalogue");

    if (!admin.ok) {
      return admin.response;
    }

    await ensureDatabaseConnection();

    const { id } =
      await context.params;

    const packageId =
      Number(id);

    if (
      !Number.isInteger(
        packageId
      ) ||
      packageId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "معرّف الباقة غير صحيح.",
        },
        { status: 400 }
      );
    }

    const existing =
      await db.orm.public.Package.first(
        {
          id: packageId,
        }
      );

    if (!existing) {
      return NextResponse.json(
        {
          success: false,
          message:
            "الباقة غير موجودة.",
        },
        { status: 404 }
      );
    }

    /*
     * Deleting a package that orders or subscriptions reference would break
     * their history: those packages are deactivated instead.
     */
    const references =
      await packageReferences(existing);

    if (
      references.orders > 0 ||
      references.subscriptions > 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "لا يمكن حذف الباقة لأنها مرتبطة بطلبات أو اشتراكات. أوقفها بدل الحذف.",
          references,
        },
        { status: 409 }
      );
    }

    /*
     * Remove package/device relations
     * before deleting the package.
     */
    // Every link, not just the first (delete() removes a single row).
    await db.orm.public.PackageDevice
      .where({
        packageId,
      })
      .deleteAndCount();

    const deleted =
      await db.orm.public.Package
        .where({
          id: packageId,
        })
        .delete();

    if (!deleted) {
      return NextResponse.json(
        {
          success: false,
          message:
            "تعذر حذف الباقة.",
        },
        { status: 500 }
      );
    }

    await auditCatalogue({
      actor: { id: admin.user.id, role: admin.user.role },
      entityType: "PACKAGE",
      entityId: packageId,
      action: "PACKAGE_DELETED",
      summary: `Package deleted: ${existing.name} (unused by orders and subscriptions)`,
    });

    return NextResponse.json({
      success: true,
      message:
        "تم حذف الباقة.",
    });
  } catch (error) {
    console.error(
      "Admin package DELETE error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "حدث خطأ أثناء حذف الباقة.",
      },
      { status: 500 }
    );
  }
}
/**
 * One audit event per kind of change, so price, status, media and
 * compatibility changes are each findable in the audit log.
 */
async function auditPackageUpdate(input: {
  actor: { id: number; role?: string | null };
  packageId: number;
  name: string;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  links: ReturnType<typeof describeLinks> | null;
}) {
  const { actor, packageId, name, before, after, links } = input;
  const events: { action: string; summary: string; changes: string[] }[] = [];
  const price = describeChanges(before, after, ["price"]);
  const status = describeChanges(before, after, ["isActive"]);
  const media = describeChanges(before, after, ["imageUrl"]);
  const details = describeChanges(before, after, ["name", "slug", "serviceType", "durationMonths", "durationLabel", "description", "specifications", "notes"]);

  if (price.length) events.push({ action: "PACKAGE_PRICE_CHANGED", summary: `Price changed for ${name}: ${before.price} → ${after.price} IQD`, changes: price });
  if (status.length) events.push({ action: after.isActive ? "PACKAGE_ACTIVATED" : "PACKAGE_DEACTIVATED", summary: `Package ${after.isActive ? "activated" : "deactivated"}: ${name}`, changes: status });
  if (media.length) events.push({ action: "PACKAGE_MEDIA_CHANGED", summary: `Image changed for ${name}`, changes: media });
  if (links?.changed) events.push({ action: "PACKAGE_COMPATIBILITY_CHANGED", summary: `Compatible devices changed for ${name}`, changes: [`added: ${links.added.join(", ") || "—"}`, `removed: ${links.removed.join(", ") || "—"}`] });
  if (details.length) events.push({ action: "PACKAGE_UPDATED", summary: `Package edited: ${name}`, changes: details });

  for (const event of events) {
    await auditCatalogue({ actor, entityType: "PACKAGE", entityId: packageId, ...event });
  }
}
