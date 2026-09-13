import { NextResponse } from "next/server";
import { db } from "@/src/prisma/db";

export async function GET() {
  try {
    const packages =
      await db.orm.public.Package.all();

    const activePackages = packages
      .filter((pkg) => pkg.isActive)
      .sort(
        (a, b) =>
          a.price - b.price ||
          a.id - b.id
      );

    return NextResponse.json({
      success: true,
      packages: activePackages.map(
        (pkg) => ({
          id: pkg.id,
          name: pkg.name,
          slug: pkg.slug,
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
        })
      ),
    });
  } catch (error) {
    console.error(
      "Public packages error:",
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