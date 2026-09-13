import { NextResponse } from "next/server";
import {
  db,
  ensureDatabaseConnection,
} from "@/src/prisma/db";

export const dynamic = "force-dynamic";

type PopularPackage = {
  id: number;
  name: string;
  slug: string;
  price: number;
  durationMonths: number;
  durationLabel: string;
  description: string;
  specifications: string;
  notes: string | null;
  imageUrl: string | null;
  isActive: boolean;
  salesCount: number;
};

export async function GET() {
  try {
    await ensureDatabaseConnection();

    const packages =
      await db.orm.public.Package.all();

    const subscriptions =
      await db.orm.public.Subscription.all();

    const salesByPackageName =
      new Map<string, number>();

    for (const subscription of subscriptions) {
      const status =
        subscription.status?.toUpperCase();

      if (status === "CANCELLED") {
        continue;
      }

      const packageName =
        subscription.packageName?.trim();

      if (!packageName) {
        continue;
      }

      salesByPackageName.set(
        packageName,
        (salesByPackageName.get(
          packageName
        ) ?? 0) + 1
      );
    }

    const activePackages =
      packages
        .filter(
          (pkg) => pkg.isActive === true
        )
        .map(
          (pkg): PopularPackage => ({
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
            salesCount:
              salesByPackageName.get(
                pkg.name.trim()
              ) ?? 0,
          })
        )
        .sort((a, b) => {
          if (b.salesCount !== a.salesCount) {
            return (
              b.salesCount -
              a.salesCount
            );
          }

          if (a.price !== b.price) {
            return a.price - b.price;
          }

          return a.id - b.id;
        });

    return NextResponse.json(
      {
        success: true,
        packages:
          activePackages.slice(0, 3),
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
    console.error(
      "Popular packages error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "تعذر تحميل الباقات الأكثر مبيعًا.",
        packages: [],
      },
      {
        status: 500,
        headers: {
          "Cache-Control":
            "no-store",
        },
      }
    );
  }
}