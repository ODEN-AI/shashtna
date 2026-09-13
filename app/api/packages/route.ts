import { NextResponse } from "next/server";
import { db, ensureDatabaseConnection } from "@/src/prisma/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensureDatabaseConnection();

    const packages = await db.orm.public.Package.all();

    const activePackages = packages
      .filter((pkg) => pkg.isActive)
      .sort((a, b) => {
        if (a.price !== b.price) {
          return a.price - b.price;
        }

        return a.id - b.id;
      });

    return NextResponse.json(
      {
        success: true,
        packages: activePackages.map((pkg) => ({
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
        })),
      },
      {
        status: 200,
        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      }
    );
  } catch (error) {
    console.error("Public packages GET error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "تعذر تحميل الباقات.",
        packages: [],
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }
}