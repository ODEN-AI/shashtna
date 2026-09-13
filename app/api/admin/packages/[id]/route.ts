import { NextResponse } from "next/server";
import { db } from "@/src/prisma/db";

type PackageBody = {
  name?: string;
  slug?: string;
  price?: number;
  durationMonths?: number;
  durationLabel?: string;
  description?: string;
  specifications?: string;
  notes?: string | null;
  imageUrl?: string | null;
  isActive?: boolean;
};

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(
  request: Request,
  context: RouteContext
) {
  try {
    const { id } = await context.params;
    const packageId = Number(id);

    if (!Number.isInteger(packageId) || packageId <= 0) {
      return NextResponse.json(
        {
          success: false,
          message: "معرف الباقة غير صحيح.",
        },
        { status: 400 }
      );
    }

    const existing =
      await db.orm.public.Package.first({
        id: packageId,
      });

    if (!existing) {
      return NextResponse.json(
        {
          success: false,
          message: "الباقة غير موجودة.",
        },
        { status: 404 }
      );
    }

    const body = (await request.json()) as PackageBody;

    const updateData: Record<
      string,
      unknown
    > = {};

    if (typeof body.name === "string") {
      const value = body.name.trim();

      if (!value) {
        return NextResponse.json(
          {
            success: false,
            message: "اسم الباقة مطلوب.",
          },
          { status: 400 }
        );
      }

      updateData.name = value;
    }

    if (typeof body.slug === "string") {
      const value = body.slug.trim().toLowerCase();

      if (!value) {
        return NextResponse.json(
          {
            success: false,
            message: "Slug الباقة مطلوب.",
          },
          { status: 400 }
        );
      }

      const sameSlug =
        await db.orm.public.Package.first({
          slug: value,
        });

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

      updateData.slug = value;
    }

    if (typeof body.price === "number") {
      if (body.price < 0) {
        return NextResponse.json(
          {
            success: false,
            message: "السعر غير صحيح.",
          },
          { status: 400 }
        );
      }

      updateData.price = body.price;
    }

    if (
      typeof body.durationMonths ===
      "number"
    ) {
      if (body.durationMonths <= 0) {
        return NextResponse.json(
          {
            success: false,
            message: "مدة الاشتراك غير صحيحة.",
          },
          { status: 400 }
        );
      }

      updateData.durationMonths =
        body.durationMonths;
    }

    if (
      typeof body.durationLabel === "string"
    ) {
      updateData.durationLabel =
        body.durationLabel.trim();
    }

    if (
      typeof body.description === "string"
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
      typeof body.notes === "string"
    ) {
      updateData.notes =
        body.notes === null
          ? null
          : body.notes.trim() || null;
    }

    if (
      body.imageUrl === null ||
      typeof body.imageUrl === "string"
    ) {
      updateData.imageUrl =
        body.imageUrl === null
          ? null
          : body.imageUrl.trim() || null;
    }

    if (
      typeof body.isActive === "boolean"
    ) {
      updateData.isActive =
        body.isActive;
    }

    updateData.updatedAt = new Date().toISOString();

    const updated =
      await db.orm.public.Package.where({
        id: packageId,
      }).update(updateData);

    if (!updated) {
      return NextResponse.json(
        {
          success: false,
          message: "تعذر تحديث الباقة.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "تم تحديث الباقة بنجاح.",
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
        message: "حدث خطأ أثناء تحديث الباقة.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  context: RouteContext
) {
  try {
    const { id } = await context.params;
    const packageId = Number(id);

    if (!Number.isInteger(packageId) || packageId <= 0) {
      return NextResponse.json(
        {
          success: false,
          message: "معرف الباقة غير صحيح.",
        },
        { status: 400 }
      );
    }

    const existing =
      await db.orm.public.Package.first({
        id: packageId,
      });

    if (!existing) {
      return NextResponse.json(
        {
          success: false,
          message: "الباقة غير موجودة.",
        },
        { status: 404 }
      );
    }

    const deleted =
      await db.orm.public.Package
        .where({ id: packageId })
        .delete();

    if (!deleted) {
      return NextResponse.json(
        {
          success: false,
          message: "تعذر حذف الباقة.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "تم حذف الباقة.",
    });
  } catch (error) {
    console.error(
      "Admin package DELETE error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message: "حدث خطأ أثناء حذف الباقة.",
      },
      { status: 500 }
    );
  }
}