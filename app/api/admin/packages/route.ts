import { NextResponse } from "next/server";
import { db, ensureDatabaseConnection } from "@/src/prisma/db";

export const dynamic = "force-dynamic";

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

export async function GET() {
  try {
    await ensureDatabaseConnection();

    const packages = await db.orm.public.Package.all();

    packages.sort((a, b) => {
      if (a.price !== b.price) {
        return a.price - b.price;
      }

      return a.id - b.id;
    });

    return NextResponse.json({
      success: true,
      packages: packages.map((pkg) => ({
        id: pkg.id,
        name: pkg.name,
        slug: pkg.slug,
        price: pkg.price,
        durationMonths: pkg.durationMonths,
        durationLabel: pkg.durationLabel,
        description: pkg.description,
        specifications: pkg.specifications,
        notes: pkg.notes,
        imageUrl: pkg.imageUrl,
        isActive: pkg.isActive,
        createdAt: pkg.createdAt,
        updatedAt: pkg.updatedAt,
      })),
    });
  } catch (error) {
    console.error("Admin packages GET error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "تعذر تحميل الباقات.",
        packages: [],
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    await ensureDatabaseConnection();

    const body = (await request.json()) as PackageBody;

    const name = body.name?.trim();
    const slug = body.slug?.trim().toLowerCase();

    const price = body.price;
    const durationMonths = body.durationMonths;

    if (!name || !slug) {
      return NextResponse.json(
        {
          success: false,
          message: "اسم الباقة والـ Slug مطلوبان.",
        },
        { status: 400 }
      );
    }

    if (
      typeof price !== "number" ||
      !Number.isFinite(price) ||
      price < 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "السعر غير صحيح.",
        },
        { status: 400 }
      );
    }

    if (
      typeof durationMonths !== "number" ||
      !Number.isInteger(durationMonths) ||
      durationMonths <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "مدة الاشتراك غير صحيحة.",
        },
        { status: 400 }
      );
    }

    const durationLabel =
      body.durationLabel?.trim() ||
      `${durationMonths} Months`;

    const description =
      body.description?.trim() ||
      `اشتراك ${name}`;

    const specifications =
      body.specifications?.trim() ||
      `اشتراك لمدة ${durationMonths} شهر`;

    const notes =
      body.notes?.trim() || null;

    const imageUrl =
      body.imageUrl?.trim() || null;

    const isActive =
      typeof body.isActive === "boolean"
        ? body.isActive
        : true;

    const existing =
      await db.orm.public.Package.first({
        slug,
      });

    if (existing) {
      return NextResponse.json(
        {
          success: false,
          message: "هذا الـ Slug مستخدم مسبقًا.",
        },
        { status: 409 }
      );
    }

    const created =
      await db.orm.public.Package.create({
        name,
        slug,
        price,
        durationMonths,
        durationLabel,
        description,
        specifications,
        notes,
        imageUrl,
        isActive,
      });

    return NextResponse.json(
      {
        success: true,
        message: "تم إنشاء الباقة بنجاح.",
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
        message: "حدث خطأ أثناء إنشاء الباقة.",
      },
      { status: 500 }
    );
  }
}