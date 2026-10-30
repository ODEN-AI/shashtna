import { NextResponse } from "next/server";
import { catalogueImageUrl, describeChanges, describeLinks, isValidPrice, parseRenewalPrice } from "@/src/lib/catalogue";
import { requireAdmin } from "@/src/lib/session";
import { parsePackageOptions, type ParsedOption } from "@/src/lib/package-options";
import { durationValue, hasDurationFields, resolvePackageDuration } from "@/src/lib/subscription-duration";
import { auditCatalogue, packageReferences } from "@/src/server/catalogue";
import { deletePackageOptions, describeOption, packageOptions, savePackageOptions, syncDefaultOption } from "@/src/server/package-options";
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
  /** Lengths with their own prices; replaces the package's options when sent. */
  options?: unknown;
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

    /*
     * Lengths and prices. Sent as options (the catalogue form), they replace
     * the package's options and its price / duration columns follow the
     * default option. Sent the old way (price / duration on the package),
     * they apply to the default option.
     */
    const hasOptions =
      body.options !== undefined;

    let parsedOptions: ParsedOption[] | null = null;

    if (hasOptions) {
      const parsed =
        parsePackageOptions(body.options, serviceType);

      if (!parsed.ok) {
        return NextResponse.json(
          {
            success: false,
            message: parsed.error,
          },
          { status: 400 }
        );
      }

      parsedOptions = parsed.options;
    }

    if (!hasOptions && body.price !== undefined) {
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

    if (!hasOptions && body.renewalPrice !== undefined) {
      const renewalPrice =
        parseRenewalPrice(body.renewalPrice);

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

      updateData.renewalPrice =
        renewalPrice.value;
    }

    // Duration is only touched when the request carries it (a status toggle
    // leaves it alone); VIP stays on its fixed three months.
    if (
      !hasOptions &&
      (serviceType === "VIP" ||
        hasDurationFields(body))
    ) {
      const keepsLength =
        body.durationValue === undefined &&
        body.durationUnit === undefined &&
        body.durationMonths === undefined;
      const current =
        durationValue(existing.durationMonths, existing.durationUnit);
      const duration =
        resolvePackageDuration(
          keepsLength
            ? { durationValue: current.value, durationUnit: current.unit, durationLabel: body.durationLabel }
            : body,
          serviceType
        );

      if (!duration.ok) {
        return NextResponse.json(
          {
            success: false,
            message: duration.error,
          },
          { status: 400 }
        );
      }

      updateData.durationMonths =
        duration.durationMonths;
      updateData.durationUnit =
        duration.durationUnit;
      updateData.durationLabel =
        duration.durationLabel;
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

    /*
     * Options are saved first: if they are refused, nothing about the
     * package has changed yet.
     */
    let optionAudit: { before: string; after: string } | null = null;

    if (parsedOptions) {
      const saved =
        await savePackageOptions(packageId, parsedOptions);

      if (!saved.ok) {
        return NextResponse.json(
          {
            success: false,
            message: saved.error,
          },
          { status: saved.status }
        );
      }

      const live = (list: typeof saved.before) =>
        list.filter((option) => option.durationMonths > 0).map(describeOption).join("; ");

      optionAudit = { before: live(saved.before), after: live(saved.after) };
    } else if (
      updateData.price !== undefined ||
      updateData.renewalPrice !== undefined ||
      updateData.durationMonths !== undefined
    ) {
      const lengths = (await packageOptions(packageId)).filter((option) => option.durationMonths > 0 && option.isActive);

      // A VIP package sells one length only; the old edit path can't fold several into it.
      if (serviceType === "VIP" && lengths.length > 1) {
        return NextResponse.json(
          {
            success: false,
            message:
              "باقات VIP مدتها واحدة (3 أشهر). احذف المدد الزائدة من صفحة الباقة أولًا.",
          },
          { status: 409 }
        );
      }

      const synced =
        await syncDefaultOption(packageId, existing, {
          price: Number(updateData.price ?? existing.price),
          renewalPrice: (updateData.renewalPrice !== undefined ? updateData.renewalPrice : existing.renewalPrice) as number | null,
          durationMonths: Number(updateData.durationMonths ?? existing.durationMonths),
          durationUnit: String(updateData.durationUnit ?? existing.durationUnit),
          durationLabel: String(updateData.durationLabel ?? existing.durationLabel),
        });

      if (!synced.ok) {
        return NextResponse.json(
          {
            success: false,
            message: synced.error,
          },
          { status: synced.status }
        );
      }
    }

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
      options: optionAudit,
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

    // Its lengths go with it (no order references a package that can be deleted).
    await deletePackageOptions(packageId);

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
  options: { before: string; after: string } | null;
}) {
  const { actor, packageId, name, before, after, links, options } = input;
  const events: { action: string; summary: string; changes: string[] }[] = [];
  const price = describeChanges(before, after, ["price", "renewalPrice"]);
  const status = describeChanges(before, after, ["isActive"]);
  const media = describeChanges(before, after, ["imageUrl"]);
  const details = describeChanges(before, after, ["name", "slug", "serviceType", "durationMonths", "durationUnit", "durationLabel", "description", "specifications", "notes"]);

  if (price.length) events.push({ action: "PACKAGE_PRICE_CHANGED", summary: `Price changed for ${name}: ${price.join("; ")} IQD`, changes: price });
  if (status.length) events.push({ action: after.isActive ? "PACKAGE_ACTIVATED" : "PACKAGE_DEACTIVATED", summary: `Package ${after.isActive ? "activated" : "deactivated"}: ${name}`, changes: status });
  if (media.length) events.push({ action: "PACKAGE_MEDIA_CHANGED", summary: `Image changed for ${name}`, changes: media });
  if (options && options.before !== options.after) events.push({ action: "PACKAGE_OPTIONS_CHANGED", summary: `Lengths and prices changed for ${name}`, changes: [`before: ${options.before || "—"}`, `after: ${options.after || "—"}`] });
  if (links?.changed) events.push({ action: "PACKAGE_COMPATIBILITY_CHANGED", summary: `Compatible devices changed for ${name}`, changes: [`added: ${links.added.join(", ") || "—"}`, `removed: ${links.removed.join(", ") || "—"}`] });
  if (details.length) events.push({ action: "PACKAGE_UPDATED", summary: `Package edited: ${name}`, changes: details });

  for (const event of events) {
    await auditCatalogue({ actor, entityType: "PACKAGE", entityId: packageId, ...event });
  }
}
